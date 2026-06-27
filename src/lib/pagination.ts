import { getFramecraftDb } from "./dbConnection";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface PageResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface PageOptions {
  limit?: number;
  offset?: number;
}

/** Count rows matching an arbitrary WHERE clause. */
export async function countRows(table: string, where = "1=1", params: unknown[] = []): Promise<number> {
  if (!isTauri) return 0;
  const db = await getFramecraftDb();
  const rows = (await db.select(
    `SELECT COUNT(*) as n FROM "${table}" WHERE ${where}`,
    params
  )) as Record<string, unknown>[];
  return (rows[0]?.n as number) ?? 0;
}

/** Generic paged SELECT — caller provides the full query body (after SELECT *). */
export async function selectPaged<T>(
  query: string,
  params: unknown[],
  rowMapper: (r: Record<string, unknown>) => T,
  countQuery: string,
  countParams: unknown[],
  { limit = 50, offset = 0 }: PageOptions = {}
): Promise<PageResult<T>> {
  if (!isTauri) return { items: [], total: 0, hasMore: false };
  const db = await getFramecraftDb();

  const [rows, countRows] = await Promise.all([
    db.select(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params,
      limit,
      offset,
    ]) as Promise<Record<string, unknown>[]>,
    db.select(countQuery, countParams) as Promise<Record<string, unknown>[]>,
  ]);

  const total = (countRows[0]?.n as number) ?? 0;
  return {
    items: rows.map(rowMapper),
    total,
    hasMore: offset + rows.length < total,
  };
}
