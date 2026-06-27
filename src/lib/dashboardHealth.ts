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

export interface ActiveProject {
  id: string;
  title: string;
  client?: string;
  status: string;
  prompt_count: number;
}

export interface LastTouchedPrompt {
  id: string;
  title: string;
  provider: string;
  updated_at: string;
  is_winner: boolean;
}

export interface ProductionHealth {
  promptsThisWeek: number;
  resultsThisWeek: number;
  winRate: number;
  pendingReviewCount: number;
  topProvenTokens: ProvenToken[];
  pendingResults: PendingResult[];
  activeProjectCount: number;
  queueDepth: number;
  activeProjects: ActiveProject[];
  lastTouchedPrompt: LastTouchedPrompt | null;
}

export const EMPTY_HEALTH: ProductionHealth = {
  promptsThisWeek: 0,
  resultsThisWeek: 0,
  winRate: 0,
  pendingReviewCount: 0,
  topProvenTokens: [],
  pendingResults: [],
  activeProjectCount: 0,
  queueDepth: 0,
  activeProjects: [],
  lastTouchedPrompt: null,
};

export async function getDashboardHealth(): Promise<ProductionHealth> {
  if (!isTauri) return EMPTY_HEALTH;

  const db = await getFramecraftDb();

  const [weekData, ratingData, pendingData, tokenData, projectData, queueData, lastPromptData] = await Promise.all([
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

    db.select(
      `SELECT p.id, p.title, p.client, p.status,
         (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) AS prompt_count
       FROM projects p
       WHERE p.status NOT IN ('delivered', 'archived')
       ORDER BY p.updated_at DESC
       LIMIT 4`
    ) as Promise<(ActiveProject & Record<string, unknown>)[]>,

    db.select(
      `SELECT COUNT(*) AS n FROM queue WHERE status = 'pending'`
    ) as Promise<{ n: number }[]>,

    db.select(
      `SELECT id, title, provider, updated_at, is_winner
       FROM prompts
       ORDER BY updated_at DESC
       LIMIT 1`
    ) as Promise<(LastTouchedPrompt & Record<string, unknown>)[]>,
  ]);

  const week = weekData[0] ?? { prompts_week: 0, results_week: 0 };
  const ratings = ratingData[0] ?? { winners: 0, rated: 0 };
  const activeProjects = projectData.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    client: r.client as string | undefined,
    status: r.status as string,
    prompt_count: r.prompt_count as number,
  }));
  const lastRaw = lastPromptData[0];
  const lastTouchedPrompt: LastTouchedPrompt | null = lastRaw
    ? {
        id: lastRaw.id as string,
        title: lastRaw.title as string,
        provider: lastRaw.provider as string,
        updated_at: lastRaw.updated_at as string,
        is_winner: Boolean(lastRaw.is_winner),
      }
    : null;

  return {
    promptsThisWeek: week.prompts_week,
    resultsThisWeek: week.results_week,
    winRate: ratings.rated > 0 ? Math.round((ratings.winners / ratings.rated) * 100) : 0,
    pendingReviewCount: pendingData.length,
    topProvenTokens: tokenData,
    pendingResults: pendingData,
    activeProjectCount: activeProjects.length,
    queueDepth: (queueData[0]?.n as number) ?? 0,
    activeProjects,
    lastTouchedPrompt,
  };
}
