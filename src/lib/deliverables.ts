import type { Deliverable, DeliverableStatus, Reference } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

function generateId() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

// ─── Status ordering ──────────────────────────────────────────

export const STATUS_ORDER: DeliverableStatus[] = [
  "planned", "prompting", "generating", "review", "selected", "final",
];

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  planned:    "PLANNED",
  prompting:  "PROMPTING",
  generating: "GENERATING",
  review:     "REVIEW",
  selected:   "SELECTED",
  final:      "FINAL",
};

export function nextStatus(s: DeliverableStatus): DeliverableStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}

export function prevStatus(s: DeliverableStatus): DeliverableStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i > 0 ? STATUS_ORDER[i - 1] : null;
}

// ─── Dev fallback store ───────────────────────────────────────

const _devStore: Deliverable[] = [];

// ─── Row mapper ───────────────────────────────────────────────

function rowToDeliverable(row: Record<string, unknown>): Deliverable {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    status: (row.status ?? "planned") as DeliverableStatus,
    target_format: row.target_format as string | undefined,
    aspect_ratio: row.aspect_ratio as string | undefined,
    linked_prompt_id: row.linked_prompt_id as string | undefined,
    linked_result_id: row.linked_result_id as string | undefined,
    notes: row.notes as string | undefined,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Input types ──────────────────────────────────────────────

export interface CreateDeliverableInput {
  project_id: string;
  title: string;
  description?: string;
  status?: DeliverableStatus;
  target_format?: string;
  aspect_ratio?: string;
  linked_prompt_id?: string;
  linked_result_id?: string;
  notes?: string;
  sort_order?: number;
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function createDeliverable(data: CreateDeliverableInput): Promise<string> {
  const id = generateId();
  const ts = now();
  const status = data.status ?? "planned";

  if (isTauri) {
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO project_deliverables
          (id, project_id, title, description, status, target_format, aspect_ratio,
           linked_prompt_id, linked_result_id, notes, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          id, data.project_id, data.title, data.description ?? null,
          status, data.target_format ?? null, data.aspect_ratio ?? null,
          data.linked_prompt_id ?? null, data.linked_result_id ?? null,
          data.notes ?? null, data.sort_order ?? 0, ts, ts,
        ]
      );
      return id;
    } catch (err) {
      throw new Error(String(err));
    }
  }

  _devStore.push({
    id, project_id: data.project_id, title: data.title,
    description: data.description, status,
    target_format: data.target_format, aspect_ratio: data.aspect_ratio,
    linked_prompt_id: data.linked_prompt_id, linked_result_id: data.linked_result_id,
    notes: data.notes, sort_order: data.sort_order ?? 0,
    created_at: ts, updated_at: ts,
  });
  return id;
}

export async function getDeliverablesForProject(projectId: string): Promise<Deliverable[]> {
  if (isTauri) {
    try {
      const db = await getDb();
      const rows = (await db.select(
        `SELECT * FROM project_deliverables WHERE project_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [projectId]
      )) as Record<string, unknown>[];
      return rows.map(rowToDeliverable);
    } catch {
      return [];
    }
  }
  return _devStore
    .filter((d) => d.project_id === projectId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getDeliverableById(id: string): Promise<Deliverable | null> {
  if (isTauri) {
    try {
      const db = await getDb();
      const rows = (await db.select(
        "SELECT * FROM project_deliverables WHERE id = $1", [id]
      )) as Record<string, unknown>[];
      return rows[0] ? rowToDeliverable(rows[0]) : null;
    } catch {
      return null;
    }
  }
  return _devStore.find((d) => d.id === id) ?? null;
}

export async function updateDeliverable(
  id: string,
  data: Partial<Omit<CreateDeliverableInput, "project_id">>
): Promise<void> {
  const ts = now();
  if (isTauri) {
    try {
      const db = await getDb();
      const sets: string[] = ["updated_at = $1"];
      const values: unknown[] = [ts];
      const push = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };
      if (data.title       !== undefined) push("title",            data.title);
      if (data.description !== undefined) push("description",      data.description ?? null);
      if (data.status      !== undefined) push("status",           data.status);
      if (data.target_format !== undefined) push("target_format",  data.target_format ?? null);
      if (data.aspect_ratio  !== undefined) push("aspect_ratio",   data.aspect_ratio ?? null);
      if (data.linked_prompt_id !== undefined) push("linked_prompt_id", data.linked_prompt_id ?? null);
      if (data.linked_result_id !== undefined) push("linked_result_id", data.linked_result_id ?? null);
      if (data.notes       !== undefined) push("notes",            data.notes ?? null);
      if (data.sort_order  !== undefined) push("sort_order",       data.sort_order);
      values.push(id);
      await db.execute(
        `UPDATE project_deliverables SET ${sets.join(", ")} WHERE id = $${values.length}`,
        values
      );
      return;
    } catch (err) {
      throw new Error(String(err));
    }
  }
  const idx = _devStore.findIndex((d) => d.id === id);
  if (idx !== -1) _devStore[idx] = { ..._devStore[idx], ...data, updated_at: ts } as Deliverable;
}

export async function deleteDeliverable(id: string): Promise<void> {
  if (isTauri) {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM project_deliverables WHERE id = $1", [id]);
      return;
    } catch (err) {
      throw new Error(String(err));
    }
  }
  const idx = _devStore.findIndex((d) => d.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}

// ─── Status movement ──────────────────────────────────────────

export async function advanceDeliverable(id: string): Promise<DeliverableStatus | null> {
  const d = await getDeliverableById(id);
  if (!d) return null;
  const next = nextStatus(d.status);
  if (!next) return null;
  await updateDeliverable(id, { status: next });
  return next;
}

export async function retreatDeliverable(id: string): Promise<DeliverableStatus | null> {
  const d = await getDeliverableById(id);
  if (!d) return null;
  const prev = prevStatus(d.status);
  if (!prev) return null;
  await updateDeliverable(id, { status: prev });
  return prev;
}

// ─── Reference linking ────────────────────────────────────────

export async function linkReferenceToDeliverable(
  deliverableId: string,
  referenceId: string
): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    await db.execute(
      "INSERT OR IGNORE INTO deliverable_references (deliverable_id, reference_id) VALUES ($1, $2)",
      [deliverableId, referenceId]
    );
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function unlinkReferenceFromDeliverable(
  deliverableId: string,
  referenceId: string
): Promise<void> {
  if (!isTauri) return;
  try {
    const db = await getDb();
    await db.execute(
      "DELETE FROM deliverable_references WHERE deliverable_id = $1 AND reference_id = $2",
      [deliverableId, referenceId]
    );
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function getReferencesForDeliverable(deliverableId: string): Promise<Reference[]> {
  if (!isTauri) return [];
  try {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT r.* FROM "references" r
       JOIN deliverable_references dr ON dr.reference_id = r.id
       WHERE dr.deliverable_id = $1`,
      [deliverableId]
    )) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | undefined,
      kind: row.kind as Reference["kind"],
      file_data: row.file_data as string | undefined,
      thumbnail_data: row.thumbnail_data as string | undefined,
      provider: row.provider as Reference["provider"],
      category: row.category as Reference["category"],
      source_url: row.source_url as string | undefined,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      rating: (row.rating as number) ?? 0,
      best_use: row.best_use as string | undefined,
      risk_notes: row.risk_notes as string | undefined,
      notes: row.notes as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));
  } catch {
    return [];
  }
}

// ─── Missing asset check ──────────────────────────────────────

/** Returns true if a deliverable is past 'prompting' but has no linked result. */
export function isMissingResult(d: Deliverable): boolean {
  const idx = STATUS_ORDER.indexOf(d.status);
  return idx >= STATUS_ORDER.indexOf("generating") && !d.linked_result_id;
}
