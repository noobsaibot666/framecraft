import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ProvenToken {
  id: string;
  text: string;
  quality_score: number;
  use_count: number;
}

export interface PendingResult {
  id: string;
  prompt_id: string;
  prompt_title: string;
  created_at: string;
}

export interface ProductionHealth {
  promptsThisWeek: number;
  resultsThisWeek: number;
  winRate: number;
  pendingReviewCount: number;
  topProvenTokens: ProvenToken[];
  pendingResults: PendingResult[];
}

export const EMPTY_HEALTH: ProductionHealth = {
  promptsThisWeek: 0,
  resultsThisWeek: 0,
  winRate: 0,
  pendingReviewCount: 0,
  topProvenTokens: [],
  pendingResults: [],
};

export async function getDashboardHealth(): Promise<ProductionHealth> {
  if (!isTauri) return EMPTY_HEALTH;

  const db = await getFramecraftDb();

  const [weekData, ratingData, pendingData, tokenData] = await Promise.all([
    db.select(
      `SELECT
        (SELECT COUNT(*) FROM prompts WHERE created_at >= datetime('now', '-7 days')) AS prompts_week,
        (SELECT COUNT(*) FROM results WHERE created_at >= datetime('now', '-7 days')) AS results_week`
    ) as Promise<{ prompts_week: number; results_week: number }[]>,

    db.select(
      `SELECT
        (SELECT COUNT(*) FROM prompts WHERE is_winner = 1) AS winners,
        (SELECT COUNT(*) FROM prompts WHERE rating > 0) AS rated`
    ) as Promise<{ winners: number; rated: number }[]>,

    db.select(
      `SELECT r.id, r.prompt_id, COALESCE(p.title, 'Untitled') AS prompt_title, r.created_at
       FROM results r
       LEFT JOIN prompts p ON r.prompt_id = p.id
       WHERE (r.score_overall = 0 OR r.score_overall IS NULL) AND r.is_failed = 0
       ORDER BY r.created_at DESC
       LIMIT 5`
    ) as Promise<PendingResult[]>,

    db.select(
      `SELECT id, text, quality_score, use_count
       FROM tokens
       WHERE quality_score > 0.15
       ORDER BY quality_score DESC, use_count DESC
       LIMIT 5`
    ) as Promise<ProvenToken[]>,
  ]);

  const week = weekData[0] ?? { prompts_week: 0, results_week: 0 };
  const ratings = ratingData[0] ?? { winners: 0, rated: 0 };

  return {
    promptsThisWeek: week.prompts_week,
    resultsThisWeek: week.results_week,
    winRate: ratings.rated > 0 ? Math.round((ratings.winners / ratings.rated) * 100) : 0,
    pendingReviewCount: pendingData.length,
    topProvenTokens: tokenData,
    pendingResults: pendingData,
  };
}
