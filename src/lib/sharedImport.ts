import type { CreateResultInput } from "./db";
import { createResult } from "./db";
import { saveReferenceImage, saveResultImage, thumbnailFromDataUrl } from "./fileStore";
import {
  createTauriSharedIngestFileSystem,
  getLibrarySettingsState,
  type LibrarySettingsState,
} from "./librarySettings";
import { getLibraryLockIdentityNative } from "./libraryLockNative";
import { createReference, type CreateReferenceInput } from "./references";
import {
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
  saveReferenceImage: typeof saveReferenceImage;
  createReference: typeof createReference;
  saveResultImage: typeof saveResultImage;
  createResult: typeof createResult;
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

const defaultDeps: SharedImportDeps = {
  getLibraryState: getLibrarySettingsState,
  getIdentity: async () => getLibraryLockIdentityNative(),
  createFs: createTauriSharedIngestFileSystem,
  publishSharedIngestJob,
  saveReferenceImage,
  createReference,
  saveResultImage,
  createResult,
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

  const saved = await deps.saveReferenceImage(input.referenceId, input.dataUrl);
  const id = await deps.createReference({
    id: input.referenceId,
    ...input.reference,
    file_data: saved.filePath,
    thumbnail_data: saved.thumbPath,
  });
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

  const saved = await deps.saveResultImage(input.resultId, input.dataUrl);
  const id = await deps.createResult({
    id: input.resultId,
    prompt_id: input.promptId,
    file_path: saved.filePath,
    thumbnail_path: saved.thumbPath,
    ...input.result,
  });
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
