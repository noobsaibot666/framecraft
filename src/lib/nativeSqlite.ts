import { invoke } from "@tauri-apps/api/core";

export interface NativeSqliteQueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface NativeSqliteDatabase {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<NativeSqliteQueryResult>;
  close(): Promise<boolean>;
}

export function createNativeSqliteDatabase(dbPath: string): NativeSqliteDatabase {
  return {
    select: (query, bindValues = []) => invoke("native_sqlite_select", { dbPath, query, bindValues }),
    execute: (query, bindValues = []) => invoke("native_sqlite_execute", { dbPath, query, bindValues }),
    close: async () => true,
  };
}
