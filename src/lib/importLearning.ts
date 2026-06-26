export interface ImportLearningSignal {
  tags: string[];
  avoidanceText?: string;
  reusableTokens: string[];
  parameterLabels: string[];
}

const TAG_KEYWORD_MAP: Record<string, string[]> = {
  portrait: ["portrait", "person", "face", "model", "skin", "eyes"],
  product: ["product", "packshot", "still life", "bottle", "cosmetics", "object", "perfume"],
  fashion: ["fashion", "clothing", "outfit", "garment", "luxury wear"],
  advertising: ["ad", "campaign", "brand", "commercial", "hero"],
  automotive: ["car", "vehicle", "automobile", "road", "driving"],
  architecture: ["building", "interior", "architecture", "facade", "room"],
  editorial: ["editorial", "magazine", "lifestyle", "story"],
  cinematic: ["cinematic", "film", "dramatic", "rim light", "scene"],
};

const PARAM_PATTERNS: Array<[RegExp, string]> = [
  [/--ar\s+([\d:]+)/, "--ar"],
  [/--v(?:ersion)?\s+(\S+)/, "--v"],
  [/--s(?:tylize)?\s+(\d+)/, "--s"],
  [/--c(?:haos)?\s+(\d+)/, "--c"],
  [/--w(?:eird)?\s+(\d+)/, "--w"],
  [/--q(?:uality)?\s+(\S+)/, "--q"],
  [/--style\s+(\S+)/, "--style"],
  [/--seed\s+(\d+)/, "--seed"],
  [/--sref(?:\s+([^\s-]\S*))?/, "--sref"],
  [/--profile\s+(\S+)|--p\s+(\S+)/, "--profile"],
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stripPromptParams(text: string): string {
  return text
    .replace(/--no\s+.*?(?=\s--[a-zA-Z]|$)/gs, "")
    .replace(/--[a-zA-Z]+(?:\s+\S+)?/g, "")
    .replace(/-{1,2}exp(?!\w)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractReusableTokens(text: string): string[] {
  return unique(
    stripPromptParams(text)
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8 && part.split(/\s+/).length >= 2)
      .slice(0, 8)
  );
}

function extractParameterLabels(text: string): string[] {
  const labels: string[] = [];
  for (const [pattern, flag] of PARAM_PATTERNS) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (match) labels.push(value ? `${flag} ${value}` : flag);
  }

  const no = text.match(/--no\s+(.*?)(?=\s--[a-zA-Z]|$)/s);
  if (no?.[1]?.trim()) labels.push(`--no ${no[1].trim()}`);
  return unique(labels);
}

export function analyzeImportedPromptLearning(text: string): ImportLearningSignal {
  const lower = stripPromptParams(text).toLowerCase();
  const tags = Object.entries(TAG_KEYWORD_MAP)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([tag]) => tag);
  const no = text.match(/--no\s+(.*?)(?=\s--[a-zA-Z]|$)/s);
  const avoidanceText = no?.[1]?.trim() || undefined;

  return {
    tags: unique(tags),
    avoidanceText,
    reusableTokens: extractReusableTokens(text),
    parameterLabels: extractParameterLabels(text),
  };
}

export function buildImportLearningNotes(source: string | undefined, learning: ImportLearningSignal): string | undefined {
  const lines = [
    source?.trim() ? `Source: ${source.trim()}` : "",
    learning.tags.length ? `Learned tags: ${learning.tags.join(", ")}` : "",
    learning.reusableTokens.length ? `Reusable tokens: ${learning.reusableTokens.join("; ")}` : "",
    learning.avoidanceText ? `Avoidance: ${learning.avoidanceText}` : "",
    learning.parameterLabels.length ? `Detected parameters: ${learning.parameterLabels.join(", ")}` : "",
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : undefined;
}
