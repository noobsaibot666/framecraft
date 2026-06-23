import type { AvoidancePattern, DetectedRisk } from "@/types";

// Keyword triggers per artifact_type — matched against lowercased prompt text
const TRIGGERS: Record<string, string[]> = {
  bad_hands: ["hands", "fingers", "holding", "reaching", "pointing", "gripping", "gesturing", "palm", "fist", "grip"],
  plastic_skin: ["portrait", "person", "woman", "man", "face", "skin", "closeup", "close-up", "model", "beauty", "headshot", "selfie"],
  gibberish_text: ["sign", "text", "logo", "label", "book", "newspaper", "shirt", "bottle", "poster", "signage", "billboard", "menu", "packaging"],
  eye_inconsistency: ["eyes", "gaze", "stare", "looking", "eye contact", "pupils", "iris", "staring"],
  ai_glow: ["glowing", "illuminated", "backlit", "halo", "ethereal light", "radiant", "luminous", "inner glow"],
  jewelry_mismatch: ["jewelry", "earrings", "necklace", "bracelet", "ring", "accessories", "pendant", "choker", "bangles"],
  background_melting: ["background", "environment", "scene", "setting", "surroundings", "landscape", "backdrop"],
  floating_objects: ["floating", "levitating", "hovering", "product shot", "still life", "flat lay", "packshot"],
  texture_blending: ["material", "texture", "surface", "fabric", "leather", "metal", "concrete", "glass", "cloth", "velvet", "silk"],
  impossible_architecture: ["building", "architecture", "facade", "structure", "interior", "corridor", "hallway", "staircase", "ceiling", "atrium"],
  unreal_reflections: ["reflection", "mirror", "glossy", "chrome", "polished", "shiny", "reflective", "specular"],
  fake_dof: ["depth of field", "bokeh", "blurred background", "shallow focus", "defocus", "out of focus"],
  over_sharpened: ["hyper-detailed", "ultra-detailed", "hyperdetailed", "8k", "photorealistic 8k", "razor sharp", "microscopic detail"],
  perfect_symmetry: ["symmetric", "symmetrical", "centered", "perfectly balanced", "front-on", "straight-on", "full face"],
  generic_luxury_mood: ["luxury", "premium", "elegant", "opulent", "sophisticated", "high-end", "luxurious", "upscale"],
  fake_cinematic_sheen: ["cinematic", "film grain", "anamorphic", "dramatic lighting", "movie still", "film look", "cinemascope"],
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function detectRisks(promptText: string, patterns: AvoidancePattern[]): DetectedRisk[] {
  const lower = promptText.toLowerCase();
  const detected: DetectedRisk[] = [];

  for (const pattern of patterns) {
    const triggers = TRIGGERS[pattern.artifact_type] ?? [];
    const matched = triggers.filter((t) => lower.includes(t));
    if (matched.length > 0) {
      detected.push({ pattern, triggered_by: matched });
    }
  }

  return detected.sort(
    (a, b) => (SEVERITY_ORDER[a.pattern.severity] ?? 4) - (SEVERITY_ORDER[b.pattern.severity] ?? 4)
  );
}

export function calculateRiskScore(risks: DetectedRisk[]): number {
  const points = risks.reduce((sum, r) => {
    switch (r.pattern.severity) {
      case "critical": return sum + 3;
      case "high": return sum + 2;
      case "medium": return sum + 1;
      case "low": return sum + 0.5;
      default: return sum;
    }
  }, 0);
  // Normalize to 0–10; cap at a realistic max of ~15 pts (3 criticals + 3 highs + 3 mediums)
  return Math.min(10, Math.round((points / 15) * 100) / 10);
}
