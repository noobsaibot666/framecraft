import { describe, it, expect } from "vitest";
import { getDashboardHealth, EMPTY_HEALTH } from "./dashboardHealth";

// All DB queries are Tauri-gated — resolves to EMPTY_HEALTH in dev/test mode.

describe("getDashboardHealth (dev mode)", () => {
  it("resolves without throwing", async () => {
    await expect(getDashboardHealth()).resolves.toBeDefined();
  });

  it("returns zero weekly counts in dev mode", async () => {
    const health = await getDashboardHealth();
    expect(health.promptsThisWeek).toBe(0);
    expect(health.resultsThisWeek).toBe(0);
  });

  it("returns valid winRate range", async () => {
    const health = await getDashboardHealth();
    expect(health.winRate).toBeGreaterThanOrEqual(0);
    expect(health.winRate).toBeLessThanOrEqual(100);
  });

  it("returns empty arrays in dev mode", async () => {
    const health = await getDashboardHealth();
    expect(health.topProvenTokens).toEqual([]);
    expect(health.pendingResults).toEqual([]);
  });

  it("matches EMPTY_HEALTH shape in dev mode", async () => {
    const health = await getDashboardHealth();
    expect(Object.keys(health)).toEqual(Object.keys(EMPTY_HEALTH));
  });
});
