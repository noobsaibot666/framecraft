import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ImpactReference {
  id: string;
  title: string;
  kind: string;
  thumbnail_data?: string;
  /** References linked to projects whose prompts are winners */
  project_count: number;
  project_winner_count: number;
  /** References directly linked via result_references to winning gallery results */
  result_appearances: number;
  result_win_count: number;
  /**
   * Composite score weighting result-level wins (60%) over project-level wins (40%).
   * range 0–1.
   */
  impact_score: number;
}

/**
 * Scores each reference by two orthogonal signals:
 *   1. project_references → project_prompts → prompts.is_winner  (existing path)
 *   2. result_references  → results.is_winner                    (direct gallery path)
 *
 * Result-level correlation is weighted higher (60%) because it's a direct causal link:
 * the reference was literally used in the generation that won.
 *
 * When projectId is supplied, only references attached to that project are considered
 * for the project path (result path is always global).
 */
export async function getHighImpactReferences(limit = 5, projectId?: string): Promise<ImpactReference[]> {
  if (!isTauri) return [];
  const db = await getFramecraftDb();

  const params: unknown[] = [];

  // Conditionally scope the project JOIN to a specific project
  const projectJoinFilter = projectId
    ? (() => { params.push(projectId); return `AND pr.project_id = $${params.length}`; })()
    : "";

  // HAVING extra clause: if projectId given, require the reference to be in that project
  const projectHavingFilter = projectId ? "AND project_count > 0" : "";

  params.push(limit);
  const limitIdx = params.length;

  const rows = (await db.select(
    `SELECT
       r.id, r.title, r.kind, r.thumbnail_data,
       COUNT(DISTINCT pr.project_id)                                       AS project_count,
       COUNT(DISTINCT CASE WHEN p.is_winner = 1 THEN p.id END)             AS project_winner_count,
       COALESCE(rr_agg.result_appearances, 0)                              AS result_appearances,
       COALESCE(rr_agg.result_win_count, 0)                                AS result_win_count
     FROM "references" r
     LEFT JOIN project_references pr  ON pr.reference_id = r.id ${projectJoinFilter}
     LEFT JOIN project_prompts    pp  ON pp.project_id   = pr.project_id
     LEFT JOIN prompts            p   ON p.id            = pp.prompt_id
     LEFT JOIN (
       SELECT rr.reference_id,
         COUNT(DISTINCT rr.result_id)                                      AS result_appearances,
         COUNT(DISTINCT CASE WHEN res.is_winner = 1 THEN res.id END)       AS result_win_count
       FROM result_references rr
       JOIN results res ON res.id = rr.result_id
       GROUP BY rr.reference_id
     ) rr_agg ON rr_agg.reference_id = r.id
     GROUP BY r.id
     HAVING (project_winner_count > 0 OR result_win_count > 0) ${projectHavingFilter}
     ORDER BY result_win_count DESC, project_winner_count DESC, result_appearances DESC
     LIMIT $${limitIdx}`,
    params
  )) as Record<string, unknown>[];

  return rows.map((r) => {
    const projectCount  = (r.project_count        as number) ?? 1;
    const projectWins   = (r.project_winner_count as number) ?? 0;
    const resultApps    = (r.result_appearances   as number) ?? 0;
    const resultWins    = (r.result_win_count     as number) ?? 0;

    const projectRate = projectCount > 0 ? projectWins / projectCount : 0;
    const resultRate  = resultApps   > 0 ? resultWins  / resultApps   : 0;
    const composite   = Math.round((projectRate * 0.4 + resultRate * 0.6) * 100) / 100;

    return {
      id:                   r.id            as string,
      title:                r.title         as string,
      kind:                 r.kind          as string,
      thumbnail_data:       r.thumbnail_data as string | undefined,
      project_count:        projectCount,
      project_winner_count: projectWins,
      result_appearances:   resultApps,
      result_win_count:     resultWins,
      impact_score:         composite,
    };
  });
}

/**
 * Composite impact score for a single reference.
 * Merges project-level winner correlation with direct result-level winner correlation.
 */
export async function getReferenceImpactScore(referenceId: string): Promise<number> {
  if (!isTauri) return 0;
  const db = await getFramecraftDb();

  const [projectRows, resultRows] = await Promise.all([
    db.select(
      `SELECT
         COUNT(DISTINCT pr.project_id)                               AS project_count,
         COUNT(DISTINCT CASE WHEN p.is_winner = 1 THEN p.id END)     AS winner_count
       FROM project_references pr
       LEFT JOIN project_prompts pp ON pp.project_id = pr.project_id
       LEFT JOIN prompts         p  ON p.id          = pp.prompt_id
       WHERE pr.reference_id = $1`,
      [referenceId]
    ) as Promise<Record<string, unknown>[]>,
    db.select(
      `SELECT
         COUNT(DISTINCT rr.result_id)                                AS result_count,
         COUNT(DISTINCT CASE WHEN res.is_winner = 1 THEN res.id END) AS win_count
       FROM result_references rr
       JOIN results res ON res.id = rr.result_id
       WHERE rr.reference_id = $1`,
      [referenceId]
    ) as Promise<Record<string, unknown>[]>,
  ]);

  const pr = (projectRows as Record<string, unknown>[])[0] ?? {};
  const rr = (resultRows  as Record<string, unknown>[])[0] ?? {};

  const projectCount = (pr.project_count as number) ?? 0;
  const projectWins  = (pr.winner_count  as number) ?? 0;
  const resultCount  = (rr.result_count  as number) ?? 0;
  const resultWins   = (rr.win_count     as number) ?? 0;

  const projectRate = projectCount > 0 ? projectWins / projectCount : 0;
  const resultRate  = resultCount  > 0 ? resultWins  / resultCount  : 0;

  if (projectRate === 0 && resultRate === 0) return 0;

  // Weight result-level correlation more heavily — it's a direct causal signal
  return Math.round((projectRate * 0.4 + resultRate * 0.6) * 100) / 100;
}
