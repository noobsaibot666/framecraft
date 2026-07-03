import { describe, expect, it } from "vitest";
import {
  buildDecisionContext,
  formatDecisionOutcome,
  isEmptyDecision,
  parseComparisonDecision,
  EMPTY_DECISION,
  type ComparisonDecisionSlot,
} from "./comparisonDecision";
import type { ComparisonResult } from "@/types";

function result(overrides: Partial<ComparisonResult> = {}): ComparisonResult {
  return {
    result_id: "res",
    prompt_id: "p",
    prompt_title: "Hero shot",
    prompt_provider: "midjourney",
    prompt_version: 2,
    score_overall: 4,
    score_realism: 4,
    score_brand_fit: 3,
    score_composition: 5,
    score_lighting: 4,
    score_ai_risk: 1,
    is_winner: false,
    is_failed: false,
    created_at: "t",
    ...overrides,
  };
}

function slot(overrides: Partial<ComparisonDecisionSlot> = {}): ComparisonDecisionSlot {
  return { label: "Result A", result: result(), isWinner: false, isRejected: false, ...overrides };
}

describe("buildDecisionContext", () => {
  it("includes mode, scores, and user marks", () => {
    const context = buildDecisionContext("result_result", [
      slot({ label: "Result A", isWinner: true, notes: "crisp fabric" }),
      slot({ label: "Result B", isRejected: true, result: result({ score_overall: 2 }) }),
    ]);
    expect(context).toContain("Result vs Result");
    expect(context).toContain("Result A");
    expect(context).toContain("marked WINNER by user");
    expect(context).toContain("marked REJECTED by user");
    expect(context).toContain("user notes: crisp fabric");
    expect(context).toContain("overall 4/5");
  });

  it("adds the creative direction for direction_result mode", () => {
    const context = buildDecisionContext("direction_result", [slot(), slot()], "Analog dusk minimalism");
    expect(context).toContain("Project creative direction to judge against: Analog dusk minimalism");
  });

  it("tells the model to judge on AI-look risk in ai_risk mode", () => {
    const context = buildDecisionContext("ai_risk", [slot(), slot()]);
    expect(context).toContain("AI-look risk");
  });

  it("includes sref codes when present", () => {
    const context = buildDecisionContext("sref_sref", [
      slot({ result: result({ prompt_style_ref: "12345" }) }),
    ]);
    expect(context).toContain("sref 12345");
  });
});

describe("parseComparisonDecision", () => {
  it("parses a full decision", () => {
    const decision = parseComparisonDecision(JSON.stringify({
      stronger_option: "Result A",
      why_stronger: "Cleaner hierarchy.",
      what_failed: "B reads synthetic.",
      reuse: ["dusk light", "35mm grain"],
      avoid: ["plastic skin"],
      intelligence: "Dusk light wins for this brand.",
    }));
    expect(decision.stronger_option).toBe("Result A");
    expect(decision.reuse).toEqual(["dusk light", "35mm grain"]);
    expect(decision.avoid).toEqual(["plastic skin"]);
    expect(isEmptyDecision(decision)).toBe(false);
  });

  it("returns the empty decision for garbage", () => {
    expect(parseComparisonDecision("not json")).toEqual(EMPTY_DECISION);
    expect(isEmptyDecision(parseComparisonDecision("{}"))).toBe(true);
  });

  it("caps list fields at three entries", () => {
    const decision = parseComparisonDecision(JSON.stringify({ reuse: ["a", "b", "c", "d", "e"] }));
    expect(decision.reuse).toHaveLength(3);
  });
});

describe("formatDecisionOutcome", () => {
  it("serializes all six doc-04 output fields", () => {
    const outcome = formatDecisionOutcome({
      stronger_option: "Result A",
      why_stronger: "Cleaner hierarchy",
      what_failed: "B too synthetic",
      reuse: ["dusk light"],
      avoid: ["plastic skin"],
      intelligence: "Dusk wins",
    });
    expect(outcome).toContain("Stronger: Result A");
    expect(outcome).toContain("Why: Cleaner hierarchy");
    expect(outcome).toContain("Failed: B too synthetic");
    expect(outcome).toContain("Reuse: dusk light");
    expect(outcome).toContain("Avoid: plastic skin");
    expect(outcome).toContain("Intelligence: Dusk wins");
  });

  it("omits a 'none' stronger option", () => {
    const outcome = formatDecisionOutcome({ ...EMPTY_DECISION, stronger_option: "none", intelligence: "n/a" });
    expect(outcome).not.toContain("Stronger:");
    expect(outcome).toContain("Intelligence: n/a");
  });
});
