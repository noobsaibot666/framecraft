import { fetchProviderJson, requireValidApiKey } from "./aiClient";
import { getApiKey, type AIModel } from "./aiConfig";
import { parseBriefResult, type BriefResult } from "./aiResultParsers";

export const BRIEF_ANALYSIS_PROMPT = `You are an expert creative director and Midjourney prompt engineer for advertising-grade production.

Analyze the creative brief and return ONLY a valid JSON object (no markdown, no explanation):
{
  "summary": "2-3 sentence summary of the brief's core ask and objective",
  "production_goal": "one sentence — what this campaign must achieve visually",
  "creative_direction": "overall visual direction and aesthetic approach",
  "tone": "tone descriptor (e.g. luxury minimal, bold editorial, warm lifestyle)",
  "key_elements": ["core visual element 1", "element 2"],
  "required_deliverables": ["hero key visual", "lifestyle context shot", "detail close-up"],
  "key_constraints": ["brand rule or restriction 1", "constraint 2"],
  "risk_areas": ["specific visual risk for this category — e.g. product reflections may look synthetic", "another risk if present"],
  "prompts": [
    {
      "title": "descriptive 3-6 word title",
      "prompt": "complete Midjourney-ready prompt with style, lighting, composition, and --ar parameter",
      "use_case": "what this shot serves in the campaign",
      "tags": ["category", "style"],
      "aspect_ratio": "16:9"
    }
  ],
  "suggested_recipes": [
    {
      "title": "Recipe name (3-5 words)",
      "description": "one sentence on what this recipe produces and when to use it",
      "token_sequence": ["subject token", "environment token", "lighting token", "camera token", "style token", "--ar 16:9"]
    }
  ]
}

required_deliverables: list what the campaign actually needs as distinct shots (not creative concepts — concrete deliverables like "hero pack shot", "talent lifestyle", "texture detail").
key_constraints: brand rules, legal restrictions, or production limits from the brief. Empty array if none stated.
risk_areas: what could go wrong visually for this specific brief — AI-look risks, category-specific production traps. 2-3 items maximum.
suggested_recipes: 1-2 reusable prompt structures for this campaign type. token_sequence is an ordered list of prompt tokens, not a full sentence.
Generate 4-5 distinct prompt variations covering: hero/key visual, lifestyle/context, detail close-up, alternative angle. Every prompt must be immediately usable in Midjourney.
Return only the JSON — no markdown fences, no preamble.`;

export type BriefContent =
  | { type: "text"; text: string }
  | { type: "pdf"; base64: string };

export function validateBriefContent(content: BriefContent): { valid: boolean; message?: string } {
  if (content.type === "text" && content.text.trim().length === 0) {
    return { valid: false, message: "Paste brief text or attach a PDF before analyzing." };
  }
  if (content.type === "pdf" && content.base64.trim().length === 0) {
    return { valid: false, message: "Attach a readable PDF before analyzing." };
  }
  return { valid: true };
}

export async function analyzeBrief(content: BriefContent, model: AIModel): Promise<BriefResult> {
  const contentValidation = validateBriefContent(content);
  if (!contentValidation.valid) throw new Error(contentValidation.message);

  if (content.type === "pdf" && model.provider === "openai") {
    throw new Error("PDF upload requires an Anthropic model. Paste the brief as text to use OpenAI.");
  }

  const apiKey = getApiKey(model.provider);
  requireValidApiKey(model.provider, apiKey);

  let rawText: string;

  if (model.provider === "anthropic") {
    const userContent =
      content.type === "pdf"
        ? [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: content.base64 } },
            { type: "text", text: BRIEF_ANALYSIS_PROMPT },
          ]
        : [{ type: "text", text: `BRIEF:\n${content.text}\n\n${BRIEF_ANALYSIS_PROMPT}` }];

    const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
      model.provider,
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 3072,
          messages: [{ role: "user", content: userContent }],
        }),
      }
    );
    rawText = data.content.find((c) => c.type === "text")?.text ?? "";
  } else {
    const text = content.type === "text" ? content.text : "";
    const data = await fetchProviderJson<{ choices: { message: { content: string } }[] }>(
      model.provider,
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 3072,
          messages: [{ role: "user", content: `BRIEF:\n${text}\n\n${BRIEF_ANALYSIS_PROMPT}` }],
        }),
      }
    );
    rawText = data.choices[0]?.message?.content ?? "";
  }

  return parseBriefResult(rawText);
}
