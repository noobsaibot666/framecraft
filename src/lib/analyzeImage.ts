import { getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";
import { fetchProviderJson, requireValidApiKey } from "@/lib/aiClient";
import { parseAnalysisResult, parseDescribeResult } from "@/lib/aiResultParsers";
import type { DescribeResult } from "@/lib/aiResultParsers";

export interface AnalysisResult {
  title: string;
  suggested_prompt: string;
  variation_prompt: string;
  style_notes: string;
  elements: string[];
  ai_look_risks: string[];
  avoidance_suggestions: string[];
  tags: string[];
  aspect_ratio: string;
  quality_tier: string;
  provider: string;
}

export const ANALYSIS_PROMPT = `You are an expert AI prompt engineer for advertising-grade image production using Midjourney.
Analyze this image and return ONLY a valid JSON object (no markdown, no explanation) with exactly these fields:
{
  "title": "concise 4-8 word descriptive title for this prompt",
  "suggested_prompt": "complete Midjourney prompt to recreate this image — include subject, composition, lighting, color palette, visual style, mood, and any relevant camera or lens descriptors",
  "variation_prompt": "alternative Midjourney prompt for a different angle, crop, or stylistic interpretation of the same subject — must differ meaningfully from suggested_prompt",
  "style_notes": "2-3 sentences on the visual style, lighting approach, and production quality",
  "elements": ["key visual element 1", "element 2"],
  "ai_look_risks": ["specific AI artifact risk detected in this image — e.g. artificial bokeh depth", "another risk if present"],
  "avoidance_suggestions": ["avoidance token to add — e.g. avoid artificial glow", "avoid plastic skin texture", "avoid fake lens blur"],
  "tags": ["portrait", "advertising", "editorial"],
  "aspect_ratio": "16:9",
  "quality_tier": "commercial",
  "provider": "midjourney"
}
quality_tier must be one of: commercial, editorial, concept, reference.
ai_look_risks: list specific visual risks you detect in THIS image — things that look AI-generated, synthetic, or could cause prompt failures. Empty array if the image looks authentically photographic.
avoidance_suggestions: 2-4 short avoidance tokens to prepend or append to the prompt to prevent the detected risks. Start each with "avoid" or "no".
Return only the JSON object — no markdown fences, no preamble.`;

/** Send one image + instruction to a vision-capable model and return the raw text reply. */
export async function visionComplete(
  base64: string,
  mimeType: string,
  model: AIModel,
  prompt: string,
  maxTokens = 1536
): Promise<string> {
  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  if (model.provider === "anthropic") {
    const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(model.provider, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: maxTokens,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }

  const data = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(model.provider, "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model.id,
      max_tokens: maxTokens,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  return data.choices[0]?.message?.content ?? "";
}

export async function analyzeImage(
  base64: string,
  mimeType: string,
  model: AIModel
): Promise<AnalysisResult> {
  const text = await visionComplete(base64, mimeType, model, ANALYSIS_PROMPT);
  return parseAnalysisResult(text);
}

// ─── Reverse-engineering description (Prompt Craft's Image Description AI) ──
// Distinct from ANALYSIS_PROMPT above: this is not a superficial caption but
// a prompt-engineer's dissection of the image, plus a structured element
// breakdown that describeFormula.ts reformats into any provider's success
// formula client-side (no extra vision call needed when the user switches
// provider in the builder).
export const DESCRIBE_PROMPT_BASE = `You are an expert AI prompt engineer reverse-engineering this image so someone could recreate it with an image-generation model.
Do not write a superficial caption. Dissect it like a finished prompt: name the exact subject, environment, composition, lighting setup, camera/lens language, material and texture realism, color grade and mood, and stylistic influences you see evidence of in the image.

Return ONLY a valid JSON object (no markdown, no explanation) with exactly these fields:
{
  "description": "4-8 sentences of accurate, prompt-engineering-grade reverse-engineered description of exactly what is visible — subject, composition, lighting, camera/lens, materials, color grade, mood, and style. Written as prose explaining how this image could be recreated, not a generic caption.",
  "elements": {
    "subject": "the main subject(s), described precisely",
    "environment": "setting / background / world the subject sits in",
    "composition": "framing, angle, rule of thirds, crop, negative space",
    "light": "lighting setup — direction, quality, source, time of day",
    "material_realism": "textures and material qualities visible (skin, fabric, surfaces, grain)",
    "mood": "color grade, tone, atmosphere, emotional quality",
    "camera_language": "camera angle, lens type, depth of field, focal length feel",
    "style": "artistic/photographic style or visual influences evident",
    "image_type": "photograph / illustration / 3D render / product shot / editorial, etc.",
    "intent": "the likely creative or commercial intent behind this image",
    "action": "what the subject is doing, if anything — empty string if static",
    "text_graphics": "any in-image text, typography, or graphic elements — empty string if none",
    "references": "visual influences or reference styles this resembles — empty string if none obvious",
    "consistency": "elements that would need to stay consistent across variations of this image — empty string if not applicable",
    "quality_tags": "quality/production descriptors evident (e.g. commercial polish, editorial grain)",
    "exclusions": "artifacts or qualities to explicitly avoid when recreating this (e.g. avoid plastic skin, avoid AI blur)",
    "moment": "the specific instant captured — decisive moment, time of day, motion blur if any"
  }
}
Every "elements" value must be a short, precise phrase (under 20 words), not a sentence. Use "" only when genuinely absent from the image — never invent detail that isn't visible. Return only the JSON object — no markdown fences, no preamble.`;

export function buildDescribePrompt(question: string): string {
  const trimmed = question.trim();
  return trimmed
    ? `${DESCRIBE_PROMPT_BASE}\n\nThe user also wants special attention paid to this in "description": ${trimmed}`
    : DESCRIBE_PROMPT_BASE;
}

export async function describeImageForFormula(
  base64: string,
  mimeType: string,
  model: AIModel,
  question: string
): Promise<DescribeResult> {
  const text = await visionComplete(base64, mimeType, model, buildDescribePrompt(question), 2048);
  return parseDescribeResult(text);
}
