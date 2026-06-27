import { describe, expect, it } from "vitest";
import { getHighImpactReferences, getReferenceImpactScore } from "./referenceImpact";

describe("getHighImpactReferences (dev mode)", () => {
  it("returns empty array in dev/test mode", async () => {
    await expect(getHighImpactReferences()).resolves.toEqual([]);
  });

  it("returns empty when filtered by project", async () => {
    await expect(getHighImpactReferences(5, "proj-1")).resolves.toEqual([]);
  });

  it("respects the limit parameter signature", async () => {
    const result = await getHighImpactReferences(3);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe("getReferenceImpactScore (dev mode)", () => {
  it("returns 0 in dev/test mode", async () => {
    await expect(getReferenceImpactScore("any-id")).resolves.toBe(0);
  });
});
