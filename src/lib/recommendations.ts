/**
 * Deterministic production intelligence layer.
 * All recommendations derive from local SQL aggregation + existing ratings + gallery results.
 * No ML, no network, no AI key required.
 *
 * What the system learns from:
 *   tokens       — quality_score updated after each result is scored
 *   results      — win_count + avg_score fed into prompt + recipe ranking
 *   result_references — references used in winning gallery results surface first
 *   prompt_references — references attached to high-rated prompts are also boosted
 *   avoidance_patterns + failed results — surfaced as "Watch Out For"
 */

import type { Prompt, Token, SREF, Profile, Reference, Recipe } from "@/types";
import { createBoundedAsyncCache } from "./boundedCache";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

// ─── Shared types ─────────────────────────────────────────────

export interface TokenRec {
  token: Token;
  reason: string;
  score: number;
}

export interface PromptRec {
  prompt: Prompt;
  reason: string;
}

export interface RecipeRec {
  recipe: Recipe;
  reason: string;
}

export interface SREFRec {
  sref: SREF;
  reason: string;
}

export interface ProfileRec {
  profile: Profile;
  reason: string;
}

export interface ReferenceRec {
  reference: Reference;
  reason: string;
}

export interface AvoidanceRec {
  label: string;
  correction?: string;
  reason: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface RecommendationSet {
  tokens: TokenRec[];
  prompts: PromptRec[];
  recipes: RecipeRec[];
  srefs: SREFRec[];
  profiles: ProfileRec[];
  references: ReferenceRec[];
  avoidance: AvoidanceRec[];
}

// ─── Context passed in by the caller ─────────────────────────

export interface RecommendationContext {
  provider?: string;
  category?: string;
  tags?: string[];
  promptText?: string;
  excludePromptId?: string;
  projectId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function tryParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw as string) as T; } catch { return fallback; }
}

function rowToPrompt(row: Record<string, unknown>): Prompt {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    provider: (row.provider ?? "midjourney") as Prompt["provider"],
    category: row.category as Prompt["category"] | undefined,
    use_case: row.use_case as string | undefined,
    prompt_text: row.prompt_text as string,
    avoidance_text: row.avoidance_text as string | undefined,
    aspect_ratio: row.aspect_ratio as string | undefined,
    model_version: row.model_version as string | undefined,
    camera: row.camera as string | undefined,
    lens: row.lens as string | undefined,
    lighting: row.lighting as string | undefined,
    style_ref: row.style_ref as string | undefined,
    character_ref: row.character_ref as string | undefined,
    image_ref: row.image_ref as string | undefined,
    parameters: row.parameters ? tryParse(row.parameters, undefined) : undefined,
    tags: tryParse<string[]>(row.tags, []),
    rating: (row.rating as number) ?? 0,
    ai_look_risk: (row.ai_look_risk as number) ?? 0,
    reuse_potential: (row.reuse_potential as number) ?? 0,
    is_recipe: Boolean(row.is_recipe),
    is_winner: Boolean(row.is_winner),
    is_failed: Boolean(row.is_failed),
    failure_notes: row.failure_notes as string | undefined,
    notes: row.notes as string | undefined,
    version: (row.version as number) ?? 1,
    parent_id: row.parent_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToToken(row: Record<string, unknown>): Token {
  return {
    id: row.id as string,
    text: row.text as string,
    category_id: row.category_id as string,
    category_name: row.category_name as string | undefined,
    provider: row.provider as Token["provider"] | undefined,
    use_count: (row.use_count as number) ?? 0,
    quality_score: (row.quality_score as number) ?? 0,
    is_builtin: Boolean(row.is_builtin),
    is_favorite: Boolean(row.is_favorite),
  };
}

function rowToSREF(row: Record<string, unknown>): SREF {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    provider: (row.provider ?? "midjourney") as SREF["provider"],
    category: row.category as SREF["category"] | undefined,
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    example_path: row.example_path as string | undefined,
    rating: (row.rating as number) ?? 0,
    tags: tryParse<string[]>(row.tags, []),
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    provider: (row.provider ?? "midjourney") as Profile["provider"],
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    example_path: row.example_path as string | undefined,
    rating: (row.rating as number) ?? 0,
    tags: tryParse<string[]>(row.tags, []),
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

function rowToReference(row: Record<string, unknown>): Reference {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    kind: (row.kind as Reference["kind"]) ?? "image",
    file_data: row.file_data as string | undefined,
    thumbnail_data: row.thumbnail_data as string | undefined,
    provider: row.provider as Reference["provider"] | undefined,
    category: row.category as Reference["category"] | undefined,
    source_url: row.source_url as string | undefined,
    tags: tryParse<string[]>(row.tags, []),
    rating: (row.rating as number) ?? 0,
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Scorers ──────────────────────────────────────────────────

/** Proven tokens: high quality_score, same provider/category, not overused in failures. */
export async function recommendTokens(ctx: RecommendationContext, limit = 6): Promise<TokenRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const conditions: string[] = ["t.quality_score > 0.1"];
  const values: unknown[] = [];

  if (ctx.provider) {
    values.push(ctx.provider);
    conditions.push(`(t.provider = $${values.length} OR t.provider IS NULL)`);
  }

  const rows = (await db.select(
    `SELECT t.*, tc.name as category_name
     FROM tokens t
     LEFT JOIN token_categories tc ON t.category_id = tc.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.quality_score DESC, t.use_count DESC, t.is_favorite DESC
     LIMIT ${limit * 3}`,
    values
  )) as Record<string, unknown>[];

  const tokens = rows.map(rowToToken);

  // Filter out tokens already in the prompt text
  const promptLower = (ctx.promptText ?? "").toLowerCase();
  const filtered = tokens.filter((t) => !promptLower.includes(t.text.toLowerCase()));

  return filtered.slice(0, limit).map((t) => ({
    token: t,
    score: t.quality_score,
    reason: t.is_favorite
      ? "Favorited"
      : t.use_count > 5
        ? `Used ${t.use_count}× with high score`
        : "High quality score",
  }));
}

/**
 * Related prompts: same provider + category, sorted by actual gallery win count
 * then avg result score, then user rating. Gallery wins trump manual ratings.
 */
export async function recommendPrompts(ctx: RecommendationContext, limit = 4): Promise<PromptRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const conditions: string[] = ["p.rating >= 3", "p.is_failed = 0", "p.is_recipe = 0"];
  const values: unknown[] = [];

  if (ctx.excludePromptId) {
    values.push(ctx.excludePromptId);
    conditions.push(`p.id != $${values.length}`);
  }
  if (ctx.provider) {
    values.push(ctx.provider);
    conditions.push(`p.provider = $${values.length}`);
  }
  if (ctx.category) {
    values.push(ctx.category);
    conditions.push(`p.category = $${values.length}`);
  }

  const rows = (await db.select(
    `SELECT p.*,
       COUNT(r.id) AS result_count,
       SUM(CASE WHEN r.is_winner = 1 THEN 1 ELSE 0 END) AS win_count,
       COALESCE(AVG(CASE WHEN r.score_overall > 0 THEN r.score_overall END), 0) AS avg_score
     FROM prompts p
     LEFT JOIN results r ON r.prompt_id = p.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY p.id
     ORDER BY win_count DESC, avg_score DESC, p.is_winner DESC, p.rating DESC, p.reuse_potential DESC
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => {
    const p = rowToPrompt(row);
    const winCount = (row.win_count as number) ?? 0;
    const avgScore = (row.avg_score as number) ?? 0;
    const resultCount = (row.result_count as number) ?? 0;
    const reason = winCount > 0
      ? `${winCount} winning result${winCount !== 1 ? "s" : ""} in gallery`
      : resultCount > 0
        ? `${resultCount} result${resultCount !== 1 ? "s" : ""} · avg score ${avgScore.toFixed(1)}`
        : p.is_winner
          ? "Winner in same category"
          : p.rating >= 4
            ? `Rated ${p.rating}/5 — same provider`
            : "High reuse potential";
    return { prompt: p, reason };
  });
}

/**
 * Recipes: same category, sorted by gallery wins produced then rating.
 * Recipes that actually generated winning results surface first.
 */
export async function recommendRecipes(ctx: RecommendationContext, limit = 3): Promise<RecipeRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const conditions: string[] = ["r.rating >= 3"];
  const values: unknown[] = [];

  if (ctx.category) {
    values.push(ctx.category);
    conditions.push(`(r.category = $${values.length} OR r.category IS NULL)`);
  }
  if (ctx.provider) {
    values.push(ctx.provider);
    conditions.push(`(r.provider = $${values.length} OR r.provider IS NULL)`);
  }

  const rows = (await db.select(
    `SELECT r.*,
       SUM(CASE WHEN res.is_winner = 1 THEN 1 ELSE 0 END) AS win_count,
       COALESCE(AVG(CASE WHEN res.score_overall > 0 THEN res.score_overall END), 0) AS avg_score
     FROM prompts r
     LEFT JOIN results res ON res.prompt_id = r.id
     WHERE r.is_recipe = 1 AND ${conditions.join(" AND ")}
     GROUP BY r.id
     ORDER BY win_count DESC, avg_score DESC, r.rating DESC, r.reuse_potential DESC
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => {
    const p = rowToPrompt(row);
    const winCount = (row.win_count as number) ?? 0;
    const reason = winCount > 0
      ? `Generated ${winCount} winning result${winCount !== 1 ? "s" : ""}`
      : p.rating >= 4
        ? `Rated ${p.rating}/5 — ${ctx.category ?? "all"}`
        : "Frequently reused structure";
    return {
      recipe: {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        provider: p.provider,
        structure: [],
        example_prompt: p.prompt_text,
        tags: p.tags,
        use_count: 0,
        rating: p.rating,
        notes: p.notes,
        created_at: p.created_at,
        updated_at: p.updated_at,
      } as Recipe,
      reason,
    };
  });
}

/** Avoidance suggestions: built-in patterns + failure artifacts from same category. */
export async function recommendAvoidance(ctx: RecommendationContext, limit = 4): Promise<AvoidanceRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  // Pull avoidance patterns relevant to category/provider
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (ctx.category) {
    values.push(ctx.category);
    conditions.push(`(ap.category = $${values.length} OR ap.category = 'all')`);
  } else {
    conditions.push("ap.category = 'all'");
  }

  const patternRows = (await db.select(
    `SELECT ap.* FROM avoidance_patterns ap
     WHERE ${conditions.join(" AND ")}
     ORDER BY CASE ap.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  const recs: AvoidanceRec[] = patternRows.map((row) => ({
    label: row.label as string,
    correction: row.correction_prompt as string | undefined,
    reason: row.category === "all" ? "Common AI artifact" : `Common in ${ctx.category} work`,
    severity: (row.severity as AvoidanceRec["severity"]) ?? "medium",
  }));

  // Also pull frequent artifacts from failed results in same category
  if (ctx.category || ctx.provider) {
    const failedRows = (await db.select(
      `SELECT r.artifacts FROM results r
       LEFT JOIN prompts p ON r.prompt_id = p.id
       WHERE r.is_failed = 1
         AND r.artifacts IS NOT NULL
         AND r.artifacts != '[]'
         AND ($1 IS NULL OR p.category = $1)
       ORDER BY r.created_at DESC
       LIMIT 15`,
      [ctx.category ?? null]
    )) as { artifacts: string }[];

    const freq: Record<string, number> = {};
    for (const row of failedRows) {
      const arts = tryParse<string[]>(row.artifacts, []);
      for (const a of arts) freq[a] = (freq[a] ?? 0) + 1;
    }

    const topArtifacts = Object.entries(freq)
      .filter(([label]) => !recs.some((r) => r.label === label))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [label, count] of topArtifacts) {
      recs.push({
        label,
        reason: `Appeared in ${count} failed result${count !== 1 ? "s" : ""} in your library`,
        severity: "medium",
      });
    }
  }

  return recs.slice(0, limit);
}

/** SREF suggestions: same provider, same category, highest rated. */
export async function recommendSREFs(ctx: RecommendationContext, limit = 3): Promise<SREFRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const conditions: string[] = ["s.rating > 0"];
  const values: unknown[] = [];

  if (ctx.provider) {
    values.push(ctx.provider);
    conditions.push(`s.provider = $${values.length}`);
  }
  if (ctx.category) {
    values.push(ctx.category);
    conditions.push(`(s.category = $${values.length} OR s.category IS NULL)`);
  }

  const rows = (await db.select(
    `SELECT s.* FROM srefs s
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.rating DESC
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => {
    const s = rowToSREF(row);
    return {
      sref: s,
      reason: s.rating >= 4
        ? `Rated ${s.rating}/5 — ${ctx.provider ?? "your library"}`
        : s.best_use
          ? `Best for: ${s.best_use.slice(0, 40)}`
          : "High rated style ref",
    };
  });
}

/** Profile suggestions: same provider, highest rated. */
export async function recommendProfiles(ctx: RecommendationContext, limit = 3): Promise<ProfileRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const conditions: string[] = ["p.rating > 0"];
  const values: unknown[] = [];

  if (ctx.provider) {
    values.push(ctx.provider);
    conditions.push(`p.provider = $${values.length}`);
  }

  const rows = (await db.select(
    `SELECT p.* FROM profiles p
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.rating DESC
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => {
    const p = rowToProfile(row);
    return {
      profile: p,
      reason: p.rating >= 4
        ? `Rated ${p.rating}/5`
        : p.best_use
          ? `Best for: ${p.best_use.slice(0, 40)}`
          : "Highly rated profile",
    };
  });
}

/**
 * Reference suggestions — learned from three signals:
 *   1. result_references: references used in actual winning gallery results (strongest signal)
 *   2. prompt_references: references attached to high-rated/winner prompts
 *   3. user rating + tag overlap with current prompt context
 *
 * References with no results yet but a solid rating are still shown,
 * ranked below those proven by gallery data.
 */
export async function recommendReferences(ctx: RecommendationContext, limit = 4): Promise<ReferenceRec[]> {
  if (!isTauri) return [];
  const db = await getDb();

  const whereConditions: string[] = [];
  const values: unknown[] = [];

  if (ctx.category) {
    values.push(ctx.category);
    whereConditions.push(`(r.category = $${values.length} OR r.category IS NULL)`);
  }

  // Build tag match expression for ORDER BY boost (context tags ↔ reference tags)
  const tagMatchExpr = ctx.tags && ctx.tags.length > 0
    ? (() => {
        const clauses = ctx.tags.slice(0, 3).map((tag) => {
          values.push(`%${tag}%`);
          return `lower(r.tags) LIKE $${values.length}`;
        });
        return `CASE WHEN ${clauses.join(" OR ")} THEN 1 ELSE 0 END`;
      })()
    : "0";

  // Include refs with rating >= 2 OR proven by any winning gallery/prompt link
  const qualityFilter = "("
    + "r.rating >= 2"
    + " OR COALESCE(rr_agg.result_win_count, 0) > 0"
    + " OR COALESCE(pr_agg.prompt_win_count, 0) > 0"
    + ")";

  const whereClause = [qualityFilter, ...whereConditions].join(" AND ");

  const rows = (await db.select(
    `SELECT r.*,
       COALESCE(rr_agg.result_win_count,  0) AS result_win_count,
       COALESCE(rr_agg.result_appearances, 0) AS result_appearances,
       COALESCE(pr_agg.prompt_win_count,  0) AS prompt_win_count,
       ${tagMatchExpr} AS tag_match
     FROM "references" r
     LEFT JOIN (
       SELECT rr.reference_id,
         COUNT(DISTINCT rr.result_id) AS result_appearances,
         COUNT(DISTINCT CASE WHEN res.is_winner = 1 THEN res.id END) AS result_win_count
       FROM result_references rr
       JOIN results res ON res.id = rr.result_id
       GROUP BY rr.reference_id
     ) rr_agg ON rr_agg.reference_id = r.id
     LEFT JOIN (
       SELECT pr.reference_id,
         COUNT(DISTINCT CASE WHEN p.is_winner = 1 OR p.rating >= 4 THEN p.id END) AS prompt_win_count
       FROM prompt_references pr
       JOIN prompts p ON p.id = pr.prompt_id
       GROUP BY pr.reference_id
     ) pr_agg ON pr_agg.reference_id = r.id
     WHERE ${whereClause}
     ORDER BY tag_match DESC, result_win_count DESC, prompt_win_count DESC, r.rating DESC, r.created_at DESC
     LIMIT ${limit}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => {
    const ref = rowToReference(row);
    const resultWins   = (row.result_win_count  as number) ?? 0;
    const promptWins   = (row.prompt_win_count  as number) ?? 0;
    const tagMatch     = Boolean(row.tag_match);
    const reason = resultWins > 0
      ? `In ${resultWins} winning result${resultWins !== 1 ? "s" : ""} in gallery`
      : promptWins > 0
        ? `Used in ${promptWins} high-rated prompt${promptWins !== 1 ? "s" : ""}`
        : tagMatch
          ? "Matches current tags"
          : ref.best_use
            ? `Best for: ${ref.best_use.slice(0, 50)}`
            : ref.rating >= 4
              ? `Rated ${ref.rating}/5`
              : "In your reference library";
    return { reference: ref, reason };
  });
}

const _recCache = createBoundedAsyncCache<string, RecommendationSet>({
  maxEntries: 32,
  ttlMs: 30_000,
});

export function buildRecommendationCacheKey(ctx: RecommendationContext): string {
  return JSON.stringify({
    provider: ctx.provider ?? "",
    category: ctx.category ?? "",
    projectId: ctx.projectId ?? "",
    excludePromptId: ctx.excludePromptId ?? "",
    // Recommendation scoring intentionally considers the caller's first tags.
    // Preserve their order so distinct scoring inputs cannot share a cache key.
    tags: ctx.tags ?? [],
    promptText: ctx.promptText ?? "",
  });
}

export function invalidateRecommendationCache(): void {
  _recCache.invalidate();
}

/** Run all recommendation scorers in parallel, with a 30s in-memory cache per context key. */
export async function getRecommendations(ctx: RecommendationContext): Promise<RecommendationSet> {
  if (!isTauri) {
    return { tokens: [], prompts: [], recipes: [], srefs: [], profiles: [], references: [], avoidance: [] };
  }

  return _recCache.get(buildRecommendationCacheKey(ctx), async () => {
    const [tokens, prompts, recipes, srefs, profiles, references, avoidance] = await Promise.all([
      recommendTokens(ctx), recommendPrompts(ctx), recommendRecipes(ctx), recommendSREFs(ctx),
      recommendProfiles(ctx), recommendReferences(ctx), recommendAvoidance(ctx),
    ]);
    return { tokens, prompts, recipes, srefs, profiles, references, avoidance };
  });
}
