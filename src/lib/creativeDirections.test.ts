import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));
import {
  createCreativeDirection,
  deleteCreativeDirection,
  getCreativeDirections,
  selectCreativeDirection,
  updateCreativeDirection,
} from "./creativeDirections";

describe("creative direction development store", () => {
  it("creates and returns project-scoped directions", async () => {
    const id = await createCreativeDirection({
      project_id: "direction-project-a",
      title: "Material Honesty",
      campaign_idea: "Show the product through tactile material details.",
    });

    const directions = await getCreativeDirections("direction-project-a");
    expect(directions.some((direction) => direction.id === id)).toBe(true);
    expect(directions.find((direction) => direction.id === id)?.visual_aesthetic).toBe("");
    expect((await getCreativeDirections("direction-project-b")).some((direction) => direction.id === id)).toBe(false);
  });

  it("updates editable direction fields", async () => {
    const id = await createCreativeDirection({ project_id: "direction-update", title: "Before" });
    await updateCreativeDirection(id, { title: "After", tone: "Quiet confidence" });

    const direction = (await getCreativeDirections("direction-update")).find((item) => item.id === id);
    expect(direction?.title).toBe("After");
    expect(direction?.tone).toBe("Quiet confidence");
  });

  it("keeps one selected direction per project", async () => {
    const projectId = "direction-selection";
    const first = await createCreativeDirection({ project_id: projectId, title: "First" });
    const second = await createCreativeDirection({ project_id: projectId, title: "Second" });

    await selectCreativeDirection(projectId, first);
    await selectCreativeDirection(projectId, second);

    const selected = (await getCreativeDirections(projectId)).filter((direction) => direction.is_selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(second);
  });

  it("deletes a direction", async () => {
    const projectId = "direction-delete";
    const id = await createCreativeDirection({ project_id: projectId, title: "Delete me" });
    await deleteCreativeDirection(id);
    expect((await getCreativeDirections(projectId)).some((direction) => direction.id === id)).toBe(false);
  });
});

// ─── DB error propagation (Tauri branch) ─────────────────────

describe("creativeDirections DB error propagation", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("getCreativeDirections propagates DB errors with operation context", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue({ select: () => Promise.reject("disk I/O error"), execute: vi.fn() });
    const { getCreativeDirections: fresh } = await import("./creativeDirections");
    await expect(fresh("proj")).rejects.toThrow("getCreativeDirections: disk I/O error");
  });
});
