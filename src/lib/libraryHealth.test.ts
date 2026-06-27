import { describe, it, expect } from "vitest";
import { getLibraryHealth, EMPTY_LIBRARY_HEALTH } from "./libraryHealth";

// All DB queries are Tauri-gated — resolves to EMPTY_LIBRARY_HEALTH in dev/test mode.

describe("getLibraryHealth (dev mode)", () => {
  it("resolves without throwing", async () => {
    await expect(getLibraryHealth()).resolves.toBeDefined();
  });

  it("returns zero counts in dev mode", async () => {
    const h = await getLibraryHealth();
    expect(h.totalPrompts).toBe(0);
    expect(h.ratedCount).toBe(0);
    expect(h.winnerCount).toBe(0);
    expect(h.failedCount).toBe(0);
    expect(h.unreviewedResults).toBe(0);
  });

  it("returns valid ratedPercent range", async () => {
    const h = await getLibraryHealth();
    expect(h.ratedPercent).toBeGreaterThanOrEqual(0);
    expect(h.ratedPercent).toBeLessThanOrEqual(100);
  });

  it("returns empty token arrays in dev mode", async () => {
    const h = await getLibraryHealth();
    expect(h.topTokens).toEqual([]);
    expect(h.negativeTokens).toEqual([]);
  });

  it("matches EMPTY_LIBRARY_HEALTH shape", async () => {
    const h = await getLibraryHealth();
    expect(Object.keys(h)).toEqual(Object.keys(EMPTY_LIBRARY_HEALTH));
  });
});
