import type { Reference } from "@/types";
import type { CreateResultInput } from "./db";
import type { LibraryPaths } from "./libraryConfig";

export interface SharedIngestFileSystem {
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  writeTextFile(path: string, contents: string): Promise<void>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
  readTextFile(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
  renameFile(from: string, to: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}

export interface SharedIngestDb {
  select(sql: string, values?: unknown[]): Promise<unknown[]>;
  execute(sql: string, values: unknown[]): Promise<void>;
}

export interface SharedIngestIdentity {
  machine: string;
  user: string;
}

interface SharedIngestJobBase {
  schema_version: 1;
  job_id: string;
  idempotency_key: string;
  created_at: string;
  created_by: SharedIngestIdentity;
}

export interface ReferenceImportPayload {
  referenceId: string;
  originalStagedPath: string;
  thumbnailStagedPath: string;
  originalExtension: string;
  reference: {
    title: string;
    description?: string;
    kind: Reference["kind"];
    provider?: Reference["provider"];
    category?: Reference["category"];
    source_url?: string;
    tags?: string[];
    rating?: number;
    best_use?: string;
    risk_notes?: string;
    notes?: string;
  };
}

export interface ResultImportPayload {
  resultId: string;
  promptId: string;
  originalStagedPath: string;
  thumbnailStagedPath: string;
  originalExtension: string;
  result: Omit<CreateResultInput, "id" | "prompt_id" | "file_path" | "thumbnail_path">;
}

export interface ProjectResultLinkPayload {
  projectId: string;
  resultId: string;
}

export type ReferenceImportJob = SharedIngestJobBase & {
  kind: "reference.import";
  payload: ReferenceImportPayload;
};

export type ResultImportJob = SharedIngestJobBase & {
  kind: "result.import";
  payload: ResultImportPayload;
};

export type ProjectResultLinkJob = SharedIngestJobBase & {
  kind: "project_result.link";
  payload: ProjectResultLinkPayload;
};

export type SharedIngestJob = ReferenceImportJob | ResultImportJob | ProjectResultLinkJob;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ProcessSharedIngestResult {
  applied: number;
  failed: number;
  skipped: number;
}

export interface SharedIngestStatus {
  pending: number;
  failed: number;
  applied: number;
  lastAppliedAt: string | null;
}

export interface RetryFailedSharedIngestResult {
  retried: number;
  skipped: number;
}

export function createReferenceImportJob(input: {
  jobId: string;
  referenceId: string;
  idempotencyKey: string;
  createdAt: string;
  createdBy: SharedIngestIdentity;
  originalExtension: string;
  reference: ReferenceImportPayload["reference"];
}): ReferenceImportJob {
  const extension = normalizeExtension(input.originalExtension);
  return {
    schema_version: 1,
    kind: "reference.import",
    job_id: input.jobId,
    idempotency_key: input.idempotencyKey,
    created_at: input.createdAt,
    created_by: input.createdBy,
    payload: {
      referenceId: input.referenceId,
      originalExtension: extension,
      originalStagedPath: `${input.jobId}/original.${extension}`,
      thumbnailStagedPath: `${input.jobId}/thumb.jpg`,
      reference: input.reference,
    },
  };
}

export function createResultImportJob(input: {
  jobId: string;
  resultId: string;
  promptId: string;
  idempotencyKey: string;
  createdAt: string;
  createdBy: SharedIngestIdentity;
  originalExtension: string;
  result: ResultImportPayload["result"];
}): ResultImportJob {
  const extension = normalizeExtension(input.originalExtension);
  return {
    schema_version: 1,
    kind: "result.import",
    job_id: input.jobId,
    idempotency_key: input.idempotencyKey,
    created_at: input.createdAt,
    created_by: input.createdBy,
    payload: {
      resultId: input.resultId,
      promptId: input.promptId,
      originalExtension: extension,
      originalStagedPath: `${input.jobId}/original.${extension}`,
      thumbnailStagedPath: `${input.jobId}/thumb.jpg`,
      result: input.result,
    },
  };
}

export function createProjectResultLinkJob(input: {
  jobId: string;
  projectId: string;
  resultId: string;
  idempotencyKey: string;
  createdAt: string;
  createdBy: SharedIngestIdentity;
}): ProjectResultLinkJob {
  return {
    schema_version: 1,
    kind: "project_result.link",
    job_id: input.jobId,
    idempotency_key: input.idempotencyKey,
    created_at: input.createdAt,
    created_by: input.createdBy,
    payload: {
      projectId: input.projectId,
      resultId: input.resultId,
    },
  };
}

export function validateSharedIngestJob(job: SharedIngestJob): ValidationResult {
  const errors: string[] = [];
  if (job.schema_version !== 1) errors.push("Unsupported shared ingest schema.");
  if (!job.job_id) errors.push("Missing job id.");
  if (!job.idempotency_key) errors.push("Missing idempotency key.");
  if (job.kind !== "reference.import" && job.kind !== "result.import" && job.kind !== "project_result.link") {
    errors.push("Unsupported shared ingest kind.");
  }
  if (job.kind === "reference.import" || job.kind === "result.import") {
    for (const path of [job.payload.originalStagedPath, job.payload.thumbnailStagedPath]) {
      if (!isSafeRelativePath(path)) errors.push(`Unsafe staged media path: ${path}`);
    }
  }
  if (job.kind === "result.import" && !job.payload.promptId) errors.push("Missing prompt id.");
  if (job.kind === "project_result.link" && !job.payload.projectId) errors.push("Missing project id.");
  if (job.kind === "project_result.link" && !job.payload.resultId) errors.push("Missing result id.");
  return { ok: errors.length === 0, errors };
}

export async function publishSharedIngestJob(input: {
  paths: LibraryPaths;
  fs: SharedIngestFileSystem;
  job: SharedIngestJob;
  originalBytes: Uint8Array;
  thumbnailBytes: Uint8Array;
}): Promise<void> {
  const validation = validateSharedIngestJob(input.job);
  if (!validation.ok) throw new Error(validation.errors.join(", "));

  await input.fs.mkdir(input.paths.inboxDir);
  if (input.job.kind === "reference.import" || input.job.kind === "result.import") {
    await input.fs.mkdir(input.paths.stagingDir);
    await input.fs.mkdir(`${input.paths.stagingDir}${input.job.job_id}/`);
    await input.fs.writeFile(`${input.paths.stagingDir}${input.job.payload.originalStagedPath}`, input.originalBytes);
    await input.fs.writeFile(`${input.paths.stagingDir}${input.job.payload.thumbnailStagedPath}`, input.thumbnailBytes);
  }

  const tempPath = `${input.paths.inboxDir}${input.job.job_id}.tmp`;
  const finalPath = `${input.paths.inboxDir}${input.job.job_id}.json`;
  await input.fs.writeTextFile(tempPath, JSON.stringify(input.job, null, 2));
  await input.fs.renameFile(tempPath, finalPath);
}

export async function processSharedIngestInbox(input: {
  paths: LibraryPaths;
  fs: SharedIngestFileSystem;
  db: SharedIngestDb;
}): Promise<ProcessSharedIngestResult> {
  await input.fs.mkdir(input.paths.inboxDir);
  await input.fs.mkdir(input.paths.stagingDir);
  await ensureSyncDirs(input.paths, input.fs);
  const result: ProcessSharedIngestResult = { applied: 0, failed: 0, skipped: 0 };
  const names = await orderInboxNames(input.paths, input.fs, (await input.fs.readDir(input.paths.inboxDir))
    .filter((name) => name.endsWith(".json"))
    .sort());

  for (const name of names) {
    const inboxPath = `${input.paths.inboxDir}${name}`;
    let rawJob = "";
    try {
      rawJob = await input.fs.readTextFile(inboxPath);
      const job = JSON.parse(rawJob) as SharedIngestJob;
      const validation = validateSharedIngestJob(job);
      if (!validation.ok) throw new Error(validation.errors.join(", "));

	      if (await input.fs.exists(appliedPath(input.paths, job.idempotency_key))) {
	        await input.fs.removeFile(inboxPath);
	        result.skipped += 1;
	        continue;
	      }

	      if (await jobAlreadyExistsInDatabase(input.db, job)) {
	        await writeAppliedMarker(input.paths, input.fs, job);
	        await input.fs.removeFile(inboxPath);
	        result.applied += 1;
	        continue;
	      }

	      await applyJob(input.paths, input.fs, input.db, job);
	      await writeAppliedMarker(input.paths, input.fs, job);
	      await input.fs.removeFile(inboxPath);
	      result.applied += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Shared ingest job failed.";
      await input.fs.writeTextFile(`${input.paths.failedDir}${name}`, JSON.stringify({ reason, source: inboxPath, job: rawJob }, null, 2));
      await input.fs.removeFile(inboxPath);
      result.failed += 1;
    }
  }

  return result;
}

export async function getSharedIngestStatus(input: {
  paths: LibraryPaths;
  fs: SharedIngestFileSystem;
}): Promise<SharedIngestStatus> {
  await input.fs.mkdir(input.paths.inboxDir);
  await ensureSyncDirs(input.paths, input.fs);
  const pending = (await safeReadJsonNames(input.fs, input.paths.inboxDir)).length;
  const failed = (await safeReadJsonNames(input.fs, input.paths.failedDir)).length;
  const appliedNames = await safeReadJsonNames(input.fs, input.paths.appliedDir);
  const appliedTimes = await Promise.all(appliedNames.map(async (name) => {
    try {
      const raw = await input.fs.readTextFile(`${input.paths.appliedDir}${name}`);
      const parsed = JSON.parse(raw) as { applied_at?: unknown };
      return typeof parsed.applied_at === "string" ? parsed.applied_at : null;
    } catch {
      return null;
    }
  }));
  const sortedAppliedTimes = appliedTimes
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastAppliedAt = sortedAppliedTimes.length ? sortedAppliedTimes[sortedAppliedTimes.length - 1] : null;
  return { pending, failed, applied: appliedNames.length, lastAppliedAt };
}

export async function retryFailedSharedIngestJobs(input: {
  paths: LibraryPaths;
  fs: SharedIngestFileSystem;
}): Promise<RetryFailedSharedIngestResult> {
  await input.fs.mkdir(input.paths.inboxDir);
  await ensureSyncDirs(input.paths, input.fs);
  const names = await safeReadJsonNames(input.fs, input.paths.failedDir);
  const result: RetryFailedSharedIngestResult = { retried: 0, skipped: 0 };

  for (const name of names) {
    const failedPath = `${input.paths.failedDir}${name}`;
    try {
      const raw = await input.fs.readTextFile(failedPath);
      const failed = JSON.parse(raw) as { job?: unknown };
      const jobRaw = typeof failed.job === "string" ? failed.job : JSON.stringify(failed.job);
      if (!jobRaw) {
        result.skipped += 1;
        continue;
      }
      const job = JSON.parse(jobRaw) as SharedIngestJob;
      const validation = validateSharedIngestJob(job);
      if (!validation.ok) {
        result.skipped += 1;
        continue;
      }
      const inboxPath = `${input.paths.inboxDir}${job.job_id}.json`;
      if (await input.fs.exists(inboxPath)) {
        result.skipped += 1;
        continue;
      }
      await input.fs.writeTextFile(inboxPath, jobRaw);
      await input.fs.removeFile(failedPath);
      result.retried += 1;
    } catch {
      result.skipped += 1;
    }
  }

  return result;
}

async function safeReadJsonNames(fs: SharedIngestFileSystem, path: string): Promise<string[]> {
  try {
    return (await fs.readDir(path)).filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

async function orderInboxNames(paths: LibraryPaths, fs: SharedIngestFileSystem, names: string[]): Promise<string[]> {
  const weighted = await Promise.all(names.map(async (name) => {
    try {
      const raw = await fs.readTextFile(`${paths.inboxDir}${name}`);
      const job = JSON.parse(raw) as SharedIngestJob;
      return { name, weight: job.kind === "project_result.link" ? 1 : 0 };
    } catch {
      return { name, weight: 0 };
    }
  }));
  return weighted
    .sort((a, b) => a.weight - b.weight || a.name.localeCompare(b.name))
    .map((item) => item.name);
}

async function applyJob(paths: LibraryPaths, fs: SharedIngestFileSystem, db: SharedIngestDb, job: SharedIngestJob): Promise<void> {
  if (job.kind === "project_result.link") {
    await insertProjectResultLink(db, job);
    return;
  }

  const originalPath = `${paths.stagingDir}${job.payload.originalStagedPath}`;
  const thumbnailPath = `${paths.stagingDir}${job.payload.thumbnailStagedPath}`;
  if (!(await fs.exists(originalPath))) throw new Error(`Missing staged media: ${job.payload.originalStagedPath}`);
  if (!(await fs.exists(thumbnailPath))) throw new Error(`Missing staged media: ${job.payload.thumbnailStagedPath}`);

  if (job.kind === "reference.import") {
    const filePath = `${paths.referencesDir}${job.payload.referenceId}.${job.payload.originalExtension}`;
    const thumbPath = `${paths.referencesDir}${job.payload.referenceId}_thumb.jpg`;
    await fs.mkdir(paths.referencesDir);
    await fs.copyFile(originalPath, filePath);
    await fs.copyFile(thumbnailPath, thumbPath);
    await insertReference(db, job, filePath, thumbPath);
    return;
  }

  const promptRows = await db.select("SELECT id FROM prompts WHERE id = $1 LIMIT 1", [job.payload.promptId]);
  if (promptRows.length === 0) throw new Error(`Missing prompt: ${job.payload.promptId}`);
  const filePath = `${paths.resultsDir}${job.payload.resultId}.${job.payload.originalExtension}`;
  const thumbPath = `${paths.resultsDir}${job.payload.resultId}_thumb.jpg`;
  await fs.mkdir(paths.resultsDir);
  await fs.copyFile(originalPath, filePath);
  await fs.copyFile(thumbnailPath, thumbPath);
  await insertResult(db, job, filePath, thumbPath);
}

async function jobAlreadyExistsInDatabase(db: SharedIngestDb, job: SharedIngestJob): Promise<boolean> {
  if (job.kind === "reference.import") {
    const rows = await db.select('SELECT id FROM "references" WHERE id = $1 LIMIT 1', [job.payload.referenceId]);
    return rows.length > 0;
  }
  if (job.kind === "result.import") {
    const rows = await db.select("SELECT id FROM results WHERE id = $1 LIMIT 1", [job.payload.resultId]);
    return rows.length > 0;
  }
  const rows = await db.select(
    "SELECT result_id FROM project_results WHERE project_id = $1 AND result_id = $2 LIMIT 1",
    [job.payload.projectId, job.payload.resultId]
  );
  return rows.length > 0;
}

async function writeAppliedMarker(paths: LibraryPaths, fs: SharedIngestFileSystem, job: SharedIngestJob): Promise<void> {
  await fs.writeTextFile(appliedPath(paths, job.idempotency_key), JSON.stringify({
    job_id: job.job_id,
    idempotency_key: job.idempotency_key,
    applied_at: new Date().toISOString(),
  }, null, 2));
}

async function insertProjectResultLink(db: SharedIngestDb, job: ProjectResultLinkJob): Promise<void> {
  const projectRows = await db.select("SELECT id FROM projects WHERE id = $1 LIMIT 1", [job.payload.projectId]);
  if (projectRows.length === 0) throw new Error(`Missing project: ${job.payload.projectId}`);
  const resultRows = await db.select("SELECT id FROM results WHERE id = $1 LIMIT 1", [job.payload.resultId]);
  if (resultRows.length === 0) throw new Error(`Missing result: ${job.payload.resultId}`);
  await db.execute(
    "INSERT OR IGNORE INTO project_results (project_id, result_id) VALUES ($1, $2)",
    [job.payload.projectId, job.payload.resultId]
  );
}

async function insertReference(db: SharedIngestDb, job: ReferenceImportJob, filePath: string, thumbPath: string): Promise<void> {
  const ref = job.payload.reference;
  await db.execute(
    `INSERT INTO "references"
      (id, title, description, kind, file_data, thumbnail_data,
       provider, category, source_url, tags, rating,
       best_use, risk_notes, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      job.payload.referenceId,
      ref.title,
      ref.description ?? null,
      ref.kind,
      filePath,
      thumbPath,
      ref.provider ?? null,
      ref.category ?? null,
      ref.source_url ?? null,
      ref.tags ? JSON.stringify(ref.tags) : null,
      ref.rating ?? 0,
      ref.best_use ?? null,
      ref.risk_notes ?? null,
      ref.notes ?? null,
      job.created_at,
      job.created_at,
    ]
  );
}

async function insertResult(db: SharedIngestDb, job: ResultImportJob, filePath: string, thumbPath: string): Promise<void> {
  const result = job.payload.result;
  await db.execute(
    `INSERT INTO results
      (id, prompt_id, file_path, thumbnail_path, provider,
       score_overall, score_realism, score_brand_fit, score_composition,
       score_lighting, score_ai_risk, reuse_potential,
       is_winner, is_failed, artifacts, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      job.payload.resultId,
      job.payload.promptId,
      filePath,
      thumbPath,
      result.provider ?? null,
      result.score_overall ?? 0,
      result.score_realism ?? 0,
      result.score_brand_fit ?? 0,
      result.score_composition ?? 0,
      result.score_lighting ?? 0,
      result.score_ai_risk ?? 0,
      result.reuse_potential ?? 0,
      result.is_winner ? 1 : 0,
      result.is_failed ? 1 : 0,
      result.artifacts ? JSON.stringify(result.artifacts) : null,
      result.notes ?? null,
    ]
  );
}

async function ensureSyncDirs(paths: LibraryPaths, fs: SharedIngestFileSystem): Promise<void> {
  await fs.mkdir(paths.syncDir);
  await fs.mkdir(paths.appliedDir);
  await fs.mkdir(paths.failedDir);
}

function appliedPath(paths: LibraryPaths, idempotencyKey: string): string {
  return `${paths.appliedDir}${safeKey(idempotencyKey)}.json`;
}

function safeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeExtension(extension: string): string {
  return extension.replace(/^\./, "").toLowerCase() || "jpg";
}

function isSafeRelativePath(path: string): boolean {
  if (!path || path.includes("\\") || path.startsWith("/") || path.startsWith("~")) return false;
  return path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}
