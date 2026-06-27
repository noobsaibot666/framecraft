import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ImpactReference {
  id: string;
  title: string;
  kind: string;
  thumbnail_data?: string;
  project_count: number;
  winner_count: number;
  impact_score: number;
}

/**
 * Scores each reference by how many winner prompts exist in projects it's linked to.
 * impact_score = winner_count / max(1, project_count) — higher means the reference correlates with wins.
 */
export async function getHighImpactReferences(limit = 5, projectId?: string): Promise<ImpactReference[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();

  const projectFilter = projectId ? `AND pr.project_id = $${1}` : "";
  const params: unknown[] = projectId ? [projectId] : [];
  // Limit param index
  const limitIdx = params.length + 1;
  params.push(limit);

  const rows = (await db.select(
    `SELECT
       r.id, r.title, r.kind, r.thumbnail_data,
       COUNT(DISTINCT pr.project_id) AS project_count,
       COUNT(DISTINCT CASE WHEN p.is_winner = 1 THEN p.id END) AS winner_count
     FROM "references" r
     JOIN project_references pr ON pr.reference_id = r.id
     LEFT JOIN project_prompts pp ON pp.project_id = pr.project_id
     LEFT JOIN prompts p ON p.id = pp.prompt_id
     WHERE 1=1 ${projectFilter}
     GROUP BY r.id
     HAVING winner_count > 0
     ORDER BY winner_count DESC, project_count DESC
     LIMIT $${limitIdx}`,
    params
  )) as Record<string, unknown>[];

  return rows.map((r) => {
    const projects = (r.project_count as number) ?? 1;
    const winners = (r.winner_count as number) ?? 0;
    return {
      id: r.id as string,
      title: r.title as string,
      kind: r.kind as string,
      thumbnail_data: r.thumbnail_data as string | undefined,
      project_count: projects,
      winner_count: winners,
      impact_score: Math.round((winners / Math.max(1, projects)) * 100) / 100,
    };
  });
}

/**
 * Quick score for a single reference — used to show impact badges inline.
 */
export async function getReferenceImpactScore(referenceId: string): Promise<number> {
  if (!isTauri) return 0;
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT
       COUNT(DISTINCT pr.project_id) AS project_count,
       COUNT(DISTINCT CASE WHEN p.is_winner = 1 THEN p.id END) AS winner_count
     FROM project_references pr
     LEFT JOIN project_prompts pp ON pp.project_id = pr.project_id
     LEFT JOIN prompts p ON p.id = pp.prompt_id
     WHERE pr.reference_id = $1`,
    [referenceId]
  )) as Record<string, unknown>[];
  const r = rows[0] ?? {};
  const projects = (r.project_count as number) ?? 0;
  const winners = (r.winner_count as number) ?? 0;
  if (projects === 0) return 0;
  return Math.round((winners / projects) * 100) / 100;
}
