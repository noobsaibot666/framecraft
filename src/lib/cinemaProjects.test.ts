import { describe, expect, it } from "vitest";
import {
  createCinemaProject,
  deleteCinemaProject,
  getCinemaProjectById,
  getCinemaProjects,
  nextCinemaProjectStatus,
  updateCinemaProject,
} from "./cinemaProjects";
import { createCinemaFolder } from "./cinemaFolders";
import { createCinemaAsset } from "./cinemaAssets";
import { createCinemaScene } from "./cinemaScenes";
import { createCinemaShot } from "./cinemaShots";

describe("cinema project development store", () => {
  it("creates a project with draft defaults", async () => {
    const id = await createCinemaProject({ title: "Desert Wanderer" });

    const project = await getCinemaProjectById(id);
    expect(project).not.toBeNull();
    expect(project!.title).toBe("Desert Wanderer");
    expect(project!.status).toBe("draft");
    expect(project!.script_status).toBe("draft");
  });

  it("persists chosen script/image/video providers", async () => {
    const id = await createCinemaProject({
      title: "Pirate Saga",
      script_model: "claude-sonnet-4-6",
      image_provider: "nano_banana",
      video_provider: "seedance",
    });

    const project = await getCinemaProjectById(id);
    expect(project!.script_model).toBe("claude-sonnet-4-6");
    expect(project!.image_provider).toBe("nano_banana");
    expect(project!.video_provider).toBe("seedance");
  });

  it("lists all created projects", async () => {
    const id = await createCinemaProject({ title: "Listed Project" });
    const projects = await getCinemaProjects();
    expect(projects.some((p) => p.id === id)).toBe(true);
  });

  it("updates script fields and status", async () => {
    const id = await createCinemaProject({ title: "Editable" });

    await updateCinemaProject(id, {
      script_content: "INT. CABIN - NIGHT...",
      script_idea: "A pirate finds a map.",
      script_status: "approved",
      status: "assets",
    });

    const project = await getCinemaProjectById(id);
    expect(project!.script_content).toBe("INT. CABIN - NIGHT...");
    expect(project!.script_idea).toBe("A pirate finds a map.");
    expect(project!.script_status).toBe("approved");
    expect(project!.status).toBe("assets");
  });

  it("deletes a project", async () => {
    const id = await createCinemaProject({ title: "Delete me" });
    await deleteCinemaProject(id);
    expect(await getCinemaProjectById(id)).toBeNull();
  });

  it("getCinemaProjectById and getCinemaProjects report real folder/asset/scene/shot counts", async () => {
    const projectId = await createCinemaProject({ title: "Counted Project" });
    const folderId = await createCinemaFolder({ project_id: projectId, name: "Characters" });
    await createCinemaAsset({ project_id: projectId, folder_id: folderId, tag: "@hero", title: "Hero" });
    const sceneId = await createCinemaScene({ project_id: projectId, title: "Opening" });
    await createCinemaShot({ scene_id: sceneId, project_id: projectId, label: "Shot 1" });

    const byId = await getCinemaProjectById(projectId);
    expect(byId!.folder_count).toBe(1);
    expect(byId!.asset_count).toBe(1);
    expect(byId!.scene_count).toBe(1);
    expect(byId!.shot_count).toBe(1);

    const list = await getCinemaProjects();
    const listed = list.find((p) => p.id === projectId)!;
    expect(listed.folder_count).toBe(1);
    expect(listed.asset_count).toBe(1);
    expect(listed.scene_count).toBe(1);
    expect(listed.shot_count).toBe(1);
  });
});

describe("nextCinemaProjectStatus", () => {
  it("advances forward when the target outranks the current status", () => {
    expect(nextCinemaProjectStatus("draft", "scripting")).toBe("scripting");
    expect(nextCinemaProjectStatus("assets", "scenes")).toBe("scenes");
  });

  it("never regresses a project that's already further along", () => {
    expect(nextCinemaProjectStatus("scenes", "assets")).toBe("scenes");
    expect(nextCinemaProjectStatus("scenes", "scripting")).toBe("scenes");
  });

  it("is a no-op once a project is archived or complete", () => {
    expect(nextCinemaProjectStatus("archived", "scenes")).toBe("archived");
    expect(nextCinemaProjectStatus("complete", "scenes")).toBe("complete");
  });
});
