import { describe, expect, it } from "vitest";
import {
  createProject,
  getProjects,
  getProjectById,
  searchProjects,
  updateProject,
  deleteProject,
} from "./projects";
import type { ProjectStatus, Category } from "@/types";

// isTauri is false in Vitest — all calls use the in-memory _devStore

function proj(overrides: {
  title?: string;
  status?: ProjectStatus;
  category?: Category;
  client?: string;
} = {}) {
  return {
    title: overrides.title ?? "Test Project",
    status: overrides.status ?? ("draft" as ProjectStatus),
    category: overrides.category,
    client: overrides.client,
  };
}

describe("projects in-memory CRUD", () => {
  it("createProject returns a non-empty id", async () => {
    const id = await createProject(proj());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("getProjectById returns created project", async () => {
    const id = await createProject(proj({ title: "Campaign Alpha" }));
    const found = await getProjectById(id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Campaign Alpha");
    expect(found!.id).toBe(id);
  });

  it("getProjectById returns null for unknown id", async () => {
    const found = await getProjectById("nonexistent-proj-xyz-999");
    expect(found).toBeNull();
  });

  it("getProjects returns all stored projects", async () => {
    const beforeCount = (await getProjects()).length;
    await createProject(proj({ title: "Proj List A" }));
    await createProject(proj({ title: "Proj List B" }));
    const afterCount = (await getProjects()).length;
    expect(afterCount).toBe(beforeCount + 2);
  });

  it("getProjects filters by status", async () => {
    await createProject(proj({ title: "Active Campaign ZZA", status: "active" }));
    await createProject(proj({ title: "Draft Campaign ZZA", status: "draft" }));
    const actives = await getProjects({ status: "active" });
    expect(actives.every((p) => p.status === "active")).toBe(true);
  });

  it("getProjects returns archived projects in dev (no default filter)", async () => {
    await createProject(proj({ title: "Archived ZZB", status: "archived" }));
    const list = await getProjects();
    expect(list.some((p) => p.status === "archived")).toBe(true);
  });

  it("updateProject changes title", async () => {
    const id = await createProject(proj({ title: "Before Proj Update" }));
    await updateProject(id, { title: "After Proj Update" });
    const found = await getProjectById(id);
    expect(found!.title).toBe("After Proj Update");
  });

  it("updateProject changes status", async () => {
    const id = await createProject(proj({ title: "Status Changer", status: "draft" }));
    await updateProject(id, { status: "active" });
    const found = await getProjectById(id);
    expect(found!.status).toBe("active");
  });

  it("round trips project setup metadata", async () => {
    const id = await createProject({
      title: "Setup Metadata Project",
      project_type: "campaign",
      intended_output: "Launch-ready image and video prompt system",
      image_needs: "Hero stills and product closeups",
      video_needs: "Short motion tests",
      aspect_ratios: ["16:9", "4:5"],
      provider_targets: ["midjourney", "kling"],
      visual_direction: "Premium studio realism",
      constraints: "Avoid over-polished AI skin",
      creative_goals: "Build a reusable craft baseline",
    });

    await updateProject(id, {
      aspect_ratios: ["1:1"],
      provider_targets: ["midjourney", "runway"],
      creative_goals: "Updated production goal",
    });

    const found = await getProjectById(id);
    expect(found).toMatchObject({
      id,
      project_type: "campaign",
      intended_output: "Launch-ready image and video prompt system",
      image_needs: "Hero stills and product closeups",
      video_needs: "Short motion tests",
      aspect_ratios: ["1:1"],
      provider_targets: ["midjourney", "runway"],
      visual_direction: "Premium studio realism",
      constraints: "Avoid over-polished AI skin",
      creative_goals: "Updated production goal",
    });
  });

  it("deleteProject removes the project", async () => {
    const id = await createProject(proj({ title: "Will Be Deleted Project" }));
    expect(await getProjectById(id)).not.toBeNull();
    await deleteProject(id);
    expect(await getProjectById(id)).toBeNull();
  });

  it("searchProjects matches by title substring", async () => {
    await createProject(proj({ title: "XYZ_UNIQUE_PROJ_789 Summer Campaign" }));
    const results = await searchProjects("XYZ_UNIQUE_PROJ_789");
    expect(results.some((p) => p.title.includes("XYZ_UNIQUE_PROJ_789"))).toBe(true);
  });

  it("searchProjects with empty query returns all non-archived", async () => {
    const all = await getProjects();
    const searched = await searchProjects("");
    expect(searched.length).toBe(all.length);
  });
});
