export const DEFAULT_DB_NAME = "framecraft.db";
export const DEFAULT_SQLITE_URL = `sqlite:${DEFAULT_DB_NAME}`;
export const FRAMECRAFT_LIBRARY_EXTENSION = ".framecraftlib";
export const LIBRARY_PATH_STORAGE_KEY = "framecraft_library_path";

export type LibraryMode = "appData" | "portable";

export interface LibraryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ActiveLibrarySelection {
  mode: LibraryMode;
  path: string | null;
}

export interface LibraryPaths {
  baseDir: string;
  dbPath: string;
  resultsDir: string;
  referencesDir: string;
  backupsDir: string;
  locksDir: string;
}

export interface LibraryMetadata {
  format_version: 1;
  created_at: string;
  db_filename: string;
  results_dir: string;
  references_dir: string;
}

export function getDefaultLibraryMode(): LibraryMode {
  return "appData";
}

export function normalizeDir(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

export function getResultDir(baseDir: string): string {
  return `${normalizeDir(baseDir)}results/`;
}

export function getReferenceDir(baseDir: string): string {
  return `${normalizeDir(baseDir)}references/`;
}

export function resolveLibraryPaths(baseDir: string): LibraryPaths {
  const base = normalizeDir(baseDir);
  return {
    baseDir: base,
    dbPath: `${base}${DEFAULT_DB_NAME}`,
    resultsDir: getResultDir(base),
    referencesDir: getReferenceDir(base),
    backupsDir: `${base}backups/`,
    locksDir: `${base}locks/`,
  };
}

export function isFramecraftLibraryPath(path: string): boolean {
  return path.toLowerCase().endsWith(FRAMECRAFT_LIBRARY_EXTENSION);
}

export function buildLibraryMetadata(createdAt = new Date().toISOString()): LibraryMetadata {
  return {
    format_version: 1,
    created_at: createdAt,
    db_filename: DEFAULT_DB_NAME,
    results_dir: "results",
    references_dir: "references",
  };
}

function getBrowserStorage(): LibraryStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function getSelectedLibraryPath(storage = getBrowserStorage()): string | null {
  const path = storage?.getItem(LIBRARY_PATH_STORAGE_KEY)?.trim();
  return path ? path : null;
}

export function setSelectedLibraryPath(path: string, storage = getBrowserStorage()): void {
  const normalized = path.trim();
  if (!normalized) throw new Error("Library path is required.");
  if (!isFramecraftLibraryPath(normalized)) throw new Error("Library path must end with .framecraftlib.");
  storage?.setItem(LIBRARY_PATH_STORAGE_KEY, normalized);
}

export function clearSelectedLibraryPath(storage = getBrowserStorage()): void {
  storage?.removeItem(LIBRARY_PATH_STORAGE_KEY);
}

export function getActiveLibrarySelection(storage = getBrowserStorage()): ActiveLibrarySelection {
  const path = getSelectedLibraryPath(storage);
  return path ? { mode: "portable", path } : { mode: "appData", path: null };
}

export function getActiveLibraryPaths(appDataDir: string, storage = getBrowserStorage()): LibraryPaths {
  const selection = getActiveLibrarySelection(storage);
  return resolveLibraryPaths(selection.path ?? appDataDir);
}

export async function getAppDataLibraryPaths(): Promise<LibraryPaths> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  return getActiveLibraryPaths(await appDataDir());
}

export async function getActiveSqliteUrl(storage = getBrowserStorage()): Promise<string> {
  const selection = getActiveLibrarySelection(storage);
  return selection.path ? `sqlite:${resolveLibraryPaths(selection.path).dbPath}` : DEFAULT_SQLITE_URL;
}
