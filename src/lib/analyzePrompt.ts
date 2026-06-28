import { fetchProviderJson, requireValidApiKey } from "./aiClient";
import { AI_KEY_ANTHROPIC, getApiKey, validateApiKey } from "./aiConfig";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface PromptAdvice {
  suggestions: string[];
  risks: string[];
}

export const EMPTY_ADVICE: PromptAdvice = { suggestions: [], risks: [] };

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

function buildSystemPrompt(brief?: string, provenTokens?: string[]): string {
  const parts: string[] = [
    "You are an expert AI image prompt engineer for advertising-grade production.",
    "Analyze the draft prompt and return ONLY a valid JSON object:",
    `{
  "suggestions": ["specific improvement (max 3 items)"],
  "risks": ["specific risk or issue (max 2 items)"]
}`,
    "",
    "suggestions: concrete, actionable improvements — add missing elements, improve specificity, suggest better ordering or phrasing. Each item starts with an action verb.",
    "risks: potential issues — generic phrasing, AI-look risks, conflicting instructions, missing critical parameters.",
    "Return only the JSON — no markdown fences, no preamble.",
  ];

  if (brief) {
    parts.push(`\nProject brief context:\n${brief}`);
  }
  if (provenTokens && provenTokens.length > 0) {
    parts.push(`\nProven high-quality tokens from this library: ${provenTokens.join(", ")}`);
  }

  return parts.join("\n");
}

function parseAdvice(raw: string): PromptAdvice {
  try {
    const json = JSON.parse(raw.trim()) as Partial<PromptAdvice>;
    return {
      suggestions: Array.isArray(json.suggestions) ? json.suggestions.slice(0, 3) : [],
      risks: Array.isArray(json.risks) ? json.risks.slice(0, 2) : [],
    };
  } catch {
    return EMPTY_ADVICE;
  }
}

export function validatePromptForAnalysis(promptText: string): { valid: boolean; message?: string } {
  if (!promptText || promptText.trim().length < 20) {
    return { valid: false, message: "Add at least 20 characters to the prompt before analyzing." };
  }
  const key = typeof localStorage !== "undefined" ? localStorage.getItem(AI_KEY_ANTHROPIC) ?? "" : "";
  const keyValid = validateApiKey("anthropic", key);
  if (!keyValid.valid) {
    return { valid: false, message: "Add an Anthropic API key in Settings to use Prompt Advisor." };
  }
  return { valid: true };
}

// ─── Prompt Variations ───────────────────────────────────────

export interface PromptVariations {
  variations: string[];
}

export const EMPTY_VARIATIONS: PromptVariations = { variations: [] };

const VARIATIONS_SYSTEM = `You are an expert AI image prompt engineer for advertising-grade production.
Given a base prompt, generate exactly 3 distinct variations.
Each variation should preserve the core subject and intent, but explore a different stylistic angle, mood, or technical approach. Keep each variation complete and ready-to-use.
Return ONLY a valid JSON object:
{
  "variations": [
    "variation 1 full prompt text",
    "variation 2 full prompt text",
    "variation 3 full prompt text"
  ]
}
Return only the JSON — no markdown fences, no preamble.`;

function parseVariations(raw: string): PromptVariations {
  try {
    const json = JSON.parse(raw.trim()) as Partial<PromptVariations>;
    return {
      variations: Array.isArray(json.variations) ? json.variations.slice(0, 3).map(String) : [],
    };
  } catch {
    return EMPTY_VARIATIONS;
  }
}

export async function generatePromptVariations(opts: { promptText: string }): Promise<PromptVariations> {
  if (!isTauri) return EMPTY_VARIATIONS;

  const apiKey = getApiKey("anthropic");
  requireValidApiKey("anthropic", apiKey);

  const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
    "anthropic",
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
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: VARIATIONS_SYSTEM,
        messages: [{ role: "user", content: `Base prompt:\n${opts.promptText.trim()}` }],
      }),
    }
  );

  const rawText = data.content.find((c) => c.type === "text")?.text ?? "";
  return parseVariations(rawText);
}

// ─── Tag Suggestions ─────────────────────────────────────────

export interface TagSuggestions {
  tags: string[];
}

const TAG_SUGGEST_SYSTEM = `You are an expert AI image prompt engineer.
Given a draft prompt and any existing tags, suggest 3-5 short new tags describing the prompt's category, style, subject, or mood.
Tags should be 1-2 words, lowercase, no punctuation.
Return ONLY a valid JSON object:
{
  "tags": ["tag1", "tag2", "tag3"]
}
Return only the JSON — no markdown fences, no preamble.`;

export async function generateTagSuggestions(opts: {
  promptText: string;
  existingTags?: string[];
}): Promise<TagSuggestions> {
  if (!isTauri) return { tags: [] };

  const apiKey = getApiKey("anthropic");
  requireValidApiKey("anthropic", apiKey);

  const context = opts.existingTags?.length
    ? `Existing tags (do not repeat): ${opts.existingTags.join(", ")}\n`
    : "";

  const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
    "anthropic",
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
        model: HAIKU_MODEL,
        max_tokens: 256,
        system: TAG_SUGGEST_SYSTEM,
        messages: [{ role: "user", content: `${context}Draft prompt:\n${opts.promptText.trim()}` }],
      }),
    }
  );

  const rawText = data.content.find((c) => c.type === "text")?.text ?? "";
  try {
    const json = JSON.parse(rawText.trim()) as Partial<TagSuggestions>;
    const existing = new Set(opts.existingTags ?? []);
    return {
      tags: Array.isArray(json.tags)
        ? json.tags.slice(0, 5).map(String).map((t) => t.toLowerCase().trim()).filter((t) => t && !existing.has(t))
        : [],
    };
  } catch {
    return { tags: [] };
  }
}

// ─── Prompt Analysis ─────────────────────────────────────────

export async function analyzePromptDraft(opts: {
  promptText: string;
  brief?: string;
  provenTokens?: string[];
}): Promise<PromptAdvice> {
  if (!isTauri) return EMPTY_ADVICE;

  const apiKey = getApiKey("anthropic");
  requireValidApiKey("anthropic", apiKey);

  const systemPrompt = buildSystemPrompt(opts.brief, opts.provenTokens);
  const userMessage = `Draft prompt:\n${opts.promptText.trim()}`;

  const data = await fetchProviderJson<{ content: { type: string; text: string }[] }>(
    "anthropic",
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
        model: HAIKU_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    }
  );

  const rawText = data.content.find((c) => c.type === "text")?.text ?? "";
  return parseAdvice(rawText);
}
