import { getApiKey } from "@/lib/aiConfig";
import type { AIModel } from "@/lib/aiConfig";

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

export async function analyzeImage(
  base64: string,
  mimeType: string,
  model: AIModel
): Promise<AnalysisResult> {
  const apiKey = getApiKey(model.provider);
  if (!apiKey) throw new Error(`No API key configured for ${model.provider}. Add it in Settings.`);

  let text: string;

  if (model.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 1536,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `Anthropic API error ${res.status}`);
    }
    const data = await res.json() as { content: { type: string; text: string }[] };
    text = data.content.find((c) => c.type === "text")?.text ?? "";

  } else {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        max_tokens: 1536,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(err?.error?.message ?? `OpenAI API error ${res.status}`);
    }
    const data = await res.json() as { choices: { message: { content: string } }[] };
    text = data.choices[0]?.message?.content ?? "";
  }

  const clean = text.replace(/^```[a-z]*\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(clean) as AnalysisResult;
}
