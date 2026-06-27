import { describe, it, expect } from "vitest";
import { validatePromptForAnalysis, analyzePromptDraft, EMPTY_ADVICE } from "./analyzePrompt";

describe("validatePromptForAnalysis", () => {
  it("rejects empty prompt", () => {
    const v = validatePromptForAnalysis("");
    expect(v.valid).toBe(false);
    expect(v.message).toBeTruthy();
  });

  it("rejects prompt under 20 characters", () => {
    const v = validatePromptForAnalysis("short");
    expect(v.valid).toBe(false);
  });

  it("rejects prompt of exactly 19 characters", () => {
    const v = validatePromptForAnalysis("a".repeat(19));
    expect(v.valid).toBe(false);
  });

  it("requires API key to be configured (key not set in test env)", () => {
    const v = validatePromptForAnalysis("a".repeat(25));
    // In test env localStorage is empty → no API key → invalid
    expect(v.valid).toBe(false);
    expect(v.message).toContain("Anthropic");
  });
});

describe("analyzePromptDraft (dev mode)", () => {
  it("resolves to EMPTY_ADVICE in dev/test mode", async () => {
    const result = await analyzePromptDraft({ promptText: "a beautiful product shot cinematic lighting" });
    expect(result).toEqual(EMPTY_ADVICE);
  });
});
