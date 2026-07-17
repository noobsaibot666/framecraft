import type { CinemaProject, CreateCinemaProjectInput, UpdateCinemaProjectInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

function now(): string {
  return new Date().toISOString();
}

function rowToCinemaProject(row: Record<string, unknown>): CinemaProject {
  return {
    id: row.id as string,
    title: row.title as string,
    status: (row.status as CinemaProject["status"]) ?? "draft",
    script_model: (row.script_model as string) || undefined,
    image_provider: (row.image_provider as CinemaProject["image_provider"]) || undefined,
    video_provider: (row.video_provider as CinemaProject["video_provider"]) || undefined,
    script_content: (row.script_content as string) || undefined,
    script_idea: (row.script_idea as string) || undefined,
    script_runtime_target: (row.script_runtime_target as string) || undefined,
    script_setting: (row.script_setting as string) || undefined,
    script_tone: (row.script_tone as string) || undefined,
    script_status: (row.script_status as CinemaProject["script_status"]) ?? "draft",
    notes: (row.notes as string) || undefined,
    thumbnail_data: (row.thumbnail_data as string) || undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    folder_count: (row.folder_count as number) ?? undefined,
    asset_count: (row.asset_count as number) ?? undefined,
    scene_count: (row.scene_count as number) ?? undefined,
    shot_count: (row.shot_count as number) ?? undefined,
  };
}

// ─── In-memory dev store ──────────────────────────────────────
const _devStore: CinemaProject[] = [];

// ─── CRUD ─────────────────────────────────────────────────────

export async function createCinemaProject(data: CreateCinemaProjectInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT INTO cinema_projects
       (id, title, status, script_model, image_provider, video_provider, script_status, notes, created_at, updated_at)
       VALUES ($1,$2,'draft',$3,$4,$5,'draft',$6,$7,$8)`,
      [id, data.title.trim(), data.script_model ?? null, data.image_provider ?? null,
        data.video_provider ?? null, data.notes?.trim() || null, ts, ts]
    );
    return id;
  }

  _devStore.unshift({
    id,
    title: data.title.trim(),
    status: "draft",
    script_model: data.script_model,
    image_provider: data.image_provider,
    video_provider: data.video_provider,
    script_status: "draft",
    notes: data.notes?.trim() || undefined,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getCinemaProjects(): Promise<CinemaProject[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT p.*,
         (SELECT COUNT(*) FROM cinema_folders f WHERE f.project_id = p.id) as folder_count,
         (SELECT COUNT(*) FROM cinema_assets a WHERE a.project_id = p.id) as asset_count,
         (SELECT COUNT(*) FROM cinema_scenes s WHERE s.project_id = p.id) as scene_count,
         (SELECT COUNT(*) FROM cinema_shots sh WHERE sh.project_id = p.id) as shot_count
       FROM cinema_projects p
       ORDER BY p.updated_at DESC`
    )) as Record<string, unknown>[];
    return rows.map(rowToCinemaProject);
  }
  return [..._devStore];
}

export async function getCinemaProjectById(id: string): Promise<CinemaProject | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT p.*,
         (SELECT COUNT(*) FROM cinema_folders f WHERE f.project_id = p.id) as folder_count,
         (SELECT COUNT(*) FROM cinema_assets a WHERE a.project_id = p.id) as asset_count,
         (SELECT COUNT(*) FROM cinema_scenes s WHERE s.project_id = p.id) as scene_count,
         (SELECT COUNT(*) FROM cinema_shots sh WHERE sh.project_id = p.id) as shot_count
       FROM cinema_projects p
       WHERE p.id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToCinemaProject(rows[0]) : null;
  }
  return _devStore.find((p) => p.id === id) ?? null;
}

export async function updateCinemaProject(id: string, data: UpdateCinemaProjectInput): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    if ("title" in data && data.title != null) add("title", data.title.trim());
    if ("status" in data && data.status != null) add("status", data.status);
    if ("script_model" in data) add("script_model", data.script_model ?? null);
    if ("image_provider" in data) add("image_provider", data.image_provider ?? null);
    if ("video_provider" in data) add("video_provider", data.video_provider ?? null);
    if ("script_content" in data) add("script_content", data.script_content ?? null);
    if ("script_idea" in data) add("script_idea", data.script_idea ?? null);
    if ("script_runtime_target" in data) add("script_runtime_target", data.script_runtime_target ?? null);
    if ("script_setting" in data) add("script_setting", data.script_setting ?? null);
    if ("script_tone" in data) add("script_tone", data.script_tone ?? null);
    if ("script_status" in data && data.script_status != null) add("script_status", data.script_status);
    if ("notes" in data) add("notes", data.notes ?? null);
    if ("thumbnail_data" in data) add("thumbnail_data", data.thumbnail_data ?? null);

    values.push(id);
    await db.execute(`UPDATE cinema_projects SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }

  const idx = _devStore.findIndex((p) => p.id === id);
  if (idx !== -1) _devStore[idx] = { ..._devStore[idx], ...data, updated_at: ts };
}

export async function deleteCinemaProject(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    // Cascade handles cinema_folders/cinema_assets/cinema_scenes/cinema_shots/cinema_script_versions
    await db.execute("DELETE FROM cinema_projects WHERE id = $1", [id]);
    return;
  }
  const idx = _devStore.findIndex((p) => p.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}
