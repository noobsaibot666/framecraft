import type { CinemaFolder, CinemaFolderKind, CreateCinemaFolderInput, UpdateCinemaFolderInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId } from "./utils";
import { ACCENT_COLORS } from "./storytelling";
import { deleteCinemaAsset, getAssetsForProject } from "./cinemaAssets";
import { getShotsForProject, updateCinemaShot } from "./cinemaShots";

/** Master/root folder name per kind — AI-suggested and script-driven folders nest under these
 * instead of landing flat at root, matching the "Characters/Locations/Props → entity subfolder"
 * structure described for this feature. */
export const MASTER_FOLDER_NAMES: Record<CinemaFolderKind, string> = {
  character: "Characters",
  location: "Locations",
  prop: "Props",
  other: "Other",
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const _devStore: CinemaFolder[] = [];

function now(): string {
  return new Date().toISOString();
}

function rowToFolder(row: Record<string, unknown>): CinemaFolder {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    parent_id: (row.parent_id as string) || undefined,
    name: row.name as string,
    kind: (row.kind as CinemaFolder["kind"]) ?? "other",
    description: (row.description as string) || undefined,
    accent_color: (row.accent_color as string) || undefined,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createCinemaFolder(input: CreateCinemaFolderInput): Promise<string> {
  const id = generateId();
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_folders (id, project_id, parent_id, name, kind, description, accent_color, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, input.project_id, input.parent_id ?? null, input.name.trim(), input.kind ?? "other",
        input.description?.trim() || null, input.accent_color ?? null, input.sort_order ?? 0, ts, ts]
    );
    return id;
  }

  _devStore.push({
    id,
    project_id: input.project_id,
    parent_id: input.parent_id,
    name: input.name.trim(),
    kind: input.kind ?? "other",
    description: input.description?.trim() || undefined,
    accent_color: input.accent_color,
    sort_order: input.sort_order ?? 0,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getFoldersForProject(projectId: string): Promise<CinemaFolder[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_folders WHERE project_id = $1 ORDER BY sort_order ASC, name ASC`,
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToFolder);
  }
  return _devStore
    .filter((f) => f.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export async function getCinemaFolderById(id: string): Promise<CinemaFolder | null> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(`SELECT * FROM cinema_folders WHERE id = $1`, [id])) as Record<string, unknown>[];
    return rows[0] ? rowToFolder(rows[0]) : null;
  }
  return _devStore.find((f) => f.id === id) ?? null;
}

export async function updateCinemaFolder(id: string, data: UpdateCinemaFolderInput): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    if ("name" in data && data.name != null) add("name", data.name.trim());
    if ("kind" in data && data.kind != null) add("kind", data.kind);
    if ("description" in data) add("description", data.description ?? null);
    if ("accent_color" in data) add("accent_color", data.accent_color ?? null);
    if ("parent_id" in data) add("parent_id", data.parent_id ?? null);
    if ("sort_order" in data && data.sort_order != null) add("sort_order", data.sort_order);

    values.push(id);
    await db.execute(`UPDATE cinema_folders SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }

  const idx = _devStore.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const prev = _devStore[idx];
  _devStore[idx] = {
    ...prev,
    name: data.name?.trim() ?? prev.name,
    kind: data.kind ?? prev.kind,
    description: "description" in data ? (data.description ?? undefined) : prev.description,
    accent_color: "accent_color" in data ? (data.accent_color ?? undefined) : prev.accent_color,
    parent_id: "parent_id" in data ? (data.parent_id ?? undefined) : prev.parent_id,
    sort_order: data.sort_order ?? prev.sort_order,
    updated_at: ts,
  };
}

export async function deleteCinemaFolder(id: string): Promise<void> {
  // `linked_asset_ids` (cinema_shots) is a JSON array in a plain TEXT column, not a real FK, so
  // SQLite's cascade can't reach into it — figure out which assets are about to disappear (this
  // folder, every descendant subfolder, and their assets) before deleting, so we can purge them
  // from any shot that referenced them afterward.
  const folder = await getCinemaFolderById(id);
  const allProjectFolders = folder ? await getFoldersForProject(folder.project_id) : [];

  const toRemove = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of allProjectFolders) {
      if (f.parent_id && toRemove.has(f.parent_id) && !toRemove.has(f.id)) {
        toRemove.add(f.id);
        grew = true;
      }
    }
  }
  const affectedAssetIds = folder
    ? (await getAssetsForProject(folder.project_id)).filter((a) => toRemove.has(a.folder_id)).map((a) => a.id)
    : [];

  if (isTauri) {
    const db = await getFramecraftDb();
    // Cascade handles subfolders and assets
    await db.execute("DELETE FROM cinema_folders WHERE id = $1", [id]);

    if (!folder || affectedAssetIds.length === 0) return;
    const affectedIdSet = new Set(affectedAssetIds);
    const shots = await getShotsForProject(folder.project_id);
    const shotsToClean = shots.filter((s) => s.linked_asset_ids?.some((assetId) => affectedIdSet.has(assetId)));
    await Promise.all(shotsToClean.map((s) =>
      updateCinemaShot(s.id, { linked_asset_ids: s.linked_asset_ids!.filter((assetId) => !affectedIdSet.has(assetId)) })
    ));
    return;
  }

  // Dev store has no FK cascade — remove the folder and its descendant folders here, then remove
  // each affected asset through deleteCinemaAsset (which lives in cinemaAssets.ts's own dev store
  // and already handles its own shot-reference cleanup for that one asset). Sequential, not
  // Promise.all: each call does its own read-modify-write of a shot's linked_asset_ids, and two
  // assets removed from the *same* shot concurrently would race — whichever write lands last
  // would silently undo the other's removal.
  for (let i = _devStore.length - 1; i >= 0; i--) {
    if (toRemove.has(_devStore[i].id)) _devStore.splice(i, 1);
  }
  for (const assetId of affectedAssetIds) {
    await deleteCinemaAsset(assetId);
  }
}

/**
 * Finds this project's root master folder for `kind` (e.g. "Characters" for
 * kind="character"), creating it if it doesn't exist yet. Always re-reads
 * current folders from storage rather than trusting a caller-supplied list,
 * so accepting several script-suggested folders of the same kind back to
 * back can't race and create two master folders.
 */
export async function getOrCreateMasterFolder(projectId: string, kind: CinemaFolderKind): Promise<string> {
  const current = await getFoldersForProject(projectId);
  const existing = current.find((f) => !f.parent_id && f.kind === kind && f.name === MASTER_FOLDER_NAMES[kind]);
  if (existing) return existing.id;
  return createCinemaFolder({
    project_id: projectId,
    name: MASTER_FOLDER_NAMES[kind],
    kind,
    accent_color: ACCENT_COLORS[current.length % ACCENT_COLORS.length],
  });
}
