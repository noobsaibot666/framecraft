// Cinema Studio — Script page intelligence orchestration. Runs the same two
// AI detections the Scenes/Assets pages already offer independently
// (splitScriptIntoScenes, suggestFoldersFromScript), together, from the
// Script page — one entry point used both by the auto-run-on-approve path
// and by a manual "Analyze Script" re-run, so the two paths can't drift.
import { splitScriptIntoScenes } from "./cinemaSceneSplit";
import { suggestFoldersFromScript, type SuggestedFolder } from "./cinemaFolderSuggestions";
import { createCinemaScene, getScenesForProject } from "./cinemaScenes";
import { getFoldersForProject } from "./cinemaFolders";
import { nextCinemaProjectStatus, updateCinemaProject } from "./cinemaProjects";
import { accentIndexForSortOrder } from "./storytelling";
import type { AIModel, AIQuality } from "./aiConfig";
import type { CinemaProjectStatus } from "@/types";

export interface ScriptIntelligenceResult {
  scenesCreated: number;
  suggestedFolders: SuggestedFolder[];
}

/**
 * Splits the script into scenes (bulk-created directly, matching
 * CinemaScenes.tsx's existing "Split Script into Scenes" convention — no
 * accept step there) and suggests asset folders (returned, not created —
 * matching CinemaAssets.tsx's existing accept/dismiss convention, since
 * folder naming/kind benefits from a human glance). Both detections dedupe
 * against what already exists so a manual re-run is safe to click twice.
 */
export async function analyzeScript(
  projectId: string,
  scriptText: string,
  currentStatus: CinemaProjectStatus,
  model: AIModel,
  quality: AIQuality
): Promise<ScriptIntelligenceResult> {
  const [existingScenes, existingFolders, splitScenes, folderCandidates] = await Promise.all([
    getScenesForProject(projectId),
    getFoldersForProject(projectId),
    splitScriptIntoScenes(scriptText, model, quality),
    suggestFoldersFromScript(scriptText, model, quality),
  ]);

  const existingSceneTitles = new Set(existingScenes.map((s) => s.title.toLowerCase()));
  const newScenes = splitScenes.filter((s) => !existingSceneTitles.has(s.title.toLowerCase()));

  await Promise.all(newScenes.map((scene, i) => createCinemaScene({
    project_id: projectId,
    sort_order: existingScenes.length + i,
    title: scene.title,
    script_excerpt: scene.script_excerpt,
    summary: scene.summary,
    mood: scene.mood,
    accent_index: accentIndexForSortOrder(existingScenes.length + i),
  })));

  if (newScenes.length > 0) {
    const status = nextCinemaProjectStatus(currentStatus, "scenes");
    if (status !== currentStatus) await updateCinemaProject(projectId, { status });
  }

  const existingFolderNames = new Set(existingFolders.map((f) => f.name.toLowerCase()));
  const suggestedFolders = folderCandidates.filter((f) => !existingFolderNames.has(f.name.toLowerCase()));

  return { scenesCreated: newScenes.length, suggestedFolders };
}
