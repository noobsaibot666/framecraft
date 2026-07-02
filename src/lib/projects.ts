import type { Project, ProjectStatus, ProjectFilters } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { executeAtomically } from "./dbTransaction";
import { buildCreateProjectStatements, buildProjectRelationshipStatements } from "./dbStatements";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

function tryParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw as string) as T; } catch { return fallback; }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    client: row.client as string | undefined,
    campaign: row.campaign as string | undefined,
    campaign_id: row.campaign_id as string | undefined,
    status: (row.status as ProjectStatus) ?? "draft",
    project_type: row.project_type as string | undefined,
    intended_output: row.intended_output as string | undefined,
    image_needs: row.image_needs as string | undefined,
    video_needs: row.video_needs as string | undefined,
    aspect_ratios: tryParse<string[]>(row.aspect_ratios, []),
    provider_targets: tryParse<string[]>(row.provider_targets, []),
    visual_direction: row.visual_direction as string | undefined,
    constraints: row.constraints as string | undefined,
    creative_goals: row.creative_goals as string | undefined,
    brief_text: row.brief_text as string | undefined,
    production_goal: row.production_goal as string | undefined,
    category: row.category as Project["category"] | undefined,
    tags: tryParse<string[]>(row.tags, []),
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    prompt_count: (row.prompt_count as number) ?? undefined,
    result_count: (row.result_count as number) ?? undefined,
    reference_count: (row.reference_count as number) ?? undefined,
    winner_count: (row.winner_count as number) ?? undefined,
  };
}

// ─── In-memory dev store ──────────────────────────────────────
const _devStore: Project[] = [];

// ─── CRUD ─────────────────────────────────────────────────────

export interface CreateProjectInput {
  title: string;
  client?: string;
  campaign?: string;
  campaign_id?: string;
  status?: ProjectStatus;
  project_type?: string;
  intended_output?: string;
  image_needs?: string;
  video_needs?: string;
  aspect_ratios?: string[];
  provider_targets?: string[];
  visual_direction?: string;
  constraints?: string;
  creative_goals?: string;
  brief_text?: string;
  production_goal?: string;
  category?: Project["category"];
  tags?: string[];
  notes?: string;
}

export async function createProject(data: CreateProjectInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    try {
      await executeAtomically(db, buildCreateProjectStatements(data, id, ts));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create project atomically: ${msg}`);
    }
    return id;
  }

  _devStore.unshift({
    id,
    title: data.title,
    client: data.client,
    campaign: data.campaign,
    campaign_id: data.campaign_id,
    status: data.status ?? "draft",
    project_type: data.project_type,
    intended_output: data.intended_output,
    image_needs: data.image_needs,
    video_needs: data.video_needs,
    aspect_ratios: data.aspect_ratios ?? [],
    provider_targets: data.provider_targets ?? [],
    visual_direction: data.visual_direction,
    constraints: data.constraints,
    creative_goals: data.creative_goals,
    brief_text: data.brief_text,
    production_goal: data.production_goal,
    category: data.category,
    tags: data.tags ?? [],
    notes: data.notes,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getProjects(filters?: ProjectFilters): Promise<Project[]> {
  if (isTauri) {
    const db = await getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.status) {
      values.push(filters.status);
      conditions.push(`p.status = $${values.length}`);
    } else if (filters?.excludeArchived) {
      conditions.push(`p.status != 'archived'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = (await db.select(
      `SELECT p.*,
         (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) as prompt_count,
         (SELECT COUNT(*) FROM project_results pr WHERE pr.project_id = p.id) as result_count,
         (SELECT COUNT(*) FROM project_references pref WHERE pref.project_id = p.id) as reference_count
       FROM projects p ${where}
       ORDER BY p.updated_at DESC`,
      values
    )) as Record<string, unknown>[];
    return rows.map(rowToProject);
  }

  let list = [..._devStore];
  if (filters?.status) list = list.filter((p) => p.status === filters.status);
  else if (filters?.excludeArchived) list = list.filter((p) => p.status !== "archived");
  return list;
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT p.*,
         (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) as prompt_count,
         (SELECT COUNT(*) FROM project_results pr WHERE pr.project_id = p.id) as result_count,
         (SELECT COUNT(*) FROM project_references pref WHERE pref.project_id = p.id) as reference_count,
         (SELECT COUNT(*) FROM project_prompts pp2
            JOIN prompts pr2 ON pp2.prompt_id = pr2.id
            WHERE pp2.project_id = p.id AND pr2.is_winner = 1) as winner_count
       FROM projects p WHERE p.id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToProject(rows[0]) : null;
  }
  return _devStore.find((p) => p.id === id) ?? null;
}

export async function searchProjects(query: string, filters?: ProjectFilters): Promise<Project[]> {
  const q = query.toLowerCase().trim();
  if (!q) return getProjects(filters);

  if (isTauri) {
    const db = await getDb();
    const conditions: string[] = [
      `(lower(p.title) LIKE $1 OR lower(p.client) LIKE $1 OR lower(p.campaign) LIKE $1 OR lower(p.tags) LIKE $1 OR lower(p.notes) LIKE $1)`,
    ];
    const values: unknown[] = [`%${q}%`];

    if (filters?.status) { values.push(filters.status); conditions.push(`p.status = $${values.length}`); }
    else if (filters?.excludeArchived) { conditions.push(`p.status != 'archived'`); }

    const rows = (await db.select(
      `SELECT p.*,
         (SELECT COUNT(*) FROM project_prompts pp WHERE pp.project_id = p.id) as prompt_count,
         (SELECT COUNT(*) FROM project_results pr WHERE pr.project_id = p.id) as result_count,
         (SELECT COUNT(*) FROM project_references pref WHERE pref.project_id = p.id) as reference_count
       FROM projects p WHERE ${conditions.join(" AND ")} ORDER BY p.updated_at DESC`,
      values
    )) as Record<string, unknown>[];
    return rows.map(rowToProject);
  }

  const all = await getProjects(filters);
  return all.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    p.client?.toLowerCase().includes(q) ||
    p.campaign?.toLowerCase().includes(q) ||
    p.tags?.some((t) => t.toLowerCase().includes(q))
  );
}

export async function updateProject(id: string, data: Partial<CreateProjectInput>): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getDb();

    // ── Base columns (migration 010 — always exist) ────────────
    {
      const sets: string[] = ["updated_at = $1"];
      const values: unknown[] = [ts];
      const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

      if ("title" in data && data.title != null) add("title", data.title);
      if ("client" in data) add("client", data.client ?? null);
      if ("campaign" in data) add("campaign", data.campaign ?? null);
      if ("status" in data && data.status != null) add("status", data.status);
      if ("brief_text" in data) add("brief_text", data.brief_text ?? null);
      if ("production_goal" in data) add("production_goal", data.production_goal ?? null);
      if ("category" in data) add("category", data.category ?? null);
      if ("tags" in data) add("tags", data.tags ? JSON.stringify(data.tags) : null);
      if ("notes" in data) add("notes", data.notes ?? null);

      values.push(id);
      await db.execute(`UPDATE projects SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    }

    // ── Extended columns (migration 014) ───────────────────────
    const ext014Keys = ["project_type","intended_output","image_needs","video_needs","aspect_ratios","provider_targets","visual_direction","constraints","creative_goals"] as const;
    if (ext014Keys.some((k) => k in data)) {
      try {
        const sets: string[] = [];
        const values: unknown[] = [];
        const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

        if ("project_type" in data) add("project_type", data.project_type ?? null);
        if ("intended_output" in data) add("intended_output", data.intended_output ?? null);
        if ("image_needs" in data) add("image_needs", data.image_needs ?? null);
        if ("video_needs" in data) add("video_needs", data.video_needs ?? null);
        if ("aspect_ratios" in data) add("aspect_ratios", data.aspect_ratios ? JSON.stringify(data.aspect_ratios) : null);
        if ("provider_targets" in data) add("provider_targets", data.provider_targets ? JSON.stringify(data.provider_targets) : null);
        if ("visual_direction" in data) add("visual_direction", data.visual_direction ?? null);
        if ("constraints" in data) add("constraints", data.constraints ?? null);
        if ("creative_goals" in data) add("creative_goals", data.creative_goals ?? null);

        if (sets.length) {
          values.push(id);
          await db.execute(`UPDATE projects SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
        }
      } catch {
        // migration 014 columns not yet applied — base fields already saved above
      }
    }

    // ── campaign_id (migration 018) ────────────────────────────
    if ("campaign_id" in data) {
      try {
        await db.execute(
          `UPDATE projects SET campaign_id = $1, updated_at = $2 WHERE id = $3`,
          [data.campaign_id ?? null, ts, id]
        );
      } catch (err) {
        console.warn("[updateProject] campaign_id UPDATE failed (migration 018 not yet applied?):", err);
      }
    }
    return;
  }

  const idx = _devStore.findIndex((p) => p.id === id);
  if (idx !== -1) _devStore[idx] = { ..._devStore[idx], ...data, updated_at: ts };
}

export async function deleteProject(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    // Cascade handles link tables
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
    return;
  }
  const idx = _devStore.findIndex((p) => p.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}

// ─── Link: Prompts ────────────────────────────────────────────

export async function addPromptToProject(projectId: string, promptId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  const ts = now();
  await executeAtomically(db, buildProjectRelationshipStatements("prompts", projectId, promptId, ts));
}

export async function removePromptFromProject(projectId: string, promptId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "DELETE FROM project_prompts WHERE project_id = $1 AND prompt_id = $2",
    [projectId, promptId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
}

export async function getPromptsForProject(projectId: string): Promise<{
  id: string; title: string; provider: string; rating: number; is_winner: boolean; is_failed: boolean;
  version: number; parent_id?: string; thumbnail_data?: string;
}[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, p.provider, p.rating, p.is_winner, p.is_failed,
            p.version, p.parent_id, p.thumbnail_data
     FROM prompts p
     JOIN project_prompts pp ON p.id = pp.prompt_id
     WHERE pp.project_id = $1
     ORDER BY p.rating DESC, p.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    provider: r.provider as string,
    rating: (r.rating as number) ?? 0,
    is_winner: Boolean(r.is_winner),
    is_failed: Boolean(r.is_failed),
    version: (r.version as number) ?? 1,
    parent_id: r.parent_id as string | undefined,
    thumbnail_data: r.thumbnail_data as string | undefined,
  }));
}

// ─── Link: Results ────────────────────────────────────────────

export async function addResultToProject(projectId: string, resultId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  const ts = now();
  await executeAtomically(db, buildProjectRelationshipStatements("results", projectId, resultId, ts));
}

export async function removeResultFromProject(projectId: string, resultId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "DELETE FROM project_results WHERE project_id = $1 AND result_id = $2",
    [projectId, resultId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
}

export async function getResultsForProject(projectId: string): Promise<{
  id: string; prompt_id?: string; score_overall: number; is_winner: boolean; is_failed: boolean; thumbnail_path?: string;
}[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.id, r.prompt_id, r.score_overall, r.is_winner, r.is_failed, r.thumbnail_path
     FROM results r
     JOIN project_results pr ON r.id = pr.result_id
     WHERE pr.project_id = $1
     ORDER BY r.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    prompt_id: r.prompt_id as string | undefined,
    score_overall: (r.score_overall as number) ?? 0,
    is_winner: Boolean(r.is_winner),
    is_failed: Boolean(r.is_failed),
    thumbnail_path: r.thumbnail_path as string | undefined,
  }));
}

// ─── Link: References ─────────────────────────────────────────

export async function addReferenceToProject(projectId: string, referenceId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  const ts = now();
  await executeAtomically(db, buildProjectRelationshipStatements("references", projectId, referenceId, ts));
}

export async function removeReferenceFromProject(projectId: string, referenceId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "DELETE FROM project_references WHERE project_id = $1 AND reference_id = $2",
    [projectId, referenceId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
}

export async function resetProjectContent(projectId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await executeProjectResetTransaction(db, projectId, now());
}

async function executeProjectResetTransaction(db: {
  execute(sql: string, values?: unknown[]): Promise<unknown>;
  executeBatch?: (sql: string) => Promise<void>;
}, projectId: string, updatedAt: string): Promise<void> {
  const batchSql = buildProjectResetBatchSql(projectId, updatedAt);

  if (typeof db.executeBatch === "function") {
    await db.executeBatch(batchSql);
    return;
  }

  await db.execute("BEGIN");
  try {
    await db.execute("DELETE FROM project_prompts WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM project_results WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM project_references WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM project_deliverables WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM assistant_threads WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM comparison_sessions WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM creative_directions WHERE project_id = $1", [projectId]);
    await db.execute("DELETE FROM export_presets WHERE project_id = $1", [projectId]);
    await db.execute(
      `UPDATE projects
       SET brief_text = NULL,
           production_goal = NULL,
           category = NULL,
           notes = NULL,
           tags = NULL,
           updated_at = $1
       WHERE id = $2`,
      [updatedAt, projectId]
    );
    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export function buildProjectResetBatchSql(projectId: string, updatedAt: string): string {
  // executeBatch has no bind-parameter API. Every interpolated value must pass
  // through sqlQuote; raw interpolation here would create an SQL-injection risk.
  const quotedProjectId = sqlQuote(projectId);
  const quotedUpdatedAt = sqlQuote(updatedAt);
  return `
    BEGIN;
    DELETE FROM project_prompts WHERE project_id = ${quotedProjectId};
    DELETE FROM project_results WHERE project_id = ${quotedProjectId};
    DELETE FROM project_references WHERE project_id = ${quotedProjectId};
    DELETE FROM project_deliverables WHERE project_id = ${quotedProjectId};
    DELETE FROM assistant_threads WHERE project_id = ${quotedProjectId};
    DELETE FROM comparison_sessions WHERE project_id = ${quotedProjectId};
    DELETE FROM creative_directions WHERE project_id = ${quotedProjectId};
    DELETE FROM export_presets WHERE project_id = ${quotedProjectId};
    UPDATE projects
       SET brief_text = NULL,
           production_goal = NULL,
           category = NULL,
           notes = NULL,
           tags = NULL,
           updated_at = ${quotedUpdatedAt}
     WHERE id = ${quotedProjectId};
    COMMIT;
  `;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function getReferencesForProject(projectId: string): Promise<{
  id: string; title: string; kind: string; thumbnail_data?: string; rating: number;
}[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.id, r.title, r.kind, r.thumbnail_data, r.rating
     FROM "references" r
     JOIN project_references pr ON r.id = pr.reference_id
     WHERE pr.project_id = $1
     ORDER BY r.title ASC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as string,
    thumbnail_data: r.thumbnail_data as string | undefined,
    rating: (r.rating as number) ?? 0,
  }));
}

// ─── Projects that contain a given prompt/result/reference ────

export async function getProjectsForPrompt(
  promptId: string
): Promise<{ id: string; title: string; campaign_id?: string; campaign_title?: string }[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, p.campaign_id, c.title AS campaign_title
     FROM projects p
     JOIN project_prompts pp ON p.id = pp.project_id
     LEFT JOIN campaigns c ON c.id = p.campaign_id
     WHERE pp.prompt_id = $1 ORDER BY p.title ASC`,
    [promptId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    campaign_id: r.campaign_id as string | undefined,
    campaign_title: r.campaign_title as string | undefined,
  }));
}
