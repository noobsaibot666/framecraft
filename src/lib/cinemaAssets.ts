import type { CinemaAsset, CreateCinemaAssetInput, UpdateCinemaAssetInput } from "@/types";
import { getFramecraftDb } from "./dbConnection";
import { generateId, slugify } from "./utils";
import { getShotsForProject, updateCinemaShot } from "./cinemaShots";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOODBOARD_GRID_COLS = 5;
const MOODBOARD_CARD_W = 160;
const MOODBOARD_CARD_H = 190;
const MOODBOARD_GRID_GAP = 24;

/**
 * Deterministic, non-overlapping grid position for the moodboard canvas,
 * computed once at asset-creation time and persisted to `canvas_x`/`canvas_y`
 * so the canvas can always trust the stored value directly. `canvas_x`/
 * `canvas_y` are `NOT NULL DEFAULT 0`, so there is no way to distinguish
 * "never positioned" from "the user dragged it to exactly (0,0)" once a row
 * exists — assigning a real position at creation avoids that ambiguity
 * entirely instead of guessing from a stored value at read time.
 */
export function computeGridPosition(index: number): { x: number; y: number } {
  return {
    x: (index % MOODBOARD_GRID_COLS) * (MOODBOARD_CARD_W + MOODBOARD_GRID_GAP),
    y: Math.floor(index / MOODBOARD_GRID_COLS) * (MOODBOARD_CARD_H + MOODBOARD_GRID_GAP),
  };
}
const _devStore: CinemaAsset[] = [];

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

function tryParseObject(raw: unknown): Record<string, string | boolean> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw as string);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function rowToAsset(row: Record<string, unknown>): CinemaAsset {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    folder_id: row.folder_id as string,
    tag: row.tag as string,
    title: row.title as string,
    asset_type: (row.asset_type as CinemaAsset["asset_type"]) ?? "other",
    prompt_text: (row.prompt_text as string) || undefined,
    prompt_id: (row.prompt_id as string) || undefined,
    file_data: (row.file_data as string) || undefined,
    thumbnail_data: (row.thumbnail_data as string) || undefined,
    is_primary: Boolean(row.is_primary),
    merged_from: tryParseArray(row.merged_from),
    canvas_x: (row.canvas_x as number) ?? 0,
    canvas_y: (row.canvas_y as number) ?? 0,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    rating: (row.rating as number) ?? undefined,
    feedback: (row.feedback as string) || undefined,
    locked: Boolean(row.locked),
    version_group_id: (row.version_group_id as string) || undefined,
    version_number: (row.version_number as number) ?? 1,
    provider: (row.provider as CinemaAsset["provider"]) || undefined,
    prompt_parameters: tryParseObject(row.prompt_parameters),
    instruction: (row.instruction as string) || undefined,
  };
}

export async function createCinemaAsset(input: CreateCinemaAssetInput): Promise<string> {
  const id = generateId();
  const ts = now();
  // A version chain always groups by the root version's own id — new,
  // ungrouped assets are trivially "a group of one" this way, so callers
  // (and getAssetVersions) never need to special-case an absent group.
  const versionGroupId = input.version_group_id ?? id;

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute(
      `INSERT INTO cinema_assets
       (id, project_id, folder_id, tag, title, asset_type, prompt_text, prompt_id, file_data, thumbnail_data, is_primary, merged_from, canvas_x, canvas_y, sort_order, created_at, updated_at, locked, version_group_id, version_number, provider, prompt_parameters, instruction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        id, input.project_id, input.folder_id, input.tag.trim(), input.title.trim(), input.asset_type ?? "other",
        input.prompt_text?.trim() || null, input.prompt_id ?? null, input.file_data ?? null, input.thumbnail_data ?? null,
        input.is_primary ? 1 : 0, input.merged_from ? JSON.stringify(input.merged_from) : null,
        input.canvas_x ?? 0, input.canvas_y ?? 0, input.sort_order ?? 0, ts, ts,
        input.locked ? 1 : 0, versionGroupId, input.version_number ?? 1, input.provider ?? null,
        input.prompt_parameters ? JSON.stringify(input.prompt_parameters) : null, input.instruction?.trim() || null,
      ]
    );
    return id;
  }

  _devStore.push({
    id,
    project_id: input.project_id,
    folder_id: input.folder_id,
    tag: input.tag.trim(),
    title: input.title.trim(),
    asset_type: input.asset_type ?? "other",
    prompt_text: input.prompt_text?.trim() || undefined,
    prompt_id: input.prompt_id,
    file_data: input.file_data,
    thumbnail_data: input.thumbnail_data,
    is_primary: input.is_primary ?? false,
    merged_from: input.merged_from,
    canvas_x: input.canvas_x ?? 0,
    canvas_y: input.canvas_y ?? 0,
    sort_order: input.sort_order ?? 0,
    created_at: ts,
    updated_at: ts,
    locked: input.locked ?? false,
    version_group_id: versionGroupId,
    version_number: input.version_number ?? 1,
    provider: input.provider,
    prompt_parameters: input.prompt_parameters,
    instruction: input.instruction?.trim() || undefined,
  });
  return id;
}

export async function getAssetsForFolder(folderId: string): Promise<CinemaAsset[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_assets WHERE folder_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [folderId]
    )) as Record<string, unknown>[];
    return rows.map(rowToAsset);
  }
  return _devStore
    .filter((a) => a.folder_id === folderId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getAssetsForProject(projectId: string): Promise<CinemaAsset[]> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(
      `SELECT * FROM cinema_assets WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [projectId]
    )) as Record<string, unknown>[];
    return rows.map(rowToAsset);
  }
  return _devStore
    .filter((a) => a.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getCinemaAssetById(id: string): Promise<CinemaAsset | null> {
  if (isTauri) {
    const db = await getFramecraftDb();
    const rows = (await db.select(`SELECT * FROM cinema_assets WHERE id = $1`, [id])) as Record<string, unknown>[];
    return rows[0] ? rowToAsset(rows[0]) : null;
  }
  return _devStore.find((a) => a.id === id) ?? null;
}

export async function updateCinemaAsset(id: string, data: UpdateCinemaAssetInput): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getFramecraftDb();
    const sets: string[] = ["updated_at = $1"];
    const values: unknown[] = [ts];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    if ("folder_id" in data && data.folder_id != null) add("folder_id", data.folder_id);
    if ("tag" in data && data.tag != null) add("tag", data.tag.trim());
    if ("title" in data && data.title != null) add("title", data.title.trim());
    if ("asset_type" in data && data.asset_type != null) add("asset_type", data.asset_type);
    if ("prompt_text" in data) add("prompt_text", data.prompt_text ?? null);
    if ("prompt_id" in data) add("prompt_id", data.prompt_id ?? null);
    if ("file_data" in data) add("file_data", data.file_data ?? null);
    if ("thumbnail_data" in data) add("thumbnail_data", data.thumbnail_data ?? null);
    if ("is_primary" in data && data.is_primary != null) add("is_primary", data.is_primary ? 1 : 0);
    if ("merged_from" in data) add("merged_from", data.merged_from ? JSON.stringify(data.merged_from) : null);
    if ("canvas_x" in data && data.canvas_x != null) add("canvas_x", data.canvas_x);
    if ("canvas_y" in data && data.canvas_y != null) add("canvas_y", data.canvas_y);
    if ("sort_order" in data && data.sort_order != null) add("sort_order", data.sort_order);
    if ("rating" in data) add("rating", data.rating ?? null);
    if ("feedback" in data) add("feedback", data.feedback ?? null);
    if ("locked" in data && data.locked != null) add("locked", data.locked ? 1 : 0);
    if ("provider" in data) add("provider", data.provider ?? null);
    if ("prompt_parameters" in data) add("prompt_parameters", data.prompt_parameters ? JSON.stringify(data.prompt_parameters) : null);
    if ("instruction" in data) add("instruction", data.instruction ?? null);

    values.push(id);
    await db.execute(`UPDATE cinema_assets SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return;
  }

  const idx = _devStore.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const prev = _devStore[idx];
  _devStore[idx] = {
    ...prev,
    folder_id: data.folder_id ?? prev.folder_id,
    tag: data.tag?.trim() ?? prev.tag,
    title: data.title?.trim() ?? prev.title,
    asset_type: data.asset_type ?? prev.asset_type,
    prompt_text: "prompt_text" in data ? (data.prompt_text ?? undefined) : prev.prompt_text,
    prompt_id: "prompt_id" in data ? (data.prompt_id ?? undefined) : prev.prompt_id,
    file_data: "file_data" in data ? (data.file_data ?? undefined) : prev.file_data,
    thumbnail_data: "thumbnail_data" in data ? (data.thumbnail_data ?? undefined) : prev.thumbnail_data,
    is_primary: data.is_primary ?? prev.is_primary,
    merged_from: "merged_from" in data ? (data.merged_from ?? undefined) : prev.merged_from,
    canvas_x: data.canvas_x ?? prev.canvas_x,
    canvas_y: data.canvas_y ?? prev.canvas_y,
    sort_order: data.sort_order ?? prev.sort_order,
    rating: "rating" in data ? (data.rating ?? undefined) : prev.rating,
    feedback: "feedback" in data ? (data.feedback ?? undefined) : prev.feedback,
    locked: data.locked ?? prev.locked,
    provider: "provider" in data ? (data.provider ?? undefined) : prev.provider,
    prompt_parameters: "prompt_parameters" in data ? (data.prompt_parameters ?? undefined) : prev.prompt_parameters,
    instruction: "instruction" in data ? (data.instruction ?? undefined) : prev.instruction,
    updated_at: ts,
  };
}

export async function deleteCinemaAsset(id: string): Promise<void> {
  // `linked_asset_ids` is a JSON array in a plain TEXT column (no FK), matching this codebase's
  // existing tags/artifacts JSON-in-TEXT convention — but that means SQLite's own cascade can't
  // clean it up. Without this, a deleted asset's id lingers in any shot that referenced it,
  // silently filtered out by UI code today but never actually removed from storage.
  const asset = await getCinemaAssetById(id);

  if (isTauri) {
    const db = await getFramecraftDb();
    await db.execute("DELETE FROM cinema_assets WHERE id = $1", [id]);
  } else {
    const idx = _devStore.findIndex((a) => a.id === id);
    if (idx !== -1) _devStore.splice(idx, 1);
  }

  if (!asset) return;
  const shots = await getShotsForProject(asset.project_id);
  const affected = shots.filter((s) => s.linked_asset_ids?.includes(id));
  await Promise.all(affected.map((s) =>
    updateCinemaShot(s.id, { linked_asset_ids: s.linked_asset_ids!.filter((a) => a !== id) })
  ));
}

/** True if `tag` is already used by another asset in the project (case-insensitive). */
export async function isTagTaken(projectId: string, tag: string, excludeAssetId?: string): Promise<boolean> {
  const assets = await getAssetsForProject(projectId);
  const normalized = tag.trim().toLowerCase();
  return assets.some((a) => a.id !== excludeAssetId && a.tag.toLowerCase() === normalized);
}

/**
 * Deterministic `@slug` suggestion from a name, deduped against the
 * project's existing tags with a numeric suffix (`@eduardo`, `@eduardo_2`, …)
 * — matches the app's naming examples (`@eduardo`, `@loc_cabin`).
 */
export async function suggestAssetTag(projectId: string, name: string): Promise<string> {
  const base = slugify(name) || "asset";
  const existing = new Set((await getAssetsForProject(projectId)).map((a) => a.tag.replace(/^@/, "").toLowerCase()));
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  return `@${candidate}`;
}

/**
 * Groups a flat asset list into version stacks (V1, V2, …), each stack
 * sorted by version_number ascending. Pre-versioning rows (no
 * `version_group_id`) are trivially their own single-item group, since
 * `createCinemaAsset` always sets `version_group_id = id` for new rows.
 */
export function groupAssetVersions(assets: CinemaAsset[]): CinemaAsset[][] {
  const groups = new Map<string, CinemaAsset[]>();
  for (const asset of assets) {
    const groupId = asset.version_group_id ?? asset.id;
    const group = groups.get(groupId);
    if (group) group.push(asset);
    else groups.set(groupId, [asset]);
  }
  return Array.from(groups.values()).map((group) => [...group].sort((a, b) => a.version_number - b.version_number));
}

/**
 * The immediately-prior version in `asset`'s stack (version_number - 1), if
 * any — used to feed the prior prompt/rating/feedback into a redraft. `undefined`
 * for a V1, or for an asset with no stack at all.
 */
export async function getPreviousVersion(asset: CinemaAsset): Promise<CinemaAsset | undefined> {
  if (asset.version_number <= 1) return undefined;
  const siblings = await getAssetsForFolder(asset.folder_id);
  const groupId = asset.version_group_id ?? asset.id;
  return siblings.find((a) => (a.version_group_id ?? a.id) === groupId && a.version_number === asset.version_number - 1);
}

/** Diagonal cascade distance (Moodboard canvas px) between one version and the next in a stack. */
export const VERSION_STACK_OFFSET = 36;

/**
 * Where a version should sit on the Moodboard canvas relative to its stack's
 * root — a small diagonal cascade so siblings read as one cluster instead of
 * landing wherever the next free grid slot happens to be. Used both when a
 * new version is first created and by the Moodboard's Auto-Align.
 */
export function stackedVersionPosition(root: { canvas_x: number; canvas_y: number }, versionNumber: number): { x: number; y: number } {
  const step = Math.max(0, versionNumber - 1) * VERSION_STACK_OFFSET;
  return { x: root.canvas_x + step, y: root.canvas_y + step };
}

const TRAILING_VERSION_RE = /\s+V\d+$/i;
const TRAILING_TAG_VERSION_RE = /_v\d+$/i;

/**
 * Creates a new sibling asset — "V{n+1}" of `source` — in the same folder,
 * for the same purpose: fresh prompt/image/rating slate, but the same
 * folder/asset_type/provider/instruction carried forward so the user is
 * iterating on the same subject, not starting over. Retroactively labels
 * `source`'s own title with its version number the first time a second
 * version is created, so a not-yet-versioned V1 gains a visible "V1" suffix
 * once it's actually part of a stack.
 */
export async function createAssetVersion(source: CinemaAsset): Promise<string> {
  const folderAssets = await getAssetsForFolder(source.folder_id);
  const groupId = source.version_group_id ?? source.id;
  const siblings = folderAssets.filter((a) => (a.version_group_id ?? a.id) === groupId);
  const nextVersionNumber = Math.max(...siblings.map((a) => a.version_number), source.version_number) + 1;
  const root = siblings.find((a) => a.version_number === 1) ?? source;

  if (nextVersionNumber === 2 && !TRAILING_VERSION_RE.test(source.title)) {
    await updateCinemaAsset(source.id, { title: `${source.title} V${source.version_number}` });
  }

  const baseTitle = source.title.replace(TRAILING_VERSION_RE, "").trim();
  const baseTag = source.tag.replace(TRAILING_TAG_VERSION_RE, "");
  let candidateTag = `${baseTag}_v${nextVersionNumber}`;
  let n = nextVersionNumber;
  while (await isTagTaken(source.project_id, candidateTag)) {
    n += 1;
    candidateTag = `${baseTag}_v${n}`;
  }

  const { x, y } = stackedVersionPosition(root, nextVersionNumber);
  return createCinemaAsset({
    project_id: source.project_id,
    folder_id: source.folder_id,
    tag: candidateTag,
    title: `${baseTitle} V${nextVersionNumber}`,
    asset_type: source.asset_type,
    canvas_x: x,
    canvas_y: y,
    version_group_id: groupId,
    version_number: nextVersionNumber,
    provider: source.provider,
    instruction: source.instruction,
  });
}
