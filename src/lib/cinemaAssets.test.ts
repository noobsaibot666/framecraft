import { describe, expect, it } from "vitest";
import {
  computeGridPosition,
  createCinemaAsset,
  deleteCinemaAsset,
  getAssetsForFolder,
  getAssetsForProject,
  getCinemaAssetById,
  isTagTaken,
  suggestAssetTag,
  updateCinemaAsset,
} from "./cinemaAssets";
import { createCinemaShot, getCinemaShotById } from "./cinemaShots";

describe("computeGridPosition", () => {
  it("lays out positions in a 5-column grid, never colliding with (0,0) ambiguity", () => {
    expect(computeGridPosition(0)).toEqual({ x: 0, y: 0 });
    expect(computeGridPosition(1).x).toBeGreaterThan(0);
    expect(computeGridPosition(5).y).toBeGreaterThan(0);
    expect(computeGridPosition(5).x).toBe(0);
  });
});

describe("cinema asset development store", () => {
  it("creates an asset scoped to project and folder", async () => {
    const id = await createCinemaAsset({
      project_id: "asset-project-a",
      folder_id: "folder-1",
      tag: "@eduardo",
      title: "Eduardo",
      asset_type: "character_sheet",
    });

    const asset = await getCinemaAssetById(id);
    expect(asset).not.toBeNull();
    expect(asset!.tag).toBe("@eduardo");
    expect(asset!.asset_type).toBe("character_sheet");
    expect(asset!.is_primary).toBe(false);
    expect(asset!.canvas_x).toBe(0);
  });

  it("lists assets scoped to a folder and to a project", async () => {
    const projectId = "asset-project-b";
    await createCinemaAsset({ project_id: projectId, folder_id: "folder-b1", tag: "@a", title: "A" });
    await createCinemaAsset({ project_id: projectId, folder_id: "folder-b2", tag: "@b", title: "B" });

    expect((await getAssetsForFolder("folder-b1")).length).toBe(1);
    expect((await getAssetsForProject(projectId)).length).toBe(2);
  });

  it("updates prompt_text, is_primary, and merged_from provenance", async () => {
    const id = await createCinemaAsset({ project_id: "asset-project-c", folder_id: "folder-c", tag: "@sheet", title: "Sheet" });
    await updateCinemaAsset(id, { prompt_text: "A finished prompt", is_primary: true, merged_from: ["source-1", "source-2"] });

    const asset = await getCinemaAssetById(id);
    expect(asset!.prompt_text).toBe("A finished prompt");
    expect(asset!.is_primary).toBe(true);
    expect(asset!.merged_from).toEqual(["source-1", "source-2"]);
  });

  it("detects a taken tag case-insensitively, excluding the asset itself", async () => {
    const projectId = "asset-project-d";
    const id = await createCinemaAsset({ project_id: projectId, folder_id: "folder-d", tag: "@villain", title: "Villain" });

    expect(await isTagTaken(projectId, "@Villain")).toBe(true);
    expect(await isTagTaken(projectId, "@Villain", id)).toBe(false);
    expect(await isTagTaken(projectId, "@someone-else")).toBe(false);
  });

  it("suggests a deduped tag from a name", async () => {
    const projectId = "asset-project-e";
    await createCinemaAsset({ project_id: projectId, folder_id: "folder-e", tag: "@eduardo", title: "Eduardo" });

    expect(await suggestAssetTag(projectId, "Eduardo")).toBe("@eduardo_2");
    expect(await suggestAssetTag(projectId, "Someone New")).toBe("@someone_new");
  });

  it("deletes an asset", async () => {
    const id = await createCinemaAsset({ project_id: "asset-project-f", folder_id: "folder-f", tag: "@gone", title: "Gone" });
    await deleteCinemaAsset(id);
    expect(await getCinemaAssetById(id)).toBeNull();
  });

  it("deleting an asset purges its id from any shot's linked_asset_ids", async () => {
    const projectId = "asset-project-g";
    const assetId = await createCinemaAsset({ project_id: projectId, folder_id: "folder-g", tag: "@doomed", title: "Doomed" });
    const otherAssetId = await createCinemaAsset({ project_id: projectId, folder_id: "folder-g", tag: "@survivor", title: "Survivor" });
    const shotId = await createCinemaShot({
      scene_id: "scene-g",
      project_id: projectId,
      label: "Shot 1",
      linked_asset_ids: [assetId, otherAssetId],
    });

    await deleteCinemaAsset(assetId);

    const shot = await getCinemaShotById(shotId);
    expect(shot!.linked_asset_ids).toEqual([otherAssetId]);
  });
});
