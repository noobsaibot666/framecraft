// Cinema Studio — Script Studio AI assist (Phase 119). Two entry points:
// draft from an idea, and refine an existing script against a targeted
// question/instruction (runtime, setting, plot twists, tone). Both are plain
// prose in, prose out — no JSON contract needed here, unlike storyboard/shot
// generation which returns structured shot lists.
import { chatComplete } from "./aiClient";
import type { AIModel, AIQuality } from "./aiConfig";

export interface ScriptQuestion {
  key: "runtime" | "setting" | "plot_twist" | "tone";
  label: string;
  placeholder: string;
}

export const SCRIPT_QUESTIONS: ScriptQuestion[] = [
  { key: "runtime", label: "Runtime", placeholder: "e.g. 60 seconds, 4 scenes" },
  { key: "setting", label: "Setting", placeholder: "e.g. jungle, pyramids, city rooftop" },
  { key: "plot_twist", label: "Plot twist", placeholder: "e.g. the map turns out to be fake" },
  { key: "tone", label: "Tone / drama", placeholder: "e.g. tense, comedic, high-stakes" },
];

export interface ScriptDraftInput {
  idea: string;
  runtimeTarget?: string;
  setting?: string;
  tone?: string;
  plotTwist?: string;
}

const SCRIPT_SYSTEM_PROMPT = `You are a screenwriter drafting a short, production-ready video script for an AI-video shoot. Write clear scene headings, action lines, and camera-relevant description — this script will be broken into scenes and shots later. Keep it tight and visual; avoid stage-play dialogue formatting unless dialogue is essential. If this is an advertisement or otherwise features a specific product, name that product explicitly and establish it clearly within the first beat — it is the hero of the piece and should read as distinct from incidental background props, not blend in with the scenery. Return only the script text, no preamble or commentary.`;

function buildDraftPrompt(input: ScriptDraftInput): string {
  const context = [
    `Idea: ${input.idea.trim()}`,
    input.runtimeTarget?.trim() ? `Target runtime: ${input.runtimeTarget.trim()}` : "",
    input.setting?.trim() ? `Setting: ${input.setting.trim()}` : "",
    input.tone?.trim() ? `Tone: ${input.tone.trim()}` : "",
    input.plotTwist?.trim() ? `Plot twist: ${input.plotTwist.trim()}` : "",
  ].filter(Boolean).join("\n");

  return `Write a short video script from this premise.\n\n${context}`;
}

export async function generateScriptDraft(input: ScriptDraftInput, model: AIModel, quality: AIQuality = "standard"): Promise<string> {
  if (!input.idea.trim()) throw new Error("Add an idea or logline before generating a draft.");
  const text = await chatComplete(model, {
    system: SCRIPT_SYSTEM_PROMPT,
    user: buildDraftPrompt(input),
    maxTokens: 2000,
    quality,
  });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The model returned an empty script.");
  return trimmed;
}

export async function refineScript(currentScript: string, instruction: string, model: AIModel, quality: AIQuality = "standard"): Promise<string> {
  if (!currentScript.trim()) throw new Error("There's no script yet to refine — generate a draft first.");
  if (!instruction.trim()) throw new Error("Add a refinement instruction.");

  const user = `Current script:\n\n${currentScript.trim()}\n\nRevise the script per this instruction, keeping everything else intact unless the instruction requires a change: ${instruction.trim()}`;
  const text = await chatComplete(model, { system: SCRIPT_SYSTEM_PROMPT, user, maxTokens: 2400, quality });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The model returned an empty script.");
  return trimmed;
}
