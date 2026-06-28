import { getFramecraftDb } from "./dbConnection";
import type { Result } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type GalleryFilter = "all" | "winner" | "failed" | "unreviewed";
export type GallerySort = "newest" | "oldest" | "highest_score" | "winner_first";

export interface GalleryOptions {
  filter: GalleryFilter;
  sort: GallerySort;
  provider?: string;
  limit?: number;
}

export type GalleryResult = Result & { prompt_title: string; prompt_provider: string };

export function buildGalleryWhere(opts: Pick<GalleryOptions, "filter" | "provider">): {
  conditions: string[];
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (opts.filter === "winner") conditions.push("r.is_winner = 1");
  if (opts.filter === "failed") conditions.push("r.is_failed = 1");
  if (opts.filter === "unreviewed") conditions.push("(r.score_overall = 0 OR r.score_overall IS NULL) AND r.is_failed = 0");

  if (opts.provider) {
    values.push(opts.provider);
    conditions.push(`(r.provider = $${values.length} OR p.provider = $${values.length})`);
  }

  return { conditions, values };
}

export function buildGalleryOrderBy(sort: GallerySort): string {
  if (sort === "oldest") return "r.created_at ASC";
  if (sort === "highest_score") return "r.score_overall DESC, r.created_at DESC";
  if (sort === "winner_first") return "r.is_winner DESC, r.score_overall DESC, r.created_at DESC";
  return "r.created_at DESC";
}

export async function getAllGalleryResults(opts: GalleryOptions): Promise<GalleryResult[]> {
  if (!isTauri) return [];

  const db = await getFramecraftDb();
  const limit = opts.limit ?? 60;
  const { conditions, values } = buildGalleryWhere(opts);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = buildGalleryOrderBy(opts.sort);
  const limitParam = values.length + 1;

  const rows = (await db.select(
    `SELECT r.*, COALESCE(p.title, 'Untitled') AS prompt_title, COALESCE(p.provider, '') AS prompt_provider
     FROM results r
     LEFT JOIN prompts p ON r.prompt_id = p.id
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${limitParam}`,
    [...values, limit]
  )) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    prompt_id: row.prompt_id as string,
    file_path: row.file_path as string | undefined,
    thumbnail_path: row.thumbnail_path as string | undefined,
    provider: row.provider as GalleryResult["provider"] | undefined,
    score_overall: (row.score_overall as number) ?? 0,
    score_realism: (row.score_realism as number) ?? 0,
    score_brand_fit: (row.score_brand_fit as number) ?? 0,
    score_composition: (row.score_composition as number) ?? 0,
    score_lighting: (row.score_lighting as number) ?? 0,
    score_ai_risk: (row.score_ai_risk as number) ?? 0,
    reuse_potential: (row.reuse_potential as number) ?? 0,
    is_winner: Boolean(row.is_winner),
    is_failed: Boolean(row.is_failed),
    artifacts: row.artifacts ? JSON.parse(row.artifacts as string) : [],
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    prompt_title: (row.prompt_title as string) ?? "Untitled",
    prompt_provider: (row.prompt_provider as string) ?? "",
  }));
}
