// Cinema Studio — Asset Prompt Composer AI assist (Phase 121). Drafts an
// image-generation prompt for one asset (character sheet / location / prop),
// aware of the script excerpt and the containing folder's kind so a
// character folder gets nudged toward the multi-view sheet template and a
// location folder toward a 3/4-angle establishing shot. The user's own
// instruction is always the primary input — this is guidance, not a rigid
// template the user can't deviate from.
//
// Provider-aware since the asset iteration workflow (V1/V2/…): the draft is
// shaped for a specific target provider using the same success-formula
// system Prompt Craft uses (promptFormula.ts), and returns structured
// `parameters` alongside the prompt text for providers that have a
// structured parameter model (providerParameters.ts) — mirroring
// CraftPrompt's PARAMETERS panel so a generated draft "fills" the mini
// parameter editor instead of leaving the user to type flags by hand.
import { chatComplete } from "./aiClient";
import type { AIModel } from "./aiConfig";
import { formatFormulaForAI, getFormulaForProvider } from "./promptFormula";
import { STRUCTURED_PARAM_PROVIDERS } from "./providerParameters";
import type { CinemaFolderKind, Provider } from "@/types";

export interface AssetPromptPreviousAttempt {
  promptText: string;
  rating?: number;
  feedback?: string;
}

export interface AssetPromptDraftInput {
  folderKind: CinemaFolderKind;
  folderName: string;
  folderDescription?: string;
  scriptExcerpt?: string;
  assetTitle: string;
  instruction: string;
  provider: Provider;
  /** The prior version's prompt/rating/feedback, when redrafting toward a fix. */
  previousAttempt?: AssetPromptPreviousAttempt;
}

export interface AssetPromptDraft {
  promptText: string;
  parameters?: Record<string, string | boolean>;
}

const KIND_GUIDANCE: Record<CinemaFolderKind, string> = {
  character: `This is a character reference sheet. Favor: three views (full-body front, full-body back, close-up portrait), clean neutral background, exact wardrobe/prop detail, consistent facial identity across all views. If a close-up portrait shares the frame with a full-body view, consider omitting the face from the full-body panel so there is only one face for the model to track.`,
  location: `This is a location reference. Favor a 3/4 angle rather than a flat head-on shot — it reads more spatial depth and gives a video model more to work with for camera movement. Suggest generating more than one angle (an establishing wide plus a reverse angle) for continuity across multiple shots in this location.`,
  product: `This is the advertised product — the hero of the piece, not an incidental prop. Favor pristine studio-quality product photography: clean seamless background, flattering key light that reveals material and finish, sharp focus on branding/logo/label detail, and multiple hero angles (front, 3/4, a detail macro on the logo or key feature). This reference will anchor the product's "reveal" moments in the script, so exact color, material, and proportions must be unmistakable and consistent across every later shot.`,
  prop: `This is a prop reference. Favor a clean multi-angle or split-screen composition showing the object from at least two sides, plain background, exact material/scale detail.`,
  other: `Favor a clean, uncluttered background and enough angle coverage that a video model has real 3D information to work from.`,
};

// Example shape only — tells the model which keys exist for this provider
// and what a plausible value looks like; it should omit any key it has no
// informed opinion on rather than filling every field.
const PARAM_SCHEMA_HINT: Partial<Record<Provider, string>> = {
  midjourney: `{"model_version":"8.1","quality":"1","stylize":"250","chaos":"10","weird":"0","style":"raw","sw":"","sv":"","seed":"","zoom":"","stop":"","repeat":"","no_prompt":"","raw":false,"hd":false,"tile":false,"fast":false,"relax":false,"exp":false}`,
  dalle: `{"size":"1024x1024","quality":"hd","style":"vivid"}`,
  stable_diffusion: `{"steps":"30","cfg_scale":"7","sampler":"DPM++ 2M Karras","seed":"","negative_prompt":""}`,
};

function buildSystemPrompt(provider: Provider): string {
  const formulaContext = formatFormulaForAI(getFormulaForProvider(provider), provider);
  const paramsInstruction = STRUCTURED_PARAM_PROVIDERS.includes(provider)
    ? `Also return a "parameters" object using any of these keys that materially improve the result — omit keys you have no informed opinion on, don't fill every field: ${PARAM_SCHEMA_HINT[provider]}. All values are strings except the boolean flags.`
    : `This provider has no structured parameter fields — return "parameters": {}.`;
  return [
    `You are a prompt-engineering assistant for AI image generation, producing reference sheets for a video production (characters, locations, props) that must stay visually consistent once used in later video-generation shots.`,
    formulaContext,
    paramsInstruction,
    `Return ONLY a valid JSON object: {"prompt": "the finished, ready-to-paste image-generation prompt text — no options, no commentary", "parameters": {}}. No markdown fences, no preamble.`,
  ].filter(Boolean).join("\n\n");
}

function parseDraft(raw: string): AssetPromptDraft {
  try {
    const parsed = JSON.parse(raw.trim()) as { prompt?: unknown; parameters?: unknown };
    const promptText = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
    if (!promptText) throw new Error("empty prompt in response");
    const parameters =
      parsed.parameters && typeof parsed.parameters === "object" && !Array.isArray(parsed.parameters)
        ? (parsed.parameters as Record<string, string | boolean>)
        : undefined;
    return { promptText, parameters };
  } catch {
    // Graceful degradation (same convention as analyzePrompt.ts's
    // parseAdvice) — a model that ignores the "JSON only" instruction and
    // returns plain prose still produces a usable prompt, just without
    // structured parameters, rather than losing the generation entirely.
    return { promptText: raw.trim() };
  }
}

export async function draftAssetPrompt(input: AssetPromptDraftInput, model: AIModel): Promise<AssetPromptDraft> {
  if (!input.instruction.trim()) throw new Error("Describe what you want before generating a prompt.");

  const previous = input.previousAttempt;
  const context = [
    `Asset: ${input.assetTitle}`,
    `Target provider: ${input.provider}`,
    `Folder: ${input.folderName} (${input.folderKind})`,
    input.folderDescription?.trim() ? `Folder notes: ${input.folderDescription.trim()}` : "",
    input.scriptExcerpt?.trim() ? `Relevant script excerpt:\n${input.scriptExcerpt.trim()}` : "",
    `Guidance: ${KIND_GUIDANCE[input.folderKind]}`,
    `User request: ${input.instruction.trim()}`,
    previous?.promptText.trim()
      ? [
          `Previous attempt${previous.rating ? ` (rated ${previous.rating}/5)` : ""}: ${previous.promptText.trim()}`,
          previous.feedback?.trim() ? `User feedback to address: ${previous.feedback.trim()}` : "",
          `Revise the prompt to address this feedback while keeping the same subject and purpose.`,
        ].filter(Boolean).join("\n")
      : "",
  ].filter(Boolean).join("\n\n");

  const text = await chatComplete(model, { system: buildSystemPrompt(input.provider), user: context, maxTokens: 2000 });
  return parseDraft(text);
}
