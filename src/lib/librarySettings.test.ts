import { describe, expect, it, vi } from "vitest";
import { LIBRARY_PATH_STORAGE_KEY, type LibraryStorage } from "./libraryConfig";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  appDataDir: vi.fn(async () => "/app-data/"),
  migrate: vi.fn(async () => ({ paths: { baseDir: "/Migrated.framecraftlib/" }, copiedFiles: [] })),
  copy: vi.fn(async () => ({ paths: { baseDir: "/Export.framecraftlib/" }, copiedFiles: [], validation: { ok: true, errors: [] } })),
  backup: vi.fn(async () => ({ paths: { baseDir: "/Library.framecraftlib/backups/backup.framecraftlib/" }, copiedFiles: [], validation: { ok: true, errors: [] } })),
  inspect: vi.fn(async () => ({ ok: true, errors: [] })),
  validate: vi.fn(async () => ({ ok: true, errors: [] })),
  dbSelect: vi.fn(async (_sql: string) => [] as Record<string, unknown>[]),
  readDir: vi.fn(async (_dir: string) => [] as { name: string }[]),
  remove: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({ appDataDir: mocks.appDataDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: mocks.save }));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));
vi.mock("./libraryNative", () => ({
  backupLibraryPackageNative: mocks.backup,
  copyLibraryPackageNative: mocks.copy,
  createLibraryPackageNative: vi.fn(),
  inspectLibraryPackageNative: mocks.inspect,
  mergeLibraryPackageNative: vi.fn(),
  migrateAppDataToLibraryNative: mocks.migrate,
  repairLibraryDatabaseSchemaNative: vi.fn(),
  validateLibraryPackageNative: mocks.validate,
}));
vi.mock("./dbConnection", () => ({
  getFramecraftDb: vi.fn(async () => ({ select: mocks.dbSelect })),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: mocks.readDir,
  remove: mocks.remove,
}));
import {
  backupActiveLibrary,
  cleanupOrphanedManagedMedia,
  exportActiveLibraryFromDialog,
  formatLibraryActionError,
  isRepairableLibraryPackageError,
  migrateCurrentDataToLibraryFromDialog,
  scanOrphanedManagedMedia,
  selectValidatedLibrary,
} from "./librarySettings";

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

describe("librarySettings", () => {
  it("invokes migration without caller-collected media arrays", async () => {
    installTauriWindow();
    mocks.save.mockResolvedValueOnce("/Migrated.framecraftlib");

    await migrateCurrentDataToLibraryFromDialog();

    expect(mocks.migrate).toHaveBeenCalledWith({
      sourceBaseDir: "/app-data/",
      targetBaseDir: "/Migrated.framecraftlib",
    });
  });

  it("invokes copy and backup without caller-collected media arrays", async () => {
    installTauriWindow("/Library.framecraftlib");
    mocks.save.mockResolvedValueOnce("/Export.framecraftlib");

    await exportActiveLibraryFromDialog();
    await backupActiveLibrary();

    expect(mocks.copy).toHaveBeenCalledWith({
      sourceBaseDir: "/Library.framecraftlib/",
      targetBaseDir: "/Export.framecraftlib",
    });
    expect(mocks.backup).toHaveBeenCalledWith({
      sourceBaseDir: "/Library.framecraftlib/",
    });
  });

  it("persists only a valid portable library selection", async () => {
    const storage = createStorage();
    const validateLibrary = vi.fn(async () => ({ ok: true, errors: [] }));

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Client.framecraftlib", { storage, validateLibrary })
    ).resolves.toEqual({
      path: "/Volumes/NAS/Client.framecraftlib",
      restartRequired: true,
    });

    expect(validateLibrary).toHaveBeenCalledWith("/Volumes/NAS/Client.framecraftlib");
    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBe("/Volumes/NAS/Client.framecraftlib");
  });

  it("rejects an invalid portable library selection", async () => {
    const storage = createStorage();

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Broken.framecraftlib", {
        storage,
        validateLibrary: async () => ({ ok: false, errors: ["Missing framecraft.db"] }),
      })
    ).rejects.toThrow("Missing framecraft.db");

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBeUndefined();
  });

  it("formats non-Error Tauri failures for Settings", () => {
    expect(formatLibraryActionError("copyFile failed")).toBe("copyFile failed");
    expect(formatLibraryActionError({ message: "Destination exists" })).toBe("Destination exists");
    expect(formatLibraryActionError({ reason: "permission denied" })).toBe('{"reason":"permission denied"}');
  });

  it("identifies package upgrade validation errors that can be repaired safely", () => {
    expect(isRepairableLibraryPackageError("Missing inbox directory")).toBe(true);
    expect(isRepairableLibraryPackageError("Missing staging directory")).toBe(true);
    expect(isRepairableLibraryPackageError("Missing locks directory")).toBe(true);
    expect(isRepairableLibraryPackageError("Missing sync applied directory")).toBe(true);
    expect(isRepairableLibraryPackageError("Missing sync failed directory")).toBe(true);
    expect(isRepairableLibraryPackageError("Missing database schema")).toBe(true);
    expect(isRepairableLibraryPackageError("Invalid library metadata")).toBe(false);
  });
});

describe("scanOrphanedManagedMedia", () => {
  it("returns empty when not in Tauri", async () => {
    const result = await scanOrphanedManagedMedia();
    expect(result.orphanPaths).toEqual([]);
  });

  it("identifies files present on disk but not referenced in the database", async () => {
    installTauriWindow("/Library.framecraftlib");
    const resultsDir = "/Library.framecraftlib/results/";

    mocks.dbSelect.mockImplementation(async (sql: string) => {
      if (sql.includes("results")) {
        return [{ file_path: `${resultsDir}result-1.png`, thumbnail_path: `${resultsDir}result-1_thumb.jpg` }];
      }
      return [];
    });
    mocks.readDir.mockImplementation(async (dir: string) => {
      if (dir === resultsDir) {
        return [{ name: "result-1.png" }, { name: "result-1_thumb.jpg" }, { name: "orphan.png" }];
      }
      return [];
    });

    const result = await scanOrphanedManagedMedia();
    expect(result.orphanPaths).toEqual([`${resultsDir}orphan.png`]);

    mocks.dbSelect.mockReset();
    mocks.readDir.mockReset();
    vi.unstubAllGlobals();
  });
});

describe("cleanupOrphanedManagedMedia", () => {
  it("returns zero removed when not in Tauri", async () => {
    const result = await cleanupOrphanedManagedMedia(["/results/orphan.png"]);
    expect(result.removed).toBe(0);
  });

  it("removes only files within active managed directories", async () => {
    installTauriWindow("/Library.framecraftlib");
    const safeOrphan = "/Library.framecraftlib/results/orphan.png";
    const outsidePath = "/Users/alan/Desktop/file.png";

    const result = await cleanupOrphanedManagedMedia([safeOrphan, outsidePath]);

    expect(mocks.remove).toHaveBeenCalledWith(safeOrphan);
    expect(mocks.remove).not.toHaveBeenCalledWith(outsidePath);
    expect(result.removed).toBe(1);

    mocks.remove.mockReset();
    vi.unstubAllGlobals();
  });
});

function installTauriWindow(selectedLibrary?: string): void {
  const storage = createStorage();
  if (selectedLibrary) storage.setItem(LIBRARY_PATH_STORAGE_KEY, selectedLibrary);
  vi.stubGlobal("window", {
    __TAURI_INTERNALS__: {},
    localStorage: storage,
  });
}
