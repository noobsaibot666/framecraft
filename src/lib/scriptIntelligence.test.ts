import { describe, expect, it, vi } from "vitest";
import { analyzeScript } from "./scriptIntelligence";
import { createCinemaProject, getCinemaProjectById } from "./cinemaProjects";
import { createCinemaScene, getScenesForProject } from "./cinemaScenes";
import { createCinemaFolder, getFoldersForProject } from "./cinemaFolders";
import type { AIModel } from "./aiConfig";
import type { SplitScene } from "./cinemaSceneSplit";
import type { SuggestedFolder } from "./cinemaFolderSuggestions";

const mocks = vi.hoisted(() => ({
  splitScriptIntoScenes: vi.fn<(...args: unknown[]) => Promise<SplitScene[]>>(),
  suggestFoldersFromScript: vi.fn<(...args: unknown[]) => Promise<SuggestedFolder[]>>(),
}));
vi.mock("./cinemaSceneSplit", () => ({ splitScriptIntoScenes: mocks.splitScriptIntoScenes }));
vi.mock("./cinemaFolderSuggestions", () => ({ suggestFoldersFromScript: mocks.suggestFoldersFromScript }));

const dummyModel: AIModel = { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic", tier: "balanced" };

const SCENES: SplitScene[] = [
  { title: "Scene 1 — The Cabin", script_excerpt: "INT. CABIN", summary: "Ben arrives.", mood: "tense" },
  { title: "Scene 2 — The Jungle", script_excerpt: "EXT. JUNGLE", summary: "Ben treks onward.", mood: "action" },
];

const FOLDERS: SuggestedFolder[] = [
  { name: "Ben", kind: "character" },
  { name: "House", kind: "location" },
];

describe("analyzeScript", () => {
  it("creates all detected scenes, bumps status to scenes, and returns all folder suggestions on a fresh project", async () => {
    mocks.splitScriptIntoScenes.mockReset().mockResolvedValue(SCENES);
    mocks.suggestFoldersFromScript.mockReset().mockResolvedValue(FOLDERS);

    const projectId = await createCinemaProject({ title: "Treasure Hunt" });

    const result = await analyzeScript(projectId, "INT. CABIN...", "scripting", dummyModel, "standard");

    expect(result.scenesCreated).toBe(2);
    expect(result.suggestedFolders).toEqual(FOLDERS);

    const scenes = await getScenesForProject(projectId);
    expect(scenes.map((s) => s.title)).toEqual(SCENES.map((s) => s.title));

    const project = await getCinemaProjectById(projectId);
    expect(project?.status).toBe("scenes");
  });

  it("dedupes against existing scenes and folders on a re-run", async () => {
    mocks.splitScriptIntoScenes.mockReset().mockResolvedValue(SCENES);
    mocks.suggestFoldersFromScript.mockReset().mockResolvedValue(FOLDERS);

    const projectId = await createCinemaProject({ title: "Treasure Hunt 2" });
    await createCinemaScene({ project_id: projectId, sort_order: 0, title: SCENES[0].title });
    await createCinemaFolder({ project_id: projectId, name: FOLDERS[0].name, kind: FOLDERS[0].kind });

    const result = await analyzeScript(projectId, "INT. CABIN...", "assets", dummyModel, "standard");

    // Only the second (non-duplicate) scene/folder should come through.
    expect(result.scenesCreated).toBe(1);
    expect(result.suggestedFolders).toEqual([FOLDERS[1]]);

    const scenes = await getScenesForProject(projectId);
    expect(scenes).toHaveLength(2);
    const folders = await getFoldersForProject(projectId);
    expect(folders).toHaveLength(1); // suggestion wasn't auto-created, only the pre-existing one is there
  });

  it("does not regress project status, and leaves status untouched when no new scenes are created", async () => {
    mocks.splitScriptIntoScenes.mockReset().mockResolvedValue([SCENES[0]]);
    mocks.suggestFoldersFromScript.mockReset().mockResolvedValue([]);

    const projectId = await createCinemaProject({ title: "Treasure Hunt 3" });
    await createCinemaScene({ project_id: projectId, sort_order: 0, title: SCENES[0].title });

    const result = await analyzeScript(projectId, "INT. CABIN...", "complete", dummyModel, "standard");

    // No new scenes → analyzeScript never calls updateCinemaProject, so the
    // project's real stored status (still "draft" from creation) is untouched.
    expect(result.scenesCreated).toBe(0);
    const project = await getCinemaProjectById(projectId);
    expect(project?.status).toBe("draft");
  });
});
