import { describe, expect, it } from "vitest";
import {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  addItemToSession,
  removeItemFromSession,
  getItemsForSession,
  setItemWinner,
  setItemRejected,
  getBestDimension,
  getWeakestDimension,
  type CreateSessionInput,
} from "./comparisons";
import type { ComparisonResult } from "@/types";

// isTauri is false in Vitest — all calls use the in-memory dev stores

function sess(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return { title: "Test Session", ...overrides };
}

function mockResult(overrides: Partial<ComparisonResult> = {}): ComparisonResult {
  return {
    result_id: "r1",
    prompt_id: "p1",
    prompt_title: "Test Prompt",
    prompt_provider: "midjourney",
    prompt_version: 1,
    score_overall: 3,
    score_realism: 4,
    score_brand_fit: 2,
    score_composition: 3,
    score_lighting: 5,
    score_ai_risk: 1,
    is_winner: false,
    is_failed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Session CRUD ─────────────────────────────────────────────

describe("comparison sessions in-memory CRUD", () => {
  it("createSession returns a non-empty id", async () => {
    const id = await createSession(sess());
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("getSessionById returns the created session", async () => {
    const id = await createSession(sess({ title: "Session Alpha" }));
    const found = await getSessionById(id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Session Alpha");
    expect(found!.id).toBe(id);
  });

  it("getSessionById returns null for unknown id", async () => {
    expect(await getSessionById("nonexistent-session-zzz")).toBeNull();
  });

  it("getSessions returns all sessions", async () => {
    const before = (await getSessions()).length;
    await createSession(sess({ title: "List A" }));
    await createSession(sess({ title: "List B" }));
    expect((await getSessions()).length).toBe(before + 2);
  });

  it("getSessions filters by projectId", async () => {
    await createSession(sess({ title: "For Project X", project_id: "proj_x_unique" }));
    await createSession(sess({ title: "For Project Y", project_id: "proj_y_unique" }));
    const forX = await getSessions("proj_x_unique");
    expect(forX.every((s) => s.project_id === "proj_x_unique")).toBe(true);
  });

  it("updateSession changes title", async () => {
    const id = await createSession(sess({ title: "Before" }));
    await updateSession(id, { title: "After" });
    expect((await getSessionById(id))!.title).toBe("After");
  });

  it("deleteSession removes the session", async () => {
    const id = await createSession(sess({ title: "To Delete" }));
    await deleteSession(id);
    expect(await getSessionById(id)).toBeNull();
  });
});

// ─── Item CRUD ────────────────────────────────────────────────

describe("comparison items in-memory CRUD", () => {
  it("addItemToSession returns an id", async () => {
    const sessionId = await createSession(sess({ title: "Item Test Session A" }));
    const itemId = await addItemToSession(sessionId, "result_001");
    expect(itemId).toBeTruthy();
  });

  it("getItemsForSession returns added items", async () => {
    const sessionId = await createSession(sess({ title: "Item Test Session B" }));
    await addItemToSession(sessionId, "result_aaa", 0);
    await addItemToSession(sessionId, "result_bbb", 1);
    const items = await getItemsForSession(sessionId);
    const resultIds = items.map((i) => i.result_id);
    expect(resultIds).toContain("result_aaa");
    expect(resultIds).toContain("result_bbb");
  });

  it("duplicate addItemToSession is idempotent", async () => {
    const sessionId = await createSession(sess({ title: "Idempotent Session" }));
    await addItemToSession(sessionId, "result_dup");
    await addItemToSession(sessionId, "result_dup");
    const items = await getItemsForSession(sessionId);
    expect(items.filter((i) => i.result_id === "result_dup")).toHaveLength(1);
  });

  it("removeItemFromSession removes the item", async () => {
    const sessionId = await createSession(sess({ title: "Remove Item Session" }));
    const itemId = await addItemToSession(sessionId, "result_to_remove");
    await removeItemFromSession(itemId);
    const items = await getItemsForSession(sessionId);
    expect(items.some((i) => i.result_id === "result_to_remove")).toBe(false);
  });

  it("setItemWinner marks one winner and clears others", async () => {
    const sessionId = await createSession(sess({ title: "Winner Session" }));
    const id1 = await addItemToSession(sessionId, "result_win_aaa");
    const id2 = await addItemToSession(sessionId, "result_win_bbb");
    await setItemWinner(id1, sessionId);
    await setItemWinner(id2, sessionId);
    const items = await getItemsForSession(sessionId);
    const winners = items.filter((i) => i.is_winner);
    expect(winners).toHaveLength(1);
    expect(winners[0].result_id).toBe("result_win_bbb");
  });

  it("setItemRejected marks item rejected", async () => {
    const sessionId = await createSession(sess({ title: "Reject Session" }));
    const itemId = await addItemToSession(sessionId, "result_rej_ccc");
    await setItemRejected(itemId, true);
    const items = await getItemsForSession(sessionId);
    const item = items.find((i) => i.id === itemId);
    expect(item!.is_rejected).toBe(true);
  });

  it("setItemRejected clears is_winner", async () => {
    const sessionId = await createSession(sess({ title: "Reject Winner Session" }));
    const itemId = await addItemToSession(sessionId, "result_rejwin_ddd");
    await setItemWinner(itemId, sessionId);
    await setItemRejected(itemId, true);
    const items = await getItemsForSession(sessionId);
    const item = items.find((i) => i.id === itemId);
    expect(item!.is_winner).toBe(false);
    expect(item!.is_rejected).toBe(true);
  });
});

// ─── Decision support ─────────────────────────────────────────

describe("getBestDimension", () => {
  it("returns the highest-scoring non-risk dimension", () => {
    const r = mockResult({ score_realism: 2, score_brand_fit: 3, score_composition: 1, score_lighting: 5 });
    expect(getBestDimension(r)).toBe("Lighting");
  });

  it("returns null when all scores are zero", () => {
    const r = mockResult({ score_realism: 0, score_brand_fit: 0, score_composition: 0, score_lighting: 0 });
    expect(getBestDimension(r)).toBeNull();
  });
});

describe("getWeakestDimension", () => {
  it("returns the lowest-scoring dimension when below 4", () => {
    const r = mockResult({ score_realism: 4, score_brand_fit: 1, score_composition: 3, score_lighting: 5 });
    expect(getWeakestDimension(r)).toBe("Brand Fit");
  });

  it("returns null when all dimensions score 4 or above", () => {
    const r = mockResult({ score_realism: 4, score_brand_fit: 5, score_composition: 4, score_lighting: 5 });
    expect(getWeakestDimension(r)).toBeNull();
  });
});
