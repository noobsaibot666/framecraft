import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));
import {
  createDeliverable,
  getDeliverablesForProject,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  advanceDeliverable,
  retreatDeliverable,
  nextStatus,
  prevStatus,
  isMissingResult,
  STATUS_ORDER,
  type CreateDeliverableInput,
} from "./deliverables";
import type { Deliverable, DeliverableStatus } from "@/types";

// isTauri is false in Vitest — all calls use the in-memory _devStore

function del(overrides: Partial<CreateDeliverableInput> = {}): CreateDeliverableInput {
  return {
    project_id: "proj_test",
    title: "Test Deliverable",
    status: "planned",
    ...overrides,
  };
}

function mockDeliverable(overrides: Partial<Deliverable> = {}): Deliverable {
  return {
    id: "d1",
    project_id: "proj1",
    title: "Hero Banner",
    status: "planned",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Status helpers ───────────────────────────────────────────

describe("nextStatus", () => {
  it("advances through the full order", () => {
    expect(nextStatus("planned")).toBe("prompting");
    expect(nextStatus("prompting")).toBe("generating");
    expect(nextStatus("generating")).toBe("review");
    expect(nextStatus("review")).toBe("selected");
    expect(nextStatus("selected")).toBe("final");
  });

  it("returns null at final", () => {
    expect(nextStatus("final")).toBeNull();
  });
});

describe("prevStatus", () => {
  it("retreats through the full order", () => {
    expect(prevStatus("final")).toBe("selected");
    expect(prevStatus("selected")).toBe("review");
    expect(prevStatus("review")).toBe("generating");
    expect(prevStatus("generating")).toBe("prompting");
    expect(prevStatus("prompting")).toBe("planned");
  });

  it("returns null at planned", () => {
    expect(prevStatus("planned")).toBeNull();
  });
});

describe("STATUS_ORDER", () => {
  it("has 6 statuses in correct sequence", () => {
    expect(STATUS_ORDER).toHaveLength(6);
    expect(STATUS_ORDER[0]).toBe("planned");
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe("final");
  });
});

// ─── Missing result check ─────────────────────────────────────

describe("isMissingResult", () => {
  it("returns false for planned and prompting (no result yet expected)", () => {
    expect(isMissingResult(mockDeliverable({ status: "planned" }))).toBe(false);
    expect(isMissingResult(mockDeliverable({ status: "prompting" }))).toBe(false);
  });

  it("returns true for generating+ when no result linked", () => {
    expect(isMissingResult(mockDeliverable({ status: "generating" }))).toBe(true);
    expect(isMissingResult(mockDeliverable({ status: "review" }))).toBe(true);
    expect(isMissingResult(mockDeliverable({ status: "selected" }))).toBe(true);
    expect(isMissingResult(mockDeliverable({ status: "final" }))).toBe(true);
  });

  it("returns false when result is linked at any status", () => {
    const statuses: DeliverableStatus[] = ["generating", "review", "selected", "final"];
    for (const status of statuses) {
      expect(isMissingResult(mockDeliverable({ status, linked_result_id: "result_abc" }))).toBe(false);
    }
  });
});

// ─── CRUD ─────────────────────────────────────────────────────

describe("deliverables in-memory CRUD", () => {
  it("createDeliverable returns a non-empty id", async () => {
    const id = await createDeliverable(del());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("getDeliverableById returns the created deliverable", async () => {
    const id = await createDeliverable(del({ title: "Hero Banner A" }));
    const found = await getDeliverableById(id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Hero Banner A");
    expect(found!.status).toBe("planned");
  });

  it("getDeliverableById returns null for unknown id", async () => {
    expect(await getDeliverableById("nonexistent-del-xyz")).toBeNull();
  });

  it("getDeliverablesForProject returns deliverables for correct project", async () => {
    const projId = "proj_unique_" + Date.now();
    await createDeliverable(del({ project_id: projId, title: "A" }));
    await createDeliverable(del({ project_id: projId, title: "B" }));
    const list = await getDeliverablesForProject(projId);
    expect(list).toHaveLength(2);
    expect(list.every((d) => d.project_id === projId)).toBe(true);
  });

  it("getDeliverablesForProject sorts by sort_order then created_at", async () => {
    const projId = "proj_sort_" + Date.now();
    await createDeliverable(del({ project_id: projId, title: "B", sort_order: 2 }));
    await createDeliverable(del({ project_id: projId, title: "A", sort_order: 1 }));
    const list = await getDeliverablesForProject(projId);
    expect(list[0].title).toBe("A");
    expect(list[1].title).toBe("B");
  });

  it("updateDeliverable changes title", async () => {
    const id = await createDeliverable(del({ title: "Before" }));
    await updateDeliverable(id, { title: "After" });
    expect((await getDeliverableById(id))!.title).toBe("After");
  });

  it("updateDeliverable changes status", async () => {
    const id = await createDeliverable(del({ status: "planned" }));
    await updateDeliverable(id, { status: "review" });
    expect((await getDeliverableById(id))!.status).toBe("review");
  });

  it("updateDeliverable sets linked_prompt_id", async () => {
    const id = await createDeliverable(del());
    await updateDeliverable(id, { linked_prompt_id: "prompt_abc" });
    expect((await getDeliverableById(id))!.linked_prompt_id).toBe("prompt_abc");
  });

  it("deleteDeliverable removes the deliverable", async () => {
    const id = await createDeliverable(del({ title: "To Delete" }));
    await deleteDeliverable(id);
    expect(await getDeliverableById(id)).toBeNull();
  });
});

// ─── Status movement ──────────────────────────────────────────

describe("advanceDeliverable", () => {
  it("moves deliverable to next status", async () => {
    const id = await createDeliverable(del({ status: "planned" }));
    const next = await advanceDeliverable(id);
    expect(next).toBe("prompting");
    expect((await getDeliverableById(id))!.status).toBe("prompting");
  });

  it("returns null and stays at final", async () => {
    const id = await createDeliverable(del({ status: "final" }));
    const next = await advanceDeliverable(id);
    expect(next).toBeNull();
    expect((await getDeliverableById(id))!.status).toBe("final");
  });

  it("advances through full pipeline", async () => {
    const id = await createDeliverable(del({ status: "planned" }));
    for (const expected of ["prompting", "generating", "review", "selected", "final"] as DeliverableStatus[]) {
      const next = await advanceDeliverable(id);
      expect(next).toBe(expected);
    }
  });
});

describe("retreatDeliverable", () => {
  it("moves deliverable to previous status", async () => {
    const id = await createDeliverable(del({ status: "review" }));
    const prev = await retreatDeliverable(id);
    expect(prev).toBe("generating");
    expect((await getDeliverableById(id))!.status).toBe("generating");
  });

  it("returns null and stays at planned", async () => {
    const id = await createDeliverable(del({ status: "planned" }));
    const prev = await retreatDeliverable(id);
    expect(prev).toBeNull();
  });
});

// ─── DB error propagation (Tauri branch) ─────────────────────

describe("deliverables DB error propagation", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("getDeliverablesForProject propagates DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue({ select: () => Promise.reject("disk I/O error"), execute: vi.fn() });
    const { getDeliverablesForProject: fresh } = await import("./deliverables");
    await expect(fresh("proj")).rejects.toThrow("getDeliverablesForProject: disk I/O error");
  });

  it("getDeliverableById propagates DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue({ select: () => Promise.reject("SQLITE_BUSY"), execute: vi.fn() });
    const { getDeliverableById: fresh } = await import("./deliverables");
    await expect(fresh("d")).rejects.toThrow("getDeliverableById: SQLITE_BUSY");
  });

  it("getReferencesForDeliverable propagates DB errors", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    mocks.getDb.mockResolvedValue({ select: () => Promise.reject("corrupt page"), execute: vi.fn() });
    const { getReferencesForDeliverable: fresh } = await import("./deliverables");
    await expect(fresh("d")).rejects.toThrow("getReferencesForDeliverable: corrupt page");
  });
});
