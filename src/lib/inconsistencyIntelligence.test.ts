import { describe, it, expect, vi } from "vitest";
import { recordConsistencyEvent, getTopConsistencyConflicts, getConsistencyRuleCount, getAllConsistencyRuleCounts } from "./inconsistencyIntelligence";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

// All DB calls are Tauri-gated — dev/test mode returns empty/void without touching the DB.

describe("recordConsistencyEvent (dev mode)", () => {
  it("resolves without throwing and without touching the db", async () => {
    await expect(
      recordConsistencyEvent({ rule_id: "camera-macro-wide", rule_label: "test", action: "warned" })
    ).resolves.toBeUndefined();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("getTopConsistencyConflicts (dev mode)", () => {
  it("resolves to an empty array", async () => {
    await expect(getTopConsistencyConflicts()).resolves.toEqual([]);
  });
});

describe("getConsistencyRuleCount (dev mode)", () => {
  it("resolves to 0", async () => {
    await expect(getConsistencyRuleCount("camera-macro-wide")).resolves.toBe(0);
  });
});

describe("getAllConsistencyRuleCounts (dev mode)", () => {
  it("resolves to an empty object", async () => {
    await expect(getAllConsistencyRuleCounts()).resolves.toEqual({});
  });
});
