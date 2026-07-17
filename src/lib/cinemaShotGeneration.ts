// Cinema Studio — AI shot-prompt generation + transitions (Phase 127). This
// is the in-app equivalent of the reference workflow's "Claude Skill":
// describe the scene, it writes the full director's-brief prompt, director
// hacks included. Built on `promptFormula.ts`'s existing per-provider
// formulas (Seedance director's-brief, Kling compact scene direction) —
// the prompt STRUCTURE is not reinvented here, only the shot-specific
// context assembly around it.
import { chatComplete } from "./aiClient";
import { formatFormulaForAI, getFormulaForProvider } from "./promptFormula";
import { extractJson } from "./creativeDirectionGeneration";
import type { AIModel } from "./aiConfig";
import type { CinemaScene, CinemaShot, Provider } from "@/types";

export interface ShotPromptInput {
  shot: CinemaShot;
  scene: CinemaScene;
  linkedAssetTags: string[];
  videoProvider: Provider;
  projectTitle: string;
}

function buildShotContext(input: ShotPromptInput): string {
  const { shot, scene, linkedAssetTags, projectTitle } = input;
  return [
    `Project: ${projectTitle}`,
    `Scene: ${scene.title}${scene.mood ? ` (mood: ${scene.mood})` : ""}`,
    scene.script_excerpt ? `Script excerpt:\n${scene.script_excerpt}` : "",
    `Shot: ${shot.label} (${shot.shot_type}${shot.is_broll ? ", B-ROLL" : ""})`,
    shot.description ? `What happens: ${shot.description}` : "",
    shot.director_notes ? `Director notes: ${shot.director_notes}` : "",
    shot.dop_notes ? `DOP notes: ${shot.dop_notes}` : "",
    shot.camera_notes ? `Camera: ${shot.camera_notes}` : "",
    shot.lighting_notes ? `Lighting: ${shot.lighting_notes}` : "",
    shot.sound_notes ? `Sound/dialogue: ${shot.sound_notes}` : "",
    linkedAssetTags.length ? `Reference assets (use these exact tags, identity/appearance locked to each): ${linkedAssetTags.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

const SYSTEM_PROMPT_PREAMBLE = `You are a director's-brief prompt writer for AI video generation. Given a scene and shot's context, write ONE finished, ready-to-paste video-generation prompt — no preamble, no options, no commentary. Include concrete director/DOP details: camera movement and speed, framing, lighting motivation, physics/weight of movement, and explicit positive locks for any referenced assets ("@tag" identity, wardrobe, or prop shape must not drift). If reference assets are given, name them by their exact tag so the generator can match them.`;

export async function generateShotPrompt(input: ShotPromptInput, model: AIModel): Promise<string> {
  const formula = getFormulaForProvider(input.videoProvider);
  const formulaGuidance = formatFormulaForAI(formula, input.videoProvider);
  const system = `${SYSTEM_PROMPT_PREAMBLE}\n\n${formulaGuidance}`;
  const user = buildShotContext(input);

  const text = await chatComplete(model, { system, user, maxTokens: 900 });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The model returned an empty prompt.");
  return trimmed;
}

export type TimelinePosition = "first" | "middle" | "last";

export interface TransitionSuggestion {
  option: string;
  rationale: string;
}

export function parseTransitionSuggestions(raw: string): TransitionSuggestion[] {
  const record = extractJson(raw) as { transitions?: unknown };
  if (!Array.isArray(record.transitions) || record.transitions.length === 0) {
    throw new Error("Transition response must include a non-empty transitions array.");
  }
  return record.transitions.map((t) => {
    const item = t as Record<string, unknown>;
    return {
      option: typeof item.option === "string" ? item.option.trim() : "",
      rationale: typeof item.rationale === "string" ? item.rationale.trim() : "",
    };
  }).filter((t) => t.option);
}

export async function suggestTransitions(
  scene: CinemaScene,
  position: TimelinePosition,
  model: AIModel
): Promise<TransitionSuggestion[]> {
  const system = `You are a film editor suggesting scene transitions. Offer 2-3 distinct transition options (cut, dissolve, whip pan, match cut, etc.) suited to the scene's mood and its position in the story, each with a one-sentence rationale. Return only valid JSON: {"transitions":[{"option":"...","rationale":"..."}]}`;
  const user = [
    `Scene: ${scene.title}`,
    scene.mood ? `Mood: ${scene.mood}` : "",
    scene.summary ? `Summary: ${scene.summary}` : "",
    `Position in the story: ${position}`,
  ].filter(Boolean).join("\n");

  const text = await chatComplete(model, { system, user, maxTokens: 500 });
  return parseTransitionSuggestions(text);
}
