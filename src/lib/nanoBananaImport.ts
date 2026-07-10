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

  const subjectLine = asString(subject?.main) ?? asString(subject?.description);
  const promptText =
    asString(priority?.primary) ??
    asString(obj.prompt) ??
    asString(obj.prompt_text) ??
    asString(obj.text) ??
    asString(obj.description) ??
    (subjectLine ? `${subjectLine}${asString(env?.setting) ? ` in ${asString(env?.setting)}` : ""}` : undefined);

  if (!promptText) {
    return {
      ok: false,
      error: 'No prompt text found — expected one of "prompt", "prompt_text", "text", "description", "priority.primary", or "subject.main"/"subject.description".',
    };
  }

  const aspectRatio = asString(technical?.aspect_ratio) ?? asString(obj.aspect_ratio) ?? asString(obj.ar);

  const exclusions = constraints?.exclusions ?? obj.exclusions;
  const avoidance = Array.isArray(exclusions)
    ? exclusions.filter((v): v is string => typeof v === "string").join(", ")
    : asString(exclusions);

  const cameraObj = style?.camera as Record<string, unknown> | undefined;
  const camera = asString(cameraObj?.angle) ?? asString(obj.camera);
  const lens = asString(cameraObj?.lens) ?? asString(obj.lens);

  const lightingObj = env?.lighting as Record<string, unknown> | undefined;
  const lighting = asString(lightingObj?.direction) ?? asString(env?.lighting) ?? asString(obj.lighting);

  const mood = asString(style?.mood) ?? asString(obj.mood);

  return {
    ok: true,
    data: { promptText, aspectRatio, camera, lens, lighting, mood, avoidance },
  };
}
