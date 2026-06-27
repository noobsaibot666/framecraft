import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ProvenCombo {
  token_a_id: string;
  token_b_id: string;
  token_a_text: string;
  token_b_text: string;
  avg_rating: number;
  co_occurrence_count: number;
}

export interface TopPattern extends ProvenCombo {}

// Build all unique ordered pairs (a < b lexicographically) — pure, no Tauri needed.
export function buildTokenPairs(tokenIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    for (let j = i + 1; j < tokenIds.length; j++) {
      const a = tokenIds[i];
      const b = tokenIds[j];
      pairs.push(a < b ? [a, b] : [b, a]);
    }
  }
  return pairs;
}

// Called from ResultReview after a result is saved and scored.
// Finds tokens whose text appears in promptText, then upserts co-occurrence counts and
// updates the running average rating for each pair in token_patterns.
export async function updateCoOccurrences(promptText: string, scoreOverall: number): Promise<void> {
  if (!isTauri || scoreOverall === 0 || !promptText.trim()) return;
  const db = await getFramecraftDb();

  const rows = (await db.select(
    `SELECT id FROM tokens WHERE length(text) > 2 AND instr(lower($1), lower(text)) > 0`,
    [promptText]
  )) as { id: string }[];

  const tokenIds = rows.map((r) => r.id);
  if (tokenIds.length < 2) return;

  const pairs = buildTokenPairs(tokenIds);
  for (const [a, b] of pairs) {
    await db.execute(
      `INSERT INTO token_patterns (token_a_id, token_b_id, co_occurrence_count, avg_rating, last_updated)
       VALUES ($1, $2, 1, $3, datetime('now'))
       ON CONFLICT(token_a_id, token_b_id) DO UPDATE SET
         avg_rating = (avg_rating * co_occurrence_count + excluded.avg_rating) / (co_occurrence_count + 1),
         co_occurrence_count = co_occurrence_count + 1,
         last_updated = datetime('now')`,
      [a, b, scoreOverall]
    );
  }
}

// Returns proven token pairs from the currently selected token IDs.
// A combo is "proven" when avg_rating >= minRating and seen at least minCount times.
export async function getProvenCombos(
  tokenIds: string[],
  minRating = 3.5,
  minCount = 2
): Promise<ProvenCombo[]> {
  if (!isTauri || tokenIds.length < 2) return [];
  const db = await getFramecraftDb();

  const n = tokenIds.length;
  const slots = tokenIds.map((_, i) => `$${i + 1}`).join(", ");

  const rows = (await db.select(
    `SELECT tp.token_a_id, tp.token_b_id, tp.avg_rating, tp.co_occurrence_count,
            ta.text AS token_a_text, tb.text AS token_b_text
     FROM token_patterns tp
     JOIN tokens ta ON tp.token_a_id = ta.id
     JOIN tokens tb ON tp.token_b_id = tb.id
     WHERE tp.token_a_id IN (${slots})
       AND tp.token_b_id IN (${slots})
       AND tp.avg_rating >= $${n * 2 + 1}
       AND tp.co_occurrence_count >= $${n * 2 + 2}
     ORDER BY tp.avg_rating DESC, tp.co_occurrence_count DESC`,
    [...tokenIds, ...tokenIds, minRating, minCount]
  )) as ProvenCombo[];

  return rows;
}

// Top co-occurrence patterns library-wide, for dashboard use.
export async function getTopPatterns(limit = 10): Promise<TopPattern[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();

  const rows = (await db.select(
    `SELECT tp.token_a_id, tp.token_b_id, tp.avg_rating, tp.co_occurrence_count,
            ta.text AS token_a_text, tb.text AS token_b_text
     FROM token_patterns tp
     JOIN tokens ta ON tp.token_a_id = ta.id
     JOIN tokens tb ON tp.token_b_id = tb.id
     WHERE tp.avg_rating >= 3.5 AND tp.co_occurrence_count >= 2
     ORDER BY tp.avg_rating DESC, tp.co_occurrence_count DESC
     LIMIT $1`,
    [limit]
  )) as TopPattern[];

  return rows;
}
