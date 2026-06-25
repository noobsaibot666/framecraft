import { describe, expect, it } from "vitest";
import {
  DEFAULT_DB_NAME,
  DEFAULT_SQLITE_URL,
  FRAMECRAFT_LIBRARY_EXTENSION,
  buildLibraryMetadata,
  getDefaultLibraryMode,
  getReferenceDir,
  getResultDir,
  isFramecraftLibraryPath,
  normalizeDir,
  resolveLibraryPaths,
} from "./libraryConfig";

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
});
