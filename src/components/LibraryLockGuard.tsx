import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { exists, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/Button";
import { getLibrarySettingsState } from "@/lib/librarySettings";
import {
  LibraryLockConflictError,
  LibraryLockStaleError,
  acquireLibraryLock,
  refreshLibraryLock,
  releaseLibraryLock,
  type LibraryLockFileSystem,
  type LibraryLockInfo,
} from "@/lib/libraryLock";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const REFRESH_MS = 60 * 1000;

type LockState =
  | { status: "checking" }
  | { status: "inactive" }
  | { status: "owned" }
  | { status: "conflict"; lock: LibraryLockInfo }
  | { status: "stale"; lock: LibraryLockInfo }
  | { status: "error"; message: string };

export function LibraryLockGuard({ children }: { children: ReactNode }) {
  const fs = useMemo(createTauriLockFs, []);
  const session = useRef<string>(crypto.randomUUID());
  const currentLock = useRef<LibraryLockInfo | null>(null);
  const baseDir = useRef<string | null>(null);
  const [state, setState] = useState<LockState>({ status: "checking" });

  const buildLock = useCallback(async (): Promise<LibraryLockInfo> => ({
    session_id: session.current,
    machine: navigator.platform || "unknown-machine",
    user: "local-user",
    updated_at: new Date().toISOString(),
    app_version: isTauri() ? await getVersion() : "dev",
  }), []);

  const acquire = useCallback(async (forceTakeover = false) => {
    if (!isTauri()) {
      setState({ status: "inactive" });
      return;
    }

    const settings = await getLibrarySettingsState();
    if (settings.selection.mode !== "portable") {
      setState({ status: "inactive" });
      return;
    }

    baseDir.current = settings.paths.baseDir;
    const lock = await buildLock();
    try {
      currentLock.current = await acquireLibraryLock(settings.paths.baseDir, fs, lock, Date.now(), forceTakeover);
      setState({ status: "owned" });
    } catch (error) {
      if (error instanceof LibraryLockConflictError) setState({ status: "conflict", lock: error.lock });
      else if (error instanceof LibraryLockStaleError) setState({ status: "stale", lock: error.lock });
      else setState({ status: "error", message: error instanceof Error ? error.message : "Library lock failed." });
    }
  }, [buildLock, fs]);

  useEffect(() => {
    acquire();
  }, [acquire]);

  useEffect(() => {
    if (state.status !== "owned") return;
    const timer = window.setInterval(() => {
      if (!baseDir.current || !currentLock.current) return;
      refreshLibraryLock(baseDir.current, fs, currentLock.current)
        .then((lock) => { currentLock.current = lock; })
        .catch((error) => {
          setState({ status: "error", message: error instanceof Error ? error.message : "Library lock refresh failed." });
        });
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fs, state.status]);

  useEffect(() => {
    const release = () => {
      if (!baseDir.current) return;
      releaseLibraryLock(baseDir.current, fs, session.current).catch(() => {});
    };
    window.addEventListener("beforeunload", release);
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("beforeunload", release);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [fs]);

  if (state.status === "checking") return <LockScreen title="Checking Library Lock" message="Checking active library access..." />;
  if (state.status === "conflict") {
    return (
      <LockScreen
        title="Library In Use"
        message={`This library is locked by ${state.lock.user} on ${state.lock.machine}. Close it there before continuing.`}
      />
    );
  }
  if (state.status === "stale") {
    return (
      <LockScreen
        title="Stale Library Lock"
        message={`Last lock update was ${new Date(state.lock.updated_at).toLocaleString()}. Take over only if no other machine is using it.`}
        action={<Button variant="ghost" size="sm" onClick={() => acquire(true)}><RefreshCw size={10} /> Take Over Lock</Button>}
      />
    );
  }
  if (state.status === "error") return <LockScreen title="Library Lock Error" message={state.message} />;
  return <>{children}</>;
}

function LockScreen({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="max-w-md w-full flex flex-col gap-4 p-5 rounded-card"
        style={{ border: "1px solid rgba(215,25,33,0.35)", background: "rgba(12,12,12,0.96)" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-red/70 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <h1 className="font-sans text-sm font-semibold text-white tracking-wide">{title}</h1>
            <p className="font-mono text-[10px] text-muted leading-relaxed">{message}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

function createTauriLockFs(): LibraryLockFileSystem {
  return {
    exists: (path) => exists(path),
    readTextFile: (path) => readTextFile(path),
    writeTextFile: (path, contents) => writeTextFile(path, contents),
    remove: (path) => remove(path),
  };
}
