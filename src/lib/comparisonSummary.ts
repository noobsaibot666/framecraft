import type { ComparisonResult } from "@/types";

export interface ComparisonSummarySlot {
  result: ComparisonResult;
  isWinner: boolean;
  isRejected: boolean;
}

export interface ComparisonSummary {
  filledCount: number;
  emptyCount: number;
  winnerCount: number;
  rejectedCount: number;
  pendingDecisionCount: number;
  topScoreLabel: string | null;
  topScore: number | null;
  canApplyDecisions: boolean;
}

export function summarizeComparisonSlots(
  slots: Array<ComparisonSummarySlot | null>
): ComparisonSummary {
  const filled = slots.filter((slot): slot is ComparisonSummarySlot => Boolean(slot));
  const winnerCount = filled.filter((slot) => slot.isWinner).length;
  const rejectedCount = filled.filter((slot) => slot.isRejected).length;
  const pendingDecisionCount = filled.filter((slot) => !slot.isWinner && !slot.isRejected).length;
  const top = filled.reduce<ComparisonSummarySlot | null>((best, slot) => {
    if (!best) return slot;
    return slot.result.score_overall > best.result.score_overall ? slot : best;
  }, null);

  return {
    filledCount: filled.length,
    emptyCount: slots.length - filled.length,
    winnerCount,
    rejectedCount,
    pendingDecisionCount,
    topScoreLabel: top?.result.prompt_title ?? null,
    topScore: top?.result.score_overall ?? null,
    canApplyDecisions: winnerCount > 0 || rejectedCount > 0,
  };
}
