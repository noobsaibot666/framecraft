import type { Result } from "@/types";

export interface PromptResultSummary {
  rating: number;
  ai_look_risk: number;
  is_winner: boolean;
  is_failed: boolean;
}

export function summarizePromptFromResults(results: Result[]): PromptResultSummary {
  if (results.length === 0) {
    return {
      rating: 0,
      ai_look_risk: 0,
      is_winner: false,
      is_failed: false,
    };
  }

  return {
    rating: Math.max(...results.map((r) => r.score_overall ?? 0)),
    ai_look_risk: Math.max(...results.map((r) => (r.score_ai_risk ?? 0) * 2)),
    is_winner: results.some((r) => r.is_winner),
    is_failed: results.some((r) => r.is_failed),
  };
}
