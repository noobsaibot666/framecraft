import { describe, expect, it } from "vitest";
import {
  COMPARISON_TYPES,
  buildComparisonOutcome,
  getComparisonRoles,
  type ComparisonOutcomeSlot,
} from "./comparisonWorkflow";

function slot(overrides: Partial<ComparisonOutcomeSlot> = {}): ComparisonOutcomeSlot {
  return {
    label: "Studio result",
    provider: "midjourney",
    promptVersion: 2,
    overallScore: 4,
    isWinner: false,
    isRejected: false,
    notes: "Strong composition",
    ...overrides,
  };
}

describe("comparison workflow definitions", () => {
  it("defines the seven comparison modes from doc 04 §3", () => {
    expect(COMPARISON_TYPES.map((item) => item.id)).toEqual([
      "result_result",
      "reference_result",
      "provider_provider",
      "prompt_version",
      "direction_result",
      "sref_sref",
      "ai_risk",
    ]);
  });

  it("assigns a reference and generated result in reference mode", () => {
    expect(getComparisonRoles("reference_result", 2)).toEqual(["reference", "result"]);
  });

  it("assigns provider roles across all visible slots", () => {
    expect(getComparisonRoles("provider_provider", 4)).toEqual([
      "provider_a",
      "provider_b",
      "provider_c",
      "provider_d",
    ]);
  });

  it("assigns sref roles in SREF vs SREF mode", () => {
    expect(getComparisonRoles("sref_sref", 3)).toEqual(["sref_a", "sref_b", "sref_c"]);
  });

  it("uses plain result roles for direction and AI-risk modes", () => {
    expect(getComparisonRoles("direction_result", 2)).toEqual(["result", "result"]);
    expect(getComparisonRoles("ai_risk", 2)).toEqual(["result", "result"]);
  });
});

describe("buildComparisonOutcome", () => {
  it("records the winner, rejected option, and production reason", () => {
    const outcome = buildComparisonOutcome("result_result", [
      slot({ label: "Result A", isWinner: true, overallScore: 5 }),
      slot({ label: "Result B", isRejected: true, notes: "Artificial skin texture" }),
    ]);

    expect(outcome).toContain("Result vs Result");
    expect(outcome).toContain("Winner: Result A");
    expect(outcome).toContain("Rejected: Result B");
    expect(outcome).toContain("Artificial skin texture");
  });

  it("includes provider and prompt-version evidence", () => {
    const outcome = buildComparisonOutcome("provider_provider", [
      slot({ label: "Option A", provider: "gpt_image", promptVersion: 3, isWinner: true }),
      slot({ label: "Option B", provider: "midjourney", promptVersion: 4 }),
    ]);

    expect(outcome).toContain("GPT Image 2");
    expect(outcome).toContain("v3");
    expect(outcome).toContain("Midjourney");
    expect(outcome).toContain("v4");
  });

  it("returns an empty outcome when no decision exists", () => {
    expect(buildComparisonOutcome("prompt_version", [slot()])).toBe("");
  });
});
