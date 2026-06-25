export const DEFAULT_DB_NAME = "framecraft.db";
export const DEFAULT_SQLITE_URL = `sqlite:${DEFAULT_DB_NAME}`;
export const FRAMECRAFT_LIBRARY_EXTENSION = ".framecraftlib";

export type LibraryMode = "appData" | "portable";

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

export async function getAppDataLibraryPaths(): Promise<LibraryPaths> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  return resolveLibraryPaths(await appDataDir());
}

export async function getActiveSqliteUrl(): Promise<string> {
  return DEFAULT_SQLITE_URL;
}

