import { describe, expect, it, vi } from "vitest";
import { resolveLibraryPaths } from "./libraryConfig";
import {
  createProjectResultLinkJob,
  createReferenceImportJob,
  createResultImportJob,
  getSharedIngestStatus,
  processSharedIngestInbox,
  publishSharedIngestJob,
  retryFailedSharedIngestJobs,
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

function createDb(options: { promptExists?: boolean; projectExists?: boolean; resultExists?: boolean; referenceExists?: boolean; projectResultExists?: boolean } = {}): SharedIngestDb & {
  references: unknown[][];
  results: unknown[][];
  projectResults: unknown[][];
} {
  return {
    references: [],
    results: [],
    projectResults: [],
	    select: vi.fn(async (sql: string) => {
	      if (sql.includes("FROM prompts")) return options.promptExists ? [{ id: "prompt-1" }] : [];
	      if (sql.includes("FROM projects")) return options.projectExists ? [{ id: "project-1" }] : [];
	      if (sql.includes('FROM "references"')) return options.referenceExists ? [{ id: "ref-a" }] : [];
	      if (sql.includes("FROM project_results")) return options.projectResultExists ? [{ id: "result-a" }] : [];
	      if (sql.includes("FROM results")) return options.resultExists ? [{ id: "result-a" }] : [];
	      return [];
	    }),
    execute: vi.fn(async function (this: SharedIngestDb & { references: unknown[][]; results: unknown[][]; projectResults: unknown[][] }, sql: string, values: unknown[]) {
      if (sql.includes('INTO "references"')) this.references.push(values);
      if (sql.includes("INTO results")) this.results.push(values);
      if (sql.includes("INTO project_results")) this.projectResults.push(values);
    }),
  };
}

async function expectedAppliedMarkerPath(appliedDir: string, idempotencyKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(idempotencyKey));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${appliedDir}${hex}.json`;
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

  it("accepts exactly 128-character ids and normalizes uppercase dotted extensions", () => {
    const safeId = "a".repeat(128);
    const job = createReferenceImportJob({
      jobId: safeId,
      referenceId: safeId,
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: ".PNG",
      reference: { title: "Mood", kind: "image" },
    });

    expect(job.payload.originalExtension).toBe("png");
    expect(validateSharedIngestJob(job)).toEqual({ ok: true, errors: [] });
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

  it.each(["../escape", "nested/id", "nested\\id", "", "a".repeat(129)])(
    "rejects unsafe job ids: %s",
    (jobId) => {
      const job = createReferenceImportJob({
        jobId,
        referenceId: "ref-a",
        idempotencyKey: "ref:hash-a",
        createdAt: "2026-06-25T10:00:00.000Z",
        createdBy: { machine: "mac", user: "alan" },
        originalExtension: "png",
        reference: { title: "Mood", kind: "image" },
      });

      expect(validateSharedIngestJob(job).ok).toBe(false);
    }
  );

  it.each(["../escape", "nested/id", "nested\\id", "", "a".repeat(129)])(
    "rejects unsafe reference ids: %s",
    (referenceId) => {
      const job = createReferenceImportJob({
        jobId: "job-a",
        referenceId,
        idempotencyKey: "ref:hash-a",
        createdAt: "2026-06-25T10:00:00.000Z",
        createdBy: { machine: "mac", user: "alan" },
        originalExtension: "png",
        reference: { title: "Mood", kind: "image" },
      });

      expect(validateSharedIngestJob(job).ok).toBe(false);
    }
  );

  it.each(["../escape", "nested/id", "nested\\id", "", "a".repeat(129)])(
    "rejects unsafe result ids: %s",
    (resultId) => {
      const job = createResultImportJob({
        jobId: "job-a",
        resultId,
        promptId: "prompt-1",
        idempotencyKey: "result:hash-a",
        createdAt: "2026-06-25T10:00:00.000Z",
        createdBy: { machine: "mac", user: "alan" },
        originalExtension: "png",
        result: { provider: "midjourney" },
      });

      expect(validateSharedIngestJob(job).ok).toBe(false);
    }
  );

  it.each(["../../db", "exe", "nested/png", "nested\\png", ""])(
    "rejects unsafe original extensions: %s",
    (originalExtension) => {
      const job = createReferenceImportJob({
        jobId: "job-a",
        referenceId: "ref-a",
        idempotencyKey: "ref:hash-a",
        createdAt: "2026-06-25T10:00:00.000Z",
        createdBy: { machine: "mac", user: "alan" },
        originalExtension: "png",
        reference: { title: "Mood", kind: "image" },
      });
      job.payload.originalExtension = originalExtension;
      job.payload.originalStagedPath = `job-a/original.${originalExtension}`;

      expect(validateSharedIngestJob(job).ok).toBe(false);
    }
  );

  it.each([
    ["original", "other-job/original.png", "job-a/thumb.jpg"],
    ["thumbnail", "job-a/original.png", "job-a/other.jpg"],
  ])("requires the canonical %s staged path", (_kind, originalStagedPath, thumbnailStagedPath) => {
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });
    job.payload.originalStagedPath = originalStagedPath;
    job.payload.thumbnailStagedPath = thumbnailStagedPath;

    expect(validateSharedIngestJob(job).ok).toBe(false);
  });

  it("rejects an unsafe result id in a project result link", () => {
    const job = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "../result",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });

    expect(validateSharedIngestJob(job).ok).toBe(false);
  });

  it.each([
    ["promptId", "../prompt"],
    ["projectId", "project/id"],
  ] as const)("rejects unsafe DB identity %s", (field, unsafeId) => {
    const job = field === "promptId"
      ? createResultImportJob({
          jobId: "job-a",
          resultId: "result-a",
          promptId: unsafeId,
          idempotencyKey: "result:hash-a",
          createdAt: "2026-06-25T10:00:00.000Z",
          createdBy: { machine: "mac", user: "alan" },
          originalExtension: "png",
          result: { provider: "midjourney" },
        })
      : createProjectResultLinkJob({
          jobId: "job-a",
          projectId: unsafeId,
          resultId: "result-a",
          idempotencyKey: "project-result:project-a:result-a",
          createdAt: "2026-06-25T10:00:00.000Z",
          createdBy: { machine: "mac", user: "alan" },
        });

    expect(validateSharedIngestJob(job).ok).toBe(false);
  });

  it("rejects an invalid publish before filesystem I/O", async () => {
    const paths = resolveLibraryPaths("/Volumes/NAS/Work.framecraftlib");
    const fs = createFs();
    const job = createReferenceImportJob({
      jobId: "../escape",
      referenceId: "ref-a",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });

    await expect(publishSharedIngestJob({
      paths,
      fs,
      job,
      originalBytes: new Uint8Array([1]),
      thumbnailBytes: new Uint8Array([2]),
    })).rejects.toThrow();

    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.writeTextFile).not.toHaveBeenCalled();
    expect(fs.renameFile).not.toHaveBeenCalled();
  });

  it("does not copy media or query the database for an invalid inbox job", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createReferenceImportJob({
      jobId: "job-a",
      referenceId: "../escape",
      idempotencyKey: "ref:hash-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      reference: { title: "Mood", kind: "image" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-a.json": JSON.stringify(job),
      "/lib/Work.framecraftlib/staging/job-a/original.png": new Uint8Array([1]),
      "/lib/Work.framecraftlib/staging/job-a/thumb.jpg": new Uint8Array([2]),
    });
    const db = createDb();

    await expect(processSharedIngestInbox({ paths, fs, db })).resolves.toEqual({
      applied: 0,
      failed: 1,
      skipped: 0,
    });
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
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
    const markerPath = await expectedAppliedMarkerPath(paths.appliedDir, job.idempotency_key);

    expect(result).toEqual({ applied: 1, failed: 0, skipped: 0 });
    expect(fs.copies).toContainEqual([
      "/lib/Work.framecraftlib/staging/job-a/original.png",
      "/lib/Work.framecraftlib/references/ref-a.png",
    ]);
    expect(db.references).toHaveLength(1);
    expect(fs.files[markerPath]).toContain('"job_id": "job-a"');
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
    const markerPath = await expectedAppliedMarkerPath(paths.appliedDir, job.idempotency_key);
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-a.json": JSON.stringify(job),
      [markerPath]: "{}",
    });
    const db = createDb();

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 0, failed: 0, skipped: 1 });
    expect(db.references).toHaveLength(0);
    expect(fs.removed).toContain("/lib/Work.framecraftlib/inbox/job-a.json");
  });

  it("marks a job applied when its database row already exists but the applied marker is missing", async () => {
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
    });
    const db = createDb({ referenceExists: true });

    const result = await processSharedIngestInbox({ paths, fs, db });
    const markerPath = await expectedAppliedMarkerPath(paths.appliedDir, job.idempotency_key);

    expect(result).toEqual({ applied: 1, failed: 0, skipped: 0 });
    expect(db.references).toHaveLength(0);
    expect(fs.files[markerPath]).toContain('"job_id": "job-a"');
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

  it("creates and validates a project result link job", () => {
    const job = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "result-a",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });

    expect(job.kind).toBe("project_result.link");
    expect(validateSharedIngestJob(job)).toEqual({ ok: true, errors: [] });
  });

  it("merges a project result link when project and result exist", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "result-a",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-link.json": JSON.stringify(job),
    });
    const db = createDb({ projectExists: true, resultExists: true });

    const result = await processSharedIngestInbox({ paths, fs, db });
    const markerPath = await expectedAppliedMarkerPath(paths.appliedDir, job.idempotency_key);

    expect(result).toEqual({ applied: 1, failed: 0, skipped: 0 });
    expect(db.projectResults).toEqual([["project-1", "result-a"]]);
    expect(fs.files[markerPath]).toContain('"job_id": "job-link"');
  });

  it("uses distinct applied markers for idempotency keys that sanitize identically", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const firstJob = createProjectResultLinkJob({
      jobId: "job-link-a",
      projectId: "project-a",
      resultId: "result-a",
      idempotencyKey: "project-result:a_b:c",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const secondJob = createProjectResultLinkJob({
      jobId: "job-link-b",
      projectId: "project-a",
      resultId: "result-b",
      idempotencyKey: "project-result:a:b_c",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-link-a.json": JSON.stringify(firstJob),
      "/lib/Work.framecraftlib/inbox/job-link-b.json": JSON.stringify(secondJob),
    });
    const db = createDb({ projectExists: true, resultExists: true });

    await expect(processSharedIngestInbox({ paths, fs, db })).resolves.toEqual({
      applied: 2,
      failed: 0,
      skipped: 0,
    });
    const markers = Object.keys(fs.files).filter((path) => path.startsWith(paths.appliedDir));
    expect(markers).toHaveLength(2);
    expect(new Set(markers).size).toBe(2);
  });

  it("uses a bounded applied marker filename for a very long idempotency key", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-a",
      resultId: "result-a",
      idempotencyKey: `project-result:${"a".repeat(10_000)}`,
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-link.json": JSON.stringify(job),
    });
    const db = createDb({ projectExists: true, resultExists: true });

    await expect(processSharedIngestInbox({ paths, fs, db })).resolves.toEqual({
      applied: 1,
      failed: 0,
      skipped: 0,
    });
    const marker = Object.keys(fs.files).find((path) => path.startsWith(paths.appliedDir));
    const filename = marker?.slice(paths.appliedDir.length);
    expect(filename).toMatch(/^[a-f0-9]{64}\.json$/);
  });

  it("fails a project result link when the result does not exist yet", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const job = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "result-a",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-link.json": JSON.stringify(job),
    });
    const db = createDb({ projectExists: true, resultExists: false });

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 0, failed: 1, skipped: 0 });
    expect(fs.files["/lib/Work.framecraftlib/sync/failed/job-link.json"]).toContain("Missing result: result-a");
  });

  it("processes result imports before project links from the same inbox batch", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const resultJob = createResultImportJob({
      jobId: "job-result",
      resultId: "result-a",
      promptId: "prompt-1",
      idempotencyKey: "result:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
      originalExtension: "png",
      result: { provider: "midjourney" },
    });
    const linkJob = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "result-a",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/job-link.json": JSON.stringify(linkJob),
      "/lib/Work.framecraftlib/inbox/job-result.json": JSON.stringify(resultJob),
      "/lib/Work.framecraftlib/staging/job-result/original.png": new Uint8Array([1]),
      "/lib/Work.framecraftlib/staging/job-result/thumb.jpg": new Uint8Array([2]),
    });
    const db = createDb({ promptExists: true, projectExists: true, resultExists: false });
    db.execute = vi.fn(async function (this: typeof db, sql: string, values: unknown[]) {
      if (sql.includes("INTO results")) this.results.push(values);
      if (sql.includes("INTO project_results")) this.projectResults.push(values);
    });
    db.select = vi.fn(async (sql: string) => {
      if (sql.includes("FROM prompts")) return [{ id: "prompt-1" }];
      if (sql.includes("FROM projects")) return [{ id: "project-1" }];
      if (sql.includes("FROM results")) return db.results.length ? [{ id: "result-a" }] : [];
      return [];
    });

    const result = await processSharedIngestInbox({ paths, fs, db });

    expect(result).toEqual({ applied: 2, failed: 0, skipped: 0 });
    expect(db.results).toHaveLength(1);
    expect(db.projectResults).toEqual([["project-1", "result-a"]]);
  });

  it("reports pending failed applied counts and last applied time", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const fs = createFs({
      "/lib/Work.framecraftlib/inbox/a.json": "{}",
      "/lib/Work.framecraftlib/inbox/b.json": "{}",
      "/lib/Work.framecraftlib/sync/failed/c.json": "{}",
      "/lib/Work.framecraftlib/sync/applied/a.json": JSON.stringify({ applied_at: "2026-06-25T10:00:00.000Z" }),
      "/lib/Work.framecraftlib/sync/applied/b.json": JSON.stringify({ applied_at: "2026-06-25T11:00:00.000Z" }),
    });

    await expect(getSharedIngestStatus({ paths, fs })).resolves.toEqual({
      pending: 2,
      failed: 1,
      applied: 2,
      lastAppliedAt: "2026-06-25T11:00:00.000Z",
    });
  });

  it("retries failed jobs by restoring their original job into inbox", async () => {
    const paths = resolveLibraryPaths("/lib/Work.framecraftlib");
    const originalJob = createProjectResultLinkJob({
      jobId: "job-link",
      projectId: "project-1",
      resultId: "result-a",
      idempotencyKey: "project-result:project-1:result-a",
      createdAt: "2026-06-25T10:00:00.000Z",
      createdBy: { machine: "mac", user: "alan" },
    });
    const fs = createFs({
      "/lib/Work.framecraftlib/sync/failed/job-link.json": JSON.stringify({
        reason: "Missing result: result-a",
        source: "/lib/Work.framecraftlib/inbox/job-link.json",
        job: JSON.stringify(originalJob),
      }),
    });

    const result = await retryFailedSharedIngestJobs({ paths, fs });

    expect(result).toEqual({ retried: 1, skipped: 0 });
    expect(fs.files["/lib/Work.framecraftlib/inbox/job-link.json"]).toBe(JSON.stringify(originalJob));
    expect(fs.removed).toContain("/lib/Work.framecraftlib/sync/failed/job-link.json");
  });
});
