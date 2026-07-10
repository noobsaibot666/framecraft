// Provider success formulas (V2 feedback §11, review doc 03) — the ordered
// structure that tends to win for each image/video generation model. Defaults
// ship per provider; users can edit per prompt, and imports refine the stored
// order. Video providers (Seedance, Kling) get director-brief structures, not
// image-prompt structures.

import type { Provider } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
  // GPT Image: visual hierarchy — most important decisions first, large to small (doc 03 §2).
  gpt_image: [
    "Image type",
    "Subject",
    "Environment",
    "Composition",
    "Moment",
    "Light",
    "Style",
    "Material realism",
    "Color grade / Mood",
    "Camera language",
    "Exclusions",
  ],
  // Nano Banana Pro: reads like a creative brief, not a keyword list (doc 03 §3).
  nano_banana: [
    "Intent",
    "Subject",
    "Action",
    "Environment",
    "Composition",
    "Camera language",
    "Light",
    "Style",
    "Text / Graphics",
    "References",
    "Consistency",
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
  // Seedance: a short-film director's brief — Subject + Motion foundation,
  // then narrative, shots, transitions, continuity, audio (doc 03 §4).
  seedance: [
    "Intent",
    "Narrative format",
    "Theme",
    "Subject",
    "World / Setting",
    "Shots",
    "Transitions",
    "Camera language",
    "Motion logic",
    "Continuity",
    "Audio / Rhythm",
    "Style",
    "Exclusions",
  ],
  // Kling: compact scene direction — director plus cinematographer (doc 03 §5).
  // Order verified against Kling 3.0 guidance (2026): Scene → Characters →
  // Action → Camera → Audio & Style, with labeled shots and a continuity line.
  kling: [
    "Scene",
    "Scene description",
    // World / Setting = the real scene_world field (audit doc 05 §13) —
    // reuses the same step name Seedance already uses for the same concept.
    "World / Setting",
    "Subject",
    "Subject description",
    "Motion",
    // Real shot-by-shot editor (audit doc 05 §13).
    "Shots",
    "Camera language",
    "Transitions",
    "Light",
    "Atmosphere",
    "Continuity lock",
    "Audio / Dialogue",
    "Exclusions",
  ],
  runway: VIDEO_DEFAULT,
  higgsfield: VIDEO_DEFAULT,
  other: IMAGE_DEFAULT,
};

// ─── Provider prompting guidance ──────────────────────────────

const IMAGE_GUIDANCE =
  "Keep one dominant idea: one main subject, one clear environment, one visual language — then layer light, materials and mood from large to small.";
const VIDEO_GUIDANCE =
  "State subject and motion first, then scene, camera movement and lighting. Keep one continuous action per generation.";

/** Core prompting rule per provider (doc 03 "Core Logic" sections) — fed to the AI alongside the formula. */
export const PROVIDER_GUIDANCE: Record<Provider, string> = {
  midjourney:
    "Lead with the subject and the strongest visual decisions in short comma-separated clauses; move technical control into parameters (--ar, --s, --no) instead of prose.",
  gpt_image:
    "Order decisions by visual hierarchy — the most important image decisions first, then details from large to small. One dominant concept, one main subject, one clear environment, one visual language; do not mix competing ideas.",
  nano_banana:
    "Write like a creative brief, not a keyword list. State the intent first, then subject, action and environment. Name any in-image text or typography explicitly, and give references and consistency instructions their own lines.",
  dalle: IMAGE_GUIDANCE,
  stable_diffusion:
    "Front-load the subject and style tags, keep quality boosters minimal, and put everything unwanted in the negative prompt rather than the main prompt.",
  firefly: IMAGE_GUIDANCE,
  ideogram: IMAGE_GUIDANCE,
  flux: IMAGE_GUIDANCE,
  seedance:
    "Prompt like a short-film director's brief, not an image prompt. The foundation is Subject + Motion; build up with a narrative format, shot-by-shot structure, transitions, motion logic, continuity rules and audio rhythm. Describe camera movement separately from subject movement, one clear action per shot.",
  kling:
    "Write compact scene direction, not one giant beautiful paragraph. Think director plus cinematographer: story intention, continuity lock, spatial logic, shot order, camera movement, transitions, lighting, audio, negative constraints. For multi-shot prompts label shots (Shot 1, Shot 2, up to 6), restate continuity anchors in one 'Continuity:' line, and label dialogue per speaker with a tone cue.",
  runway: VIDEO_GUIDANCE,
  higgsfield: VIDEO_GUIDANCE,
  other: IMAGE_GUIDANCE,
};

/** Classical narrative formats for video director-brief prompts (doc 03 §4). */
export const NARRATIVE_FORMATS: { value: string; label: string; arc: string }[] = [
  { value: "brand", label: "Brand film / spec ad", arc: "Tension → Transformation → Payoff" },
  { value: "cinematic", label: "Cinematic storytelling", arc: "Setup → Disruption → Resolution" },
  { value: "fashion", label: "Fashion / mood film", arc: "Arrival → Presence → Iconic final image" },
  { value: "documentary", label: "Documentary-style", arc: "Observation → Detail → Human meaning" },
  { value: "surreal", label: "Surreal / poetic", arc: "Reality → Distortion → Revelation" },
  { value: "product", label: "Product film", arc: "Object introduction → Sensory interaction → Hero reveal" },
];

export function getNarrativeArc(value: string): string {
  return NARRATIVE_FORMATS.find((f) => f.value === value)?.arc ?? "";
}

type LearnedStore = Partial<Record<string, string[]>>;

// In-memory cache — authoritative for the synchronous getFormulaForProvider()
// API every call site relies on. Backed by the per-library `learned_formulas`
// table (migration 035) instead of localStorage, so learned formulas travel
// with the portable library like everything else in the app — previously
// this was the one subsystem whose learned data lived outside any library.
// Dev/test mode (no Tauri) has nothing to hydrate and stays purely in-memory,
// matching every other lib file's isTauri guard pattern.
const cache: LearnedStore = {};
let hydrated = !isTauri;
let hydratePromise: Promise<void> | null = null;

function ensureHydrated(): void {
  if (hydrated || hydratePromise) return;
  hydratePromise = (async () => {
    try {
      const db = await getFramecraftDb();
      const rows = (await db.select(
        "SELECT provider, steps FROM learned_formulas"
      )) as { provider: string; steps: string }[];
      for (const row of rows) {
        // Don't clobber anything already learned this session (e.g. from an
        // import that happened before hydration finished) — first write wins.
        if (row.provider in cache) continue;
        try {
          const steps = JSON.parse(row.steps) as string[];
          if (Array.isArray(steps)) cache[row.provider] = steps;
        } catch {
          // corrupt row — skip
        }
      }
    } catch {
      // no Tauri yet, or DB not ready — cache stays at whatever it already had
    } finally {
      hydrated = true;
    }
  })();
}

function persistLearned(provider: Provider, steps: string[]): void {
  if (!isTauri) return;
  getFramecraftDb()
    .then((db) =>
      db.execute(
        `INSERT INTO learned_formulas (provider, steps, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT(provider) DO UPDATE SET steps = excluded.steps, updated_at = excluded.updated_at`,
        [provider, JSON.stringify(steps), new Date().toISOString()]
      )
    )
    .catch(() => {
      // best-effort — the in-memory cache already reflects the learned value for this session
    });
}

// Kick off hydration as soon as this module loads — it's imported early
// (CraftPrompt, ManualImport, the Project Assistant), so the cache is warm
// well before the user reaches a formula-consuming page in real usage.
ensureHydrated();

/** Test-only: clears the in-memory learned-formula cache between test cases. */
export function resetLearnedFormulaCacheForTests(): void {
  for (const key of Object.keys(cache)) delete cache[key];
}

/** Formula for a provider: learned order when imports have refined it, else the shipped default. */
export function getFormulaForProvider(provider: Provider): string[] {
  const learned = cache[provider];
  if (learned && learned.length >= 3) return [...learned];
  return [...(DEFAULT_FORMULAS[provider] ?? IMAGE_DEFAULT)];
}

// ─── Learning from imports ────────────────────────────────────

interface StepSignal {
  step: string;
  keywords: string[];
}

const STEP_SIGNALS: StepSignal[] = [
  { step: "Image type", keywords: ["photograph of", "photo of", "illustration", "3d render", "poster", "editorial image", "product shot", "still life", "image type"] },
  { step: "Intent", keywords: ["intent", "goal:", "output type", "deliverable", "create a", "generate a", "design a", "we need"] },
  { step: "Subject", keywords: ["woman", "man", "person", "product", "bottle", "car", "portrait", "subject", "character"] },
  { step: "Subject description", keywords: ["wearing", "dressed in", "made of", "-year-old", "with a", "weathered", "polished"] },
  { step: "Action", keywords: ["running", "jumping", "walking", "holding", "pouring", "dancing", "leaping", "in motion", "gesturing"] },
  { step: "Place", keywords: ["studio", "forest", "city", "interior", "street", "beach", "room", "landscape"] },
  { step: "Environment", keywords: ["studio", "forest", "city", "interior", "street", "beach", "room", "landscape", "background"] },
  { step: "Scene", keywords: ["scene", "studio", "forest", "city", "interior", "street", "beach", "room", "landscape"] },
  { step: "Scene description", keywords: ["filled with", "cluttered", "sparse", "lit by", "in the background", "walls"] },
  { step: "World / Setting", keywords: ["setting", "studio", "forest", "city", "interior", "street", "landscape"] },
  { step: "Moment", keywords: ["moment", "mid-", "during", "caught", "instant", "golden hour", "dawn", "dusk", "night"] },
  { step: "Composition", keywords: ["composition", "rule of thirds", "centered", "symmetry", "framing", "negative space", "crop"] },
  { step: "Light", keywords: ["light", "lighting", "backlit", "softbox", "shadows", "sunlight", "rim light"] },
  { step: "Style", keywords: ["style", "aesthetic", "film still", "cinematic", "minimalist", "surreal", "analog", "35mm film"] },
  { step: "Material realism", keywords: ["texture", "skin", "fabric", "material", "grain", "imperfections", "pores"] },
  { step: "Mood", keywords: ["mood", "atmosphere", "cinematic", "intimate", "moody", "serene", "energetic", "tone"] },
  { step: "Color grade / Mood", keywords: ["mood", "color grade", "graded", "teal and orange", "desaturated", "warm tones", "cool tones", "kodak", "moody", "serene"] },
  { step: "Atmosphere", keywords: ["atmosphere", "mood", "fog", "haze", "mist", "tension", "serene", "moody"] },
  { step: "Camera language", keywords: ["camera", "lens", "mm", "angle", "close-up", "wide shot", "macro", "depth of field"] },
  { step: "Camera movement", keywords: ["dolly", "tracking shot", "pan ", "tilt", "crane", "zoom in", "push in", "orbit", "handheld"] },
  { step: "Motion", keywords: ["motion", "running", "moving", "dolly", "tracking", "handheld", "pan", "sway"] },
  { step: "Motion logic", keywords: ["motion", "slow motion", "movement", "dolly", "tracking", "handheld", "drift", "sway"] },
  { step: "Narrative format", keywords: ["narrative", "three act", "story arc", "setup", "payoff", "resolution", "transformation"] },
  { step: "Theme", keywords: ["theme", "core message", "the film is about", "the story is about"] },
  { step: "Shots", keywords: ["shot 1", "shot 2", "shot-by-shot", "opening shot", "first shot", "final shot", "scene 1"] },
  { step: "Transitions", keywords: ["transition", "cut to", "dissolve", "match cut", "fade to", "whip pan"] },
  { step: "Continuity", keywords: ["continuity", "consistent", "same character", "keep the same", "across shots", "across all"] },
  { step: "Continuity lock", keywords: ["continuity", "consistent", "same character", "keep the same", "across shots"] },
  { step: "Consistency", keywords: ["consistency", "consistent", "same character", "keep the same", "identical", "across all"] },
  { step: "Audio / Rhythm", keywords: ["audio", "music", "rhythm", "beat", "sound", "score"] },
  { step: "Audio / Dialogue", keywords: ["audio", "dialogue", "voice", "music", "sound"] },
  { step: "Duration", keywords: ["second clip", "seconds long", "duration", "5s", "10s"] },
  { step: "Text / Graphics", keywords: ["typography", "headline", "lettering", "typeface", "font", "title text", "logo"] },
  { step: "References", keywords: ["reference", "style ref", "sref", "match the attached", "based on the attached"] },
  { step: "Quality tags", keywords: ["masterpiece", "best quality", "highly detailed", "8k", "4k"] },
  { step: "Exclusions", keywords: ["--no", "avoid", "no text", "without", "negative"] },
  { step: "Negative prompt", keywords: ["negative prompt", "negative:"] },
];

// Steps that cover each other — a draft that demonstrates one member of a
// group counts as covering the whole group in missingFormulaSteps.
const STEP_EQUIVALENTS: string[][] = [
  ["Place", "Environment", "Scene", "World / Setting"],
  ["Mood", "Color grade / Mood", "Atmosphere"],
  ["Consistency", "Continuity", "Continuity lock"],
  ["Audio / Rhythm", "Audio / Dialogue"],
  ["Motion", "Motion logic", "Camera movement"],
  ["Exclusions", "Negative prompt"],
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
 * Only steps that belong to the provider's default vocabulary are kept, so a
 * Kling import doesn't pollute the formula with image-only steps.
 */
export function learnFormulaFromImport(promptText: string, provider: Provider): string[] | null {
  if (!promptText.trim()) return null;
  const defaults = DEFAULT_FORMULAS[provider] ?? IMAGE_DEFAULT;
  const observed = detectFormulaOrder(promptText).filter((s) => defaults.includes(s));
  if (observed.length < 3) return null;
  // Keep any default steps the import didn't demonstrate, appended in default order.
  const merged = [...observed, ...defaults.filter((s) => !observed.includes(s))];
  cache[provider] = merged;
  persistLearned(provider, merged);
  return merged;
}

/** Expand a covered-step set with its equivalents (Place ↔ Environment etc.). */
function expandCovered(covered: Set<string>): Set<string> {
  const expanded = new Set(covered);
  for (const group of STEP_EQUIVALENTS) {
    if (group.some((step) => expanded.has(step))) {
      for (const step of group) expanded.add(step);
    }
  }
  return expanded;
}

/** Which formula steps the current draft has not covered yet. */
export function missingFormulaSteps(promptText: string, formula: string[]): string[] {
  const covered = expandCovered(new Set(detectFormulaOrder(promptText)));
  return formula.filter((step) => !covered.has(step));
}

/** Formula + provider prompting rule for AI assistant / analysis context. */
export function formatFormulaForAI(formula: string[], provider: Provider): string {
  if (!formula.length) return "";
  const guidance = PROVIDER_GUIDANCE[provider] ?? IMAGE_GUIDANCE;
  return `Success formula for ${provider}: ${formula.join(" + ")}. Provider rule: ${guidance} Evaluate the draft against this structure and flag missing or weakly covered steps.`;
}
