import { describe, it, expect, vi } from "vitest";
import { recordDuplicateDismissed, getDismissedDuplicateIds } from "./duplicateDismissals";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

// All DB calls are Tauri-gated — dev/test mode returns empty/void without touching the DB.

describe("recordDuplicateDismissed (dev mode)", () => {
  it("resolves without throwing and without touching the db", async () => {
    await expect(recordDuplicateDismissed("source-1", "candidate-1")).resolves.toBeUndefined();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("getDismissedDuplicateIds (dev mode)", () => {
  it("resolves to an empty set", async () => {
    const result = await getDismissedDuplicateIds("source-1");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });
});
