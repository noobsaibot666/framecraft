import { describe, expect, it } from "vitest";
import { parseSplitScenes, splitScriptIntoScenes } from "./cinemaSceneSplit";
import type { AIModel } from "./aiConfig";

const dummyModel: AIModel = { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "balanced" };

describe("parseSplitScenes", () => {
  it("parses a valid scenes JSON payload", () => {
    const raw = JSON.stringify({
      scenes: [
        { title: "Scene 1 — The Cabin", script_excerpt: "INT. CABIN", summary: "Setup", mood: "tense" },
      ],
    });
    expect(parseSplitScenes(raw)).toEqual([
      { title: "Scene 1 — The Cabin", script_excerpt: "INT. CABIN", summary: "Setup", mood: "tense" },
    ]);
  });

  it("throws when the scenes array is missing or empty", () => {
    expect(() => parseSplitScenes(JSON.stringify({ nope: true }))).toThrow(/scenes array/i);
    expect(() => parseSplitScenes(JSON.stringify({ scenes: [] }))).toThrow(/scenes array/i);
  });

  it("throws when a scene is missing a title", () => {
    const raw = JSON.stringify({ scenes: [{ summary: "no title" }] });
    expect(() => parseSplitScenes(raw)).toThrow(/missing a title/i);
  });
});

describe("splitScriptIntoScenes validation", () => {
  it("rejects an empty script before calling the model", async () => {
    await expect(splitScriptIntoScenes("  ", dummyModel)).rejects.toThrow(/approve a script/i);
  });
});
