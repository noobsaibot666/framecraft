import type { LibraryLockInfo } from "./libraryLock";
import type {
  acquireLibraryLockNative,
  refreshLibraryLockNative,
  releaseLibraryLockNative,
} from "./libraryLockNative";
import type { repairLibraryDatabaseSchemaNative } from "./libraryNative";

export interface PortableLibraryStartupInput {
  baseDir: string;
  lock: LibraryLockInfo;
  now: number;
  forceTakeover: boolean;
}

export interface PortableLibraryStartupDependencies {
  acquire: typeof acquireLibraryLockNative;
  repair: typeof repairLibraryDatabaseSchemaNative;
  refresh: typeof refreshLibraryLockNative;
  release: typeof releaseLibraryLockNative;
  startHeartbeat: (tick: () => Promise<void>) => () => void;
}

export class LibraryStartupCancelledError extends Error {
  constructor() {
    super("Library startup was cancelled.");
    this.name = "LibraryStartupCancelledError";
  }
}

export class PortableLibraryCleanupError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly cleanupError: unknown,
    public readonly lock: LibraryLockInfo
  ) {
    super(
      `${errorMessage(originalError, "Library preparation failed.")} `
      + `The acquired library lock could not be released: ${errorMessage(cleanupError, "unknown cleanup error")}. `
      + "Retry cleanup before opening this library elsewhere."
    );
    this.name = "PortableLibraryCleanupError";
  }
}

export function attachPortableLibraryPageLifecycle(input: {
  target: Window;
  invalidate: () => void;
  enterChecking: () => void;
  cancel: () => Promise<void>;
  reacquire: () => Promise<void>;
  onError: (error: unknown) => void;
}): () => void {
  let departed = false;

  const run = (operation: () => Promise<void>) => {
    try {
      void operation().catch(input.onError);
    } catch (error) {
      input.onError(error);
    }
  };
  const depart = () => {
    if (departed) return;
    departed = true;
    input.invalidate();
    input.enterChecking();
    run(input.cancel);
  };
  const returnFromCache = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    departed = false;
    input.enterChecking();
    run(input.reacquire);
  };

  input.target.addEventListener("beforeunload", depart);
  input.target.addEventListener("pagehide", depart);
  input.target.addEventListener("pageshow", returnFromCache);

  return () => {
    input.target.removeEventListener("beforeunload", depart);
    input.target.removeEventListener("pagehide", depart);
    input.target.removeEventListener("pageshow", returnFromCache);
    depart();
  };
}

export function createPortableLibraryStartupCoordinator(
  deps: PortableLibraryStartupDependencies
) {
  let generation = 0;
  let active: { generation: number; promise: Promise<LibraryLockInfo> } | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let ownership: { baseDir: string; lock: LibraryLockInfo } | null = null;
  let stopHeartbeat: (() => void) | null = null;
  let refreshInFlight: Promise<void> | null = null;

  const isCurrent = (attemptGeneration: number) => generation === attemptGeneration;

  const stopRefreshing = async () => {
    stopHeartbeat?.();
    stopHeartbeat = null;
    if (refreshInFlight) await refreshInFlight.catch(() => {});
  };

  const releaseOwnership = async (originalError: unknown) => {
    await stopRefreshing();
    if (!ownership) return;

    const acquired = ownership;
    try {
      await deps.release(acquired.baseDir, acquired.lock.session_id);
      if (ownership === acquired) ownership = null;
    } catch (cleanupError) {
      throw new PortableLibraryCleanupError(
        originalError,
        cleanupError,
        acquired.lock
      );
    }
  };

  const startRefreshing = (attemptGeneration: number) => {
    const tick = async () => {
      if (!isCurrent(attemptGeneration) || !ownership || refreshInFlight) return;
      const refreshingOwnership = ownership;
      const refresh = deps.refresh(
        refreshingOwnership.baseDir,
        refreshingOwnership.lock
      ).then((refreshed) => {
        if (isCurrent(attemptGeneration) && ownership === refreshingOwnership) {
          ownership = { ...refreshingOwnership, lock: refreshed };
        }
      });
      refreshInFlight = refresh;
      try {
        await refresh;
      } finally {
        if (refreshInFlight === refresh) refreshInFlight = null;
      }
    };
    stopHeartbeat = deps.startHeartbeat(tick);
  };

  const run = async (
    input: PortableLibraryStartupInput,
    attemptGeneration: number
  ): Promise<LibraryLockInfo> => {
    if (!isCurrent(attemptGeneration)) throw new LibraryStartupCancelledError();
    if (ownership) {
      await releaseOwnership(new Error(
        "A previous library lock cleanup must finish before startup can continue."
      ));
      if (!isCurrent(attemptGeneration)) throw new LibraryStartupCancelledError();
    }

    const acquired = await deps.acquire(
      input.baseDir,
      input.lock,
      input.now,
      input.forceTakeover
    );
    ownership = { baseDir: input.baseDir, lock: acquired };

    if (!isCurrent(attemptGeneration)) {
      const cancelled = new LibraryStartupCancelledError();
      await releaseOwnership(cancelled);
      throw cancelled;
    }

    try {
      startRefreshing(attemptGeneration);
      const validation = await deps.repair(input.baseDir);
      if (!isCurrent(attemptGeneration)) throw new LibraryStartupCancelledError();
      if (!validation.ok) {
        throw new Error(validation.errors.join(", ") || "Library validation failed.");
      }
      return acquired;
    } catch (error) {
      await releaseOwnership(error);
      throw error;
    }
  };

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };

  const start = (input: PortableLibraryStartupInput): Promise<LibraryLockInfo> => {
    if (active && active.generation === generation) return active.promise;

    const attemptGeneration = ++generation;
    const promise = enqueue(() => run(input, attemptGeneration));
    active = { generation: attemptGeneration, promise };
    void promise.then(
      () => {
        if (active?.promise === promise) active = null;
      },
      () => {
        if (active?.promise === promise) active = null;
      }
    );
    return promise;
  };

  const cancel = (): Promise<void> => {
    generation += 1;
    active = null;
    return enqueue(() => releaseOwnership(new LibraryStartupCancelledError()));
  };

  const cleanup = (): Promise<void> => enqueue(
    () => releaseOwnership(new Error("Library lock cleanup was requested."))
  );

  return { start, cancel, cleanup };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
