// Parses a pasted Nano Banana JSON brief for Manual Import. Handles both
// Framecraft's own deeply-nested export shape (buildNanaBananaJson in
// CraftPrompt.tsx) and flatter ad-hoc shapes a user might paste from an AI
// chat response or write by hand. Pure and testable — the previous inline
// version failed completely silently on a parse error or an unrecognized
// shape (empty catch block, no feedback), which is what "the import isn't
// working" reports usually turn out to mean in practice.

export interface NanoBananaExtraction {
  promptText: string;
  aspectRatio?: string;
  camera?: string;
  lens?: string;
  lighting?: string;
  mood?: string;
  avoidance?: string;
}

export type NanoBananaParseResult =
  | { ok: true; data: NanoBananaExtraction }
  | { ok: false; error: string };

/** Strips a ```json ... ``` (or bare ``` ... ```) wrapper — the single most common
 * reason a pasted AI-generated JSON brief fails to parse. */
export function stripCodeFence(text: string): string {
  return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Nano Banana Pro's "cinematic brief" export (camera_and_cinematography,
 * subjects[], hero_product, environment_and_composition,
 * negative_prompt_weights) has no single prompt/description field — every
 * section together *is* the prompt. Composed only when no direct prompt
 * field is found elsewhere.
 */
function composeFromCinematicBrief(obj: Record<string, unknown>): string | undefined {
  const cam = asRecord(obj.camera_and_cinematography);
  const aesthetic = asRecord(obj.aesthetic_and_style);
  const hero = asRecord(obj.hero_product);
  const envComp = asRecord(obj.environment_and_composition);
  const subjectsArr = Array.isArray(obj.subjects) ? (obj.subjects as unknown[]).map(asRecord).filter(Boolean) as Record<string, unknown>[] : undefined;

  const parts: string[] = [];

  const shot = [asString(cam?.shot_type), asString(cam?.angle)].filter(Boolean).join(", ");
  if (shot) parts.push(shot);

  subjectsArr?.forEach((s) => {
    const bits = [asString(s.appearance), asString(s.clothing), asString(s.action), asString(s.interaction)].filter(Boolean).join(", ");
    if (bits) parts.push(bits);
  });

  if (hero) {
    const heroBits = [asString(hero.brand), asString(hero.item), asString(hero.material), asString(hero.state)].filter(Boolean).join(" ");
    if (heroBits) parts.push(heroBits);
  }

  const envBits = [asString(envComp?.location), asString(envComp?.architecture)].filter(Boolean).join(", ");
  if (envBits) parts.push(`in ${envBits}`);

  const lightingLine = asString(cam?.lighting);
  if (lightingLine) parts.push(lightingLine);

  const styleBits = [asString(aesthetic?.style_preset), asString(aesthetic?.mood)].filter(Boolean).join(", ");
  if (styleBits) parts.push(styleBits);

  return parts.length ? parts.join(". ") : undefined;
}

export function parseNanoBananaJson(raw: string): NanoBananaParseResult {
  const cleaned = stripCodeFence(raw);
  if (!cleaned) return { ok: false, error: "Paste a Nano Banana JSON brief first." };

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (err) {
    return { ok: false, error: `Couldn't parse this as JSON: ${err instanceof Error ? err.message : String(err)}` };
  }

  const priority = obj.priority as Record<string, unknown> | undefined;
  const technical = obj.technical as Record<string, unknown> | undefined;
  const constraints = obj.constraints as Record<string, unknown> | undefined;
  const style = obj.style as Record<string, unknown> | undefined;
  const env = obj.environment as Record<string, unknown> | undefined;
  const subject = obj.subject as Record<string, unknown> | undefined;
  const cam = asRecord(obj.camera_and_cinematography);
  const aesthetic = asRecord(obj.aesthetic_and_style);
  const generationSettings = asRecord(obj.generation_settings);
  const negativeWeights = asRecord(obj.negative_prompt_weights);

  const subjectLine = asString(subject?.main) ?? asString(subject?.description);
  const promptText =
    asString(priority?.primary) ??
    asString(obj.prompt) ??
    asString(obj.prompt_text) ??
    asString(obj.text) ??
    asString(obj.description) ??
    (subjectLine ? `${subjectLine}${asString(env?.setting) ? ` in ${asString(env?.setting)}` : ""}` : undefined) ??
    composeFromCinematicBrief(obj);

  if (!promptText) {
    return {
      ok: false,
      error: 'No prompt text found — expected one of "prompt", "prompt_text", "text", "description", "priority.primary", "subject.main"/"subject.description", or a cinematic brief with "subjects"/"camera_and_cinematography".',
    };
  }

  const aspectRatio = asString(technical?.aspect_ratio) ?? asString(obj.aspect_ratio) ?? asString(obj.ar) ?? asString(generationSettings?.aspect_ratio);

  const exclusions = constraints?.exclusions ?? obj.exclusions;
  const avoidance = Array.isArray(exclusions)
    ? exclusions.filter((v): v is string => typeof v === "string").join(", ")
    : asString(exclusions) ?? asString(negativeWeights?.artifacts);

  const cameraObj = style?.camera as Record<string, unknown> | undefined;
  const camera = asString(cameraObj?.angle) ?? asString(obj.camera) ?? asString(cam?.angle) ?? asString(cam?.shot_type);
  const lens = asString(cameraObj?.lens) ?? asString(obj.lens) ?? asString(cam?.lens_simulation);

  const lightingObj = env?.lighting as Record<string, unknown> | undefined;
  const lighting = asString(lightingObj?.direction) ?? asString(env?.lighting) ?? asString(obj.lighting) ?? asString(cam?.lighting);

  const mood = asString(style?.mood) ?? asString(obj.mood) ?? asString(aesthetic?.mood);

  return {
    ok: true,
    data: { promptText, aspectRatio, camera, lens, lighting, mood, avoidance },
  };
}
