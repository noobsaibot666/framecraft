import { describe, expect, it, vi } from "vitest";
import { resolveLibraryPaths } from "./libraryConfig";
import {
  createReferenceImportJob,
  createResultImportJob,
  processSharedIngestInbox,
  publishSharedIngestJob,
  validateSharedIngestJob,
  type SharedIngestDb,
  type SharedIngestFileSystem,
} from "./sharedIngest";

function createFs(existing: Record<string, string | Uint8Array> = {}): SharedIngestFileSystem & {
  files: Record<string, string | Uint8Array>;
  writes: string[];
  renames: Array<[string, string]>;
  copies: Array<[string, string]>;
  removed: string[];
} {
  const fs = {
    files: { ...existing },
    writes: [] as string[],
    renames: [] as Array<[string, string]>,
    copies: [] as Array<[string, string]>,
    removed: [] as string[],
    mkdir: vi.fn(async () => undefined),
    exists: vi.fn(async (path: string) => Object.prototype.hasOwnProperty.call(fs.files, path)),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      fs.files[path] = contents;
      fs.writes.push(path);
    }),
    writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
      fs.files[path] = contents;
      fs.writes.push(path);
    }),
    readTextFile: vi.fn(async (path: string) => String(fs.files[path] ?? "")),
    readDir: vi.fn(async (path: string) =>
      Object.keys(fs.files)
        .filter((file) => file.startsWith(path) && file.endsWith(".json"))
        .map((file) => file.slice(path.length))
    ),
    renameFile: vi.fn(async (from: string, to: string) => {
      fs.files[to] = fs.files[from] ?? "";
      delete fs.files[from];
      fs.renames.push([from, to]);
    }),
    copyFile: vi.fn(async (from: string, to: string) => {
      fs.files[to] = fs.files[from] ?? "";
      fs.copies.push([from, to]);
    }),
    removeFile: vi.fn(async (path: string) => {
      delete fs.files[path];
      fs.removed.push(path);
    }),
  };
  return fs;
}

function createDb(options: { promptExists?: boolean } = {}): SharedIngestDb & {
  references: unknown[][];
  results: unknown[][];
} {
  return {
    references: [],
    results: [],
    select: vi.fn(async (sql: string) => {
      if (sql.includes("FROM prompts")) return options.promptExists ? [{ id: "prompt-1" }] : [];
      return [];
    }),
    execute: vi.fn(async function (this: SharedIngestDb & { references: unknown[][]; results: unknown[][] }, sql: string, values: unknown[]) {
      if (sql.includes('INTO "references"')) this.references.push(values);
      if (sql.includes("INTO results")) this.results.push(values);
    }),
  };
}

describe("sharedIngest", () => {
  it("creates a valid reference import job with safe staged paths", () => {
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image", tags: ["brand"] },
    });

    expect(job.kind).toBe("reference.import");
    expect(job.payload.originalStagedPath).toBe("job-a/original.png");
    expect(job.payload.thumbnailStagedPath).toBe("job-a/thumb.jpg");
    expect(validateSharedIngestJob(job).ok).toBe(true);
  });

  it("rejects unsafe staged paths", () => {
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });
    job.payload.originalStagedPath = "../escape.png";

    expect(validateSharedIngestJob(job)).toEqual({
      ok: false,
      errors: ["Unsafe staged media path: ../escape.png"],
    });
  });

  it("publishes media before atomically renaming the job into inbox", async () => {
    const paths = resolveLibraryPaths("/Volumes/NAS/Work.framecraftlib");
    const fs = createFs();
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });

    await publishSharedIngestJob({
      paths,
      fs,
      job,
      originalBytes: new Uint8Array([1, 2]),
      thumbnailBytes: new Uint8Array([3, 4]),
    });

    expect(fs.writes).toEqual([
      "/Volumes/NAS/Work.framecraftlib/staging/job-a/original.png",
      "/Volumes/NAS/Work.framecraftlib/staging/job-a/thumb.jpg",
      "/Volumes/NAS/Work.framecraftlib/inbox/job-a.tmp",
    ]);
    expect(fs.renames).toEqual([
      ["/Volumes/NAS/Work.framecraftlib/inbox/job-a.tmp", "/Volumes/NAS/Work.framecraftlib/inbox/job-a.json"],
    ]);
  });

  it("merges a reference import job once and records it as applied", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image", rating: 4 },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-a.json": JSON.stringify(job),
      "/lib/Work.framecraftlib/staging/job-a/original.png": new Uint8Array([1]),
      "/lib/Work.framecraftlib/staging/job-a/thumb.jpg": new Uint8Array([2]),
    });
    const db = createDb();

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 1, failed: 0, skipped: 0 });
    expect(fs.copies).toContainEqual([
      "/lib/Work.framecraftlib/staging/job-a/original.png",
      "/lib/Work.framecraftlib/references/ref-a.png",
    ]);
    expect(db.references).toHaveLength(1);
    expect(fs.files["/lib/Work.framecraftlib/sync/applied/ref_hash-a.json"]).toContain('"job_id": "job-a"');
    expect(fs.removed).toContain("/lib/Work.framecraftlib/inbox/job-a.json");
  });

  it("skips a duplicate idempotency key without inserting a duplicate row", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-a.json": JSON.stringify(job),
      "/lib/Work.framecraftlib/sync/applied/ref_hash-a.json": "{}",
    });
    const db = createDb();

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 0, failed: 0, skipped: 1 });
    expect(db.references).toHaveLength(0);
    expect(fs.removed).toContain("/lib/Work.framecraftlib/inbox/job-a.json");
  });

  it("fails result imports when the prompt is missing", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createResultImportJob({
      jobId: "job-r",
      resultId: "result-a",
      promptId: "prompt-1",
      idempotencyKey: "result:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "win", user: "alan" },
      originalExtension: "jpg",
      result: { provider: "midjourney", score_overall: 4 },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-r.json": JSON.stringify(job),
      "/lib/Work.framecraftlib/staging/job-r/original.jpg": new Uint8Array([1]),
      "/lib/Work.framecraftlib/staging/job-r/thumb.jpg": new Uint8Array([2]),
    });
    const db = createDb({ promptExists: false });

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 0, failed: 1, skipped: 0 });
    expect(db.results).toHaveLength(0);
    expect(fs.files["/lib/Work.framecraftlib/sync/failed/job-r.json"]).toContain("Missing prompt: prompt-1");
    expect(fs.removed).toContain("/lib/Work.framecraftlib/inbox/job-r.json");
  });
});
