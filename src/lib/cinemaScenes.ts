import type { CinemaScene, CreateCinemaSceneInput, UpdateCinemaSceneInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const _devStore: CinemaScene[] = [];

function now(): string {
  return new Date().toISOString();
}

function rowToScene(row: Record<string, unknown>): CinemaScene {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    sort_order: (row.sort_order as number) ?? 0,
    title: row.title as string,
    script_excerpt: (row.script_excerpt as string) || undefined,
    summary: (row.summary as string) || undefined,
    mood: (row.mood as string) || undefined,
    accent_index: (row.accent_index as number) ?? 0,
    status: (row.status as CinemaScene["status"]) ?? "draft",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    shot_count: (row.shot_count as number) ?? undefined,
  };
}

export async function createCinemaScene(input: CreateCinemaSceneInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_scenes (id, project_id, sort_order, title, script_excerpt, summary, mood, accent_index, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10)`,
      [id, input.project_id, input.sort_order ?? 0, input.title.trim(), input.script_excerpt?.trim() || null,
        input.summary?.trim() || null, input.mood?.trim() || null, input.accent_index ?? 0, ts, ts]
    );
    return id;
  }

  _devStore.push({
    id,
    project_id: input.project_id,
    sort_order: input.sort_order ?? 0,
    title: input.title.trim(),
    script_excerpt: input.script_excerpt?.trim() || undefined,
    summary: input.summary?.trim() || undefined,
    mood: input.mood?.trim() || undefined,
    accent_index: input.accent_index ?? 0,
    status: "draft",
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getScenesForProject(projectId: string): Promise<CinemaScene[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT s.*, (SELECT COUNT(*) FROM cinema_shots sh WHERE sh.scene_id = s.id) as shot_count
       FROM cinema_scenes s WHERE s.project_id = $1 ORDER BY s.sort_order ASC, s.created_at ASC`,
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToScene);
  }
  return _devStore
    .filter((s) => s.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getCinemaSceneById(id: string): Promise<CinemaScene | null> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT s.*, (SELECT COUNT(*) FROM cinema_shots sh WHERE sh.scene_id = s.id) as shot_count
       FROM cinema_scenes s WHERE s.id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToScene(rows[0]) : null;
  }
  return _devStore.find((s) => s.id === id) ?? null;
}

export async function updateCinemaScene(id: string, data: UpdateCinemaSceneInput): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    if ("sort_order" in data && data.sort_order != null) add("sort_order", data.sort_order);
    if ("title" in data && data.title != null) add("title", data.title.trim());
    if ("script_excerpt" in data) add("script_excerpt", data.script_excerpt ?? null);
    if ("summary" in data) add("summary", data.summary ?? null);
    if ("mood" in data) add("mood", data.mood ?? null);
    if ("accent_index" in data && data.accent_index != null) add("accent_index", data.accent_index);
    if ("status" in data && data.status != null) add("status", data.status);

    values.push(id);
    await db.execute(`UPDATE cinema_scenes SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }

  const idx = _devStore.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const prev = _devStore[idx];
  _devStore[idx] = {
    ...prev,
    sort_order: data.sort_order ?? prev.sort_order,
    title: data.title?.trim() ?? prev.title,
    script_excerpt: "script_excerpt" in data ? (data.script_excerpt ?? undefined) : prev.script_excerpt,
    summary: "summary" in data ? (data.summary ?? undefined) : prev.summary,
    mood: "mood" in data ? (data.mood ?? undefined) : prev.mood,
    accent_index: data.accent_index ?? prev.accent_index,
    status: data.status ?? prev.status,
    updated_at: ts,
  };
}

export async function deleteCinemaScene(id: string): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    // Cascade handles cinema_shots
    await db.execute("DELETE FROM cinema_scenes WHERE id = $1", [id]);
    return;
  }
  const idx = _devStore.findIndex((s) => s.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}

export async function reorderScenes(projectId: string, orderedIds: string[]): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute("UPDATE cinema_scenes SET sort_order = $1 WHERE id = $2 AND project_id = $3", [i, orderedIds[i], projectId]);
    }
    return;
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const scene = _devStore.find((s) => s.id === orderedIds[i] && s.project_id === projectId);
    if (scene) scene.sort_order = i;
  }
}
