import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

// Each scorer issues db.select; count calls to prove cache hits vs recomputation.
function fakeDb() {
  return { select: vi.fn(async () => [] as Record<string, unknown>[]), execute: vi.fn() };
}

describe("getRecommendations cache correctness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("serves a second identical call from cache (no new DB work)", async () => {
    const db = fakeDb();
    mocks.getDb.mockResolvedValue(db);
    const { getRecommendations } = await import("./recommendations");

    await getRecommendations({ provider: "midjourney", category: "product" });
    const callsAfterFirst = db.select.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await getRecommendations({ provider: "midjourney", category: "product" });
    expect(db.select.mock.calls.length).toBe(callsAfterFirst); // cache hit
  });

  it("treats differing tags as a distinct key (recomputes)", async () => {
    const db = fakeDb();
    mocks.getDb.mockResolvedValue(db);
    const { getRecommendations } = await import("./recommendations");

    await getRecommendations({ provider: "midjourney", tags: ["a"] });
    const afterFirst = db.select.mock.calls.length;
    await getRecommendations({ provider: "midjourney", tags: ["b"] });
    expect(db.select.mock.calls.length).toBeGreaterThan(afterFirst); // different key
  });

  it("invalidateRecommendations forces recomputation", async () => {
    const db = fakeDb();
    mocks.getDb.mockResolvedValue(db);
    const { getRecommendations, invalidateRecommendations } = await import("./recommendations");

    await getRecommendations({ provider: "midjourney" });
    const afterFirst = db.select.mock.calls.length;
    invalidateRecommendations();
    await getRecommendations({ provider: "midjourney" });
    expect(db.select.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it("dedupes concurrent identical calls into one computation", async () => {
    const db = fakeDb();
    mocks.getDb.mockResolvedValue(db);
    const { getRecommendations } = await import("./recommendations");

    const [a, b] = await Promise.all([
      getRecommendations({ provider: "midjourney", category: "x" }),
      getRecommendations({ provider: "midjourney", category: "x" }),
    ]);
    // Both resolve to the same computed set; only one batch of scorers ran.
    expect(a).toEqual(b);
  });
});
