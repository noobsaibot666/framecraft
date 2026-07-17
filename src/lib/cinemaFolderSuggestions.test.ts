import { describe, expect, it } from "vitest";
import { parseSuggestedFolders, suggestFoldersFromScript } from "./cinemaFolderSuggestions";
import type { AIModel } from "./aiConfig";

const dummyModel: AIModel = { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "balanced" };

describe("parseSuggestedFolders", () => {
  it("parses a valid folders JSON payload", () => {
    const raw = JSON.stringify({
      folders: [
        { name: "Eduardo", kind: "character" },
        { name: "Captain's Cabin", kind: "location" },
      ],
    });
    const result = parseSuggestedFolders(raw);
    expect(result).toEqual([
      { name: "Eduardo", kind: "character" },
      { name: "Captain's Cabin", kind: "location" },
    ]);
  });

  it("falls back to 'other' for an unrecognized kind", () => {
    const raw = JSON.stringify({ folders: [{ name: "Something", kind: "vehicle" }] });
    expect(parseSuggestedFolders(raw)).toEqual([{ name: "Something", kind: "other" }]);
  });

  it("dedupes case-insensitive duplicate names", () => {
    const raw = JSON.stringify({ folders: [{ name: "Eduardo", kind: "character" }, { name: "eduardo", kind: "character" }] });
    expect(parseSuggestedFolders(raw)).toHaveLength(1);
  });

  it("throws when the folders array is missing", () => {
    expect(() => parseSuggestedFolders(JSON.stringify({ nope: true }))).toThrow(/folders array/i);
  });
});

describe("suggestFoldersFromScript validation", () => {
  it("rejects an empty script before calling the model", async () => {
    await expect(suggestFoldersFromScript("  ", dummyModel)).rejects.toThrow(/approve a script/i);
  });
});
