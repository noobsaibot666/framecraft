import { describe, expect, it, vi } from "vitest";
import { createBoundedAsyncCache } from "./boundedCache";

describe("createBoundedAsyncCache", () => {
  it("deduplicates in-flight loads and returns defensive values", async () => {
    let resolve!: (value: string[]) => void;
    const load = vi.fn(() => new Promise<string[]>((done) => { resolve = done; }));
    const cache = createBoundedAsyncCache({ maxEntries: 2, ttlMs: 1_000, load });

    const first = cache.get("a");
    const second = cache.get("a");
    expect(load).toHaveBeenCalledTimes(1);
    resolve(["value"]);

    expect(await first).toEqual(["value"]);
    expect(await second).toEqual(["value"]);
  });

  it("keeps a slow in-flight load deduplicated beyond the configured TTL", async () => {
    let now = 0;
    let resolve!: (value: string) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((done) => { resolve = done; }))
      .mockResolvedValue("fresh");
    const cache = createBoundedAsyncCache({ maxEntries: 2, ttlMs: 10, load, now: () => now });

    const first = cache.get("a");
    now = 20;
    const second = cache.get("a");
    expect(load).toHaveBeenCalledTimes(1);
    resolve("value");
    await expect(Promise.all([first, second])).resolves.toEqual(["value", "value"]);

    now = 31;
    await cache.get("a");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts least-recently-used entries at the configured bound", async () => {
    const load = vi.fn(async (key: string) => key);
    const cache = createBoundedAsyncCache({ maxEntries: 2, ttlMs: 1_000, load });

    await cache.get("a");
    await cache.get("b");
    await cache.get("a");
    await cache.get("c");
    await cache.get("b");

    expect(load.mock.calls.map(([key]) => key)).toEqual(["a", "b", "c", "b"]);
    expect(cache.size()).toBe(2);
  });

  it("expires entries by TTL and evicts rejected promises so callers can retry", async () => {
    let now = 0;
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ok")
      .mockResolvedValueOnce("fresh");
    const cache = createBoundedAsyncCache({ maxEntries: 2, ttlMs: 10, load, now: () => now });

    await expect(cache.get("a")).rejects.toThrow("temporary");
    await expect(cache.get("a")).resolves.toBe("ok");
    now = 11;
    await expect(cache.get("a")).resolves.toBe("fresh");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("supports key and full invalidation", async () => {
    const load = vi.fn(async (key: string) => key);
    const cache = createBoundedAsyncCache({ maxEntries: 2, ttlMs: 1_000, load });
    await cache.get("a");
    await cache.get("b");
    cache.invalidate("a");
    expect(cache.keys()).toEqual(["b"]);
    cache.invalidate();
    expect(cache.keys()).toEqual([]);
  });
});
