// Cinema Studio — mood-aware creative hints for the Shot Editor (Phase 126).
// Deterministic, rule-based (STATIC in this app's own intelligence
// vocabulary — see CLAUDE.md) — a scene's mood tag surfaces director/DOP/
// camera suggestions at the point of writing each shot, the same "assistive,
// not generative" role `consistencyFactors.ts` plays elsewhere in the app.

export interface CreativeHintGroup {
  label: string;
  hints: string[];
}

interface MoodRule {
  keywords: string[];
  groups: CreativeHintGroup[];
}

const MOOD_RULES: MoodRule[] = [
  {
    keywords: ["dramatic", "drama", "emotional", "sad", "grief"],
    groups: [
      { label: "CAMERA", hints: ["Slow zoom in on the character's face", "Hold the frame longer than feels comfortable"] },
      { label: "DIRECTOR", hints: ["Let a reaction breathe before cutting away", "Favor stillness over movement"] },
      { label: "LIGHTING", hints: ["Low-key, single motivated source", "Let shadow do some of the storytelling"] },
    ],
  },
  {
    keywords: ["tense", "suspense", "thriller", "fear", "dread"],
    groups: [
      { label: "CAMERA", hints: ["Tight framing, restrict headroom", "Slow push-in, almost imperceptible"] },
      { label: "DIRECTOR", hints: ["Withhold information the character doesn't have yet", "Cut on an unresolved beat"] },
      { label: "SOUND", hints: ["Reduce ambient noise to raise tension", "A single sustained low tone under the scene"] },
    ],
  },
  {
    keywords: ["action", "fast", "chase", "fight", "sport"],
    groups: [
      { label: "CAMERA", hints: ["Handheld with real weight — not shaky-cam for its own sake", "Faster cuts, shorter shot durations"] },
      { label: "DIRECTOR", hints: ["Prioritize legible geography over rapid cutting", "Show impact and consequence, not just motion"] },
      { label: "PHYSICS", hints: ["Respect momentum — bodies and objects don't stop instantly", "Recoil, drag, and follow-through sell the hit"] },
    ],
  },
  {
    keywords: ["comedic", "comedy", "funny", "playful", "light"],
    groups: [
      { label: "CAMERA", hints: ["Wider frame — give physical comedy room to read", "Cut on the joke's beat, not before or after"] },
      { label: "DIRECTOR", hints: ["Let the setup land before the punchline", "Keep performance grounded, not mugging"] },
    ],
  },
  {
    keywords: ["quiet", "calm", "peaceful", "slow", "reflective"],
    groups: [
      { label: "CAMERA", hints: ["Static or very slow drift", "Wide negative space around the subject"] },
      { label: "DIRECTOR", hints: ["Let silence and ambience carry the moment", "Minimal blocking, natural pauses"] },
    ],
  },
];

const DEFAULT_GROUPS: CreativeHintGroup[] = [
  { label: "CAMERA", hints: ["Match camera intent to what the character needs the audience to feel"] },
  { label: "DIRECTOR", hints: ["State the one thing this shot must communicate before writing the prompt"] },
];

export function getCreativeHints(mood?: string): CreativeHintGroup[] {
  if (!mood?.trim()) return DEFAULT_GROUPS;
  const normalized = mood.trim().toLowerCase();
  const rule = MOOD_RULES.find((r) => r.keywords.some((k) => normalized.includes(k)));
  return rule?.groups ?? DEFAULT_GROUPS;
}
