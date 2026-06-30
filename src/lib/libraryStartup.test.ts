import { describe, expect, it, vi } from "vitest";
import { LIBRARY_PATH_STORAGE_KEY, type LibraryStorage } from "./libraryConfig";
import type { LibraryLockInfo } from "./libraryLock";
import { selectValidatedLibrary } from "./librarySettings";
import {
  LibraryStartupCancelledError,
  PortableLibraryCleanupError,
  attachPortableLibraryPageLifecycle,
  createPortableLibraryStartupCoordinator,
} from "./libraryStartup";

const requestedLock: LibraryLockInfo = {
  session_id: "session-1",
  machine: "studio-mac",
  user: "alan",
  updated_at: "2026-06-30T10:00:00.000Z",
  app_version: "0.1.0",
};

const ownedLock: LibraryLockInfo = {
  ...requestedLock,
  updated_at: "2026-06-30T10:00:01.000Z",
};

function createStorage(): LibraryStorage & { data: Record<string, string> } {
  const storage = {
    data: {} as Record<string, string>,
    getItem(key: string) {
      return storage.data[key] ?? null;
    },
    setItem(key: string, value: string) {
      storage.data[key] = value;
    },
    removeItem(key: string) {
      delete storage.data[key];
    },
  };
  return storage;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function coordinatorDeps(overrides: Partial<{
  acquire: () => Promise<LibraryLockInfo>;
  repair: () => Promise<{ ok: boolean; errors: string[] }>;
  refresh: () => Promise<LibraryLockInfo>;
  release: () => Promise<void>;
  startHeartbeat: (tick: () => Promise<void>) => () => void;
}> = {}) {
  return {
    acquire: vi.fn(async () => ownedLock),
    repair: vi.fn(async () => ({ ok: true, errors: [] })),
    refresh: vi.fn(async () => ownedLock),
    release: vi.fn(async () => {}),
    startHeartbeat: vi.fn((_tick: () => Promise<void>) => () => {}),
    ...overrides,
  };
}

const startupInput = {
  baseDir: "/Volumes/Studio.framecraftlib",
  lock: requestedLock,
  now: 1_751_274_000_000,
  forceTakeover: false,
};

describe("portable library startup ownership coordinator", () => {
  it("acquires the portable lock before repairing the library", async () => {
    const calls: string[] = [];
    const deps = coordinatorDeps({
      acquire: vi.fn(async () => {
        calls.push("acquire");
        return ownedLock;
      }),
      repair: vi.fn(async () => {
        calls.push("repair");
        return { ok: true, errors: [] };
      }),
    });
    const coordinator = createPortableLibraryStartupCoordinator(deps);

    await coordinator.start(startupInput);
    expect(calls).toEqual(["acquire", "repair"]);
  });

  it("does not repair when lock acquisition fails", async () => {
    const repair = vi.fn(async () => ({ ok: true, errors: [] }));

    const coordinator = createPortableLibraryStartupCoordinator(coordinatorDeps({
      acquire: vi.fn(async () => { throw new Error("library in use"); }),
      repair,
    }));

    await expect(coordinator.start(startupInput)).rejects.toThrow("library in use");

    expect(repair).not.toHaveBeenCalled();
  });

  it("throws joined validation errors when repair leaves the library invalid", async () => {
    const coordinator = createPortableLibraryStartupCoordinator(coordinatorDeps({
      repair: vi.fn(async () => ({
        ok: false,
        errors: ["Missing database schema", "Invalid library metadata"],
      })),
    }));

    await expect(coordinator.start(startupInput)).rejects.toThrow(
      "Missing database schema, Invalid library metadata"
    );
  });

  it("uses fallback text when invalid repair validation has no errors", async () => {
    const coordinator = createPortableLibraryStartupCoordinator(coordinatorDeps({
      repair: vi.fn(async () => ({ ok: false, errors: [] })),
    }));

    await expect(coordinator.start(startupInput)).rejects.toThrow(
      "Library validation failed."
    );
  });
  it("deduplicates concurrent startup attempts", async () => {
    const acquired = deferred<LibraryLockInfo>();
    const deps = coordinatorDeps({ acquire: vi.fn(() => acquired.promise) });
    const coordinator = createPortableLibraryStartupCoordinator(deps);

    const first = coordinator.start(startupInput);
    const second = coordinator.start({ ...startupInput, forceTakeover: true });

    expect(second).toBe(first);
    await vi.waitFor(() => expect(deps.acquire).toHaveBeenCalledTimes(1));

    acquired.resolve(ownedLock);
    await expect(first).resolves.toBe(ownedLock);
    expect(deps.repair).toHaveBeenCalledTimes(1);
  });

  it("releases an acquired lock when cancelled before acquisition completes", async () => {
    const acquired = deferred<LibraryLockInfo>();
    const deps = coordinatorDeps({ acquire: vi.fn(() => acquired.promise) });
    const coordinator = createPortableLibraryStartupCoordinator(deps);
    const attempt = coordinator.start(startupInput);

    await vi.waitFor(() => expect(deps.acquire).toHaveBeenCalledTimes(1));
    const cancellation = coordinator.cancel();
    acquired.resolve(ownedLock);

    await expect(attempt).rejects.toBeInstanceOf(LibraryStartupCancelledError);
    await cancellation;
    expect(deps.repair).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalledWith(
      startupInput.baseDir,
      ownedLock.session_id
    );
  });

  it("keeps heartbeat active during repair and releases on cancellation", async () => {
    const repaired = deferred<{ ok: boolean; errors: string[] }>();
    let heartbeatTick: (() => Promise<void>) | undefined;
    const stopHeartbeat = vi.fn();
    const deps = coordinatorDeps({
      repair: vi.fn(() => repaired.promise),
      startHeartbeat: vi.fn((tick) => {
        heartbeatTick = tick;
        return stopHeartbeat;
      }),
    });
    const coordinator = createPortableLibraryStartupCoordinator(deps);
    const attempt = coordinator.start(startupInput);

    await vi.waitFor(() => expect(deps.repair).toHaveBeenCalledTimes(1));
    expect(deps.startHeartbeat).toHaveBeenCalledTimes(1);
    await heartbeatTick?.();
    expect(deps.refresh).toHaveBeenCalledTimes(1);

    const cancellation = coordinator.cancel();
    repaired.resolve({ ok: true, errors: [] });

    await expect(attempt).rejects.toBeInstanceOf(LibraryStartupCancelledError);
    await cancellation;
    expect(stopHeartbeat).toHaveBeenCalledTimes(1);
    expect(deps.release).toHaveBeenCalledWith(
      startupInput.baseDir,
      ownedLock.session_id
    );
  });

  it("serializes a replacement attempt behind cancellation cleanup", async () => {
    const firstAcquire = deferred<LibraryLockInfo>();
    const calls: string[] = [];
    const deps = coordinatorDeps({
      acquire: vi.fn(async () => {
        calls.push("acquire");
        if (calls.filter((call) => call === "acquire").length === 1) {
          return firstAcquire.promise;
        }
        return ownedLock;
      }),
      release: vi.fn(async () => { calls.push("release"); }),
    });
    const coordinator = createPortableLibraryStartupCoordinator(deps);
    const obsolete = coordinator.start(startupInput);
    await vi.waitFor(() => expect(deps.acquire).toHaveBeenCalledTimes(1));
    void coordinator.cancel();
    const replacement = coordinator.start({ ...startupInput, forceTakeover: true });

    expect(deps.acquire).toHaveBeenCalledTimes(1);
    firstAcquire.resolve(ownedLock);
    await expect(obsolete).rejects.toBeInstanceOf(LibraryStartupCancelledError);
    await expect(replacement).resolves.toBe(ownedLock);

    expect(calls).toEqual(["acquire", "release", "acquire"]);
  });

  it("surfaces cleanup failure and retains ownership for teardown retry", async () => {
    const release = vi.fn()
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce(undefined);
    const deps = coordinatorDeps({
      repair: vi.fn(async () => ({ ok: false, errors: ["Invalid library metadata"] })),
      release,
    });
    const coordinator = createPortableLibraryStartupCoordinator(deps);

    await expect(coordinator.start(startupInput)).rejects.toMatchObject({
      name: PortableLibraryCleanupError.name,
      lock: ownedLock,
    });
    await expect(coordinator.cleanup()).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("releases retained ownership before a replacement acquisition", async () => {
    const calls: string[] = [];
    const release = vi.fn(async () => {
      calls.push("release");
      if (release.mock.calls.length === 1) throw new Error("permission denied");
    });
    const deps = coordinatorDeps({
      acquire: vi.fn(async () => {
        calls.push("acquire");
        return ownedLock;
      }),
      repair: vi.fn()
        .mockResolvedValueOnce({ ok: false, errors: ["Invalid library metadata"] })
        .mockResolvedValueOnce({ ok: true, errors: [] }),
      release,
    });
    const coordinator = createPortableLibraryStartupCoordinator(deps);

    await expect(coordinator.start(startupInput)).rejects.toBeInstanceOf(
      PortableLibraryCleanupError
    );
    await expect(coordinator.start(startupInput)).resolves.toBe(ownedLock);

    expect(calls).toEqual(["acquire", "release", "release", "acquire"]);
  });
});

describe("portable library page lifecycle", () => {
  function lifecycleTarget() {
    const listeners = new Map<string, Set<EventListener>>();
    const target = {
      addEventListener(type: string, listener: EventListener) {
        const entries = listeners.get(type) ?? new Set<EventListener>();
        entries.add(listener);
        listeners.set(type, entries);
      },
      removeEventListener(type: string, listener: EventListener) {
        listeners.get(type)?.delete(listener);
      },
    } as unknown as Window;
    return {
      target,
      dispatch(type: string, event: Event = new Event(type)) {
        for (const listener of listeners.get(type) ?? []) listener(event);
      },
    };
  }

  it("invalidates pending preflight before pagehide cleanup", () => {
    const events = lifecycleTarget();
    const calls: string[] = [];
    let generation = 1;
    const preflightGeneration = generation;
    let acquired = false;
    const detach = attachPortableLibraryPageLifecycle({
      target: events.target,
      invalidate: () => { calls.push("invalidate"); generation += 1; },
      enterChecking: () => { calls.push("checking"); },
      cancel: async () => { calls.push("cancel"); },
      reacquire: async () => {},
      onError: vi.fn(),
    });

    events.dispatch("pagehide");
    if (generation === preflightGeneration) acquired = true;

    expect(calls).toEqual(["invalidate", "checking", "cancel"]);
    expect(acquired).toBe(false);
    detach();
  });

  it("hides owned content on pagehide and reacquires on persisted pageshow", async () => {
    const events = lifecycleTarget();
    const reacquired = deferred<void>();
    let view: "owned" | "checking" = "owned";
    const cancel = vi.fn(async () => {});
    const reacquire = vi.fn(async () => {
      await reacquired.promise;
      view = "owned";
    });
    const detach = attachPortableLibraryPageLifecycle({
      target: events.target,
      invalidate: vi.fn(),
      enterChecking: () => { view = "checking"; },
      cancel,
      reacquire,
      onError: vi.fn(),
    });

    events.dispatch("pagehide");
    expect(view).toBe("checking");
    expect(cancel).toHaveBeenCalledTimes(1);

    const pageshow = new Event("pageshow") as Event & { persisted: boolean };
    Object.defineProperty(pageshow, "persisted", { value: true });
    events.dispatch("pageshow", pageshow);
    expect(view).toBe("checking");
    expect(reacquire).toHaveBeenCalledTimes(1);

    reacquired.resolve();
    await vi.waitFor(() => expect(view).toBe("owned"));
    detach();
  });
});

describe("portable library startup selection", () => {
  it("permits selection when every validation error is repairable after lock acquisition", async () => {
    const storage = createStorage();

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Upgrade.framecraftlib", {
        storage,
        validateLibrary: async () => ({
          ok: false,
          errors: ["Missing database schema", "Missing locks directory"],
        }),
      })
    ).resolves.toEqual({
      path: "/Volumes/NAS/Upgrade.framecraftlib",
      restartRequired: true,
    });

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBe("/Volumes/NAS/Upgrade.framecraftlib");
  });

  it("rejects selection when validation includes a non-repairable error", async () => {
    const storage = createStorage();

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Broken.framecraftlib", {
        storage,
        validateLibrary: async () => ({
          ok: false,
          errors: ["Missing database schema", "Invalid library metadata"],
        }),
      })
    ).rejects.toThrow("Missing database schema, Invalid library metadata");

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBeUndefined();
  });

  it("rejects invalid selection when validation provides no repairable errors", async () => {
    const storage = createStorage();

    await expect(
      selectValidatedLibrary("/Volumes/NAS/Broken.framecraftlib", {
        storage,
        validateLibrary: async () => ({ ok: false, errors: [] }),
      })
    ).rejects.toThrow();

    expect(storage.data[LIBRARY_PATH_STORAGE_KEY]).toBeUndefined();
  });
});
