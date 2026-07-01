import type { CreateResultInput } from "./db";
import { createResult, deleteResult } from "./db";
import {
  cleanupStagedMedia,
  publishStagedMedia,
  removeManagedPaths,
  stageManagedImage,
  thumbnailFromDataUrl,
} from "./fileStore";
import {
  createTauriSharedIngestFileSystem,
  getLibrarySettingsState,
  type LibrarySettingsState,
} from "./librarySettings";
import { getLibraryLockIdentityNative } from "./libraryLockNative";
import { addResultToProject, removeResultFromProject } from "./projects";
import { createReference, deleteReference, type CreateReferenceInput } from "./references";
import {
  createProjectResultLinkJob,
  createReferenceImportJob,
  createResultImportJob,
  publishSharedIngestJob,
  type SharedIngestFileSystem,
  type SharedIngestIdentity,
  type SharedIngestJob,
} from "./sharedIngest";

export interface SharedImportResult {
  id: string;
  queued: boolean;
}

export interface SharedImportDeps {
  getLibraryState: () => Promise<LibrarySettingsState>;
  getIdentity: () => Promise<SharedIngestIdentity>;
  createFs: () => Promise<SharedIngestFileSystem>;
  publishSharedIngestJob: typeof publishSharedIngestJob;
  stageManagedImage: typeof stageManagedImage;
  publishStagedMedia: typeof publishStagedMedia;
  cleanupStagedMedia: typeof cleanupStagedMedia;
  removeManagedPaths: typeof removeManagedPaths;
  createReference: typeof createReference;
  deleteReference: typeof deleteReference;
  createResult: typeof createResult;
  deleteResult: typeof deleteResult;
  addResultToProject: typeof addResultToProject;
  removeResultFromProject: typeof removeResultFromProject;
  thumbnailFromDataUrl: typeof thumbnailFromDataUrl;
  generateId: () => string;
  now: () => string;
}

export interface ImportReferenceImageInput {
  referenceId: string;
  dataUrl: string;
  originalName?: string;
  reference: Omit<CreateReferenceInput, "id" | "file_data" | "thumbnail_data">;
}

export interface ImportResultImageInput {
  resultId: string;
  promptId: string;
  dataUrl: string;
  originalName?: string;
  result: Omit<CreateResultInput, "id" | "prompt_id" | "file_path" | "thumbnail_path">;
}

export interface ImportProjectResultImageInput extends ImportResultImageInput {
  projectId: string;
}

const defaultDeps: SharedImportDeps = {
  getLibraryState: getLibrarySettingsState,
  getIdentity: async () => getLibraryLockIdentityNative(),
  createFs: createTauriSharedIngestFileSystem,
  publishSharedIngestJob,
  stageManagedImage,
  publishStagedMedia,
  cleanupStagedMedia,
  removeManagedPaths,
  createReference,
  deleteReference,
  createResult,
  deleteResult,
  addResultToProject,
  removeResultFromProject,
  thumbnailFromDataUrl,
  generateId: () => crypto.randomUUID().replace(/-/g, ""),
  now: () => new Date().toISOString(),
};

export async function importReferenceImage(
  input: ImportReferenceImageInput,
  deps: SharedImportDeps = defaultDeps
): Promise<SharedImportResult> {
  const state = await deps.getLibraryState();
  assertPortableLibraryReady(state);
  if (canQueueSharedIngest(state)) {
    const jobId = deps.generateId();
    const job = createReferenceImportJob({
      jobId,
      referenceId: input.referenceId,
      idempotencyKey: `reference:${input.referenceId}`,
      createdAt: deps.now(),
      createdBy: await deps.getIdentity(),
      originalExtension: extensionFromNameOrDataUrl(input.originalName, input.dataUrl),
      reference: input.reference,
    });
    await publishJob(input.dataUrl, job, state, deps);
    return { id: input.referenceId, queued: true };
  }

  const staged = await deps.stageManagedImage("reference", input.referenceId, input.dataUrl);
  let id: string;
  try {
    id = await deps.createReference({
      id: input.referenceId,
      ...input.reference,
      file_data: staged.originalFinal,
      thumbnail_data: staged.thumbnailFinal,
    });
  } catch (err) {
    await deps.cleanupStagedMedia(staged);
    throw err;
  }
  try {
    await deps.publishStagedMedia(staged);
  } catch (err) {
    await deps.deleteReference(id);
    await deps.removeManagedPaths([staged.originalTemp, staged.thumbnailTemp, staged.originalFinal, staged.thumbnailFinal]);
    throw err;
  }
  return { id, queued: false };
}

export async function importResultImage(
  input: ImportResultImageInput,
  deps: SharedImportDeps = defaultDeps
): Promise<SharedImportResult> {
  const state = await deps.getLibraryState();
  assertPortableLibraryReady(state);
  if (canQueueSharedIngest(state)) {
    const jobId = deps.generateId();
    const job = createResultImportJob({
      jobId,
      resultId: input.resultId,
      promptId: input.promptId,
      idempotencyKey: `result:${input.resultId}`,
      createdAt: deps.now(),
      createdBy: await deps.getIdentity(),
      originalExtension: extensionFromNameOrDataUrl(input.originalName, input.dataUrl),
      result: input.result,
    });
    await publishJob(input.dataUrl, job, state, deps);
    return { id: input.resultId, queued: true };
  }

  const staged = await deps.stageManagedImage("result", input.resultId, input.dataUrl);
  let id: string;
  try {
    id = await deps.createResult({
      id: input.resultId,
      prompt_id: input.promptId,
      file_path: staged.originalFinal,
      thumbnail_path: staged.thumbnailFinal,
      ...input.result,
    });
  } catch (err) {
    await deps.cleanupStagedMedia(staged);
    throw err;
  }
  try {
    await deps.publishStagedMedia(staged);
  } catch (err) {
    await deps.deleteResult(id);
    await deps.removeManagedPaths([staged.originalTemp, staged.thumbnailTemp, staged.originalFinal, staged.thumbnailFinal]);
    throw err;
  }
  return { id, queued: false };
}

export async function importProjectResultImage(
  input: ImportProjectResultImageInput,
  deps: SharedImportDeps = defaultDeps
): Promise<SharedImportResult> {
  const state = await deps.getLibraryState();
  assertPortableLibraryReady(state);
  if (canQueueSharedIngest(state)) {
    const identity = await deps.getIdentity();
    const createdAt = deps.now();
    const resultJobId = deps.generateId();
    const resultJob = createResultImportJob({
      jobId: resultJobId,
      resultId: input.resultId,
      promptId: input.promptId,
      idempotencyKey: `result:${input.resultId}`,
      createdAt,
      createdBy: identity,
      originalExtension: extensionFromNameOrDataUrl(input.originalName, input.dataUrl),
      result: input.result,
    });
    await publishJob(input.dataUrl, resultJob, state, deps);

    const linkJobId = deps.generateId();
    const linkJob = createProjectResultLinkJob({
      jobId: linkJobId,
      projectId: input.projectId,
      resultId: input.resultId,
      idempotencyKey: `project-result:${input.projectId}:${input.resultId}`,
      createdAt,
      createdBy: identity,
    });
    await deps.publishSharedIngestJob({
      paths: state.paths,
      fs: await deps.createFs(),
      job: linkJob,
      originalBytes: new Uint8Array(),
      thumbnailBytes: new Uint8Array(),
    });
    return { id: input.resultId, queued: true };
  }

  const staged = await deps.stageManagedImage("result", input.resultId, input.dataUrl);
  let id: string;
  try {
    id = await deps.createResult({
      id: input.resultId,
      prompt_id: input.promptId,
      file_path: staged.originalFinal,
      thumbnail_path: staged.thumbnailFinal,
      ...input.result,
    });
  } catch (err) {
    await deps.cleanupStagedMedia(staged);
    throw err;
  }
  try {
    await deps.addResultToProject(input.projectId, id);
  } catch (err) {
    await deps.deleteResult(id);
    await deps.cleanupStagedMedia(staged);
    throw err;
  }
  try {
    await deps.publishStagedMedia(staged);
  } catch (err) {
    await deps.removeResultFromProject(input.projectId, id);
    await deps.deleteResult(id);
    await deps.removeManagedPaths([staged.originalTemp, staged.thumbnailTemp, staged.originalFinal, staged.thumbnailFinal]);
    throw err;
  }
  return { id, queued: false };
}

function canQueueSharedIngest(state: LibrarySettingsState): boolean {
  return state.nativeAvailable && state.selection.mode === "portable" && (!state.validation || state.validation.ok);
}

function assertPortableLibraryReady(state: LibrarySettingsState): void {
  if (state.selection.mode !== "portable") return;
  if (!state.nativeAvailable) throw new Error("Shared library imports require the native app.");
  if (state.validation && !state.validation.ok) {
    throw new Error(`Repair the active library before importing: ${state.validation.errors.join(", ")}`);
  }
}

async function publishJob(
  dataUrl: string,
  job: SharedIngestJob,
  state: LibrarySettingsState,
  deps: SharedImportDeps
): Promise<void> {
  const thumbnail = await deps.thumbnailFromDataUrl(dataUrl, 320);
  await deps.publishSharedIngestJob({
    paths: state.paths,
    fs: await deps.createFs(),
    job,
    originalBytes: dataUrlToBytes(dataUrl),
    thumbnailBytes: dataUrlToBytes(thumbnail),
  });
}

function extensionFromNameOrDataUrl(name: string | undefined, dataUrl: string): string {
  const fromName = name?.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  return "jpg";
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
