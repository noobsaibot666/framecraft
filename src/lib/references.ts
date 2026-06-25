import type { Reference, ReferenceKind, ReferenceRole, ReferenceFilters } from "@/types";
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

function rowToReference(row: Record<string, unknown>): Reference {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    kind: (row.kind as ReferenceKind) ?? "image",
    file_data: row.file_data as string | undefined,
    thumbnail_data: row.thumbnail_data as string | undefined,
    provider: row.provider as Reference["provider"] | undefined,
    category: row.category as Reference["category"] | undefined,
    source_url: row.source_url as string | undefined,
    tags: tryParse<string[]>(row.tags, []),
    rating: (row.rating as number) ?? 0,
    best_use: row.best_use as string | undefined,
    risk_notes: row.risk_notes as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── In-memory dev store ──────────────────────────────────────
const _devStore: Reference[] = [];

// ─── CRUD ─────────────────────────────────────────────────────

export interface CreateReferenceInput {
  id?: string;
  title: string;
  description?: string;
  kind: ReferenceKind;
  file_data?: string;
  thumbnail_data?: string;
  provider?: Reference["provider"];
  category?: Reference["category"];
  source_url?: string;
  tags?: string[];
  rating?: number;
  best_use?: string;
  risk_notes?: string;
  notes?: string;
}

export async function createReference(data: CreateReferenceInput): Promise<string> {
  const id = data.id ?? generateId();
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    await db.execute(
      `INSERT INTO "references"
        (id, title, description, kind, file_data, thumbnail_data,
         provider, category, source_url, tags, rating,
         best_use, risk_notes, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        data.title,
        data.description ?? null,
        data.kind,
        data.file_data ?? null,
        data.thumbnail_data ?? null,
        data.provider ?? null,
        data.category ?? null,
        data.source_url ?? null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.rating ?? 0,
        data.best_use ?? null,
        data.risk_notes ?? null,
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
    description: data.description,
    kind: data.kind,
    file_data: data.file_data,
    thumbnail_data: data.thumbnail_data,
    provider: data.provider,
    category: data.category,
    source_url: data.source_url,
    tags: data.tags ?? [],
    rating: data.rating ?? 0,
    best_use: data.best_use,
    risk_notes: data.risk_notes,
    notes: data.notes,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

export async function getReferences(filters?: ReferenceFilters): Promise<Reference[]> {
  if (isTauri) {
    const db = await getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.kind) {
      values.push(filters.kind);
      conditions.push(`kind = $${values.length}`);
    }
    if (filters?.category) {
      values.push(filters.category);
      conditions.push(`category = $${values.length}`);
    }
    if (filters?.provider) {
      values.push(filters.provider);
      conditions.push(`provider = $${values.length}`);
    }
    if (filters?.minRating != null) {
      values.push(filters.minRating);
      conditions.push(`rating >= $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = (await db.select(
      `SELECT * FROM "references" ${where} ORDER BY created_at DESC`,
      values
    )) as Record<string, unknown>[];
    return rows.map(rowToReference);
  }

  let list = [..._devStore];
  if (filters?.kind) list = list.filter((r) => r.kind === filters.kind);
  if (filters?.category) list = list.filter((r) => r.category === filters.category);
  if (filters?.provider) list = list.filter((r) => r.provider === filters.provider);
  if (filters?.minRating != null) list = list.filter((r) => r.rating >= filters.minRating!);
  return list;
}

export async function getReferenceById(id: string): Promise<Reference | null> {
  if (isTauri) {
    const db = await getDb();
    const rows = (await db.select(
      `SELECT * FROM "references" WHERE id = $1`,
      [id]
    )) as Record<string, unknown>[];
    return rows[0] ? rowToReference(rows[0]) : null;
  }
  return _devStore.find((r) => r.id === id) ?? null;
}

export async function searchReferences(query: string, filters?: ReferenceFilters): Promise<Reference[]> {
  const q = query.toLowerCase().trim();
  if (!q) return getReferences(filters);

  if (isTauri) {
    const db = await getDb();
    const conditions: string[] = [
      `(lower(title) LIKE $1 OR lower(description) LIKE $1 OR lower(best_use) LIKE $1 OR lower(risk_notes) LIKE $1 OR lower(notes) LIKE $1 OR lower(tags) LIKE $1)`,
    ];
    const values: unknown[] = [`%${q}%`];

    if (filters?.kind) { values.push(filters.kind); conditions.push(`kind = $${values.length}`); }
    if (filters?.category) { values.push(filters.category); conditions.push(`category = $${values.length}`); }
    if (filters?.provider) { values.push(filters.provider); conditions.push(`provider = $${values.length}`); }
    if (filters?.minRating != null) { values.push(filters.minRating); conditions.push(`rating >= $${values.length}`); }

    const rows = (await db.select(
      `SELECT * FROM "references" WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      values
    )) as Record<string, unknown>[];
    return rows.map(rowToReference);
  }

  const all = await getReferences(filters);
  return all.filter((r) =>
    r.title.toLowerCase().includes(q) ||
    r.description?.toLowerCase().includes(q) ||
    r.best_use?.toLowerCase().includes(q) ||
    r.risk_notes?.toLowerCase().includes(q) ||
    r.notes?.toLowerCase().includes(q) ||
    r.tags?.some((t) => t.toLowerCase().includes(q))
  );
}

export async function updateReference(id: string, data: Partial<CreateReferenceInput>): Promise<void> {
  const ts = now();

  if (isTauri) {
    const db = await getDb();
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length + 1}`); };

    if ("title" in data && data.title != null) add("title", data.title);
    if ("description" in data) add("description", data.description ?? null);
    if ("kind" in data && data.kind != null) add("kind", data.kind);
    if ("file_data" in data) add("file_data", data.file_data ?? null);
    if ("thumbnail_data" in data) add("thumbnail_data", data.thumbnail_data ?? null);
    if ("provider" in data) add("provider", data.provider ?? null);
    if ("category" in data) add("category", data.category ?? null);
    if ("source_url" in data) add("source_url", data.source_url ?? null);
    if ("tags" in data) add("tags", data.tags ? JSON.stringify(data.tags) : null);
    if ("rating" in data && data.rating != null) add("rating", data.rating);
    if ("best_use" in data) add("best_use", data.best_use ?? null);
    if ("risk_notes" in data) add("risk_notes", data.risk_notes ?? null);
    if ("notes" in data) add("notes", data.notes ?? null);
    add("updated_at", ts);

    await db.execute(`UPDATE "references" SET ${sets.join(", ")} WHERE id = $1`, [id, ...values]);
    return;
  }

  const idx = _devStore.findIndex((r) => r.id === id);
  if (idx !== -1) {
    _devStore[idx] = { ..._devStore[idx], ...data, updated_at: ts };
  }
}

export async function deleteReference(id: string): Promise<void> {
  if (isTauri) {
    const db = await getDb();
    await db.execute(`DELETE FROM "references" WHERE id = $1`, [id]);
    return;
  }
  const idx = _devStore.findIndex((r) => r.id === id);
  if (idx !== -1) _devStore.splice(idx, 1);
}

// ─── Link helpers ─────────────────────────────────────────────

export async function linkReferenceToPrompt(
  promptId: string,
  referenceId: string,
  role: ReferenceRole = "style"
): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO prompt_references (prompt_id, reference_id, role) VALUES ($1, $2, $3)`,
    [promptId, referenceId, role]
  );
}

export async function unlinkReferenceFromPrompt(
  promptId: string,
  referenceId: string
): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "DELETE FROM prompt_references WHERE prompt_id = $1 AND reference_id = $2",
    [promptId, referenceId]
  );
}

export async function getReferencesForPrompt(promptId: string): Promise<(Reference & { role: ReferenceRole })[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.*, pr.role FROM "references" r
     JOIN prompt_references pr ON r.id = pr.reference_id
     WHERE pr.prompt_id = $1
     ORDER BY r.title ASC`,
    [promptId]
  )) as Record<string, unknown>[];
  return rows.map((row) => ({ ...rowToReference(row), role: row.role as ReferenceRole }));
}

export async function getPromptsForReference(referenceId: string): Promise<{ id: string; title: string; role: ReferenceRole }[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT p.id, p.title, pr.role
     FROM prompts p
     JOIN prompt_references pr ON p.id = pr.prompt_id
     WHERE pr.reference_id = $1
     ORDER BY p.title ASC`,
    [referenceId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, role: r.role as ReferenceRole }));
}

export async function linkReferenceToResult(
  resultId: string,
  referenceId: string,
  role: ReferenceRole = "style"
): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO result_references (result_id, reference_id, role) VALUES ($1, $2, $3)`,
    [resultId, referenceId, role]
  );
}

export async function getReferencesForResult(resultId: string): Promise<(Reference & { role: ReferenceRole })[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT r.*, rr.role FROM "references" r
     JOIN result_references rr ON r.id = rr.reference_id
     WHERE rr.result_id = $1
     ORDER BY r.title ASC`,
    [resultId]
  )) as Record<string, unknown>[];
  return rows.map((row) => ({ ...rowToReference(row), role: row.role as ReferenceRole }));
}

export async function getResultsForReference(referenceId: string): Promise<{ id: string; role: ReferenceRole }[]> {
  if (!isTauri) return [];
  const db = await getDb();
  const rows = (await db.select(
    `SELECT result_id as id, role FROM result_references WHERE reference_id = $1`,
    [referenceId]
  )) as Record<string, unknown>[];
  return rows.map((r) => ({ id: r.id as string, role: r.role as ReferenceRole }));
}
