import { appDataDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  clearSelectedLibraryPath,
  getActiveLibraryPaths,
  getActiveLibrarySelection,
  isFramecraftLibraryPath,
  resolveLibraryPaths,
  setSelectedLibraryPath,
  type ActiveLibrarySelection,
  type LibraryPaths,
  type LibraryStorage,
} from "./libraryConfig";
import {
  buildPortableMediaPathRewrites,
  listRelativeMediaFilenames,
  type LibraryValidationResult,
  type PortableMediaPathRewrite,
} from "./libraryPackage";
import {
  backupLibraryPackageNative,
  copyLibraryPackageNative,
  createLibraryPackageNative,
  migrateAppDataToLibraryNative,
  repairLibraryDatabaseSchemaNative,
  validateLibraryPackageNative,
} from "./libraryNative";
import { getFramecraftDb } from "./dbConnection";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface LibrarySettingsState {
  selection: ActiveLibrarySelection;
  paths: LibraryPaths;
  validation: LibraryValidationResult | null;
  nativeAvailable: boolean;
}

export interface SelectValidatedLibraryDeps {
  storage?: LibraryStorage;
  validateLibrary: (path: string) => Promise<LibraryValidationResult>;
}

export interface SelectValidatedLibraryResult {
  path: string;
  restartRequired: true;
}

export interface PortableMediaSources {
  resultPaths: string[];
  referencePaths: string[];
}

export interface PortableMediaDirs {
  resultsDir: string;
  referencesDir: string;
}

export async function selectValidatedLibrary(
  path: string,
  deps: SelectValidatedLibraryDeps
): Promise<SelectValidatedLibraryResult> {
  if (!isFramecraftLibraryPath(path)) throw new Error("Library path must end with .framecraftlib.");
  const validation = await deps.validateLibrary(path);
  if (!validation.ok) throw new Error(validation.errors.join(", "));
  setSelectedLibraryPath(path, deps.storage);
  return { path, restartRequired: true };
}

export function collectPortableMediaFilenames(
  sources: PortableMediaSources,
  dirs: PortableMediaDirs
): { resultFiles: string[]; referenceFiles: string[] } {
  return {
    resultFiles: unique(listRelativeMediaFilenames(sources.resultPaths, dirs.resultsDir)),
    referenceFiles: unique(listRelativeMediaFilenames(sources.referencePaths, dirs.referencesDir)),
  };
}

export async function getLibrarySettingsState(): Promise<LibrarySettingsState> {
  const appDir = isTauri() ? await appDataDir() : "localStorage";
  const selection = getActiveLibrarySelection();
  const paths = getActiveLibraryPaths(appDir);
  const validation = selection.path && isTauri()
    ? await validateLibraryPackageNative(selection.path)
    : null;
  return { selection, paths, validation, nativeAvailable: isTauri() };
}

export async function createLibraryFromDialog(): Promise<string | null> {
  if (!isTauri()) throw new Error("Library packages can only be created in the native app.");
  const path = await save({
    title: "Create Framecraft Library",
    filters: [{ name: "Framecraft Library", extensions: ["framecraftlib"] }],
  });
  if (!path) return null;
  const libraryPath = ensureLibraryExtension(path);
  await createLibraryPackageNative(libraryPath);
  return libraryPath;
}

export async function openLibraryFromDialog(): Promise<SelectValidatedLibraryResult | null> {
  if (!isTauri()) throw new Error("Library packages can only be opened in the native app.");
  const path = await open({
    title: "Open Framecraft Library",
    directory: true,
    multiple: false,
  });
  if (!path || Array.isArray(path)) return null;
  return selectValidatedLibrary(path, {
    validateLibrary: validateLibraryPackageNative,
  });
}

export async function migrateCurrentDataToLibraryFromDialog(): Promise<SelectValidatedLibraryResult | null> {
  if (!isTauri()) throw new Error("Library migration can only run in the native app.");
  const path = await save({
    title: "Migrate Current Data to Framecraft Library",
    filters: [{ name: "Framecraft Library", extensions: ["framecraftlib"] }],
  });
  if (!path) return null;

  const targetBaseDir = ensureLibraryExtension(path);
  const sourceBaseDir = await appDataDir();
  const sourcePaths = getActiveLibraryPaths(sourceBaseDir, createEmptyStorage());
  const media = await collectCurrentMedia(sourcePaths);

  await migrateAppDataToLibraryNative({
    sourceBaseDir,
    targetBaseDir,
    resultFiles: media.resultFiles,
    referenceFiles: media.referenceFiles,
  });
  await repairCopiedLibraryMediaPaths(sourceBaseDir, targetBaseDir);

  return selectValidatedLibrary(targetBaseDir, {
    validateLibrary: validateLibraryPackageNative,
  });
}

export async function backupActiveLibrary(): Promise<string> {
  if (!isTauri()) throw new Error("Library backup can only run in the native app.");
  const state = await getLibrarySettingsState();
  const media = await collectCurrentMedia(state.paths);
  const result = await backupLibraryPackageNative({
    sourceBaseDir: state.paths.baseDir,
    resultFiles: media.resultFiles,
    referenceFiles: media.referenceFiles,
  });
  await repairCopiedLibraryMediaPaths(state.paths.baseDir, result.paths.baseDir);
  return result.paths.baseDir;
}

export async function exportActiveLibraryFromDialog(): Promise<string | null> {
  if (!isTauri()) throw new Error("Library export can only run in the native app.");
  const path = await save({
    title: "Export Framecraft Library Copy",
    filters: [{ name: "Framecraft Library", extensions: ["framecraftlib"] }],
  });
  if (!path) return null;

  const state = await getLibrarySettingsState();
  const media = await collectCurrentMedia(state.paths);
  const targetBaseDir = ensureLibraryExtension(path);
  const result = await copyLibraryPackageNative({
    sourceBaseDir: state.paths.baseDir,
    targetBaseDir,
    resultFiles: media.resultFiles,
    referenceFiles: media.referenceFiles,
  });
  await repairCopiedLibraryMediaPaths(state.paths.baseDir, result.paths.baseDir);
  return result.paths.baseDir;
}

export async function restoreLibraryFromDialog(): Promise<SelectValidatedLibraryResult | null> {
  return openLibraryFromDialog();
}

export async function repairActiveLibraryDatabaseSchema(): Promise<LibraryValidationResult> {
  if (!isTauri()) throw new Error("Library repair can only run in the native app.");
  const state = await getLibrarySettingsState();
  if (state.selection.mode !== "portable") throw new Error("Select a portable library before repairing its database schema.");
  const validation = await repairLibraryDatabaseSchemaNative(state.paths.baseDir);
  if (!validation.ok) throw new Error(validation.errors.join(", "));
  return validation;
}

export async function revealActiveLibraryFolder(): Promise<void> {
  const state = await getLibrarySettingsState();
  await revealItemInDir(state.paths.baseDir);
}

export function useLocalAppDataLibrary(storage?: LibraryStorage): void {
  clearSelectedLibraryPath(storage);
}

export function formatLibraryActionError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Library action failed.";
  }
}

async function collectCurrentMedia(sourcePaths: LibraryPaths): Promise<{ resultFiles: string[]; referenceFiles: string[] }> {
  const db = await getFramecraftDb();
  const resultRows = await db.select(
    "SELECT file_path, thumbnail_path FROM results WHERE file_path IS NOT NULL OR thumbnail_path IS NOT NULL"
  ) as Array<{ file_path?: string | null; thumbnail_path?: string | null }>;
  const referenceRows = await db.select(
    `SELECT file_data, thumbnail_data FROM "references" WHERE file_data IS NOT NULL OR thumbnail_data IS NOT NULL`
  ) as Array<{ file_data?: string | null; thumbnail_data?: string | null }>;

  return collectPortableMediaFilenames(
    {
      resultPaths: resultRows.flatMap((row) => [row.file_path, row.thumbnail_path]).filter(isString),
      referencePaths: referenceRows.flatMap((row) => [row.file_data, row.thumbnail_data]).filter(isString),
    },
    sourcePaths
  );
}

function ensureLibraryExtension(path: string): string {
  return isFramecraftLibraryPath(path) ? path : `${path}.framecraftlib`;
}

function createEmptyStorage(): LibraryStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function repairCopiedLibraryMediaPaths(sourceBaseDir: string, targetBaseDir: string): Promise<void> {
  if (!isTauri()) return;
  const rewrites = buildPortableMediaPathRewrites({ sourceBaseDir, targetBaseDir });
  const target = resolveLibraryPaths(targetBaseDir);
  const SqlPlugin = await import("@tauri-apps/plugin-sql");
  const db = await SqlPlugin.default.load(`sqlite:${target.dbPath}`);

  try {
    for (const rewrite of rewrites) {
      await executeMediaPathRewrite(db, rewrite);
    }
  } finally {
    await db.close?.();
  }
}

async function executeMediaPathRewrite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  rewrite: PortableMediaPathRewrite
): Promise<void> {
  const table = rewrite.table === "references" ? "\"references\"" : "results";
  const column = rewrite.column;
  await db.execute(
    `UPDATE ${table}
     SET ${column} = $1 || substr(${column}, length($2) + 1)
     WHERE ${column} IS NOT NULL
       AND substr(${column}, 1, length($2)) = $2`,
    [rewrite.targetPrefix, rewrite.sourcePrefix]
  );
}
