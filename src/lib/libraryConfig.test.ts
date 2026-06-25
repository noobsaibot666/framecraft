import { describe, expect, it } from "vitest";
import {
  DEFAULT_DB_NAME,
  DEFAULT_SQLITE_URL,
  FRAMECRAFT_LIBRARY_EXTENSION,
  buildLibraryMetadata,
  clearSelectedLibraryPath,
  getActiveLibraryPaths,
  getActiveLibrarySelection,
  getActiveSqliteUrl,
  getDefaultLibraryMode,
  getReferenceDir,
  getResultDir,
  isFramecraftLibraryPath,
  LIBRARY_PATH_STORAGE_KEY,
  normalizeDir,
  resolveLibraryPaths,
  setSelectedLibraryPath,
  type LibraryStorage,
} from "./libraryConfig";

function createStorage(): LibraryStorage & { data: Record<string, string> } {
  const storage = {
    data: {} as Record<string, string>,
    getItem(key: string) {
      return storage.data[key] ?? null;
    },
    setItem(key: string, value: string) {
      storage.data[key] = value;
    },
    removeItem(key: string) {
      delete storage.data[key];
    },
  };
  return storage;
}

describe("libraryConfig defaults", () => {
  it("preserves the current app-data sqlite URL by default", () => {
    expect(DEFAULT_DB_NAME).toBe("framecraft.db");
    expect(DEFAULT_SQLITE_URL).toBe("sqlite:framecraft.db");
    expect(getDefaultLibraryMode()).toBe("appData");
  });

  it("normalizes directory paths with a trailing slash", () => {
    expect(normalizeDir("/Users/alan/Library")).toBe("/Users/alan/Library/");
    expect(normalizeDir("/Users/alan/Library/")).toBe("/Users/alan/Library/");
  });

  it("resolves the current media folder names under a base directory", () => {
    const paths = resolveLibraryPaths("/data/Framecraft");

    expect(paths.baseDir).toBe("/data/Framecraft/");
    expect(paths.dbPath).toBe("/data/Framecraft/framecraft.db");
    expect(paths.resultsDir).toBe("/data/Framecraft/results/");
    expect(paths.referencesDir).toBe("/data/Framecraft/references/");
    expect(getResultDir(paths.baseDir)).toBe(paths.resultsDir);
    expect(getReferenceDir(paths.baseDir)).toBe(paths.referencesDir);
  });

  it("identifies portable library package paths", () => {
    expect(FRAMECRAFT_LIBRARY_EXTENSION).toBe(".framecraftlib");
    expect(isFramecraftLibraryPath("/Volumes/NAS/Client.framecraftlib")).toBe(true);
    expect(isFramecraftLibraryPath("/Volumes/NAS/Client")).toBe(false);
  });

  it("builds metadata for future portable library packages", () => {
    const metadata = buildLibraryMetadata("2026-06-25T10:00:00.000Z");

    expect(metadata).toEqual({
      format_version: 1,
      created_at: "2026-06-25T10:00:00.000Z",
      db_filename: "framecraft.db",
      results_dir: "results",
      references_dir: "references",
    });
  });

  it("uses app-data paths and sqlite URL when no portable library is selected", async () => {
    const storage = createStorage();

    expect(getActiveLibrarySelection(storage)).toEqual({ mode: "appData", path: null });
    expect(getActiveLibraryPaths("/Users/alan/AppData", storage)).toEqual(resolveLibraryPaths("/Users/alan/AppData"));
    await expect(getActiveSqliteUrl(storage)).resolves.toBe(DEFAULT_SQLITE_URL);
  });

  it("persists a selected portable library path", async () => {
    const storage = createStorage();

    setSelectedLibraryPath("/Volumes/NAS/Client.framecraftlib", storage);

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBe("/Volumes/NAS/Client.framecraftlib");
    expect(getActiveLibrarySelection(storage)).toEqual({
      mode: "portable",
      path: "/Volumes/NAS/Client.framecraftlib",
    });
    expect(getActiveLibraryPaths("/Users/alan/AppData", storage)).toEqual(
      resolveLibraryPaths("/Volumes/NAS/Client.framecraftlib")
    );
    await expect(getActiveSqliteUrl(storage)).resolves.toBe(
      "sqlite:/Volumes/NAS/Client.framecraftlib/framecraft.db"
    );
  });

  it("clears a selected portable library path", () => {
    const storage = createStorage();
    setSelectedLibraryPath("/Volumes/NAS/Client.framecraftlib", storage);

    clearSelectedLibraryPath(storage);

    expect(getActiveLibrarySelection(storage)).toEqual({ mode: "appData", path: null });
    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBeUndefined();
  });
});
