import { describe, expect, it } from "vitest";
import { summarizePromptFromResults } from "./resultMemory";
import type { Result } from "@/types";

function result(overrides: Partial<Result>): Result {
  return {
    id: crypto.randomUUID(),
    prompt_id: "prompt_1",
    score_overall: 0,
    score_realism: 0,
    score_brand_fit: 0,
    score_composition: 0,
    score_lighting: 0,
    score_ai_risk: 0,
    reuse_potential: 0,
    is_winner: false,
    is_failed: false,
    artifacts: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("summarizePromptFromResults", () => {
  it("keeps winner and failed evidence even when the highest score is different", () => {
    const summary = summarizePromptFromResults([
      result({ score_overall: 5, score_ai_risk: 1 }),
      result({ score_overall: 2, score_ai_risk: 4, is_winner: true }),
      result({ score_overall: 0, score_ai_risk: 5, is_failed: true }),
    ]);

    expect(summary).toEqual({
      rating: 5,
      ai_look_risk: 10,
      is_winner: true,
      is_failed: true,
    });
  });

  it("clears prompt summary flags when all results are deleted", () => {
    const summary = summarizePromptFromResults([]);

    expect(summary).toEqual({
      rating: 0,
      ai_look_risk: 0,
      is_winner: false,
      is_failed: false,
    });
  });
});
