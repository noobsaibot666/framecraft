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
