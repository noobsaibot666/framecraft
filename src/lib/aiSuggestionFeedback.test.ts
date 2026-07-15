import { describe, it, expect, vi } from "vitest";
import { recordSuggestionFeedback, getSuggestionAcceptanceStats } from "./aiSuggestionFeedback";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./dbConnection", () => ({ getFramecraftDb: mocks.getDb }));

// All DB calls are Tauri-gated — dev/test mode returns empty/void without touching the DB.

describe("recordSuggestionFeedback (dev mode)", () => {
  it("resolves without throwing and without touching the db", async () => {
    await expect(
      recordSuggestionFeedback({ tool: "analyze_prompt", field: "improvement:lighting", action: "accepted" })
    ).resolves.toBeUndefined();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("getSuggestionAcceptanceStats (dev mode)", () => {
  it("resolves to an empty array", async () => {
    await expect(getSuggestionAcceptanceStats()).resolves.toEqual([]);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
