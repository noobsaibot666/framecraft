import type { Provider } from "@/types";

export interface FormatRule {
  description: string;
  apply: (text: string, params?: Record<string, string>) => string;
}

export interface FormattedPrompt {
  text: string;
  changes: string[];
}

// Strip existing trailing MJ-style params (--word value or --word)
function stripMjParams(text: string): string {
  return text.replace(/\s+--\S+(?:\s+\S+)?/g, "").trim();
}

// Extract --param blocks from a prompt text
function extractMjParams(text: string): string {
  const matches = text.match(/--\S+(?:\s+\S+)?/g) ?? [];
  return matches.join(" ").trim();
}

// Remove commas, extra whitespace, parenthetical weight notation [word:weight]
function normalizeText(text: string): string {
  return text
    .replace(/\[([^\]]+):\d+(\.\d+)?\]/g, "$1") // remove Stable Diffusion weights
    .replace(/\s+/g, " ")
    .trim();
}

// Remove markdown, bold, headers
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

const PROVIDERS: Partial<Record<Provider, {
  label: string;
  hints: string[];
  format: (text: string) => FormattedPrompt;
}>> = {
  midjourney: {
    label: "Midjourney",
    hints: [
      "Parameters (--ar, --v, --style, etc.) must appear at the end",
      "Comma-separated descriptors work well",
      "Avoid markdown — use plain descriptive language",
    ],
    format: (text) => {
      const changes: string[] = [];
      let t = stripMarkdown(text);
      if (t !== text) changes.push("Stripped markdown formatting");

      // Move any params already in the middle to the end
      const params = extractMjParams(t);
      const body = stripMjParams(t);

      // Normalize whitespace and commas
      const clean = normalizeText(body);
      if (clean !== body) changes.push("Normalized whitespace");

      const final = params ? `${clean} ${params}` : clean;
      if (final !== text && !changes.length) changes.push("Reordered parameters to end");

      return { text: final, changes };
    },
  },

  dalle: {
    label: "DALL·E",
    hints: [
      "Describe in natural language sentences, not comma lists",
      "Avoid provider-specific params (--ar, --v) — use descriptions instead",
      "Be explicit about style: 'oil painting', 'photo-realistic', etc.",
    ],
    format: (text) => {
      const changes: string[] = [];
      let t = stripMarkdown(text);
      if (t !== text) changes.push("Stripped markdown");

      // Remove MJ params
      const cleaned = stripMjParams(t);
      if (cleaned !== t) changes.push("Removed Midjourney parameters (--ar, --v, etc.)");
      t = cleaned;

      // Remove SD weights
      const noWeights = t.replace(/\[([^\]]+):\d+(\.\d+)?\]/g, "$1");
      if (noWeights !== t) changes.push("Removed Stable Diffusion weight notation");
      t = noWeights;

      // Convert comma-list to sentence if looks like it
      const commaCount = (t.match(/,/g) ?? []).length;
      if (commaCount > 5) {
        changes.push("Note: Consider converting comma-list to descriptive sentences for DALL·E");
      }

      return { text: normalizeText(t), changes };
    },
  },

  stable_diffusion: {
    label: "Stable Diffusion",
    hints: [
      "Comma-separated token lists work well",
      "Use (word:weight) notation for emphasis, e.g. (cinematic:1.3)",
      "Start with quality tags: (masterpiece:1.4), best quality",
    ],
    format: (text) => {
      const changes: string[] = [];
      const t = stripMarkdown(text);
      if (t !== text) changes.push("Stripped markdown");
      // Remove MJ params
      const cleaned = stripMjParams(t);
      if (cleaned !== t) changes.push("Removed Midjourney parameters");
      return { text: normalizeText(cleaned), changes };
    },
  },

  flux: {
    label: "Flux",
    hints: [
      "Flux responds well to natural language descriptions",
      "Avoid Midjourney-specific parameters",
      "Detailed scene descriptions produce best results",
    ],
    format: (text) => {
      const changes: string[] = [];
      const t = stripMarkdown(text);
      if (t !== text) changes.push("Stripped markdown");
      const cleaned = stripMjParams(t);
      if (cleaned !== t) changes.push("Removed Midjourney parameters");
      return { text: normalizeText(cleaned), changes };
    },
  },
};

export function getProviderHints(provider: Provider): string[] {
  return PROVIDERS[provider]?.hints ?? [];
}

export function formatPromptForProvider(text: string, provider: Provider): FormattedPrompt {
  const p = PROVIDERS[provider];
  if (!p) return { text, changes: [] };
  return p.format(text);
}

export function getSupportedFormatterProviders(): Provider[] {
  return Object.keys(PROVIDERS) as Provider[];
}
