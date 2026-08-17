import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, FolderOpen, HardDrive, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "@/components/ui/Button";
import {
  formatLibraryActionError,
  getLibrarySettingsState,
  openLibraryFromDialog,
  useLocalAppDataLibrary,
} from "@/lib/librarySettings";
import {
  LibraryStartupCancelledError,
  PortableLibraryCleanupError,
  attachPortableLibraryPageLifecycle,
  createPortableLibraryStartupCoordinator,
} from "@/lib/libraryStartup";
import {
  LibraryLockConflictError,
  LibraryLockStaleError,
  type LibraryLockInfo,
} from "@/lib/libraryLock";
import {
  acquireLibraryLockNative,
  getLibraryLockIdentityNative,
  refreshLibraryLockNative,
  releaseLibraryLockNative,
} from "@/lib/libraryLockNative";
import { repairLibraryDatabaseSchemaNative } from "@/lib/libraryNative";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const REFRESH_MS = 60 * 1000;

type LockState =
  | { status: "checking" }
  | { status: "inactive" }
  | { status: "owned" }
  | { status: "conflict"; lock: LibraryLockInfo }
  | { status: "stale"; lock: LibraryLockInfo }
  | { status: "cleanup-error"; message: string }
  | { status: "error"; message: string };

export function LibraryLockGuard({ children }: { children: ReactNode }) {
  const session = useRef<string>(crypto.randomUUID());
  const mounted = useRef(false);
  const attemptGeneration = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<LockState>({ status: "checking" });
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const coordinator = useRef<ReturnType<typeof createPortableLibraryStartupCoordinator> | null>(null);

  if (!coordinator.current) {
    coordinator.current = createPortableLibraryStartupCoordinator({
      acquire: acquireLibraryLockNative,
      repair: repairLibraryDatabaseSchemaNative,
      refresh: refreshLibraryLockNative,
      release: releaseLibraryLockNative,
      startHeartbeat: (tick) => {
        const timer = window.setInterval(() => {
          void tick().catch((error) => {
            if (!mounted.current) return;
            setState({
              status: "error",
              message: error instanceof Error ? error.message : "Library lock refresh failed.",
            });
            void coordinator.current?.cancel().catch((cleanupError) => {
              if (mounted.current) showCleanupError(cleanupError, setState);
            });
          });
        }, REFRESH_MS);
        return () => window.clearInterval(timer);
      },
    });
  }

  const acquire = useCallback((forceTakeover = false): Promise<void> => {
    if (inFlight.current) return inFlight.current;

    const attempt = ++attemptGeneration.current;
    setState({ status: "checking" });
    setSwitchError(null);
    const promise = (async () => {
      try {
        if (!isTauri()) {
          if (isCurrentAttempt(mounted, attemptGeneration, attempt)) {
            setState({ status: "inactive" });
          }
          return;
        }

        const [settings, identity, appVersion] = await Promise.all([
          getLibrarySettingsState(),
          getLibraryLockIdentityNative().catch(() => ({
            machine: navigator.platform || "unknown-machine",
            user: "unknown-user",
          })),
          getVersion().catch(() => "unknown"),
        ]);
        if (!isCurrentAttempt(mounted, attemptGeneration, attempt)) return;

        if (settings.selection.mode !== "portable") {
          setState({ status: "inactive" });
          return;
        }

        const lock: LibraryLockInfo = {
          session_id: session.current,
          machine: identity.machine,
          user: identity.user,
          updated_at: new Date().toISOString(),
          app_version: appVersion,
        };

        await coordinator.current!.start({
          baseDir: settings.paths.baseDir,
          lock,
          now: Date.now(),
          forceTakeover,
        });
        if (!isCurrentAttempt(mounted, attemptGeneration, attempt)) {
          await coordinator.current!.cancel();
          return;
        }
        setState({ status: "owned" });
      } catch (error) {
        if (!isCurrentAttempt(mounted, attemptGeneration, attempt)) return;
        if (error instanceof LibraryStartupCancelledError) return;
        if (error instanceof PortableLibraryCleanupError) {
          showCleanupError(error, setState);
          return;
        }
        if (error instanceof LibraryLockConflictError) setState({ status: "conflict", lock: error.lock });
        else if (error instanceof LibraryLockStaleError) setState({ status: "stale", lock: error.lock });
        else setState({ status: "error", message: error instanceof Error ? error.message : "Library lock failed." });
      }
    })();

    inFlight.current = promise;
    void promise.finally(() => {
      if (inFlight.current === promise) inFlight.current = null;
    });
    return promise;
  }, []);

  const retryCleanup = useCallback(() => {
    if (inFlight.current) return inFlight.current;

    const attempt = ++attemptGeneration.current;
    setState({ status: "checking" });
    setSwitchError(null);
    const promise = (async () => {
      try {
        await coordinator.current!.cleanup();
        if (!isCurrentAttempt(mounted, attemptGeneration, attempt)) return;
        inFlight.current = null;
        await acquire(false);
      } catch (error) {
        if (isCurrentAttempt(mounted, attemptGeneration, attempt)) {
          showCleanupError(error, setState);
        }
      }
    })();
    inFlight.current = promise;
    void promise.finally(() => {
      if (inFlight.current === promise) inFlight.current = null;
    });
    return promise;
  }, [acquire]);

  const handleUseLocalLibrary = useCallback(() => {
    if (switching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      useLocalAppDataLibrary();
      void acquire(false).finally(() => {
        if (mounted.current) setSwitching(false);
      });
    } catch (error) {
      if (mounted.current) {
        setSwitchError(formatLibraryActionError(error));
        setSwitching(false);
      }
    }
  }, [acquire, switching]);

  const handleChooseDifferentLibrary = useCallback(() => {
    if (switching) return;
    setSwitching(true);
    setSwitchError(null);
    void openLibraryFromDialog()
      .then((result) => (result ? acquire(false) : undefined))
      .catch((error) => {
        if (mounted.current) setSwitchError(formatLibraryActionError(error));
      })
      .finally(() => {
        if (mounted.current) setSwitching(false);
      });
  }, [acquire, switching]);

  useEffect(() => {
    mounted.current = true;
    void acquire();
    const detach = attachPortableLibraryPageLifecycle({
      target: window,
      invalidate: () => {
        attemptGeneration.current += 1;
        inFlight.current = null;
      },
      enterChecking: () => {
        if (mounted.current) setState({ status: "checking" });
      },
      cancel: () => coordinator.current!.cancel(),
      reacquire: () => acquire(false),
      onError: (error) => {
        if (mounted.current) showCleanupError(error, setState);
        else console.error("Library lock cleanup failed during teardown.", error);
      },
    });
    return () => {
      mounted.current = false;
      detach();
    };
  }, [acquire]);

  const escapeActions = (
    <LibraryEscapeActions
      disabled={switching}
      error={switchError}
      onUseLocal={handleUseLocalLibrary}
      onChooseDifferent={handleChooseDifferentLibrary}
    />
  );

  if (state.status === "checking") return <LockScreen title="Checking Library Lock" message="Checking active library access..." />;
  if (state.status === "conflict") {
    return (
      <LockScreen
        title="Library In Use"
        message={`This library is locked by ${state.lock.user} on ${state.lock.machine}. Close it there before continuing.`}
        action={<Button variant="ghost" size="sm" disabled={switching} onClick={() => acquire(false)}><RefreshCw size={10} /> Check Again</Button>}
        secondary={escapeActions}
      />
    );
  }
  if (state.status === "stale") {
    return (
      <LockScreen
        title="Stale Library Lock"
        message={`Last lock update was ${new Date(state.lock.updated_at).toLocaleString()}. Take over only if no other machine is using it.`}
        action={<Button variant="ghost" size="sm" disabled={switching} onClick={() => acquire(true)}><RefreshCw size={10} /> Take Over Lock</Button>}
        secondary={escapeActions}
      />
    );
  }
  if (state.status === "cleanup-error") {
    return (
      <LockScreen
        title="Library Lock Cleanup Failed"
        message={state.message}
        action={<Button variant="ghost" size="sm" disabled={switching} onClick={retryCleanup}><RefreshCw size={10} /> Retry Cleanup</Button>}
        secondary={escapeActions}
      />
    );
  }
  if (state.status === "error") {
    return (
      <LockScreen
        title="Library Lock Error"
        message={state.message}
        action={<Button variant="ghost" size="sm" disabled={switching} onClick={() => acquire(false)}><RefreshCw size={10} /> Retry</Button>}
        secondary={escapeActions}
      />
    );
  }
  return <>{children}</>;
}

function isCurrentAttempt(
  mounted: { current: boolean },
  generation: { current: number },
  attempt: number
): boolean {
  return mounted.current && generation.current === attempt;
}

function showCleanupError(
  error: unknown,
  setState: (state: LockState) => void
): void {
  setState({
    status: "cleanup-error",
    message: error instanceof Error
      ? error.message
      : "The library lock could not be released. Retry cleanup before opening it elsewhere.",
  });
}

function LockScreen({
  title,
  message,
  action,
  secondary,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="min-h-full bg-void flex items-center justify-center p-6">
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
        {secondary}
      </div>
    </div>
  );
}

function LibraryEscapeActions({
  disabled,
  error,
  onUseLocal,
  onChooseDifferent,
}: {
  disabled: boolean;
  error: string | null;
  onUseLocal: () => void;
  onChooseDifferent: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted/70">Still stuck?</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="muted" size="sm" onClick={onUseLocal} disabled={disabled}>
          <HardDrive size={10} /> Use Local Library
        </Button>
        <Button variant="muted" size="sm" onClick={onChooseDifferent} disabled={disabled}>
          <FolderOpen size={10} /> Choose Different Library
        </Button>
      </div>
      {error && <p className="font-mono text-[10px] text-red/80">{error}</p>}
    </div>
  );
}
