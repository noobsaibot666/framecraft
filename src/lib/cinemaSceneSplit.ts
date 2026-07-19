// Cinema Studio — script-to-scene splitting (Phase 125). Reads the approved
// script and proposes the Director's-overview scene breakdown: title, the
// exact script excerpt it covers, a short summary, and a mood tag that later
// feeds the Shot Editor's creative-hints panel (Phase 126).
import { chatComplete } from "./aiClient";
import { extractJson } from "./creativeDirectionGeneration";
import type { AIModel, AIQuality } from "./aiConfig";

export interface SplitScene {
  title: string;
  script_excerpt: string;
  summary: string;
  mood: string;
}

const SYSTEM_PROMPT = `You are a director breaking a script into shootable scenes for a video production. Split the script into sequential scenes in shooting order. Each scene needs the exact excerpt of script text it covers, a one-sentence summary, and a one or two word mood tag (e.g. "dramatic", "tense", "comedic", "action", "quiet"). Return only valid JSON, no commentary.`;

const JSON_SHAPE = `{
  "scenes": [
    { "title": "Scene 1 — The Cabin", "script_excerpt": "...", "summary": "...", "mood": "tense" }
  ]
}`;

export function parseSplitScenes(raw: string): SplitScene[] {
  const parsed = extractJson(raw) as { scenes?: unknown };
  if (!Array.isArray(parsed?.scenes) || parsed.scenes.length === 0) {
    throw new Error("Scene split must return a non-empty scenes array.");
  }
  return parsed.scenes.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`Scene ${index + 1} is invalid.`);
    const record = candidate as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) throw new Error(`Scene ${index + 1} is missing a title.`);
    return {
      title,
      script_excerpt: typeof record.script_excerpt === "string" ? record.script_excerpt.trim() : "",
      summary: typeof record.summary === "string" ? record.summary.trim() : "",
      mood: typeof record.mood === "string" ? record.mood.trim() : "",
    };
  });
}

export async function splitScriptIntoScenes(scriptText: string, model: AIModel, quality: AIQuality = "standard"): Promise<SplitScene[]> {
  if (!scriptText.trim()) throw new Error("Approve a script before splitting it into scenes.");
  const text = await chatComplete(model, {
    system: SYSTEM_PROMPT,
    user: `Script:\n\n${scriptText.trim()}\n\nReturn only valid JSON in this exact structure:\n${JSON_SHAPE}`,
    maxTokens: 1800,
    quality,
  });
  return parseSplitScenes(text);
}
