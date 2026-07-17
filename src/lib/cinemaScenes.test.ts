import { describe, expect, it } from "vitest";
import {
  createCinemaScene,
  deleteCinemaScene,
  getCinemaSceneById,
  getScenesForProject,
  reorderScenes,
  updateCinemaScene,
} from "./cinemaScenes";

describe("cinema scene development store", () => {
  it("creates a scene with draft status", async () => {
    const id = await createCinemaScene({ project_id: "scene-project-a", title: "Scene 1" });
    const scene = await getCinemaSceneById(id);
    expect(scene).not.toBeNull();
    expect(scene!.title).toBe("Scene 1");
    expect(scene!.status).toBe("draft");
  });

  it("lists scenes ordered by sort_order", async () => {
    const projectId = "scene-project-b";
    const a = await createCinemaScene({ project_id: projectId, title: "A", sort_order: 1 });
    const b = await createCinemaScene({ project_id: projectId, title: "B", sort_order: 0 });

    const scenes = await getScenesForProject(projectId);
    const ids = scenes.filter((s) => [a, b].includes(s.id)).map((s) => s.id);
    expect(ids).toEqual([b, a]);
  });

  it("updates title, mood, and status", async () => {
    const id = await createCinemaScene({ project_id: "scene-project-c", title: "Original" });
    await updateCinemaScene(id, { title: "Renamed", mood: "tense", status: "ready" });

    const scene = await getCinemaSceneById(id);
    expect(scene!.title).toBe("Renamed");
    expect(scene!.mood).toBe("tense");
    expect(scene!.status).toBe("ready");
  });

  it("reorders scenes by reassigning sort_order", async () => {
    const projectId = "scene-project-d";
    const a = await createCinemaScene({ project_id: projectId, title: "A", sort_order: 0 });
    const b = await createCinemaScene({ project_id: projectId, title: "B", sort_order: 1 });
    const c = await createCinemaScene({ project_id: projectId, title: "C", sort_order: 2 });

    await reorderScenes(projectId, [c, a, b]);

    const scenes = await getScenesForProject(projectId);
    const reordered = scenes.filter((s) => [a, b, c].includes(s.id));
    expect(reordered.map((s) => s.id)).toEqual([c, a, b]);
  });

  it("deletes a scene", async () => {
    const id = await createCinemaScene({ project_id: "scene-project-e", title: "Delete me" });
    await deleteCinemaScene(id);
    expect(await getCinemaSceneById(id)).toBeNull();
  });
});
