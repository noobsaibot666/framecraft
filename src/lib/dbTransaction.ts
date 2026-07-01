import type { NativeSqliteTransactionResult } from "./nativeSqlite";

export interface AtomicStatement {
  operation: "execute" | "query";
  sql: string;
  bindValues?: unknown[];
}

interface AtomicDatabase {
  executeTransaction?: (statements: AtomicStatement[]) => Promise<NativeSqliteTransactionResult[]>;
}

function validateBindValue(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new Error("SQLite numeric bind values must be finite");
  }
  throw new Error(`Unsupported SQLite bind value type: ${typeof value}`);
}

export async function executeAtomically(
  db: AtomicDatabase,
  statements: AtomicStatement[]
): Promise<NativeSqliteTransactionResult[]> {
  for (const statement of statements) {
    for (const value of statement.bindValues ?? []) validateBindValue(value);
  }
  if (typeof db.executeTransaction !== "function") {
    throw new Error("Database adapter is missing the native executeTransaction capability");
  }
  return db.executeTransaction(statements);
}
