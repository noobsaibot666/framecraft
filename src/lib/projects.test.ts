import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProjectResetBatchSql,
  createProject,
  getProjects,
  getProjectById,
  searchProjects,
  updateProject,
  deleteProject,
  addPromptToProject,
  removePromptFromProject,
  getPromptsForProject,
} from "./projects";
import { createPrompt, getPromptById } from "./db";
import type { ProjectStatus, Category } from "@/types";

// db.ts's dev-mode prompt store is backed by localStorage, which Vitest's
// default "node" environment doesn't provide as a global — mock it so
// createPrompt/getPromptById round-trip across calls the way they do in a
// real browser dev session (same pattern as promptFormula.test.ts).
const _localStorageBacking = new Map<string, string>();
beforeEach(() => {
  _localStorageBacking.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => _localStorageBacking.get(key) ?? null,
      setItem: (key: string, value: string) => _localStorageBacking.set(key, value),
      removeItem: (key: string) => _localStorageBacking.delete(key),
      clear: () => _localStorageBacking.clear(),
    },
  });
});

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
      campaign_id: "campaign-round-trip",
    });

    await updateProject(id, {
      aspect_ratios: ["1:1"],
      provider_targets: ["midjourney", "runway"],
      creative_goals: "Updated production goal",
      campaign_id: "campaign-round-trip",
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
      campaign_id: "campaign-round-trip",
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

describe("project reset SQL", () => {
  it("keeps SQL-shaped project IDs inside escaped batch literals", () => {
    const projectId = "project'; DELETE FROM projects; --";
    const sql = buildProjectResetBatchSql(projectId, "2026-06-30T10:15:00.000Z");

    expect(sql.match(/'project''; DELETE FROM projects; --'/g)).toHaveLength(9);
    expect(sql).toContain("updated_at = '2026-06-30T10:15:00.000Z'");
    expect(sql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
  });
});

// Audit doc 05 §8 — dev/browser-mode (isTauri false in Vitest) previously
// had no real project<->prompt linking and dropped builder_state on create,
// reproducing the exact "prompt doesn't show in its project" and "builder
// fields empty on reopen" bugs outside the packaged Tauri app.
describe("dev-mode project<->prompt linking (audit doc 05 §8)", () => {
  it("a prompt linked to a project appears in getPromptsForProject", async () => {
    const projectId = await createProject(proj({ title: "Linking Test Project" }));
    const promptId = await createPrompt({
      title: "Linked Prompt",
      provider: "midjourney",
      prompt_text: "a red vintage car",
    });
    await addPromptToProject(projectId, promptId);

    const linked = await getPromptsForProject(projectId);
    expect(linked.map((p) => p.id)).toContain(promptId);
    expect(linked.find((p) => p.id === promptId)?.title).toBe("Linked Prompt");
  });

  it("removePromptFromProject unlinks the prompt", async () => {
    const projectId = await createProject(proj({ title: "Unlink Test Project" }));
    const promptId = await createPrompt({
      title: "Prompt To Unlink",
      provider: "midjourney",
      prompt_text: "a mountain lake",
    });
    await addPromptToProject(projectId, promptId);
    await removePromptFromProject(projectId, promptId);

    const linked = await getPromptsForProject(projectId);
    expect(linked.map((p) => p.id)).not.toContain(promptId);
  });

  it("linking the same prompt twice does not duplicate it", async () => {
    const projectId = await createProject(proj({ title: "Dedup Test Project" }));
    const promptId = await createPrompt({
      title: "Duplicate Link Prompt",
      provider: "midjourney",
      prompt_text: "a city skyline",
    });
    await addPromptToProject(projectId, promptId);
    await addPromptToProject(projectId, promptId);

    const linked = await getPromptsForProject(projectId);
    expect(linked.filter((p) => p.id === promptId)).toHaveLength(1);
  });

  it("getPromptsForProject returns an empty array for a project with no linked prompts", async () => {
    const projectId = await createProject(proj({ title: "Empty Project" }));
    expect(await getPromptsForProject(projectId)).toEqual([]);
  });
});

describe("dev-mode createPrompt persists builder_state (audit doc 05 §8)", () => {
  it("builder_state survives the initial create, not just update", async () => {
    const builderState = JSON.stringify({ mode: "builder", subject: "a lighthouse at dusk" });
    const promptId = await createPrompt({
      title: "Builder State Prompt",
      provider: "midjourney",
      prompt_text: "a lighthouse at dusk",
      builder_state: builderState,
    });

    const reloaded = await getPromptById(promptId);
    expect(reloaded?.builder_state).toBe(builderState);
  });
});
