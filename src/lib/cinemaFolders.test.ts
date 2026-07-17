import { describe, expect, it } from "vitest";
import { createCinemaFolder, deleteCinemaFolder, getFoldersForProject, getOrCreateMasterFolder, updateCinemaFolder } from "./cinemaFolders";
import { createCinemaAsset, getCinemaAssetById } from "./cinemaAssets";
import { createCinemaShot, getCinemaShotById } from "./cinemaShots";

describe("cinema folder development store", () => {
  it("creates a root folder with defaults", async () => {
    const id = await createCinemaFolder({ project_id: "folder-project-a", name: "Characters" });
    const folders = await getFoldersForProject("folder-project-a");
    const folder = folders.find((f) => f.id === id)!;
    expect(folder.name).toBe("Characters");
    expect(folder.kind).toBe("other");
    expect(folder.parent_id).toBeUndefined();
  });

  it("creates a nested subfolder", async () => {
    const projectId = "folder-project-b";
    const root = await createCinemaFolder({ project_id: projectId, name: "Characters", kind: "character" });
    const child = await createCinemaFolder({ project_id: projectId, parent_id: root, name: "Eduardo", kind: "character" });

    const folders = await getFoldersForProject(projectId);
    const childFolder = folders.find((f) => f.id === child)!;
    expect(childFolder.parent_id).toBe(root);
  });

  it("updates name, description, and accent color", async () => {
    const id = await createCinemaFolder({ project_id: "folder-project-c", name: "Props" });
    await updateCinemaFolder(id, { name: "Renamed Props", description: "Ship cannon, spyglass", accent_color: "#38B7C8" });

    const folder = (await getFoldersForProject("folder-project-c")).find((f) => f.id === id)!;
    expect(folder.name).toBe("Renamed Props");
    expect(folder.description).toBe("Ship cannon, spyglass");
    expect(folder.accent_color).toBe("#38B7C8");
  });

  it("deletes a folder and its descendant subfolders", async () => {
    const projectId = "folder-project-d";
    const root = await createCinemaFolder({ project_id: projectId, name: "Locations" });
    const child = await createCinemaFolder({ project_id: projectId, parent_id: root, name: "Jungle" });

    await deleteCinemaFolder(root);

    const folders = await getFoldersForProject(projectId);
    expect(folders.some((f) => f.id === root)).toBe(false);
    expect(folders.some((f) => f.id === child)).toBe(false);
  });

  it("deleting a folder also removes its assets and purges them from any shot's linked_asset_ids", async () => {
    const projectId = "folder-project-h";
    const root = await createCinemaFolder({ project_id: projectId, name: "Characters", kind: "character" });
    const child = await createCinemaFolder({ project_id: projectId, parent_id: root, name: "Eduardo", kind: "character" });
    const assetId = await createCinemaAsset({ project_id: projectId, folder_id: child, tag: "@eduardo", title: "Eduardo" });
    const otherAssetId = await createCinemaAsset({ project_id: projectId, folder_id: root, tag: "@villain", title: "Villain" });
    const shotId = await createCinemaShot({
      scene_id: "scene-h",
      project_id: projectId,
      label: "Shot 1",
      linked_asset_ids: [assetId, otherAssetId],
    });

    await deleteCinemaFolder(root);

    expect(await getCinemaAssetById(assetId)).toBeNull();
    expect(await getCinemaAssetById(otherAssetId)).toBeNull();
    const shot = await getCinemaShotById(shotId);
    expect(shot!.linked_asset_ids).toEqual([]);
  });

  it("getOrCreateMasterFolder creates a root master folder named for the kind", async () => {
    const projectId = "folder-project-e";
    const masterId = await getOrCreateMasterFolder(projectId, "character");

    const folders = await getFoldersForProject(projectId);
    const master = folders.find((f) => f.id === masterId)!;
    expect(master.name).toBe("Characters");
    expect(master.kind).toBe("character");
    expect(master.parent_id).toBeUndefined();
  });

  it("getOrCreateMasterFolder reuses the existing master instead of creating a duplicate", async () => {
    const projectId = "folder-project-f";
    const first = await getOrCreateMasterFolder(projectId, "location");
    const second = await getOrCreateMasterFolder(projectId, "location");

    expect(second).toBe(first);
    const folders = await getFoldersForProject(projectId);
    expect(folders.filter((f) => f.name === "Locations").length).toBe(1);
  });

  it("getOrCreateMasterFolder keeps separate masters per kind", async () => {
    const projectId = "folder-project-g";
    const characterMaster = await getOrCreateMasterFolder(projectId, "character");
    const propMaster = await getOrCreateMasterFolder(projectId, "prop");

    expect(characterMaster).not.toBe(propMaster);
    const folders = await getFoldersForProject(projectId);
    expect(folders.map((f) => f.name).sort()).toEqual(["Characters", "Props"]);
  });
});
