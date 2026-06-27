import type { Prompt } from "@/types";
import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getDb() {
  return getFramecraftDb();
}

export type QueueStatus = "pending" | "sent" | "done" | "failed" | "skipped";

export interface QueueItem {
  id: string;
  prompt_id: string;
  project_id?: string;
  status: QueueStatus;
  sort_order: number;
  is_pinned: boolean;
  provider?: Prompt["provider"];
  result_path?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  prompt_title?: string;
  prompt_text?: string;
}

const _devQueue: QueueItem[] = [];

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function now(): string {
  return new Date().toISOString();
}

function rowToQueueItem(row: Record<string, unknown>): QueueItem {
  return {
    id: row.id as string,
    prompt_id: row.prompt_id as string,
    project_id: row.project_id as string | undefined,
    status: row.status as QueueStatus,
    sort_order: Number(row.sort_order ?? 0),
    is_pinned: Boolean(row.is_pinned),
    provider: row.provider as Prompt["provider"] | undefined,
    result_path: row.result_path as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    prompt_title: row.prompt_title as string | undefined,
    prompt_text: row.prompt_text as string | undefined,
  };
}

export async function addToQueue(promptId: string, projectId?: string): Promise<string> {
  if (isTauri) {
    const db = await getDb();
    const existing = (await db.select(
      "SELECT id FROM generation_queue WHERE prompt_id = $1 LIMIT 1",
      [promptId]
    )) as { id: string }[];
    if (existing[0]) return existing[0].id;

    const rows = (await db.select("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM generation_queue")) as { next_order: number }[];
    const id = generateId();
    const ts = now();
    await db.execute(
      `INSERT INTO generation_queue
        (id, prompt_id, project_id, status, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
      [id, promptId, projectId ?? null, rows[0]?.next_order ?? 0, ts, ts]
    );
    return id;
  }

  const existing = _devQueue.find((item) => item.prompt_id === promptId);
  if (existing) return existing.id;
  const ts = now();
  const id = generateId();
  _devQueue.push({
    id,
    prompt_id: promptId,
    project_id: projectId,
    status: "pending",
    sort_order: _devQueue.length,
    is_pinned: false,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getQueue(projectId?: string): Promise<QueueItem[]> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT q.*, p.title as prompt_title, p.prompt_text, p.provider
       FROM generation_queue q
       JOIN prompts p ON p.id = q.prompt_id
       WHERE ($1 IS NULL OR q.project_id = $1)
       ORDER BY q.is_pinned DESC, q.sort_order ASC, q.created_at ASC`,
      [projectId ?? null]
    )) as Record<string, unknown>[];
    return rows.map(rowToQueueItem);
  }

  return _devQueue
    .filter((item) => !projectId || item.project_id === projectId)
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export async function getQueueItem(id: string): Promise<QueueItem | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT q.*, p.title as prompt_title, p.prompt_text, p.provider
       FROM generation_queue q
       JOIN prompts p ON p.id = q.prompt_id
       WHERE q.id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToQueueItem(rows[0]) : null;
  }

  return _devQueue.find((item) => item.id === id) ?? null;
}

export async function updateQueueStatus(id: string, status: QueueStatus): Promise<void> {
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    await db.execute("UPDATE generation_queue SET status = $1, updated_at = $2 WHERE id = $3", [status, ts, id]);
    return;
  }

  const item = _devQueue.find((entry) => entry.id === id);
  if (item) {
    item.status = status;
    item.updated_at = ts;
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM generation_queue WHERE id = $1", [id]);
    return;
  }

  const idx = _devQueue.findIndex((item) => item.id === id);
  if (idx !== -1) _devQueue.splice(idx, 1);
}

export async function clearDone(): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute("DELETE FROM generation_queue WHERE status IN ('done', 'skipped', 'failed')");
    return;
  }

  for (let i = _devQueue.length - 1; i >= 0; i--) {
    if (["done", "skipped", "failed"].includes(_devQueue[i].status)) {
      _devQueue.splice(i, 1);
    }
  }
}

export async function pinQueueItem(id: string, pinned: boolean): Promise<void> {
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    await db.execute("UPDATE generation_queue SET is_pinned = $1, updated_at = $2 WHERE id = $3", [pinned ? 1 : 0, ts, id]);
    return;
  }

  const item = _devQueue.find((entry) => entry.id === id);
  if (item) {
    item.is_pinned = pinned;
    item.updated_at = ts;
  }
}

export async function reorderQueue(ids: string[]): Promise<void> {
  const ts = now();
  if (isTauri) {
    const db = await getDb();
    for (const [index, id] of ids.entries()) {
      await db.execute("UPDATE generation_queue SET sort_order = $1, updated_at = $2 WHERE id = $3", [index, ts, id]);
    }
    return;
  }

  const order = new Map(ids.map((id, index) => [id, index]));
  for (const item of _devQueue) {
    const next = order.get(item.id);
    if (next != null) {
      item.sort_order = next;
      item.updated_at = ts;
    }
  }
}

export function resetQueueForTests(): void {
  _devQueue.splice(0, _devQueue.length);
}
