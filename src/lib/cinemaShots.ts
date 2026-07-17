import type { CinemaShot, CreateCinemaShotInput, UpdateCinemaShotInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const _devStore: CinemaShot[] = [];

function now(): string {
  return new Date().toISOString();
}

function tryParseArray(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function rowToShot(row: Record<string, unknown>): CinemaShot {
  return {
    id: row.id as string,
    scene_id: row.scene_id as string,
    project_id: row.project_id as string,
    sort_order: (row.sort_order as number) ?? 0,
    label: row.label as string,
    shot_type: (row.shot_type as CinemaShot["shot_type"]) ?? "hero",
    description: (row.description as string) || undefined,
    director_notes: (row.director_notes as string) || undefined,
    dop_notes: (row.dop_notes as string) || undefined,
    camera_notes: (row.camera_notes as string) || undefined,
    lighting_notes: (row.lighting_notes as string) || undefined,
    sound_notes: (row.sound_notes as string) || undefined,
    linked_asset_ids: tryParseArray(row.linked_asset_ids),
    transition_in: (row.transition_in as string) || undefined,
    transition_out: (row.transition_out as string) || undefined,
    generated_prompt: (row.generated_prompt as string) || undefined,
    prompt_id: (row.prompt_id as string) || undefined,
    is_broll: Boolean(row.is_broll),
    status: (row.status as CinemaShot["status"]) ?? "draft",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createCinemaShot(input: CreateCinemaShotInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_shots
       (id, scene_id, project_id, sort_order, label, shot_type, description, director_notes, dop_notes, camera_notes, lighting_notes, sound_notes, linked_asset_ids, is_broll, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',$15,$16)`,
      [
        id, input.scene_id, input.project_id, input.sort_order ?? 0, input.label.trim(), input.shot_type ?? "hero",
        input.description?.trim() || null, input.director_notes?.trim() || null, input.dop_notes?.trim() || null,
        input.camera_notes?.trim() || null, input.lighting_notes?.trim() || null, input.sound_notes?.trim() || null,
        input.linked_asset_ids ? JSON.stringify(input.linked_asset_ids) : null, input.is_broll ? 1 : 0, ts, ts,
      ]
    );
    return id;
  }

  _devStore.push({
    id,
    scene_id: input.scene_id,
    project_id: input.project_id,
    sort_order: input.sort_order ?? 0,
    label: input.label.trim(),
    shot_type: input.shot_type ?? "hero",
    description: input.description?.trim() || undefined,
    director_notes: input.director_notes?.trim() || undefined,
    dop_notes: input.dop_notes?.trim() || undefined,
    camera_notes: input.camera_notes?.trim() || undefined,
    lighting_notes: input.lighting_notes?.trim() || undefined,
    sound_notes: input.sound_notes?.trim() || undefined,
    linked_asset_ids: input.linked_asset_ids,
    is_broll: input.is_broll ?? false,
    status: "draft",
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getShotsForScene(sceneId: string): Promise<CinemaShot[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_shots WHERE scene_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [sceneId]
    )) as Record<string, unknown>[];
    return rows.map(rowToShot);
  }
  return _devStore
    .filter((s) => s.scene_id === sceneId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getShotsForProject(projectId: string): Promise<CinemaShot[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_shots WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToShot);
  }
  return _devStore
    .filter((s) => s.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getCinemaShotById(id: string): Promise<CinemaShot | null> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(`SELECT * FROM cinema_shots WHERE id = $1`, [id])) as Record<string, unknown>[];
    return rows[0] ? rowToShot(rows[0]) : null;
  }
  return _devStore.find((s) => s.id === id) ?? null;
}

export async function updateCinemaShot(id: string, data: UpdateCinemaShotInput): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    if ("sort_order" in data && data.sort_order != null) add("sort_order", data.sort_order);
    if ("label" in data && data.label != null) add("label", data.label.trim());
    if ("shot_type" in data && data.shot_type != null) add("shot_type", data.shot_type);
    if ("description" in data) add("description", data.description ?? null);
    if ("director_notes" in data) add("director_notes", data.director_notes ?? null);
    if ("dop_notes" in data) add("dop_notes", data.dop_notes ?? null);
    if ("camera_notes" in data) add("camera_notes", data.camera_notes ?? null);
    if ("lighting_notes" in data) add("lighting_notes", data.lighting_notes ?? null);
    if ("sound_notes" in data) add("sound_notes", data.sound_notes ?? null);
    if ("linked_asset_ids" in data) add("linked_asset_ids", data.linked_asset_ids ? JSON.stringify(data.linked_asset_ids) : null);
    if ("transition_in" in data) add("transition_in", data.transition_in ?? null);
    if ("transition_out" in data) add("transition_out", data.transition_out ?? null);
    if ("generated_prompt" in data) add("generated_prompt", data.generated_prompt ?? null);
    if ("prompt_id" in data) add("prompt_id", data.prompt_id ?? null);
    if ("is_broll" in data && data.is_broll != null) add("is_broll", data.is_broll ? 1 : 0);
    if ("status" in data && data.status != null) add("status", data.status);

    values.push(id);
    await db.execute(`UPDATE cinema_shots SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }

  const idx = _devStore.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const prev = _devStore[idx];
  _devStore[idx] = {
    ...prev,
    sort_order: data.sort_order ?? prev.sort_order,
    label: data.label?.trim() ?? prev.label,
    shot_type: data.shot_type ?? prev.shot_type,
    description: "description" in data ? (data.description ?? undefined) : prev.description,
    director_notes: "director_notes" in data ? (data.director_notes ?? undefined) : prev.director_notes,
    dop_notes: "dop_notes" in data ? (data.dop_notes ?? undefined) : prev.dop_notes,
    camera_notes: "camera_notes" in data ? (data.camera_notes ?? undefined) : prev.camera_notes,
    lighting_notes: "lighting_notes" in data ? (data.lighting_notes ?? undefined) : prev.lighting_notes,
    sound_notes: "sound_notes" in data ? (data.sound_notes ?? undefined) : prev.sound_notes,
    linked_asset_ids: "linked_asset_ids" in data ? (data.linked_asset_ids ?? undefined) : prev.linked_asset_ids,
    transition_in: "transition_in" in data ? (data.transition_in ?? undefined) : prev.transition_in,
    transition_out: "transition_out" in data ? (data.transition_out ?? undefined) : prev.transition_out,
    generated_prompt: "generated_prompt" in data ? (data.generated_prompt ?? undefined) : prev.generated_prompt,
    prompt_id: "prompt_id" in data ? (data.prompt_id ?? undefined) : prev.prompt_id,
    is_broll: data.is_broll ?? prev.is_broll,
    status: data.status ?? prev.status,
    updated_at: ts,
  };
}

export async function deleteCinemaShot(id: string): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute("DELETE FROM cinema_shots WHERE id = $1", [id]);
    return;
  }
  const idx = _devStore.findIndex((s) => s.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}

export async function reorderShots(sceneId: string, orderedIds: string[]): Promise<void> {
  if (isTauri) {
    const db = await getFramecraftDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute("UPDATE cinema_shots SET sort_order = $1 WHERE id = $2 AND scene_id = $3", [i, orderedIds[i], sceneId]);
    }
    return;
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const shot = _devStore.find((s) => s.id === orderedIds[i] && s.scene_id === sceneId);
    if (shot) shot.sort_order = i;
  }
}
