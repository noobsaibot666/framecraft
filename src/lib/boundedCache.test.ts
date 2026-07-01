import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoundedCache } from "./boundedCache";

describe("createBoundedCache", () => {
  it("stores and retrieves values", () => {
    const c = createBoundedCache<number>(3);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.has("a")).toBe(true);
    expect(c.get("missing")).toBeUndefined();
  });

  it("evicts the least-recently-used entry past maxEntries", () => {
    const c = createBoundedCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // evicts "a" (oldest)
    expect(c.has("a")).toBe(false);
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.size).toBe(2);
  });

  it("a read refreshes recency so a different key is evicted", () => {
    const c = createBoundedCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // "a" now most-recent; "b" is LRU
    c.set("c", 3); // evicts "b"
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(false);
    expect(c.has("c")).toBe(true);
  });

  it("re-setting a key updates value without growing size", () => {
    const c = createBoundedCache<number>(2);
    c.set("a", 1);
    c.set("a", 9);
    expect(c.get("a")).toBe(9);
    expect(c.size).toBe(1);
  });

  it("delete and clear work", () => {
    const c = createBoundedCache<number>(3);
    c.set("a", 1);
    c.set("b", 2);
    c.delete("a");
    expect(c.has("a")).toBe(false);
    c.clear();
    expect(c.size).toBe(0);
  });

  it("throws when maxEntries < 1", () => {
    expect(() => createBoundedCache<number>(0)).toThrow();
  });

  describe("TTL expiry", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("expires entries after ttlMs on read", () => {
      const c = createBoundedCache<number>(3, 1000);
      c.set("a", 1);
      expect(c.get("a")).toBe(1);
      vi.advanceTimersByTime(1001);
      expect(c.get("a")).toBeUndefined();
      expect(c.has("a")).toBe(false);
    });

    it("keeps entries within the TTL window", () => {
      const c = createBoundedCache<number>(3, 1000);
      c.set("a", 1);
      vi.advanceTimersByTime(500);
      expect(c.get("a")).toBe(1);
    });
  });
});
