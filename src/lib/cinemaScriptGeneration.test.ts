import { describe, expect, it } from "vitest";
import { generateScriptDraft, refineScript, SCRIPT_QUESTIONS } from "./cinemaScriptGeneration";
import type { AIModel } from "./aiConfig";

const dummyModel: AIModel = { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "balanced" };

describe("SCRIPT_QUESTIONS", () => {
  it("covers runtime, setting, plot twist, and tone", () => {
    const keys = SCRIPT_QUESTIONS.map((q) => q.key);
    expect(keys).toEqual(["runtime", "setting", "plot_twist", "tone"]);
  });
});

describe("generateScriptDraft validation", () => {
  it("rejects an empty idea before calling the model", async () => {
    await expect(generateScriptDraft({ idea: "  " }, dummyModel)).rejects.toThrow(/idea/i);
  });
});

describe("refineScript validation", () => {
  it("rejects when there is no existing script", async () => {
    await expect(refineScript("", "make it darker", dummyModel)).rejects.toThrow(/script yet/i);
  });

  it("rejects an empty instruction", async () => {
    await expect(refineScript("INT. CABIN - NIGHT", "  ", dummyModel)).rejects.toThrow(/instruction/i);
  });
});
