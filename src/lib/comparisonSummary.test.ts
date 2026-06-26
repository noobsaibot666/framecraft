import { describe, expect, it } from "vitest";
import { summarizeComparisonSlots } from "./comparisonSummary";
import type { ComparisonResult } from "@/types";

function result(overrides: Partial<ComparisonResult> = {}): ComparisonResult {
  return {
    result_id: "r1",
    prompt_id: "p1",
    prompt_title: "Prompt A",
    prompt_provider: "midjourney",
    prompt_version: 1,
    score_overall: 3,
    score_realism: 3,
    score_brand_fit: 3,
    score_composition: 3,
    score_lighting: 3,
    score_ai_risk: 0,
    is_winner: false,
    is_failed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeComparisonSlots", () => {
  it("summarizes filled, winner, rejected, and pending decision counts", () => {
    const summary = summarizeComparisonSlots([
      { result: result({ result_id: "r1", prompt_title: "Winner", score_overall: 5 }), isWinner: true, isRejected: false },
      { result: result({ result_id: "r2", prompt_title: "Rejected", score_overall: 2 }), isWinner: false, isRejected: true },
      { result: result({ result_id: "r3", prompt_title: "Pending", score_overall: 4 }), isWinner: false, isRejected: false },
      null,
    ]);

    expect(summary).toEqual({
      filledCount: 3,
      emptyCount: 1,
      winnerCount: 1,
      rejectedCount: 1,
      pendingDecisionCount: 1,
      topScoreLabel: "Winner",
      topScore: 5,
      canApplyDecisions: true,
    });
  });

  it("reports no apply action when no slot has a decision", () => {
    const summary = summarizeComparisonSlots([
      { result: result({ score_overall: 4 }), isWinner: false, isRejected: false },
      null,
    ]);

    expect(summary.canApplyDecisions).toBe(false);
    expect(summary.pendingDecisionCount).toBe(1);
    expect(summary.topScoreLabel).toBe("Prompt A");
    expect(summary.topScore).toBe(4);
  });
});
