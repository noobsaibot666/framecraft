// Cinema Studio — script-driven folder suggestions (Phase 120). Reads the
// approved script and proposes the characters/locations/props that will need
// asset folders, mirroring the user's own example ("if scripts has Ben,
// House, Jungle, car... the application need to catch the keywords").
import { chatComplete } from "./aiClient";
import { extractJson } from "./creativeDirectionGeneration";
import type { AIModel } from "./aiConfig";
import type { CinemaFolderKind } from "@/types";

export interface SuggestedFolder {
  name: string;
  kind: CinemaFolderKind;
}

const FOLDER_SYSTEM_PROMPT = `You are a video-production coordinator reading a script to plan asset folders (character sheets, location references, product references, prop references). Extract every distinct character, location, product, and prop that will need its own visual reference. Skip generic background elements with no visual reference need.

Distinguish "product" from "prop" carefully — they are not the same kind:
- "product" is the item the piece exists to advertise or showcase — the hero the script is built around (e.g. the watch in a watch ad, the sneaker in a sneaker ad). There is usually only one product, occasionally a small family of variants. It typically gets the most deliberate, camera-favoring treatment in the script (close-ups, hero shots, the "reveal").
- "prop" is everything else the characters merely interact with or that dresses the scene (a coffee cup, a suitcase, a phone) — incidental, not what the piece is selling.

If the script is not an advertisement (no featured product), it's fine to return zero "product" entries — don't force one.

Return only valid JSON, no commentary.`;

const JSON_SHAPE = `{
  "folders": [
    { "name": "Eduardo", "kind": "character" },
    { "name": "Captain's Cabin", "kind": "location" },
    { "name": "RIMOWA Aluminum Case", "kind": "product" },
    { "name": "Treasure Map", "kind": "prop" }
  ]
}`;

export function parseSuggestedFolders(raw: string): SuggestedFolder[] {
  const parsed = extractJson(raw) as { folders?: unknown };
  if (!Array.isArray(parsed?.folders)) throw new Error("Folder suggestions must return a folders array.");
  const validKinds: CinemaFolderKind[] = ["character", "location", "prop", "product", "other"];
  const seen = new Set<string>();
  const result: SuggestedFolder[] = [];
  for (const candidate of parsed.folders) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const kindRaw = typeof record.kind === "string" ? record.kind.trim() : "other";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = (validKinds as string[]).includes(kindRaw) ? (kindRaw as CinemaFolderKind) : "other";
    result.push({ name, kind });
  }
  return result;
}

export async function suggestFoldersFromScript(scriptText: string, model: AIModel): Promise<SuggestedFolder[]> {
  if (!scriptText.trim()) throw new Error("Approve a script before requesting folder suggestions.");
  const text = await chatComplete(model, {
    system: FOLDER_SYSTEM_PROMPT,
    user: `Script:\n\n${scriptText.trim()}\n\nReturn only valid JSON in this exact structure:\n${JSON_SHAPE}`,
    maxTokens: 1200,
  });
  return parseSuggestedFolders(text);
}
