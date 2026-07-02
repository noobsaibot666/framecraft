// Provider success formulas (V2 feedback §11) — the ordered structure that
// tends to win for each image/video generation model. Defaults ship per
// provider; users can edit per prompt, and imports refine the stored order.

import type { Provider } from "@/types";

const LEARNED_KEY = "framecraft_learned_formulas_v1";

const IMAGE_DEFAULT = [
  "Subject",
  "Environment",
  "Composition",
  "Light",
  "Material realism",
  "Mood",
  "Camera language",
  "Exclusions",
];

const VIDEO_DEFAULT = [
  "Subject",
  "Scene",
  "Motion",
  "Camera movement",
  "Light",
  "Mood",
  "Duration",
  "Exclusions",
];

export const DEFAULT_FORMULAS: Record<Provider, string[]> = {
  midjourney: [
    "Subject",
    "Environment",
    "Camera language",
    "Light",
    "Mood",
    "Material realism",
    "Style",
    "Parameters",
    "Exclusions",
  ],
  gpt_image: [
    "Subject",
    "Place",
    "Moment",
    "Composition",
    "Light",
    "Material realism",
    "Mood",
    "Camera language",
    "Exclusions",
  ],
  nano_banana: [
    "Subject",
    "Physical attributes",
    "Environment",
    "Light",
    "Camera language",
    "Mood",
    "Technical specs",
    "Exclusions",
  ],
  dalle: IMAGE_DEFAULT,
  stable_diffusion: [
    "Subject",
    "Environment",
    "Composition",
    "Light",
    "Style",
    "Quality tags",
    "Negative prompt",
  ],
  firefly: IMAGE_DEFAULT,
  ideogram: IMAGE_DEFAULT,
  flux: IMAGE_DEFAULT,
  seedance: VIDEO_DEFAULT,
  kling: VIDEO_DEFAULT,
  runway: VIDEO_DEFAULT,
  higgsfield: VIDEO_DEFAULT,
  other: IMAGE_DEFAULT,
};

type LearnedStore = Partial<Record<string, string[]>>;

function readLearned(): LearnedStore {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(LEARNED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LearnedStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLearned(store: LearnedStore): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LEARNED_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable — learned formulas are a soft enhancement
  }
}

/** Formula for a provider: learned order when imports have refined it, else the shipped default. */
export function getFormulaForProvider(provider: Provider): string[] {
  const learned = readLearned()[provider];
  if (learned && learned.length >= 3) return [...learned];
  return [...(DEFAULT_FORMULAS[provider] ?? IMAGE_DEFAULT)];
}

// ─── Learning from imports ────────────────────────────────────

interface StepSignal {
  step: string;
  keywords: string[];
}

const STEP_SIGNALS: StepSignal[] = [
  { step: "Subject", keywords: ["woman", "man", "person", "product", "bottle", "car", "portrait", "subject", "character"] },
  { step: "Place", keywords: ["studio", "forest", "city", "interior", "street", "beach", "room", "landscape"] },
  { step: "Environment", keywords: ["studio", "forest", "city", "interior", "street", "beach", "room", "landscape", "background"] },
  { step: "Moment", keywords: ["moment", "mid-", "during", "caught", "instant", "golden hour", "dawn", "dusk", "night"] },
  { step: "Composition", keywords: ["composition", "rule of thirds", "centered", "symmetry", "framing", "negative space", "crop"] },
  { step: "Light", keywords: ["light", "lighting", "backlit", "softbox", "shadows", "sunlight", "rim light"] },
  { step: "Material realism", keywords: ["texture", "skin", "fabric", "material", "grain", "imperfections", "pores"] },
  { step: "Mood", keywords: ["mood", "atmosphere", "cinematic", "intimate", "moody", "serene", "energetic", "tone"] },
  { step: "Camera language", keywords: ["camera", "lens", "mm", "angle", "close-up", "wide shot", "macro", "depth of field"] },
  { step: "Motion", keywords: ["motion", "running", "moving", "dolly", "tracking", "handheld", "pan", "sway"] },
  { step: "Exclusions", keywords: ["--no", "avoid", "no text", "without", "negative"] },
];

/**
 * Detect which formula steps a finished prompt covers, in the order they
 * first appear. Pure — used by import learning and by draft analysis.
 */
export function detectFormulaOrder(promptText: string): string[] {
  const lower = promptText.toLowerCase();
  const found: { step: string; index: number }[] = [];
  for (const signal of STEP_SIGNALS) {
    let earliest = -1;
    for (const kw of signal.keywords) {
      const at = lower.indexOf(kw);
      if (at >= 0 && (earliest < 0 || at < earliest)) earliest = at;
    }
    if (earliest >= 0 && !found.some((f) => f.step === signal.step)) {
      found.push({ step: signal.step, index: earliest });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.step);
}

/**
 * Learn from an imported prompt: when the import covers 3+ formula steps,
 * store its observed order as the provider's preferred formula. Returns the
 * learned order, or null when the prompt carried too little structure.
 */
export function learnFormulaFromImport(promptText: string, provider: Provider): string[] | null {
  if (!promptText.trim()) return null;
  const observed = detectFormulaOrder(promptText);
  if (observed.length < 3) return null;
  // Keep any default steps the import didn't demonstrate, appended in default order.
  const defaults = DEFAULT_FORMULAS[provider] ?? IMAGE_DEFAULT;
  const merged = [...observed, ...defaults.filter((s) => !observed.includes(s))];
  const store = readLearned();
  store[provider] = merged;
  writeLearned(store);
  return merged;
}

/** Which formula steps the current draft has not covered yet. */
export function missingFormulaSteps(promptText: string, formula: string[]): string[] {
  const covered = new Set(detectFormulaOrder(promptText));
  // "Place"/"Environment" overlap — treat either as covering the other.
  if (covered.has("Place")) covered.add("Environment");
  if (covered.has("Environment")) covered.add("Place");
  return formula.filter((step) => !covered.has(step));
}

/** One-line formula description for AI assistant / analysis context. */
export function formatFormulaForAI(formula: string[], provider: Provider): string {
  if (!formula.length) return "";
  return `Success formula for ${provider}: ${formula.join(" + ")}. Evaluate the draft against this structure and flag missing or weakly covered steps.`;
}
