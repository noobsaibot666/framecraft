import { describe, expect, it } from "vitest";
import {
  computeGridPosition,
  createAssetVersion,
  createCinemaAsset,
  deleteCinemaAsset,
  getAssetsForFolder,
  getAssetsForProject,
  getCinemaAssetById,
  groupAssetVersions,
  isTagTaken,
  stackedVersionPosition,
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

  it("a freshly created asset is its own single-version group", async () => {
    const id = await createCinemaAsset({ project_id: "asset-project-h", folder_id: "folder-h", tag: "@solo", title: "Solo" });
    const asset = await getCinemaAssetById(id);
    expect(asset!.version_group_id).toBe(id);
    expect(asset!.version_number).toBe(1);
    expect(asset!.locked).toBe(false);
  });

  it("createAssetVersion creates a V2 sibling carrying forward folder/type/provider/instruction, with a fresh prompt/image/rating slate", async () => {
    const projectId = "asset-project-i";
    const v1Id = await createCinemaAsset({
      project_id: projectId,
      folder_id: "folder-i",
      tag: "@hero_shot",
      title: "Hero Shot",
      asset_type: "product",
      provider: "midjourney",
      instruction: "A hero shot of the product on a pedestal",
    });
    await updateCinemaAsset(v1Id, { prompt_text: "the v1 prompt", rating: 2, feedback: "lighting too flat", file_data: "data:image/png;base64,x" });

    const v1 = (await getCinemaAssetById(v1Id))!;
    const v2Id = await createAssetVersion(v1);
    const v2 = (await getCinemaAssetById(v2Id))!;

    expect(v2.title).toBe("Hero Shot V2");
    expect(v2.tag).toBe("@hero_shot_v2");
    expect(v2.version_number).toBe(2);
    expect(v2.version_group_id).toBe(v1Id);
    expect(v2.folder_id).toBe("folder-i");
    expect(v2.asset_type).toBe("product");
    expect(v2.provider).toBe("midjourney");
    expect(v2.instruction).toBe("A hero shot of the product on a pedestal");
    expect(v2.prompt_text).toBeUndefined();
    expect(v2.file_data).toBeUndefined();
    expect(v2.rating).toBeUndefined();
    expect(v2.locked).toBe(false);

    // Retroactively labeled once a second version exists.
    const v1AfterVersioning = (await getCinemaAssetById(v1Id))!;
    expect(v1AfterVersioning.title).toBe("Hero Shot V1");
    expect(v1AfterVersioning.version_group_id).toBe(v1Id);
  });

  it("createAssetVersion on an already-versioned asset keeps incrementing and dedupes tags", async () => {
    const projectId = "asset-project-j";
    const v1Id = await createCinemaAsset({ project_id: projectId, folder_id: "folder-j", tag: "@scene", title: "Scene" });
    const v2Id = await createAssetVersion((await getCinemaAssetById(v1Id))!);
    const v3Id = await createAssetVersion((await getCinemaAssetById(v2Id))!);

    const v3 = (await getCinemaAssetById(v3Id))!;
    expect(v3.title).toBe("Scene V3");
    expect(v3.tag).toBe("@scene_v3");
    expect(v3.version_number).toBe(3);
    expect(v3.version_group_id).toBe(v1Id);
  });

  it("new versions cascade diagonally from the stack's root position, not the global grid", async () => {
    const projectId = "asset-project-cascade";
    const v1Id = await createCinemaAsset({
      project_id: projectId, folder_id: "folder-cascade", tag: "@cascade", title: "Cascade",
      canvas_x: 200, canvas_y: 100,
    });
    const v2Id = await createAssetVersion((await getCinemaAssetById(v1Id))!);
    const v3Id = await createAssetVersion((await getCinemaAssetById(v2Id))!);

    const v2 = (await getCinemaAssetById(v2Id))!;
    const v3 = (await getCinemaAssetById(v3Id))!;
    expect(stackedVersionPosition({ canvas_x: 200, canvas_y: 100 }, 2)).toEqual({ x: 236, y: 136 });
    expect(v2.canvas_x).toBe(236);
    expect(v2.canvas_y).toBe(136);
    expect(v3.canvas_x).toBe(272);
    expect(v3.canvas_y).toBe(172);
  });

  it("groupAssetVersions groups siblings by version_group_id and sorts each stack by version_number", async () => {
    const projectId = "asset-project-k";
    const v1Id = await createCinemaAsset({ project_id: projectId, folder_id: "folder-k", tag: "@grouped", title: "Grouped" });
    const v2Id = await createAssetVersion((await getCinemaAssetById(v1Id))!);
    const otherId = await createCinemaAsset({ project_id: projectId, folder_id: "folder-k", tag: "@unrelated", title: "Unrelated" });

    const assets = await getAssetsForFolder("folder-k");
    const groups = groupAssetVersions(assets);

    expect(groups.length).toBe(2);
    const versionedGroup = groups.find((g) => g.some((a) => a.id === v1Id))!;
    expect(versionedGroup.map((a) => a.id)).toEqual([v1Id, v2Id]);
    const soloGroup = groups.find((g) => g.some((a) => a.id === otherId))!;
    expect(soloGroup.length).toBe(1);
  });
});
