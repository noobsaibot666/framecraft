import { chatComplete } from "./aiClient";
import { pickAvailableModel } from "./aiConfig";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type AdviceFieldKey =
  | "subject" | "character" | "environment" | "composition" | "camera" | "lens" | "lighting" | "mood" | "realism" | "avoidance_text"
  // Provider-specific brief fields (doc 03): Nano Banana text/reference roles, video motion/transitions/audio.
  | "text_graphics" | "reference_role" | "motion" | "transitions" | "audio";

export interface FieldImprovement {
  field: AdviceFieldKey;
  label: string;
  value: string;
}

export interface PromptAdvice {
  suggestions: string[];
  risks: string[];
  improvements: FieldImprovement[];
}

export const EMPTY_ADVICE: PromptAdvice = { suggestions: [], risks: [], improvements: [] };

const VALID_FIELD_KEYS: AdviceFieldKey[] = ["subject", "character", "environment", "composition", "camera", "lens", "lighting", "mood", "realism", "avoidance_text", "text_graphics", "reference_role", "motion", "transitions", "audio"];

function buildSystemPrompt(brief?: string, provenTokens?: string[], formulaContext?: string, consistencyFactors?: string[]): string {
  const parts: string[] = [
    "You are an expert AI image prompt engineer for advertising-grade production.",
    "Analyze the draft prompt (and current field values when provided) specifically for these failure modes — only report ones you actually find, do not force every category:",
    `- visual hierarchy (no clear focal point / everything competing for attention)
- visual logic (elements that don't cohere into one coherent scene)
- prompt overload (too much crammed into one prompt)
- too many competing ideas / subjects
- unclear main subject
- conflicting style references (e.g. documentary realism + surreal CGI)
- conflicting camera instructions (e.g. macro + wide establishing shot)
- conflicting lighting (e.g. night + morning sunlight)
- overloaded exclusions (avoidance/negative list doing too much work)`,
    "",
    "Return ONLY a valid JSON object:",
    `{
  "suggestions": ["concrete actionable improvement (max 2 items, each starts with a verb)"],
  "risks": ["specific risk found from the failure-mode list above, or other AI-look/generic-phrasing risk (max 2 items)"],
  "improvements": [
    { "field": "subject|character|environment|composition|camera|lens|lighting|mood|realism|avoidance_text|text_graphics|reference_role|motion|transitions|audio", "label": "Subject|Character|Environment|Composition|Camera|Lens|Lighting|Mood|Realism|Avoidance|Text/Graphics|Reference role|Motion|Transitions|Audio", "value": "ready-to-use replacement text for that field only" }
  ]
}`,
    "",
    "improvements: 0–3 items max. Only include a field if you have a meaningful, specific improvement. Each value must be concise, directly applicable text for that single field. Do NOT repeat the full prompt in a value.",
    "Return only the JSON — no markdown fences, no preamble.",
  ];

  if (brief) {
    parts.push(`\nProject brief context:\n${brief}`);
  }
  if (provenTokens && provenTokens.length > 0) {
    parts.push(`\nProven high-quality tokens from this library: ${provenTokens.join(", ")}`);
  }
  if (formulaContext) {
    parts.push(`\n${formulaContext}`);
  }
  if (consistencyFactors && consistencyFactors.length > 0) {
    parts.push(`\nConsistency factors the user requires to stay stable across variations — never suggest changes that would alter them: ${consistencyFactors.join(", ")}`);
  }

  return parts.join("\n");
}

function parseAdvice(raw: string): PromptAdvice {
  try {
    const json = JSON.parse(raw.trim()) as Record<string, unknown>;
    const improvements: FieldImprovement[] = Array.isArray(json.improvements)
      ? (json.improvements as Record<string, string>[])
          .filter((imp) => VALID_FIELD_KEYS.includes(imp.field as AdviceFieldKey) && imp.value?.trim())
          .slice(0, 3)
          .map((imp) => ({ field: imp.field as AdviceFieldKey, label: imp.label || imp.field, value: imp.value.trim() }))
      : [];
    return {
      suggestions: Array.isArray(json.suggestions) ? (json.suggestions as string[]).slice(0, 2) : [],
      risks: Array.isArray(json.risks) ? (json.risks as string[]).slice(0, 2) : [],
      improvements,
    };
  } catch {
    return EMPTY_ADVICE;
  }
}

export function validatePromptForAnalysis(promptText: string): { valid: boolean; message?: string } {
  if (!promptText || promptText.trim().length < 20) {
    return { valid: false, message: "Add at least 20 characters to the prompt before analyzing." };
  }
  const model = typeof localStorage !== "undefined" ? pickAvailableModel() : undefined;
  if (!model) {
    return { valid: false, message: "Add an OpenAI or Anthropic API key in Settings to use Prompt Advisor." };
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

  const model = pickAvailableModel();
  if (!model) throw new Error("Add an OpenAI or Anthropic API key in Settings.");

  const rawText = await chatComplete(model, {
    system: VARIATIONS_SYSTEM,
    user: `Base prompt:\n${opts.promptText.trim()}`,
    maxTokens: 1024,
  });
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

  const model = pickAvailableModel();
  if (!model) throw new Error("Add an OpenAI or Anthropic API key in Settings.");

  const context = opts.existingTags?.length
    ? `Existing tags (do not repeat): ${opts.existingTags.join(", ")}\n`
    : "";

  const rawText = await chatComplete(model, {
    system: TAG_SUGGEST_SYSTEM,
    user: `${context}Draft prompt:\n${opts.promptText.trim()}`,
    maxTokens: 256,
  });
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
  fields?: Partial<Record<AdviceFieldKey, string>>;
  userDirection?: string;
  /** Provider success formula context line — see promptFormula.formatFormulaForAI. */
  formulaContext?: string;
  /** User-defined consistency factors that must remain stable. */
  consistencyFactors?: string[];
}): Promise<PromptAdvice> {
  if (!isTauri) return EMPTY_ADVICE;

  const model = pickAvailableModel();
  if (!model) throw new Error("Add an OpenAI or Anthropic API key in Settings.");

  const systemPrompt = buildSystemPrompt(opts.brief, opts.provenTokens, opts.formulaContext, opts.consistencyFactors);

  const fieldLines = opts.fields
    ? Object.entries(opts.fields)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const directionLine = opts.userDirection?.trim()
    ? `\n\nUser direction: ${opts.userDirection.trim()}`
    : "";

  const userMessage = fieldLines
    ? `Draft prompt:\n${opts.promptText.trim()}\n\nCurrent field values:\n${fieldLines}${directionLine}`
    : `Draft prompt:\n${opts.promptText.trim()}${directionLine}`;

  const rawText = await chatComplete(model, { system: systemPrompt, user: userMessage, maxTokens: 768 });
  return parseAdvice(rawText);
}
