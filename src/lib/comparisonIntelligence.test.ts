import { describe, expect, it } from "vitest";
import { summarizeComparisonIntelligence } from "./comparisonIntelligence";
import type { ComparisonSession } from "@/types";

function session(id: string, outcome?: string): ComparisonSession {
  return {
    id,
    title: `Session ${id}`,
    comparison_type: "result_result",
    outcome_summary: outcome,
    item_count: 2,
    winner_count: outcome ? 1 : 0,
    created_at: `2026-06-${id.padStart(2, "0")}T10:00:00.000Z`,
    updated_at: `2026-06-${id.padStart(2, "0")}T10:00:00.000Z`,
  };
}

describe("summarizeComparisonIntelligence", () => {
  it("counts decided and pending sessions", () => {
    expect(summarizeComparisonIntelligence([
      session("1", "Winner: A"),
      session("2"),
      session("3", "  "),
    ])).toMatchObject({ total: 3, decided: 1, pending: 2 });
  });

  it("keeps at most five recent non-empty outcomes", () => {
    const summary = summarizeComparisonIntelligence([
      session("7", "Outcome 7"),
      session("6", "Outcome 6"),
      session("5", "Outcome 5"),
      session("4", "Outcome 4"),
      session("3", "Outcome 3"),
      session("2", "Outcome 2"),
      session("1"),
    ]);

    expect(summary.recentOutcomes).toEqual([
      "Outcome 7",
      "Outcome 6",
      "Outcome 5",
      "Outcome 4",
      "Outcome 3",
    ]);
  });
});
