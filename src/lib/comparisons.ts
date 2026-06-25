import type { ComparisonSession, ComparisonItem, ComparisonResult, Provider } from "@/types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
async function getDb() {
  if (!isTauri) throw new Error("Not in Tauri context");
  if (!_db) {
    const SqlPlugin = await import("@tauri-apps/plugin-sql");
    _db = await SqlPlugin.default.load("sqlite:framecraft.db");
  }
  return _db;
}

function generateId() {
  return crypto.randomUUID();
}
function now() {
  return new Date().toISOString();
}

// ─── Dev fallback stores ──────────────────────────────────────

const _devSessions: ComparisonSession[] = [];
const _devItems: ComparisonItem[] = [];

// ─── Row mappers ──────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): ComparisonSession {
  return {
    id: row.id as string,
    title: row.title as string,
    project_id: row.project_id as string | undefined,
    notes: row.notes as string | undefined,
    item_count: (row.item_count as number) ?? 0,
    winner_count: (row.winner_count as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToItem(row: Record<string, unknown>): ComparisonItem {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    result_id: row.result_id as string,
    position: (row.position as number) ?? 0,
    is_winner: Boolean(row.is_winner),
    is_rejected: Boolean(row.is_rejected),
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
  };
}

function rowToComparisonResult(row: Record<string, unknown>): ComparisonResult {
  return {
    result_id: row.result_id as string,
    prompt_id: row.prompt_id as string,
    prompt_title: row.prompt_title as string,
    prompt_provider: (row.prompt_provider ?? "midjourney") as Provider,
    prompt_version: (row.prompt_version as number) ?? 1,
    thumbnail_path: row.thumbnail_path as string | undefined,
    file_path: row.file_path as string | undefined,
    score_overall: (row.score_overall as number) ?? 0,
    score_realism: (row.score_realism as number) ?? 0,
    score_brand_fit: (row.score_brand_fit as number) ?? 0,
    score_composition: (row.score_composition as number) ?? 0,
    score_lighting: (row.score_lighting as number) ?? 0,
    score_ai_risk: (row.score_ai_risk as number) ?? 0,
    is_winner: Boolean(row.is_winner),
    is_failed: Boolean(row.is_failed),
    artifacts: row.artifacts ? JSON.parse(row.artifacts as string) : undefined,
    created_at: row.created_at as string,
  };
}

// ─── Session CRUD ─────────────────────────────────────────────

export interface CreateSessionInput {
  title: string;
  project_id?: string;
  notes?: string;
}

export async function createSession(data: CreateSessionInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT INTO comparison_sessions (id, title, project_id, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.title, data.project_id ?? null, data.notes ?? null, ts, ts]
    );
    return id;
  }

  _devSessions.unshift({
    id, title: data.title, project_id: data.project_id, notes: data.notes,
    item_count: 0, winner_count: 0, created_at: ts, updated_at: ts,
  });
  return id;
}

export async function getSessions(projectId?: string): Promise<ComparisonSession[]> {
  if (isTauri) {
    const db = await getDb();
    const where = projectId ? "WHERE cs.project_id = $1" : "";
    const rows = (await db.select(
      `SELECT cs.*,
         (SELECT COUNT(*) FROM comparison_items ci WHERE ci.session_id = cs.id) as item_count,
         (SELECT COUNT(*) FROM comparison_items ci WHERE ci.session_id = cs.id AND ci.is_winner = 1) as winner_count
       FROM comparison_sessions cs ${where}
       ORDER BY cs.updated_at DESC`,
      projectId ? [projectId] : []
    )) as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  let list = [..._devSessions];
  if (projectId) list = list.filter((s) => s.project_id === projectId);
  return list;
}

export async function getSessionById(id: string): Promise<ComparisonSession | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT cs.*,
         (SELECT COUNT(*) FROM comparison_items ci WHERE ci.session_id = cs.id) as item_count,
         (SELECT COUNT(*) FROM comparison_items ci WHERE ci.session_id = cs.id AND ci.is_winner = 1) as winner_count
       FROM comparison_sessions cs WHERE cs.id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToSession(rows[0]) : null;
  }
  return _devSessions.find((s) => s.id === id) ?? null;
}

export async function updateSession(id: string, data: Partial<CreateSessionInput>): Promise<void> {
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    if (data.title !== undefined) { values.push(data.title); sets.push(`title = $${values.length}`); }
    if (data.notes !== undefined) { values.push(data.notes); sets.push(`notes = $${values.length}`); }
    values.push(id);
    await db.execute(`UPDATE comparison_sessions SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }
  const idx = _devSessions.findIndex((s) => s.id === id);
  if (idx !== -1) _devSessions[idx] = { ..._devSessions[idx], ...data, updated_at: ts };
}

export async function deleteSession(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM comparison_sessions WHERE id = $1", [id]);
    return;
  }
  const idx = _devSessions.findIndex((s) => s.id === id);
  if (idx !== -1) _devSessions.splice(idx, 1);
}

// ─── Item CRUD ────────────────────────────────────────────────

export async function addItemToSession(
  sessionId: string,
  resultId: string,
  position = 0
): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT OR IGNORE INTO comparison_items (id, session_id, result_id, position, is_winner, is_rejected, created_at)
       VALUES ($1, $2, $3, $4, 0, 0, $5)`,
      [id, sessionId, resultId, position, ts]
    );
    await db.execute(
      "UPDATE comparison_sessions SET updated_at = $1 WHERE id = $2",
      [ts, sessionId]
    );
    return id;
  }

  if (!_devItems.some((i) => i.session_id === sessionId && i.result_id === resultId)) {
    _devItems.push({ id, session_id: sessionId, result_id: resultId, position, is_winner: false, is_rejected: false, created_at: ts });
  }
  const si = _devSessions.findIndex((s) => s.id === sessionId);
  if (si !== -1) {
    _devSessions[si].item_count = _devItems.filter((i) => i.session_id === sessionId).length;
    _devSessions[si].updated_at = ts;
  }
  return id;
}

export async function removeItemFromSession(itemId: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select("SELECT session_id FROM comparison_items WHERE id = $1", [itemId])) as { session_id: string }[];
    await db.execute("DELETE FROM comparison_items WHERE id = $1", [itemId]);
    if (rows[0]) {
      await db.execute("UPDATE comparison_sessions SET updated_at = $1 WHERE id = $2", [now(), rows[0].session_id]);
    }
    return;
  }
  const idx = _devItems.findIndex((i) => i.id === itemId);
  if (idx !== -1) _devItems.splice(idx, 1);
}

export async function getItemsForSession(sessionId: string): Promise<ComparisonItem[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      "SELECT * FROM comparison_items WHERE session_id = $1 ORDER BY position ASC, created_at ASC",
      [sessionId]
    )) as Record<string, unknown>[];
    return rows.map(rowToItem);
  }
  return _devItems.filter((i) => i.session_id === sessionId).sort((a, b) => a.position - b.position);
}

export async function setItemWinner(itemId: string, sessionId: string): Promise<void> {
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      "UPDATE comparison_items SET is_winner = 0 WHERE session_id = $1",
      [sessionId]
    );
    await db.execute(
      "UPDATE comparison_items SET is_winner = 1, is_rejected = 0 WHERE id = $1",
      [itemId]
    );
    await db.execute("UPDATE comparison_sessions SET updated_at = $1 WHERE id = $2", [ts, sessionId]);
    return;
  }
  _devItems.filter((i) => i.session_id === sessionId).forEach((i) => { i.is_winner = false; });
  const item = _devItems.find((i) => i.id === itemId);
  if (item) { item.is_winner = true; item.is_rejected = false; }
}

export async function clearItemWinner(sessionId: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("UPDATE comparison_items SET is_winner = 0 WHERE session_id = $1", [sessionId]);
    return;
  }
  _devItems.filter((i) => i.session_id === sessionId).forEach((i) => { i.is_winner = false; });
}

export async function setItemRejected(itemId: string, isRejected: boolean): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute(
      "UPDATE comparison_items SET is_rejected = $1, is_winner = 0 WHERE id = $2",
      [isRejected ? 1 : 0, itemId]
    );
    return;
  }
  const item = _devItems.find((i) => i.id === itemId);
  if (item) { item.is_rejected = isRejected; if (isRejected) item.is_winner = false; }
}

export async function updateItemNotes(itemId: string, notes: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("UPDATE comparison_items SET notes = $1 WHERE id = $2", [notes, itemId]);
    return;
  }
  const item = _devItems.find((i) => i.id === itemId);
  if (item) item.notes = notes;
}

// ─── Result loading ───────────────────────────────────────────

/** Load all results for a project, enriched with prompt metadata. */
export async function loadProjectResults(projectId: string): Promise<ComparisonResult[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT
       r.id as result_id,
       r.prompt_id,
       p.title as prompt_title,
       p.provider as prompt_provider,
       p.version as prompt_version,
       r.thumbnail_path,
       r.file_path,
       r.score_overall,
       r.score_realism,
       r.score_brand_fit,
       r.score_composition,
       r.score_lighting,
       r.score_ai_risk,
       r.is_winner,
       r.is_failed,
       r.artifacts,
       r.created_at
     FROM results r
     JOIN prompts p ON p.id = r.prompt_id
     WHERE EXISTS (
       SELECT 1 FROM project_results pr
       WHERE pr.project_id = $1 AND pr.result_id = r.id
     )
     OR EXISTS (
       SELECT 1 FROM project_prompts pp
       WHERE pp.project_id = $1 AND pp.prompt_id = r.prompt_id
     )
     ORDER BY r.created_at DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map(rowToComparisonResult);
}

// ─── Decision sync ────────────────────────────────────────────

/**
 * Sync comparison decisions back to result records.
 * Returns the number of results updated.
 */
export async function syncDecisionsToResults(sessionId: string): Promise<number> {
  if (!isTauri) return 0;
  const db = await getDb();

  const items = (await db.select(
    "SELECT result_id, is_winner, is_rejected FROM comparison_items WHERE session_id = $1",
    [sessionId]
  )) as { result_id: string; is_winner: number; is_rejected: number }[];

  let count = 0;
  for (const item of items) {
    if (item.is_winner || item.is_rejected) {
      await db.execute(
        "UPDATE results SET is_winner = $1, is_failed = $2 WHERE id = $3",
        [item.is_winner ? 1 : 0, item.is_rejected ? 1 : 0, item.result_id]
      );
      count++;
    }
  }
  return count;
}

// ─── Decision support ─────────────────────────────────────────

const SCORE_DIMENSIONS: { key: keyof ComparisonResult; label: string }[] = [
  { key: "score_realism", label: "Realism" },
  { key: "score_brand_fit", label: "Brand Fit" },
  { key: "score_composition", label: "Composition" },
  { key: "score_lighting", label: "Lighting" },
];

export function getBestDimension(r: ComparisonResult): string | null {
  const scored = SCORE_DIMENSIONS.map((d) => ({ label: d.label, val: r[d.key] as number })).filter((d) => d.val > 0);
  if (!scored.length) return null;
  return scored.reduce((a, b) => a.val >= b.val ? a : b).label;
}

export function getWeakestDimension(r: ComparisonResult): string | null {
  const scored = SCORE_DIMENSIONS.map((d) => ({ label: d.label, val: r[d.key] as number })).filter((d) => d.val > 0);
  if (!scored.length) return null;
  const weak = scored.reduce((a, b) => a.val <= b.val ? a : b);
  return weak.val < 4 ? weak.label : null;
}
