import { describe, expect, it } from "vitest";
import {
  createCinemaProject,
  deleteCinemaProject,
  getCinemaProjectById,
  getCinemaProjects,
  updateCinemaProject,
} from "./cinemaProjects";

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
});
