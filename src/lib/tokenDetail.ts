import type { Token } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface TokenDetailPrompt {
  id: string;
  title: string;
  provider: string;
  rating: number;
  is_winner: boolean;
  is_failed: boolean;
  created_at: string;
}

export interface TokenCombo {
  partner_id: string;
  partner_text: string;
  avg_rating: number;
  co_occurrence_count: number;
}

export interface TokenStats {
  use_count: number;
  quality_score: number;
  winner_count: number;
  total_prompt_count: number;
  win_rate: number;
  avg_rating: number;
}

export async function getTokenById(id: string): Promise<(Token & { category_name: string }) | null> {
  if (!isTauri) return null;
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT t.*, tc.name AS category_name
     FROM tokens t
     JOIN token_categories tc ON t.category_id = tc.id
     WHERE t.id = $1`,
    [id]
  )) as Record<string, unknown>[];
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    text: r.text as string,
    category_id: r.category_id as string,
    category_name: (r.category_name ?? r.category_id) as string,
    provider: r.provider as Token["provider"] | undefined,
    use_count: (r.use_count as number) ?? 0,
    quality_score: (r.quality_score as number) ?? 0,
    is_builtin: Boolean(r.is_builtin),
    is_favorite: Boolean(r.is_favorite),
  };
}

export async function getPromptsUsingToken(tokenId: string, limit = 20): Promise<TokenDetailPrompt[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, p.provider, p.rating, p.is_winner, p.is_failed, p.created_at
     FROM prompts p
     JOIN prompt_tokens pt ON pt.prompt_id = p.id
     WHERE pt.token_id = $1
     ORDER BY p.rating DESC, p.created_at DESC
     LIMIT $2`,
    [tokenId, limit]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    provider: r.provider as string,
    rating: (r.rating as number) ?? 0,
    is_winner: Boolean(r.is_winner),
    is_failed: Boolean(r.is_failed),
    created_at: r.created_at as string,
  }));
}

export async function getTokenCombos(tokenId: string, minCount = 1): Promise<TokenCombo[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT
       CASE WHEN tp.token_a_id = $1 THEN tp.token_b_id ELSE tp.token_a_id END AS partner_id,
       CASE WHEN tp.token_a_id = $1 THEN tb.text ELSE ta.text END AS partner_text,
       tp.avg_rating,
       tp.co_occurrence_count
     FROM token_patterns tp
     JOIN tokens ta ON tp.token_a_id = ta.id
     JOIN tokens tb ON tp.token_b_id = tb.id
     WHERE (tp.token_a_id = $1 OR tp.token_b_id = $1)
       AND tp.co_occurrence_count >= $2
     ORDER BY tp.avg_rating DESC, tp.co_occurrence_count DESC
     LIMIT 20`,
    [tokenId, minCount]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    partner_id: r.partner_id as string,
    partner_text: r.partner_text as string,
    avg_rating: (r.avg_rating as number) ?? 0,
    co_occurrence_count: (r.co_occurrence_count as number) ?? 0,
  }));
}

export async function getTokenStats(tokenId: string): Promise<TokenStats> {
  if (!isTauri) {
    return { use_count: 0, quality_score: 0, winner_count: 0, total_prompt_count: 0, win_rate: 0, avg_rating: 0 };
  }
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT
       COUNT(*) AS total,
       SUM(p.is_winner) AS winners,
       AVG(CASE WHEN p.rating > 0 THEN p.rating ELSE NULL END) AS avg_rating,
       t.use_count, t.quality_score
     FROM tokens t
     LEFT JOIN prompt_tokens pt ON pt.token_id = t.id
     LEFT JOIN prompts p ON p.id = pt.prompt_id
     WHERE t.id = $1`,
    [tokenId]
  )) as Record<string, unknown>[];
  const r = rows[0] ?? {};
  const total = (r.total as number) ?? 0;
  const winners = (r.winners as number) ?? 0;
  return {
    use_count: (r.use_count as number) ?? 0,
    quality_score: (r.quality_score as number) ?? 0,
    winner_count: winners,
    total_prompt_count: total,
    win_rate: total > 0 ? Math.round((winners / total) * 100) : 0,
    avg_rating: r.avg_rating != null ? Math.round((r.avg_rating as number) * 10) / 10 : 0,
  };
}
