// Cinema Studio provider intelligence — deterministic, rule-based capability
// data and pro-tips per provider (STATIC in this app's own intelligence
// vocabulary, see CLAUDE.md: no learning, no network dependency). Drives
// project-card badges and the shared ProTipPanel across the Script, Assets,
// and Scenes stages. Extends providerCapabilities.ts rather than duplicating
// its VIDEO_PROVIDERS set.
import type { Provider } from "@/types";
import { isVideoProvider } from "./providerCapabilities";

export type CinemaStageKey = "script" | "assets" | "scenes";

export interface ProviderCapability {
  provider: Provider;
  label: string;
  kind: "image" | "video";
  acceptsImageReference: boolean;
  maxReferenceImages?: number;
  strengths: string[];
  watchOuts: string[];
}

export const PROVIDER_CAPABILITIES: Partial<Record<Provider, ProviderCapability>> = {
  nano_banana: {
    provider: "nano_banana",
    label: "Nano Banana Pro",
    kind: "image",
    acceptsImageReference: true,
    maxReferenceImages: 1,
    strengths: [
      "Strong likeness retention from a single reference photo",
      "Follows exact wardrobe/prop detail closely",
    ],
    watchOuts: [
      "Ask for a clean, gray background — crops cleanest for a character sheet",
      "Erase the face from the full-body panel if a separate close-up portrait is also in frame — one face to track per sheet avoids identity drift",
    ],
  },
  gpt_image: {
    provider: "gpt_image",
    label: "GPT Image 2",
    kind: "image",
    acceptsImageReference: true,
    maxReferenceImages: 4,
    strengths: [
      "Reliable for the final clean character-sheet pass after a rougher first draft",
      "Follows explicit multi-view layout instructions (front / back / portrait) well",
    ],
    watchOuts: [
      "Zero background clutter — plain grey extracts cleanest",
      "State the exact number of panels/views explicitly, don't leave it implied",
    ],
  },
  seedance: {
    provider: "seedance",
    label: "Seedance",
    kind: "video",
    acceptsImageReference: true,
    maxReferenceImages: 3,
    strengths: [
      "Strong director's-brief adherence — responds well to shot-by-shot structure",
      "Realistic camera movement when speed/amplitude are stated numerically",
    ],
    watchOuts: [
      "Name every reference asset by its exact @tag in the prompt",
      "State positive locks (identity / wardrobe / prop shape) explicitly — don't assume persistence across cuts",
    ],
  },
  kling: {
    provider: "kling",
    label: "Kling",
    kind: "video",
    acceptsImageReference: true,
    maxReferenceImages: 2,
    strengths: [
      "Strong motion physics for action and fast-movement scenes",
      "Responds well to compact Scene → Characters → Action → Camera ordering",
    ],
    watchOuts: [
      "Face consistency weakens across longer shots — keep the character sheet reference close",
      "Keep scene direction compact — a tighter brief outperforms an exhaustive one",
    ],
  },
  runway: {
    provider: "runway",
    label: "Runway",
    kind: "video",
    acceptsImageReference: true,
    maxReferenceImages: 1,
    strengths: [
      "Fast iteration for quick previz",
      "Strong stylization control",
    ],
    watchOuts: [
      "Reference adherence is looser than Seedance/Kling — plan for more retries",
      "Best for establishing/mood shots, weaker for dialogue-critical continuity",
    ],
  },
  higgsfield: {
    provider: "higgsfield",
    label: "Higgsfield",
    kind: "video",
    acceptsImageReference: true,
    maxReferenceImages: 6,
    strengths: [
      "Does see image reference — its Elements system auto-matches assets by exact tag name",
      "Strong at carrying a multi-shot sequence from one script description",
    ],
    watchOuts: [
      "Keep asset tags collision-free — Elements matches by exact name, not fuzzy match",
      "Best results come from the full pipeline (script → assets → scenes), not a single isolated prompt",
    ],
  },
};

export function getProviderCapability(provider?: Provider): ProviderCapability | undefined {
  if (!provider) return undefined;
  return PROVIDER_CAPABILITIES[provider];
}

/** General, non-provider-specific tips per stage (still deterministic/STATIC). */
const GENERAL_STAGE_TIPS: Record<CinemaStageKey, string[]> = {
  script: [
    "Name characters, locations, and props explicitly in the script — Cinema Studio uses those keywords to suggest asset folders.",
  ],
  assets: [
    "Generate variations, don't settle for the first result — a higher win rate comes from picking the best of 3-4.",
    "Use a 3/4 angle for locations to enrich depth — a flat head-on shot gives the video model less to work with.",
    "Use the prompt in your image generator once you already have a reference — consistency compounds across the sheet.",
  ],
  scenes: [
    "Reverse angles for the same location keep multi-shot continuity — generate a second asset from the opposite side before shooting coverage.",
  ],
};

export function getGeneralStageTips(stage: CinemaStageKey): string[] {
  return GENERAL_STAGE_TIPS[stage] ?? [];
}

/** Combined general + provider-specific tips for the ProTipPanel. */
export function getProTips(stage: CinemaStageKey, provider?: Provider): string[] {
  const cap = getProviderCapability(provider);
  return [...getGeneralStageTips(stage), ...(cap?.watchOuts ?? [])];
}

export { isVideoProvider };
