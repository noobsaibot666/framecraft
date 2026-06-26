import { getActiveLibrarySelection, getActiveSqliteUrl, resolveLibraryPaths } from "./libraryConfig";
import { createNativeSqliteDatabase } from "./nativeSqlite";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _dbUrl = "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFramecraftDb(): Promise<any> {
  if (!isTauri) throw new Error("Not in Tauri context");

  const selection = getActiveLibrarySelection();
  if (selection.path) {
    const dbPath = resolveLibraryPaths(selection.path).dbPath;
    if (!_db || _dbUrl !== dbPath) {
      _db = createNativeSqliteDatabase(dbPath);
      _dbUrl = dbPath;
    }
    return _db;
  }

  const url = await getActiveSqliteUrl();
  if (!_db || _dbUrl !== url) {
    const SqlPlugin = await import("@tauri-apps/plugin-sql");
    _db = await SqlPlugin.default.load(url);
    _dbUrl = url;
  }
  return _db;
}

export function resetFramecraftDbConnectionForTests(): void {
  _db = null;
  _dbUrl = "";
}
