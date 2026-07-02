// Consistency Factors (V2 feedback §2) — elements that must remain stable
// across prompt variations. Pure, rule-based suggestion logic so it works
// without an API key and is fully testable.

/** Canonical factor labels offered as one-click presets. */
export const CONSISTENCY_FACTOR_PRESETS = [
  "character identity",
  "face",
  "clothing",
  "product shape",
  "object design",
  "environment",
  "brand elements",
  "color palette",
  "lighting direction",
  "camera language",
  "material accuracy",
] as const;

export type ConsistencyFactorPreset = (typeof CONSISTENCY_FACTOR_PRESETS)[number];

interface FactorRule {
  factor: ConsistencyFactorPreset;
  /** Case-insensitive substrings that signal the factor matters for this prompt. */
  keywords: string[];
}

const FACTOR_RULES: FactorRule[] = [
  {
    factor: "character identity",
    keywords: ["woman", "man", "person", "character", "model", "girl", "boy", "portrait", "athlete", "dancer", "chef", "worker"],
  },
  {
    factor: "face",
    keywords: ["face", "facial", "expression", "eyes", "smile", "close-up portrait", "headshot"],
  },
  {
    factor: "clothing",
    keywords: ["wearing", "dress", "jacket", "suit", "outfit", "clothing", "uniform", "shirt", "coat", "sportswear"],
  },
  {
    factor: "product shape",
    keywords: ["product", "bottle", "package", "packaging", "can ", "jar", "box", "device", "sneaker", "shoe", "watch", "phone"],
  },
  {
    factor: "object design",
    keywords: ["object", "furniture", "chair", "car", "vehicle", "machine", "tool", "instrument"],
  },
  {
    factor: "environment",
    keywords: ["studio", "forest", "city", "street", "interior", "landscape", "beach", "desert", "kitchen", "office", "background", "environment"],
  },
  {
    factor: "brand elements",
    keywords: ["brand", "logo", "identity", "campaign", "advertising", "packaging"],
  },
  {
    factor: "color palette",
    keywords: ["color", "palette", "tones", "monochrome", "teal", "amber", "pastel", "saturated", "muted"],
  },
  {
    factor: "lighting direction",
    keywords: ["lighting", "light", "backlit", "rim light", "golden hour", "shadows", "sunlight", "softbox"],
  },
  {
    factor: "camera language",
    keywords: ["camera", "lens", "angle", "shot", "close-up", "wide", "macro", "tracking", "dolly", "framing"],
  },
  {
    factor: "material accuracy",
    keywords: ["texture", "material", "skin", "fabric", "metal", "glass", "wood", "leather", "surface"],
  },
];

export interface SuggestFactorsInput {
  promptText?: string;
  projectDirection?: string;
  provider?: string;
  /** Factors already added by the user — never re-suggested. */
  existing?: string[];
}

/**
 * Rule-based consistency factor suggestions from the prompt draft and
 * project direction. Returns preset labels ordered by rule priority,
 * capped at 5 so the panel stays scannable.
 */
export function suggestConsistencyFactors(input: SuggestFactorsInput): ConsistencyFactorPreset[] {
  const haystack = [input.promptText ?? "", input.projectDirection ?? ""].join("\n").toLowerCase();
  if (!haystack.trim()) return [];
  const existingLower = new Set((input.existing ?? []).map((f) => f.trim().toLowerCase()));

  const suggested: ConsistencyFactorPreset[] = [];
  for (const rule of FACTOR_RULES) {
    if (existingLower.has(rule.factor)) continue;
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      suggested.push(rule.factor);
    }
  }
  return suggested.slice(0, 5);
}

/** Copy-ready suffix appended to a prompt so variations hold these elements stable. */
export function buildConsistencySuffix(factors: string[]): string {
  const cleaned = factors.map((f) => f.trim()).filter(Boolean);
  if (!cleaned.length) return "";
  return `Keep consistent across variations: ${cleaned.join(", ")}.`;
}
