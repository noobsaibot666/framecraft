import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendProjectNote,
  askAssistant,
  generateSuggestions,
  serializePackToSystem,
  createThread,
  getThreadsForProject,
  getThread,
  deleteThread,
  addMessage,
  getMessages,
} from "./assistant";
import { AI_KEY_DEEPSEEK } from "./aiConfig";
import type { ProjectContextPack } from "@/types";

// isTauri is false in Vitest — all calls use in-memory stores

describe("appendProjectNote", () => {
  it("uses the new note when no existing note is present", () => {
    expect(appendProjectNote(undefined, "New note")).toBe("New note");
  });

  it("appends without overwriting existing project notes", () => {
    expect(appendProjectNote("Existing", "New note")).toBe("Existing\n\nNew note");
  });

  it("normalizes surrounding whitespace", () => {
    expect(appendProjectNote(" Existing ", " New note ")).toBe("Existing\n\nNew note");
  });
});

function makePack(overrides: Partial<ProjectContextPack> = {}): ProjectContextPack {
  return {
    project: { id: "proj1", title: "Test Project", status: "active" },
    prompts: { total: 0, winners: 0, failed: 0, avgRating: 0, top: [], providers: [] },
    results: { total: 0, winners: 0, failed: 0, avgScore: 0 },
    references: { total: 0, kinds: [] },
    deliverables: { total: 0, byStatus: {}, missingResults: 0 },
    comparisons: { total: 0, decided: 0, pending: 0, recentOutcomes: [] },
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
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [], providers: [] },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("no results"))).toBe(true);
  });

  it("suggests marking winners when results >= 3 but none marked", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [], providers: [] },
      results: { total: 4, winners: 0, failed: 0, avgScore: 6 },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("winners marked"))).toBe(true);
  });

  it("suggests build on winner when prompt winner exists", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 1, failed: 0, avgRating: 8, top: [], providers: [] },
      results: { total: 4, winners: 1, failed: 0, avgScore: 7 },
    }));
    expect(s.some((x) => x.kind === "next_action" && x.body.includes("winning"))).toBe(true);
  });

  it("suggests documenting failures when failed prompts exist", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 2, avgRating: 5, top: [], providers: [] },
      results: { total: 2, winners: 0, failed: 1, avgScore: 4 },
    }));
    expect(s.some((x) => x.kind === "avoidance_improvement")).toBe(true);
  });

  it("suggests adding references when none exist and prompts do", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [], providers: [] },
    }));
    expect(s.some((x) => x.kind === "reference_gap")).toBe(true);
  });

  it("suggests adding style reference when refs exist but no style kind", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [], providers: [] },
      references: { total: 2, kinds: ["image", "product"] },
    }));
    expect(s.some((x) => x.kind === "reference_gap" && x.body.includes("style"))).toBe(true);
  });

  it("suggests tracing back to prompt when result winners but no prompt winners", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 3, winners: 0, failed: 0, avgRating: 7, top: [], providers: [] },
      results: { total: 5, winners: 2, failed: 0, avgScore: 7 },
    }));
    expect(s.some((x) => x.kind === "winner_interpretation")).toBe(true);
  });

  it("warns about missing deliverable results", () => {
    const s = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [], providers: [] },
      deliverables: { total: 3, byStatus: { generating: 2 }, missingResults: 2 },
    }));
    expect(s.some((x) => x.body.includes("missing") || x.body.includes("Missing"))).toBe(true);
  });

  it("directs the user to unresolved comparison sessions", () => {
    const suggestions = generateSuggestions(makePack({
      prompts: { total: 2, winners: 0, failed: 0, avgRating: 6, top: [], providers: [] },
      results: { total: 2, winners: 0, failed: 0, avgScore: 3.5 },
      comparisons: { total: 2, decided: 1, pending: 1, recentOutcomes: ["Winner: Result A"] },
    }));

    const comparison = suggestions.find((item) => item.body.includes("comparison"));
    expect(comparison?.action?.payload).toBe("/compare/proj1");
  });

  it("serializes comparison outcomes and the five-point result scale", () => {
    const context = serializePackToSystem(makePack({
      prompts: { total: 2, winners: 1, failed: 0, avgRating: 4.5, top: [], providers: [] },
      results: { total: 2, winners: 1, failed: 0, avgScore: 4.5 },
      comparisons: {
        total: 2,
        decided: 1,
        pending: 1,
        recentOutcomes: ["Result vs Result. Winner: Studio A"],
      },
    }));

    expect(context).toContain("avg rating 4.5/5");
    expect(context).toContain("avg score 4.5/5");
    expect(context).toContain("COMPARISONS (2 total, 1 decided, 1 pending)");
    expect(context).toContain("Winner: Studio A");
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

// ─── Provider routing ─────────────────────────────────────────

describe("askAssistant provider routing", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes DeepSeek models to the DeepSeek API, not OpenAI", async () => {
    localStorage.setItem(AI_KEY_DEEPSEEK, "sk-test-deepseek-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    );

    await askAssistant(makePack(), [{ role: "user", content: "hi" }], "deepseek-chat");

    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.anything());
  });
});
