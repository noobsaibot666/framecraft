import type { Project, ProjectStatus, ProjectFilters } from "@/types";
import { getFramecraftDb } from "./dbConnection";

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
    status: (row.status as ProjectStatus) ?? "draft",
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
  status?: ProjectStatus;
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
    await db.execute(
      `INSERT INTO projects
        (id, title, client, campaign, status, brief_text, production_goal,
         category, tags, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        data.title,
        data.client ?? null,
        data.campaign ?? null,
        data.status ?? "draft",
        data.brief_text ?? null,
        data.production_goal ?? null,
        data.category ?? null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.notes ?? null,
        ts,
        ts,
      ]
    );
    return id;
  }

  _devStore.unshift({
    id,
    title: data.title,
    client: data.client,
    campaign: data.campaign,
    status: data.status ?? "draft",
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
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length + 1}`); };

    if ("title" in data && data.title != null) add("title", data.title);
    if ("client" in data) add("client", data.client ?? null);
    if ("campaign" in data) add("campaign", data.campaign ?? null);
    if ("status" in data && data.status != null) add("status", data.status);
    if ("brief_text" in data) add("brief_text", data.brief_text ?? null);
    if ("production_goal" in data) add("production_goal", data.production_goal ?? null);
    if ("category" in data) add("category", data.category ?? null);
    if ("tags" in data) add("tags", data.tags ? JSON.stringify(data.tags) : null);
    if ("notes" in data) add("notes", data.notes ?? null);
    add("updated_at", ts);

    await db.execute(`UPDATE projects SET ${sets.join(", ")} WHERE id = $1`, [id, ...values]);
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
  await db.execute(
    "INSERT OR IGNORE INTO project_prompts (project_id, prompt_id) VALUES ($1, $2)",
    [projectId, promptId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
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
}[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, p.provider, p.rating, p.is_winner, p.is_failed
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
  }));
}

// ─── Link: Results ────────────────────────────────────────────

export async function addResultToProject(projectId: string, resultId: string): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO project_results (project_id, result_id) VALUES ($1, $2)",
    [projectId, resultId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
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
  id: string; score_overall: number; is_winner: boolean; is_failed: boolean; thumbnail_path?: string;
}[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.id, r.score_overall, r.is_winner, r.is_failed, r.thumbnail_path
     FROM results r
     JOIN project_results pr ON r.id = pr.result_id
     WHERE pr.project_id = $1
     ORDER BY r.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
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
  await db.execute(
    "INSERT OR IGNORE INTO project_references (project_id, reference_id) VALUES ($1, $2)",
    [projectId, referenceId]
  );
  await db.execute("UPDATE projects SET updated_at = $1 WHERE id = $2", [now(), projectId]);
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
  await db.execute("DELETE FROM project_prompts WHERE project_id = $1", [projectId]);
  await db.execute("DELETE FROM project_results WHERE project_id = $1", [projectId]);
  await db.execute("DELETE FROM project_references WHERE project_id = $1", [projectId]);
  await db.execute("DELETE FROM project_deliverables WHERE project_id = $1", [projectId]);
  await db.execute("DELETE FROM assistant_threads WHERE project_id = $1", [projectId]);
  await db.execute("DELETE FROM comparison_sessions WHERE project_id = $1", [projectId]);
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
    [now(), projectId]
  );
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

export async function getProjectsForPrompt(promptId: string): Promise<{ id: string; title: string }[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title FROM projects p
     JOIN project_prompts pp ON p.id = pp.project_id
     WHERE pp.prompt_id = $1 ORDER BY p.title ASC`,
    [promptId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({ id: r.id as string, title: r.title as string }));
}
