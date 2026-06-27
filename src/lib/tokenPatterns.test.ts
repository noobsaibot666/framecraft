import { describe, it, expect } from "vitest";
import { buildTokenPairs, getProvenCombos, getTopPatterns, updateCoOccurrences } from "./tokenPatterns";

// buildTokenPairs is pure — fully testable without Tauri.
// All DB-backed functions are no-ops / return empty in dev mode (no Tauri), which is verified here.

describe("buildTokenPairs", () => {
  it("returns empty for fewer than 2 tokens", () => {
    expect(buildTokenPairs([])).toEqual([]);
    expect(buildTokenPairs(["a"])).toEqual([]);
  });

  it("returns one pair for exactly 2 tokens, smaller ID first", () => {
    const pairs = buildTokenPairs(["z", "a"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(["a", "z"]);
  });

  it("returns all unique ordered pairs for 3 tokens", () => {
    const pairs = buildTokenPairs(["b", "a", "c"]);
    expect(pairs).toHaveLength(3);
    for (const [x, y] of pairs) {
      expect(x < y).toBe(true);
    }
    const set = new Set(pairs.map(([x, y]) => `${x}|${y}`));
    expect(set.size).toBe(3);
  });

  it("produces C(n,2) pairs for n tokens", () => {
    const ids = ["d", "c", "b", "a"];
    const pairs = buildTokenPairs(ids);
    expect(pairs).toHaveLength(6); // C(4,2) = 6
  });

  it("ensures every pair has the smaller ID first", () => {
    const pairs = buildTokenPairs(["gamma", "alpha", "beta"]);
    for (const [x, y] of pairs) {
      expect(x < y).toBe(true);
    }
  });
});

describe("updateCoOccurrences (dev mode — no-op)", () => {
  it("resolves without throwing in dev mode", async () => {
    await expect(updateCoOccurrences("editorial, fashion, soft light", 4)).resolves.toBeUndefined();
  });

  it("resolves immediately when scoreOverall is 0", async () => {
    await expect(updateCoOccurrences("editorial, fashion", 0)).resolves.toBeUndefined();
  });
});

describe("getProvenCombos (dev mode — returns empty)", () => {
  it("returns empty array in dev mode", async () => {
    const result = await getProvenCombos(["id1", "id2", "id3"]);
    expect(result).toEqual([]);
  });

  it("returns empty when fewer than 2 token IDs provided", async () => {
    expect(await getProvenCombos([])).toEqual([]);
    expect(await getProvenCombos(["only-one"])).toEqual([]);
  });
});

describe("getTopPatterns (dev mode — returns empty)", () => {
  it("returns empty array in dev mode", async () => {
    const result = await getTopPatterns(10);
    expect(result).toEqual([]);
  });
});
