// Cinema Studio — Asset Prompt Composer AI assist (Phase 121). Drafts an
// image-generation prompt for one asset (character sheet / location / prop),
// aware of the script excerpt and the containing folder's kind so a
// character folder gets nudged toward the multi-view sheet template and a
// location folder toward a 3/4-angle establishing shot. The user's own
// instruction is always the primary input — this is guidance, not a rigid
// template the user can't deviate from.
import { chatComplete } from "./aiClient";
import type { AIModel } from "./aiConfig";
import type { CinemaFolderKind } from "@/types";

export interface AssetPromptDraftInput {
  folderKind: CinemaFolderKind;
  folderName: string;
  folderDescription?: string;
  scriptExcerpt?: string;
  assetTitle: string;
  instruction: string;
}

const KIND_GUIDANCE: Record<CinemaFolderKind, string> = {
  character: `This is a character reference sheet. Favor: three views (full-body front, full-body back, close-up portrait), clean neutral background, exact wardrobe/prop detail, consistent facial identity across all views. If a close-up portrait shares the frame with a full-body view, consider omitting the face from the full-body panel so there is only one face for the model to track.`,
  location: `This is a location reference. Favor a 3/4 angle rather than a flat head-on shot — it reads more spatial depth and gives a video model more to work with for camera movement. Suggest generating more than one angle (an establishing wide plus a reverse angle) for continuity across multiple shots in this location.`,
  prop: `This is a prop reference. Favor a clean multi-angle or split-screen composition showing the object from at least two sides, plain background, exact material/scale detail.`,
  other: `Favor a clean, uncluttered background and enough angle coverage that a video model has real 3D information to work from.`,
};

const SYSTEM_PROMPT = `You are a prompt-engineering assistant for AI image generation, producing reference sheets for a video production (characters, locations, props) that must stay visually consistent once used in later video-generation shots. Write ONE finished, ready-to-paste image-generation prompt — no preamble, no options, no commentary — following the user's instruction and the guidance provided.`;

export async function draftAssetPrompt(input: AssetPromptDraftInput, model: AIModel): Promise<string> {
  if (!input.instruction.trim()) throw new Error("Describe what you want before generating a prompt.");

  const context = [
    `Asset: ${input.assetTitle}`,
    `Folder: ${input.folderName} (${input.folderKind})`,
    input.folderDescription?.trim() ? `Folder notes: ${input.folderDescription.trim()}` : "",
    input.scriptExcerpt?.trim() ? `Relevant script excerpt:\n${input.scriptExcerpt.trim()}` : "",
    `Guidance: ${KIND_GUIDANCE[input.folderKind]}`,
    `User request: ${input.instruction.trim()}`,
  ].filter(Boolean).join("\n\n");

  const text = await chatComplete(model, { system: SYSTEM_PROMPT, user: context, maxTokens: 900 });
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The model returned an empty prompt.");
  return trimmed;
}
