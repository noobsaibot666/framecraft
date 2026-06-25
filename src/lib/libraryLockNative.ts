import {
  LibraryLockConflictError,
  LibraryLockStaleError,
  type LibraryLockInfo,
} from "./libraryLock";

const LOCK_CONFLICT_PREFIX = "LOCK_CONFLICT:";
const LOCK_STALE_PREFIX = "LOCK_STALE:";

export async function acquireLibraryLockNative(
  baseDir: string,
  current: LibraryLockInfo,
  nowMs = Date.now(),
  forceTakeover = false
): Promise<LibraryLockInfo> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<LibraryLockInfo>("acquire_library_lock_native", {
      baseDir,
      current,
      nowMs,
      forceTakeover,
    });
  } catch (error) {
    throw parseNativeLockError(error);
  }
}

export async function refreshLibraryLockNative(
  baseDir: string,
  current: LibraryLockInfo,
  now = new Date()
): Promise<LibraryLockInfo> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<LibraryLockInfo>("refresh_library_lock_native", {
      baseDir,
      current: { ...current, updated_at: now.toISOString() },
      nowMs: now.getTime(),
    });
  } catch (error) {
    throw parseNativeLockError(error);
  }
}

export async function releaseLibraryLockNative(baseDir: string, sessionId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("release_library_lock_native", { baseDir, sessionId });
}

export async function getLibraryLockIdentityNative(): Promise<Pick<LibraryLockInfo, "machine" | "user">> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<Pick<LibraryLockInfo, "machine" | "user">>("get_library_lock_identity_native");
}

function parseNativeLockError(error: unknown): Error {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "Library lock failed.";

  if (message.startsWith(LOCK_CONFLICT_PREFIX)) {
    return new LibraryLockConflictError(parseLock(message.slice(LOCK_CONFLICT_PREFIX.length)));
  }
  if (message.startsWith(LOCK_STALE_PREFIX)) {
    return new LibraryLockStaleError(parseLock(message.slice(LOCK_STALE_PREFIX.length)));
  }
  return new Error(message);
}

function parseLock(raw: string): LibraryLockInfo {
  try {
    return JSON.parse(raw) as LibraryLockInfo;
  } catch {
    return {
      session_id: "unknown",
      machine: "unknown-machine",
      user: "unknown-user",
      updated_at: new Date(0).toISOString(),
      app_version: "unknown",
    };
  }
}
