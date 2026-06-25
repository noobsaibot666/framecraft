import { normalizeDir } from "./libraryConfig";

export const ACTIVE_LIBRARY_LOCK = "locks/active.lock";
export const LIBRARY_LOCK_STALE_MS = 5 * 60 * 1000;

export interface LibraryLockInfo {
  session_id: string;
  machine: string;
  user: string;
  updated_at: string;
  app_version: string;
}

export interface LibraryLockFileSystem {
  exists(path: string): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export type LibraryLockEvaluation =
  | { status: "available" }
  | { status: "owned"; lock: LibraryLockInfo }
  | { status: "conflict"; lock: LibraryLockInfo }
  | { status: "stale"; lock: LibraryLockInfo };

export class LibraryLockConflictError extends Error {
  constructor(public readonly lock: LibraryLockInfo) {
    super(`Library is locked by ${lock.user} on ${lock.machine}.`);
  }
}

export class LibraryLockStaleError extends Error {
  constructor(public readonly lock: LibraryLockInfo) {
    super(`Stale library lock from ${lock.user} on ${lock.machine}.`);
  }
}

export function evaluateLibraryLock(
  existing: LibraryLockInfo | null,
  sessionId: string,
  nowMs: number
): LibraryLockEvaluation {
  if (!existing) return { status: "available" };
  if (existing.session_id === sessionId) return { status: "owned", lock: existing };

  const updatedMs = Date.parse(existing.updated_at);
  if (!Number.isFinite(updatedMs) || nowMs - updatedMs > LIBRARY_LOCK_STALE_MS) {
    return { status: "stale", lock: existing };
  }

  return { status: "conflict", lock: existing };
}

export async function acquireLibraryLock(
  baseDir: string,
  fs: LibraryLockFileSystem,
  current: LibraryLockInfo,
  nowMs = Date.now(),
  forceTakeover = false
): Promise<LibraryLockInfo> {
  const path = lockPath(baseDir);
  const existing = await readLibraryLock(path, fs);
  const evaluation = evaluateLibraryLock(existing, current.session_id, nowMs);

  if (evaluation.status === "conflict") throw new LibraryLockConflictError(evaluation.lock);
  if (evaluation.status === "stale" && !forceTakeover) throw new LibraryLockStaleError(evaluation.lock);

  await fs.writeTextFile(path, JSON.stringify(current, null, 2));
  return current;
}

export async function refreshLibraryLock(
  baseDir: string,
  fs: LibraryLockFileSystem,
  current: LibraryLockInfo,
  now = new Date()
): Promise<LibraryLockInfo> {
  return acquireLibraryLock(
    baseDir,
    fs,
    { ...current, updated_at: now.toISOString() },
    now.getTime()
  );
}

export async function releaseLibraryLock(
  baseDir: string,
  fs: LibraryLockFileSystem,
  sessionId: string
): Promise<void> {
  const path = lockPath(baseDir);
  const existing = await readLibraryLock(path, fs);
  if (existing?.session_id === sessionId) await fs.remove(path);
}

export function lockPath(baseDir: string): string {
  return `${normalizeDir(baseDir)}${ACTIVE_LIBRARY_LOCK}`;
}

async function readLibraryLock(path: string, fs: LibraryLockFileSystem): Promise<LibraryLockInfo | null> {
  if (!(await fs.exists(path))) return null;
  try {
    return JSON.parse(await fs.readTextFile(path)) as LibraryLockInfo;
  } catch {
    return null;
  }
}
