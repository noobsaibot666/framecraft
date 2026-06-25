import { describe, expect, it, vi } from "vitest";
import {
  createLibraryPackage,
  backupLibraryPackage,
  copyLibraryPackage,
  migrateAppDataToLibrary,
  validateLibraryPackage,
  type LibraryFileSystem,
} from "./libraryPackage";

function createFs(existing: string[] = []): LibraryFileSystem & {
  dirs: string[];
  text: Record<string, string>;
  copies: Array<[string, string]>;
} {
  const paths = new Set(existing);
  const fs = {
    dirs: [] as string[],
    text: {} as Record<string, string>,
    copies: [] as Array<[string, string]>,
    exists: vi.fn(async (path: string) => paths.has(path)),
    mkdir: vi.fn(async (path: string) => {
      paths.add(path);
      fs.dirs.push(path);
    }),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      paths.add(path);
      fs.text[path] = contents;
    }),
    readTextFile: vi.fn(async (path: string) => fs.text[path] ?? ""),
    copyFile: vi.fn(async (from: string, to: string) => {
      paths.add(to);
      fs.text[to] = fs.text[from] ?? "";
      fs.copies.push([from, to]);
    }),
  };
  return fs;
}

describe("libraryPackage", () => {
  it("creates the portable library package structure", async () => {
    const fs = createFs();

    const result = await createLibraryPackage("/Volumes/NAS/Client.framecraftlib", fs, "2026-06-25T10:00:00.000Z");

    expect(result.paths.baseDir).toBe("/Volumes/NAS/Client.framecraftlib/");
    expect(fs.dirs).toEqual([
      "/Volumes/NAS/Client.framecraftlib/",
      "/Volumes/NAS/Client.framecraftlib/results/",
      "/Volumes/NAS/Client.framecraftlib/references/",
      "/Volumes/NAS/Client.framecraftlib/backups/",
      "/Volumes/NAS/Client.framecraftlib/locks/",
    ]);
    expect(fs.text["/Volumes/NAS/Client.framecraftlib/library.json"]).toContain('"format_version": 1');
    expect(fs.text["/Volumes/NAS/Client.framecraftlib/framecraft.db"]).toBe("");
  });

  it("validates a complete portable library package", async () => {
    const fs = createFs([
      "/lib/Work.framecraftlib/library.json",
      "/lib/Work.framecraftlib/framecraft.db",
      "/lib/Work.framecraftlib/results/",
      "/lib/Work.framecraftlib/references/",
    ]);
    fs.text["/lib/Work.framecraftlib/library.json"] = JSON.stringify({
      format_version: 1,
      created_at: "2026-06-25T10:00:00.000Z",
      db_filename: "framecraft.db",
      results_dir: "results",
      references_dir: "references",
    });

    await expect(validateLibraryPackage("/lib/Work.framecraftlib", fs)).resolves.toEqual({
      ok: true,
      errors: [],
    });
  });

  it("reports missing package pieces", async () => {
    const fs = createFs(["/lib/Broken.framecraftlib/library.json"]);
    fs.text["/lib/Broken.framecraftlib/library.json"] = JSON.stringify({ format_version: 1 });

    await expect(validateLibraryPackage("/lib/Broken.framecraftlib", fs)).resolves.toEqual({
      ok: false,
      errors: [
        "Missing framecraft.db",
        "Missing results directory",
        "Missing references directory",
        "Invalid library metadata",
      ],
    });
  });

  it("plans and copies current app-data into a package without deleting source data", async () => {
    const fs = createFs([
      "/app/framecraft.db",
      "/app/results/",
      "/app/references/",
      "/app/results/a.png",
      "/app/references/b.jpg",
    ]);

    const result = await migrateAppDataToLibrary({
      sourceBaseDir: "/app",
      targetBaseDir: "/portable/Work.framecraftlib",
      resultFiles: ["a.png"],
      referenceFiles: ["b.jpg"],
      fs,
      createdAt: "2026-06-25T10:00:00.000Z",
    });

    expect(result.copiedFiles).toEqual([
      "/portable/Work.framecraftlib/framecraft.db",
      "/portable/Work.framecraftlib/results/a.png",
      "/portable/Work.framecraftlib/references/b.jpg",
    ]);
    expect(fs.copies).toEqual([
      ["/app/framecraft.db", "/portable/Work.framecraftlib/framecraft.db"],
      ["/app/results/a.png", "/portable/Work.framecraftlib/results/a.png"],
      ["/app/references/b.jpg", "/portable/Work.framecraftlib/references/b.jpg"],
    ]);
  });

  it("preserves nested media folder structure", async () => {
    const fs = createFs(["/app/framecraft.db"]);

    await migrateAppDataToLibrary({
      sourceBaseDir: "/app",
      targetBaseDir: "/portable/Work.framecraftlib",
      resultFiles: ["campaigns/day-1/a.png"],
      referenceFiles: ["brand/hero/b.jpg"],
      fs,
    });

    expect(fs.dirs).toContain("/portable/Work.framecraftlib/results/campaigns/day-1/");
    expect(fs.dirs).toContain("/portable/Work.framecraftlib/references/brand/hero/");
    expect(fs.copies).toContainEqual([
      "/app/results/campaigns/day-1/a.png",
      "/portable/Work.framecraftlib/results/campaigns/day-1/a.png",
    ]);
    expect(fs.copies).toContainEqual([
      "/app/references/brand/hero/b.jpg",
      "/portable/Work.framecraftlib/references/brand/hero/b.jpg",
    ]);
  });

  it("rejects unsafe relative media paths", async () => {
    const fs = createFs(["/app/framecraft.db"]);

    await expect(
      migrateAppDataToLibrary({
        sourceBaseDir: "/app",
        targetBaseDir: "/portable/Work.framecraftlib",
        resultFiles: ["../escape.png"],
        referenceFiles: [],
        fs,
      })
    ).rejects.toThrow("Unsafe library media path");
  });

  it("copies a library package and validates the copy", async () => {
    const fs = createFs([
      "/source/Work.framecraftlib/library.json",
      "/source/Work.framecraftlib/framecraft.db",
      "/source/Work.framecraftlib/results/",
      "/source/Work.framecraftlib/references/",
    ]);
    fs.text["/source/Work.framecraftlib/library.json"] = JSON.stringify({
      format_version: 1,
      created_at: "2026-06-25T10:00:00.000Z",
      db_filename: "framecraft.db",
      results_dir: "results",
      references_dir: "references",
    });
    const result = await copyLibraryPackage({
      sourceBaseDir: "/source/Work.framecraftlib",
      targetBaseDir: "/export/Work Copy.framecraftlib",
      resultFiles: ["a.png"],
      referenceFiles: ["refs/b.jpg"],
      fs,
    });

    expect(result.validation.ok).toBe(true);
    expect(result.copiedFiles).toEqual([
      "/export/Work Copy.framecraftlib/library.json",
      "/export/Work Copy.framecraftlib/framecraft.db",
      "/export/Work Copy.framecraftlib/results/a.png",
      "/export/Work Copy.framecraftlib/references/refs/b.jpg",
    ]);
  });

  it("creates a timestamped backup inside the source library", async () => {
    const fs = createFs([
      "/source/Work.framecraftlib/library.json",
      "/source/Work.framecraftlib/framecraft.db",
      "/source/Work.framecraftlib/results/",
      "/source/Work.framecraftlib/references/",
    ]);
    fs.text["/source/Work.framecraftlib/library.json"] = JSON.stringify({
      format_version: 1,
      created_at: "2026-06-25T10:00:00.000Z",
      db_filename: "framecraft.db",
      results_dir: "results",
      references_dir: "references",
    });
    const result = await backupLibraryPackage({
      sourceBaseDir: "/source/Work.framecraftlib",
      resultFiles: [],
      referenceFiles: [],
      fs,
      createdAt: "2026-06-25T10:00:00.000Z",
    });

    expect(result.paths.baseDir).toBe(
      "/source/Work.framecraftlib/backups/framecraft-backup-2026-06-25T10-00-00-000Z.framecraftlib/"
    );
    expect(result.validation.ok).toBe(true);
  });
});
