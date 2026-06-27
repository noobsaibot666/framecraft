import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface HealthToken {
  id: string;
  text: string;
  quality_score: number;
  use_count: number;
}

export interface LibraryHealth {
  totalPrompts: number;
  ratedCount: number;
  ratedPercent: number;
  winnerCount: number;
  failedCount: number;
  unreviewedResults: number;
  topTokens: HealthToken[];
  negativeTokens: HealthToken[];
}

export const EMPTY_LIBRARY_HEALTH: LibraryHealth = {
  totalPrompts: 0,
  ratedCount: 0,
  ratedPercent: 0,
  winnerCount: 0,
  failedCount: 0,
  unreviewedResults: 0,
  topTokens: [],
  negativeTokens: [],
};

export async function getLibraryHealth(): Promise<LibraryHealth> {
  if (!isTauri) return EMPTY_LIBRARY_HEALTH;

  const db = await getFramecraftDb();

  const [promptStats, resultStats, topTokenData, negativeTokenData] = await Promise.all([
    db.select(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) AS rated,
        SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) AS winners,
        SUM(CASE WHEN is_failed = 1 THEN 1 ELSE 0 END) AS failed
       FROM prompts`
    ) as Promise<{ total: number; rated: number; winners: number; failed: number }[]>,

    db.select(
      `SELECT COUNT(*) AS unreviewed
       FROM results
       WHERE (score_overall = 0 OR score_overall IS NULL) AND is_failed = 0`
    ) as Promise<{ unreviewed: number }[]>,

    db.select(
      `SELECT id, text, quality_score, use_count
       FROM tokens
       WHERE quality_score > 0.1
       ORDER BY quality_score DESC, use_count DESC
       LIMIT 5`
    ) as Promise<HealthToken[]>,

    db.select(
      `SELECT id, text, quality_score, use_count
       FROM tokens
       WHERE quality_score < -0.05 AND use_count > 0
       ORDER BY quality_score ASC
       LIMIT 5`
    ) as Promise<HealthToken[]>,
  ]);

  const ps = promptStats[0] ?? { total: 0, rated: 0, winners: 0, failed: 0 };
  const rs = resultStats[0] ?? { unreviewed: 0 };

  return {
    totalPrompts: ps.total,
    ratedCount: ps.rated,
    ratedPercent: ps.total > 0 ? Math.round((ps.rated / ps.total) * 100) : 0,
    winnerCount: ps.winners,
    failedCount: ps.failed,
    unreviewedResults: rs.unreviewed,
    topTokens: topTokenData,
    negativeTokens: negativeTokenData,
  };
}
