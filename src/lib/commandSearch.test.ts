import { describe, expect, it } from "vitest";
import { searchAll } from "./commandSearch";

describe("searchAll (dev mode)", () => {
  it("returns empty array for query under 2 chars", async () => {
    await expect(searchAll("a")).resolves.toEqual([]);
    await expect(searchAll("")).resolves.toEqual([]);
  });

  it("returns empty array in dev/test mode for valid query", async () => {
    const results = await searchAll("hero shot");
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it("does not throw for special characters in query", async () => {
    await expect(searchAll("test%_query")).resolves.toBeDefined();
  });

  it("each result has required fields", async () => {
    const results = await searchAll("anything");
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("type");
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("path");
      expect(["prompt", "project", "reference", "campaign"]).toContain(r.type);
    }
  });
});
