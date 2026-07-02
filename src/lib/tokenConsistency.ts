// Rule-based inconsistency detection for prompt drafts — catches conflicting
// instructions (camera, lighting, style, subject count, provider mismatch)
// before they reach the provider, per the "App Intelligence" feedback.

import { isVideoProvider } from "./providerCapabilities";

export interface ConsistencyRule {
  id: string;
  label: string;
  a: string[];
  b: string[];
  suggestion: string;
}

const VIDEO_ONLY_WORDS = ["motion", "video", "fps", "frame rate", "duration", "clip", "footage", "animate", "animation"];
const IMAGE_ONLY_WORDS = ["still image", "static shot", "single frame", "photograph only"];

export const CONSISTENCY_RULES: ConsistencyRule[] = [
  {
    id: "camera-macro-wide",
    label: "Conflicting camera instructions: macro + wide establishing shot",
    a: ["macro", "extreme close-up", "close-up"],
    b: ["wide establishing shot", "wide shot", "establishing shot", "wide angle"],
    suggestion: "Pick one framing — macro/close-up OR a wide establishing shot, not both.",
  },
  {
    id: "lighting-night-morning",
    label: "Conflicting lighting: night + morning sunlight",
    a: ["night", "nighttime", "moonlit"],
    b: ["morning sunlight", "morning light", "sunrise", "daylight"],
    suggestion: "Choose one time of day — night lighting and morning sunlight can't coexist.",
  },
  {
    id: "focus-shallow-everything-sharp",
    label: "Conflicting camera: shallow depth of field + everything sharp",
    a: ["shallow depth of field", "shallow dof", "bokeh"],
    b: ["everything sharp", "deep focus", "all in focus", "tack sharp throughout"],
    suggestion: "Shallow depth of field blurs the background — drop \"everything sharp\" or switch to deep focus.",
  },
  {
    id: "composition-minimal-crowded",
    label: "Conflicting composition: minimal product shot + crowded scene",
    a: ["minimal product shot", "minimalist", "clean background"],
    b: ["crowded scene", "busy background", "crowded"],
    suggestion: "A minimal product shot needs a clean background — remove crowd/busy-scene language.",
  },
  {
    id: "subject-single-multiple",
    label: "Conflicting subject count: single subject + multiple main subjects",
    a: ["single subject", "one subject", "lone figure"],
    b: ["multiple main subjects", "group of people", "several subjects"],
    suggestion: "Decide on one primary subject, or explicitly frame it as a group shot.",
  },
  {
    id: "style-documentary-surreal",
    label: "Conflicting style references: documentary realism + surreal CGI",
    a: ["documentary realism", "documentary style", "photojournalistic"],
    b: ["surreal", "surreal cgi", "dreamlike cgi", "fantastical cgi"],
    suggestion: "Documentary realism and surreal CGI pull in opposite directions — pick the dominant style.",
  },
];

export interface ConsistencyMatch {
  rule: ConsistencyRule;
  matchedA: string;
  matchedB: string;
}

function findMatch(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  return keywords.find((kw) => lower.includes(kw)) ?? null;
}

/** Scans combined prompt text for conflicting instruction pairs. */
export function detectConsistencyIssues(text: string): ConsistencyMatch[] {
  if (!text.trim()) return [];
  const matches: ConsistencyMatch[] = [];
  for (const rule of CONSISTENCY_RULES) {
    const matchedA = findMatch(text, rule.a);
    const matchedB = matchedA ? findMatch(text, rule.b) : null;
    if (matchedA && matchedB) matches.push({ rule, matchedA, matchedB });
  }
  return matches;
}

export interface ProviderMismatch {
  label: string;
  suggestion: string;
}

/** Flags video-specific language on an image-only provider, or vice versa. */
export function detectProviderMismatch(text: string, provider: string): ProviderMismatch | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  const videoProvider = isVideoProvider(provider);
  if (!videoProvider) {
    const hit = VIDEO_ONLY_WORDS.find((w) => lower.includes(w));
    if (hit) {
      return {
        label: `Video-only language ("${hit}") with an image-only provider`,
        suggestion: `${provider} produces still images — remove motion/video language or switch to a video provider.`,
      };
    }
  } else {
    const hit = IMAGE_ONLY_WORDS.find((w) => lower.includes(w));
    if (hit) {
      return {
        label: `Image-only language ("${hit}") with a video provider`,
        suggestion: `${provider} produces video — remove still-image-only language or switch to an image provider.`,
      };
    }
  }
  return null;
}

/** Which of a set of token texts participate in a detected conflict, for grey-out styling. */
export function findConflictingTexts(tokenTexts: string[], matches: ConsistencyMatch[]): Set<string> {
  const flagged = new Set<string>();
  for (const { matchedA, matchedB } of matches) {
    for (const t of tokenTexts) {
      const lower = t.toLowerCase();
      if (lower.includes(matchedA) || lower.includes(matchedB)) flagged.add(t);
    }
  }
  return flagged;
}
