import { createResult, type CreateResultInput } from "./db";
import { saveResultImage } from "./fileStore";
import { addResultToProject } from "./projects";
import { updateQueueStatus, type QueueItem, type QueueStatus } from "./queue";

export interface ImportFileLike {
  name: string;
}

export interface QueueImportMatch<TFile extends ImportFileLike = ImportFileLike> {
  item: QueueItem;
  file: TFile;
}

export interface QueueImportDeps {
  generateId: () => string;
  saveResultImage: (resultId: string, dataUrl: string) => Promise<{ filePath: string; thumbPath: string }>;
  createResult: (data: CreateResultInput) => Promise<string>;
  addResultToProject: (projectId: string, resultId: string) => Promise<void>;
  updateQueueStatus: (id: string, status: QueueStatus) => Promise<void>;
}

const IMPORTABLE_STATUSES: QueueStatus[] = ["pending", "sent", "failed"];

const defaultDeps: QueueImportDeps = {
  generateId: () => crypto.randomUUID().replace(/-/g, ""),
  saveResultImage,
  createResult,
  addResultToProject,
  updateQueueStatus,
};

export function normalizeImportName(value: string): string {
  return value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function titleNeedle(item: QueueItem): string | undefined {
  const title = item.prompt_title?.trim();
  if (!title) return undefined;
  const normalized = normalizeImportName(title);
  return normalized.length >= 6 ? normalized : undefined;
}

export function findQueueItemForFile(fileName: string, items: QueueItem[]): QueueItem | undefined {
  const normalizedFile = normalizeImportName(fileName);
  const lowerFile = fileName.toLowerCase();
  return items.find((item) => {
    if (!IMPORTABLE_STATUSES.includes(item.status)) return false;
    const promptId = item.prompt_id.toLowerCase();
    if (promptId && lowerFile.includes(promptId)) return true;
    const needle = titleNeedle(item);
    return Boolean(needle && normalizedFile.includes(needle));
  });
}

export function matchQueueFiles<TFile extends ImportFileLike>(
  items: QueueItem[],
  files: TFile[]
): { matched: QueueImportMatch<TFile>[]; unmatched: TFile[] } {
  const available = [...items];
  const matched: QueueImportMatch<TFile>[] = [];
  const unmatched: TFile[] = [];

  for (const file of files) {
    const item = findQueueItemForFile(file.name, available);
    if (!item) {
      unmatched.push(file);
      continue;
    }
    matched.push({ item, file });
    available.splice(available.indexOf(item), 1);
  }

  return { matched, unmatched };
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function importQueueResult(
  item: QueueItem,
  dataUrl: string,
  deps: QueueImportDeps = defaultDeps
): Promise<string> {
  const resultId = deps.generateId();

  try {
    const paths = await deps.saveResultImage(resultId, dataUrl);
    await deps.createResult({
      id: resultId,
      prompt_id: item.prompt_id,
      file_path: paths.filePath,
      thumbnail_path: paths.thumbPath,
      provider: item.provider,
      notes: "Imported from generation queue",
    });
    if (item.project_id) await deps.addResultToProject(item.project_id, resultId);
    await deps.updateQueueStatus(item.id, "done");
    return resultId;
  } catch (error) {
    await deps.updateQueueStatus(item.id, "failed");
    throw error;
  }
}
