import { invoke } from "@tauri-apps/api/core";

export interface NativeSqliteQueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface NativeSqliteStatement {
  operation: "execute" | "query";
  sql: string;
  bindValues?: unknown[];
}

export interface NativeSqliteTransactionResult {
  rowsAffected?: number;
  lastInsertId?: number;
  rows?: Record<string, unknown>[];
}

export interface NativeSqliteDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<NativeSqliteQueryResult>;
  executeBatch(query: string): Promise<void>;
  executeTransaction(statements: NativeSqliteStatement[]): Promise<NativeSqliteTransactionResult[]>;
  close(): Promise<boolean>;
}

export function createNativeSqliteDatabase(dbPath: string): NativeSqliteDatabase {
  return {
    select: (query, bindValues = []) => invoke("native_sqlite_select", { dbPath, query, bindValues }),
    execute: (query, bindValues = []) => invoke("native_sqlite_execute", { dbPath, query, bindValues }),
    executeBatch: (query) => invoke("native_sqlite_execute_batch", { dbPath, query }),
    executeTransaction: (statements) => invoke("native_sqlite_execute_transaction", { dbPath, statements }),
    close: async () => true,
  };
}
