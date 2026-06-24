import { describe, expect, it } from "vitest";
import {
  generateSuggestions,
  createThread,
  getThreadsForProject,
  getThread,
  deleteThread,
  addMessage,
  getMessages,
} from "./assistant";
import type { ProjectContextPack } from "@/types";

// isTauri is false in Vitest — all calls use in-memory stores

function makePack(overrides: Partial<ProjectContextPack> = {}): ProjectContextPack {
  return {
    project: { id: "proj1", title: "Test Project", status: "active" },
    prompts: { total: 0, winners: 0, failed: 0, avgRating: 0, top: [] },
    results: { total: 0, winners: 0, failed: 0, avgScore: 0 },
    references: { total: 0, kinds: [] },
    deliverables: { total: 0, byStatus: {}, missingResults: 0 },
    ...overrides,
  };
}

// ─── generateSuggestions ──────────────────────────────────────

describe("generateSuggestions", () => {
  it("suggests start crafting when no prompts exist", () => {
    const s = generateSuggestions(makePack());
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("no prompts"))).toBe(true);
  });

  it("suggests generate results when prompts exist but no results", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [] },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("no results"))).toBe(true);
  });

  it("suggests marking winners when results >= 3 but none marked", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [] },
      results: { total: 4, winners: 0, failed: 0, avgScore: 6 },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("winners marked"))).toBe(true);
  });

  it("suggests build on winner when prompt winner exists", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 1, failed: 0, avgRating: 8, top: [] },
      results: { total: 4, winners: 1, failed: 0, avgScore: 7 },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("winning"))).toBe(true);
  });

  it("suggests documenting failures when failed prompts exist", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 2, avgRating: 5, top: [] },
      results: { total: 2, winners: 0, failed: 1, avgScore: 4 },
    }));
    expect(s.some((x) => x.kind === "avoidance_improvement")).toBe(true);
  });

  it("suggests adding references when none exist and prompts do", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [] },
    }));
    expect(s.some((x) => x.kind === "reference_gap")).toBe(true);
  });

  it("suggests adding style reference when refs exist but no style kind", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [] },
      references: { total: 2, kinds: ["image", "product"] },
    }));
    expect(s.some((x) => x.kind === "reference_gap" && x.body.includes("style"))).toBe(true);
  });

  it("suggests tracing back to prompt when result winners but no prompt winners", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [] },
      results: { total: 5, winners: 2, failed: 0, avgScore: 7 },
    }));
    expect(s.some((x) => x.kind === "winner_interpretation")).toBe(true);
  });

  it("warns about missing deliverable results", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [] },
      deliverables: { total: 3, byStatus: { generating: 2 }, missingResults: 2 },
    }));
    expect(s.some((x) => x.body.includes("missing") || x.body.includes("Missing"))).toBe(true);
  });
});

// ─── Thread CRUD ──────────────────────────────────────────────

describe("assistant thread CRUD", () => {
  it("createThread returns a non-empty id", async () => {
    const id = await createThread("proj1", "Thread 1");
    expect(id).toBeTruthy();
  });

  it("getThread returns the created thread", async () => {
    const id = await createThread("proj2", "My thread");
    const t = await getThread(id);
    expect(t).not.toBeNull();
    expect(t!.title).toBe("My thread");
    expect(t!.project_id).toBe("proj2");
  });

  it("getThread returns null for unknown id", async () => {
    expect(await getThread("nonexistent-thread")).toBeNull();
  });

  it("getThreadsForProject returns threads for correct project", async () => {
    const projId = "proj_threads_" + Date.now();
    await createThread(projId, "A");
    await createThread(projId, "B");
    const list = await getThreadsForProject(projId);
    expect(list).toHaveLength(2);
    expect(list.every((t) => t.project_id === projId)).toBe(true);
  });

  it("deleteThread removes thread and messages", async () => {
    const projId = "proj_del_" + Date.now();
    const tid = await createThread(projId, "To delete");
    await addMessage(tid, "user", "Hello");
    await deleteThread(tid);
    expect(await getThread(tid)).toBeNull();
    expect(await getMessages(tid)).toHaveLength(0);
  });
});

// ─── Message CRUD ─────────────────────────────────────────────

describe("assistant message CRUD", () => {
  it("addMessage returns a non-empty id", async () => {
    const tid = await createThread("proj_msg_test", "Msg thread");
    const id = await addMessage(tid, "user", "Hello");
    expect(id).toBeTruthy();
  });

  it("getMessages returns messages in order", async () => {
    const tid = await createThread("proj_order_" + Date.now(), "Order test");
    await addMessage(tid, "user", "First");
    await addMessage(tid, "assistant", "Second");
    await addMessage(tid, "user", "Third");
    const msgs = await getMessages(tid);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].content).toBe("First");
    expect(msgs[1].content).toBe("Second");
    expect(msgs[2].content).toBe("Third");
  });

  it("addMessage with citations stores them", async () => {
    const tid = await createThread("proj_cite_" + Date.now(), "Cite test");
    await addMessage(tid, "assistant", "See references", ["ref-1", "ref-2"]);
    const msgs = await getMessages(tid);
    expect(msgs[0].citations).toEqual(["ref-1", "ref-2"]);
  });

  it("getMessages returns empty for unknown thread", async () => {
    expect(await getMessages("nonexistent-thread-xyz")).toHaveLength(0);
  });
});
