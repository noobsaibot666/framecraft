import type { ComparisonSession } from "@/types";

export interface ComparisonIntelligenceSummary {
  total: number;
  decided: number;
  pending: number;
  recentOutcomes: string[];
}

export function summarizeComparisonIntelligence(
  sessions: ComparisonSession[]
): ComparisonIntelligenceSummary {
  const outcomes = sessions
    .map((session) => session.outcome_summary?.trim() ?? "")
    .filter(Boolean);

  return {
    total: sessions.length,
    decided: outcomes.length,
    pending: sessions.length - outcomes.length,
    recentOutcomes: outcomes.slice(0, 5),
  };
}
