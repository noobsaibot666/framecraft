import { describe, it, expect } from "vitest";
import { recordResultOutcome, recordResultRescore, recordComparisonApply, recordComparisonLesson } from "./intelligenceEngine";
import { EMPTY_DECISION, type ComparisonDecision } from "./comparisonDecision";

// Vitest runs in dev mode (no Tauri) — every underlying store call is a no-op,
// so these tests verify the orchestration itself doesn't throw and handles
// edge-case inputs safely. DB-backed behavior is covered where the
// underlying modules (memoryEngine, tokenPatterns, db) are tested directly.

describe("recordResultOutcome", () => {
  it("resolves without throwing for a winning result", async () => {
    await expect(recordResultOutcome("cinematic lighting, 35mm film grain", 5, false)).resolves.toBeUndefined();
  });

  it("resolves without throwing for a failed result", async () => {
    await expect(recordResultOutcome("plastic skin, ai glow", 1, true)).resolves.toBeUndefined();
  });

  it("resolves without throwing for an unrated result", async () => {
    await expect(recordResultOutcome("", 0, false)).resolves.toBeUndefined();
  });
});

describe("recordResultRescore", () => {
  it("is a no-op when score and failed status are unchanged", async () => {
    await expect(recordResultRescore("cinematic lighting", 4, false, 4, false)).resolves.toBeUndefined();
  });

  it("resolves without throwing when a score is corrected upward", async () => {
    await expect(recordResultRescore("cinematic lighting", 3, false, 5, false)).resolves.toBeUndefined();
  });

  it("resolves without throwing when a score is corrected downward", async () => {
    await expect(recordResultRescore("cinematic lighting", 5, false, 2, false)).resolves.toBeUndefined();
  });

  it("resolves without throwing when a result is retroactively marked failed", async () => {
    await expect(recordResultRescore("plastic skin", 4, false, 1, true)).resolves.toBeUndefined();
  });

  it("resolves without throwing when a result is un-failed", async () => {
    await expect(recordResultRescore("plastic skin", 1, true, 4, false)).resolves.toBeUndefined();
  });
});

describe("recordComparisonApply", () => {
  it("resolves without throwing for an empty prompt list", async () => {
    await expect(recordComparisonApply([])).resolves.toBeUndefined();
  });

  it("de-duplicates repeated prompt ids without throwing", async () => {
    await expect(recordComparisonApply(["p1", "p1", "p2"])).resolves.toBeUndefined();
  });
});

describe("recordComparisonLesson", () => {
  it("is a no-op for a decision with no avoid items", async () => {
    await expect(recordComparisonLesson(EMPTY_DECISION)).resolves.toBeUndefined();
  });

  it("resolves without throwing for a decision with avoid items", async () => {
    const decision: ComparisonDecision = {
      ...EMPTY_DECISION,
      avoid: ["over-saturated skin tones", "generic studio backdrop"],
      reuse: ["natural window light"],
      why_stronger: "Better subject separation from the background.",
    };
    await expect(recordComparisonLesson(decision)).resolves.toBeUndefined();
  });

  it("handles duplicate avoid items within the same decision without throwing", async () => {
    const decision: ComparisonDecision = {
      ...EMPTY_DECISION,
      avoid: ["waxy skin texture", "waxy skin texture", "  waxy skin texture  "],
    };
    await expect(recordComparisonLesson(decision)).resolves.toBeUndefined();
  });

  it("ignores blank/whitespace-only avoid entries", async () => {
    const decision: ComparisonDecision = { ...EMPTY_DECISION, avoid: ["   ", ""] };
    await expect(recordComparisonLesson(decision)).resolves.toBeUndefined();
  });
});
