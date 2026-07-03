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
  winnerTokens: WinnerToken[];
}

export interface WinnerToken {
  id: string;
  text: string;
  win_appearances: number;
  quality_score: number;
}

export interface DayActivity {
  label: string;
  prompts: number;
  results: number;
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
  winnerTokens: [],
};

export async function getDashboardHealth(): Promise<ProductionHealth> {
  if (!isTauri) return EMPTY_HEALTH;

  const db = await getFramecraftDb();

  const [weekData, ratingData, pendingData, tokenData, projectData, queueData, lastPromptData, winnerTokenData] = await Promise.all([
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
      // COALESCE campaign_client first — audit doc 05 §4, matching the same
      // inheritance every other project list/search already applies.
      `SELECT p.id, p.title, COALESCE(c.client, p.client) AS client, p.status,
         (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) AS prompt_count
       FROM projects p
       LEFT JOIN campaigns c ON c.id = p.campaign_id
       WHERE p.status NOT IN ('delivered', 'archived')
       ORDER BY p.updated_at DESC
       LIMIT 4`
    ) as Promise<(ActiveProject & Record<string, unknown>)[]>,

    db.select(
      `SELECT COUNT(*) AS n FROM generation_queue WHERE status = 'pending'`
    ) as Promise<{ n: number }[]>,

    db.select(
      `SELECT id, title, provider, updated_at, is_winner
       FROM prompts
       ORDER BY updated_at DESC
       LIMIT 1`
    ) as Promise<(LastTouchedPrompt & Record<string, unknown>)[]>,

    db.select(
      `SELECT t.id, t.text, t.quality_score, COUNT(*) AS win_appearances
       FROM prompt_tokens pt
       JOIN prompts p ON pt.prompt_id = p.id
       JOIN tokens t ON pt.token_id = t.id
       WHERE p.is_winner = 1
       GROUP BY t.id, t.text, t.quality_score
       ORDER BY win_appearances DESC, t.quality_score DESC
       LIMIT 8`
    ) as Promise<WinnerToken[]>,
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
    winnerTokens: winnerTokenData,
  };
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getWeeklyActivity(): Promise<DayActivity[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();

  const [promptData, resultData] = await Promise.all([
    db.select(
      `SELECT date(created_at) as day, COUNT(*) as n
       FROM prompts WHERE date(created_at) >= date('now', '-6 days')
       GROUP BY day`
    ) as Promise<{ day: string; n: number }[]>,
    db.select(
      `SELECT date(created_at) as day, COUNT(*) as n
       FROM results WHERE date(created_at) >= date('now', '-6 days')
       GROUP BY day`
    ) as Promise<{ day: string; n: number }[]>,
  ]);

  const promptMap: Record<string, number> = {};
  for (const r of promptData) promptMap[r.day] = r.n;
  const resultMap: Record<string, number> = {};
  for (const r of resultData) resultMap[r.day] = r.n;

  const days: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      label: DAY_LABELS[d.getUTCDay()],
      prompts: promptMap[key] ?? 0,
      results: resultMap[key] ?? 0,
    });
  }
  return days;
}
