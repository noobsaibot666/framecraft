import { describe, expect, it } from "vitest";
import {
  createCinemaShot,
  deleteCinemaShot,
  getCinemaShotById,
  getShotsForScene,
  reorderShots,
  updateCinemaShot,
} from "./cinemaShots";

describe("cinema shot development store", () => {
  it("creates a shot with draft defaults", async () => {
    const id = await createCinemaShot({ scene_id: "scene-a", project_id: "proj-a", label: "Shot 1" });
    const shot = await getCinemaShotById(id);
    expect(shot).not.toBeNull();
    expect(shot!.shot_type).toBe("hero");
    expect(shot!.status).toBe("draft");
    expect(shot!.is_broll).toBe(false);
  });

  it("creates a b-roll shot", async () => {
    const id = await createCinemaShot({ scene_id: "scene-b", project_id: "proj-b", label: "B-Roll 1", shot_type: "b_roll", is_broll: true });
    const shot = await getCinemaShotById(id);
    expect(shot!.shot_type).toBe("b_roll");
    expect(shot!.is_broll).toBe(true);
  });

  it("lists shots for a scene ordered by sort_order", async () => {
    const sceneId = "scene-c";
    const a = await createCinemaShot({ scene_id: sceneId, project_id: "proj-c", label: "A", sort_order: 1 });
    const b = await createCinemaShot({ scene_id: sceneId, project_id: "proj-c", label: "B", sort_order: 0 });

    const shots = await getShotsForScene(sceneId);
    const ids = shots.filter((s) => [a, b].includes(s.id)).map((s) => s.id);
    expect(ids).toEqual([b, a]);
  });

  it("updates notes and linked assets", async () => {
    const id = await createCinemaShot({ scene_id: "scene-d", project_id: "proj-d", label: "Shot" });
    await updateCinemaShot(id, {
      description: "Wide establishing shot",
      director_notes: "Hold longer than feels comfortable",
      linked_asset_ids: ["asset-1", "asset-2"],
    });

    const shot = await getCinemaShotById(id);
    expect(shot!.description).toBe("Wide establishing shot");
    expect(shot!.director_notes).toBe("Hold longer than feels comfortable");
    expect(shot!.linked_asset_ids).toEqual(["asset-1", "asset-2"]);
  });

  it("reorders shots within a scene", async () => {
    const sceneId = "scene-e";
    const a = await createCinemaShot({ scene_id: sceneId, project_id: "proj-e", label: "A", sort_order: 0 });
    const b = await createCinemaShot({ scene_id: sceneId, project_id: "proj-e", label: "B", sort_order: 1 });
    const c = await createCinemaShot({ scene_id: sceneId, project_id: "proj-e", label: "C", sort_order: 2 });

    await reorderShots(sceneId, [c, a, b]);

    const shots = await getShotsForScene(sceneId);
    expect(shots.map((s) => s.id)).toEqual([c, a, b]);
  });

  it("deletes a shot", async () => {
    const id = await createCinemaShot({ scene_id: "scene-f", project_id: "proj-f", label: "Delete me" });
    await deleteCinemaShot(id);
    expect(await getCinemaShotById(id)).toBeNull();
  });
});
