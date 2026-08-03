import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { PageTransition } from "./PageTransition";
import { CommandSearch } from "@/components/ui/CommandSearch";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useShortcut, registerShortcutLabel, getRegisteredShortcuts, formatShortcutKeys } from "@/lib/shortcuts";
import { getFramecraftDb } from "@/lib/dbConnection";
import { scheduleLikelyRoutePrefetch } from "@/lib/routePrefetch";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Mirrors src-tauri/src/license.rs's LicenseStatus. In the Mac App Store
// build (no direct-dist feature) get_license_status always resolves
// { active: true, ... }, so every field below is effectively unused there —
// this type/state exists once for both build variants rather than branching
// the frontend per-build.
type LicenseStatus = {
  active: boolean;
  key: string | null;
  hwid: string;
  message: string | null;
  is_trial: boolean;
  trial_days_remaining: number | null;
  trial_expired: boolean;
};

type LicenseMode = "loading" | "trial" | "trial_expired" | "inactive" | "full";

function licenseModeFor(status: LicenseStatus | null): LicenseMode {
  if (!status) return "loading";
  if (status.active) return "full";
  if (status.is_trial) return "trial";
  if (status.trial_expired) return "trial_expired";
  return "inactive";
}

registerShortcutLabel("cmd+k", "Open command search");
registerShortcutLabel("cmd+/", "Show keyboard shortcuts");
// cmd+shift+<letter>, not cmd+ctrl+<letter>: the old combo required holding
// Ctrl *and* the Windows key together on Windows, which Win+Ctrl+D/Left/Right
// etc. reserve system-wide for virtual-desktop switching — those keydowns
// never reached the browser at all. cmd+shift avoids that, and avoids
// colliding with bare Ctrl+P/F/N (print/find/new) browser accelerators.
registerShortcutLabel("cmd+shift+d", "Go to Dashboard");
registerShortcutLabel("cmd+shift+p", "Go to Prompt Craft");
registerShortcutLabel("cmd+shift+l", "Go to Assets");
registerShortcutLabel("cmd+shift+i", "Go to Import");
registerShortcutLabel("cmd+shift+t", "Go to Tokens");
registerShortcutLabel("cmd+shift+c", "Go to Campaigns");
registerShortcutLabel("cmd+shift+n", "New Prompt");
// Plain cmd+, (no Shift) — Shift+comma types "<", not ",", so
// "cmd+shift+," could never match a real keypress. cmd+, is also the
// universal cross-app "Preferences" convention and isn't a reserved
// browser/OS accelerator, so it doesn't need the extra Shift anyway.
registerShortcutLabel("cmd+,", "Go to Settings");

export function AppShell() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseFormOpen, setLicenseFormOpen] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [licenseEmailInput, setLicenseEmailInput] = useState("");
  const [licenseFormBusy, setLicenseFormBusy] = useState(false);
  const [licenseFormError, setLicenseFormError] = useState<string | null>(null);
  const licenseMode = licenseModeFor(licenseStatus);

  // Mac App Store build: get_license_status always resolves { active: true }
  // (the src-tauri license.rs stub compiled in place of the real
  // direct-dist licensing code), so licenseMode becomes "full" immediately
  // and none of the trial/paywall UI below ever renders. Same JS for both
  // build variants.
  useEffect(() => {
    if (!isTauri()) {
      setLicenseStatus({
        active: true,
        key: null,
        hwid: "",
        message: null,
        is_trial: false,
        trial_days_remaining: null,
        trial_expired: false,
      });
      return;
    }
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke<LicenseStatus>("get_license_status")
        .then((status) => {
          // Fresh install, direct-dist build, no trial started yet and no
          // license on file — init_trial is idempotent, so this is safe to
          // call unconditionally whenever the initial check comes back with
          // nothing on record.
          if (!status.active && !status.is_trial && !status.trial_expired) {
            return invoke<LicenseStatus>("init_trial");
          }
          return status;
        })
        .then(setLicenseStatus)
        .catch(() =>
          setLicenseStatus({
            active: true,
            key: null,
            hwid: "",
            message: null,
            is_trial: false,
            trial_days_remaining: null,
            trial_expired: false,
          })
        )
    );
  }, []);

  const handleActivateLicense = useCallback(async () => {
    setLicenseFormBusy(true);
    setLicenseFormError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const status = await invoke<LicenseStatus>("activate_license", {
        key: licenseKeyInput,
        email: licenseEmailInput,
      });
      setLicenseStatus(status);
      setLicenseFormOpen(false);
      setLicenseKeyInput("");
      setLicenseEmailInput("");
    } catch (error) {
      setLicenseFormError(String(error));
    } finally {
      setLicenseFormBusy(false);
    }
  }, [licenseKeyInput, licenseEmailInput]);

  const handleRecoverLicenseKey = useCallback(async () => {
    setLicenseFormBusy(true);
    setLicenseFormError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ message: string }>("recover_license_key", {
        email: licenseEmailInput,
      });
      setLicenseFormError(result.message);
    } catch (error) {
      setLicenseFormError(String(error));
    } finally {
      setLicenseFormBusy(false);
    }
  }, [licenseEmailInput]);

  // Warm the DB connection at startup so the first data page loads instantly.
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      getFramecraftDb().catch(() => {});
    }
  }, []);

  useEffect(() => scheduleLikelyRoutePrefetch(), []);

  // Global drag-and-drop guard. Without this, dropping a file anywhere that
  // isn't a dedicated dropzone (or even on one, if its own onDrop doesn't
  // preventDefault) falls through to the webview's native default: it
  // navigates the whole window to display the dropped file, replacing the
  // SPA entirely — reported as "the image opens full screen and the app
  // locks up". Real dropzones still work: they call preventDefault() in
  // their own onDrop before this ever needs to catch it.
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  const openSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useShortcut("cmd+k", openSearch);
  useShortcut("cmd+/", () => setShortcutsOpen((v) => !v));

  // Global page-navigation shortcuts (available everywhere, AppShell wraps every route).
  useShortcut("cmd+shift+d", () => navigate("/"));
  useShortcut("cmd+shift+p", () => navigate("/craft"));
  useShortcut("cmd+shift+l", () => navigate("/library"));
  useShortcut("cmd+shift+i", () => navigate("/import"));
  useShortcut("cmd+shift+t", () => navigate("/tokens"));
  useShortcut("cmd+shift+c", () => navigate("/campaigns"));
  useShortcut("cmd+shift+n", () => navigate("/craft"));
  useShortcut("cmd+,", () => navigate("/settings"));

  // Hard paywall: only reachable in the direct-dist build (the MAS build's
  // license.rs stub always reports active:true, so licenseMode is "full"
  // before this ever renders). Gates the entire app, including library
  // access, which is why this early-return sits ahead of the shell.
  if (licenseMode === "trial_expired" || licenseMode === "inactive") {
    return (
      <LicenseActivationCard
        title={licenseMode === "trial_expired" ? "Your trial has ended" : "Activate Framecraft"}
        description={
          licenseMode === "trial_expired"
            ? "Enter your license key to keep using Framecraft."
            : "Enter the license key from your purchase email to activate this copy of Framecraft."
        }
        keyInput={licenseKeyInput}
        onKeyInputChange={setLicenseKeyInput}
        emailInput={licenseEmailInput}
        onEmailInputChange={setLicenseEmailInput}
        busy={licenseFormBusy}
        error={licenseFormError}
        onActivate={handleActivateLicense}
        onRecover={handleRecoverLicenseKey}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      <TopBar onSearchOpen={() => setSearchOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <PageTransition />
        </main>
      </div>
      {licenseMode === "trial" ? (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-pill font-mono text-[11px] transition-precise"
          style={{ background: "var(--color-red-muted)", border: "var(--border-active)", color: "var(--color-soft-white)" }}
          onClick={() => setLicenseFormOpen(true)}
          aria-label="Trial active — click to activate your license"
        >
          <span>
            {licenseStatus?.trial_days_remaining ?? 0} day{(licenseStatus?.trial_days_remaining ?? 0) === 1 ? "" : "s"} left in trial
          </span>
          <span className="system-label text-red">Activate</span>
        </button>
      ) : null}
      {licenseFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setLicenseFormOpen(false)}
        >
          <div
            className="flex flex-col gap-5 w-full max-w-md rounded-card p-6"
            style={{ border: "var(--border-default)", background: "var(--color-panel)" }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Activate license"
          >
            <div className="flex items-center justify-between">
              <span className="system-label text-soft-white">Activate License</span>
              <button type="button" aria-label="Close" onClick={() => setLicenseFormOpen(false)} className="text-dim/40 hover:text-white transition-precise">
                <X size={16} />
              </button>
            </div>
            <LicenseActivationFields
              keyInput={licenseKeyInput}
              onKeyInputChange={setLicenseKeyInput}
              emailInput={licenseEmailInput}
              onEmailInputChange={setLicenseEmailInput}
              busy={licenseFormBusy}
              error={licenseFormError}
              onActivate={handleActivateLicense}
              onRecover={handleRecoverLicenseKey}
            />
          </div>
        </div>
      ) : null}
      {searchOpen && <CommandSearch onClose={() => setSearchOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      <ToastContainer />
    </div>
  );
}

interface LicenseActivationFieldsProps {
  keyInput: string;
  onKeyInputChange: (value: string) => void;
  emailInput: string;
  onEmailInputChange: (value: string) => void;
  busy: boolean;
  error: string | null;
  onActivate: () => void;
  onRecover: () => void;
}

function LicenseActivationFields({
  keyInput,
  onKeyInputChange,
  emailInput,
  onEmailInputChange,
  busy,
  error,
  onActivate,
  onRecover,
}: LicenseActivationFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] text-dim">License key</span>
        <input
          autoFocus
          value={keyInput}
          onChange={(event) => onKeyInputChange(event.target.value)}
          placeholder="FCR-XXXXXXXX-XXXXXXXX-XXXXXXXX"
          className="rounded-sm px-3 py-2 font-mono text-[12px] text-readable bg-black/40"
          style={{ border: "var(--border-default)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] text-dim">Email used at purchase</span>
        <input
          value={emailInput}
          onChange={(event) => onEmailInputChange(event.target.value)}
          placeholder="you@example.com"
          className="rounded-sm px-3 py-2 font-mono text-[12px] text-readable bg-black/40"
          style={{ border: "var(--border-default)" }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && keyInput.trim() && emailInput.trim()) onActivate();
          }}
        />
      </label>
      {error ? <p className="font-mono text-[11px] text-red">{error}</p> : null}
      <button
        type="button"
        onClick={onActivate}
        disabled={!keyInput.trim() || !emailInput.trim() || busy}
        className="rounded-pill px-4 py-2.5 font-mono text-[12px] text-black bg-white disabled:opacity-40 transition-precise"
      >
        {busy ? "Activating…" : "Activate"}
      </button>
      <button
        type="button"
        onClick={onRecover}
        disabled={!emailInput.trim() || busy}
        className="font-mono text-[11px] text-dim hover:text-white disabled:opacity-40 transition-precise"
      >
        Resend my license key
      </button>
    </>
  );
}

function LicenseActivationCard({
  title,
  description,
  ...fieldProps
}: { title: string; description: string } & LicenseActivationFieldsProps) {
  return (
    <div className="flex items-center justify-center h-full w-full bg-black p-6">
      <div
        className="flex flex-col gap-5 w-full max-w-md rounded-card p-8"
        style={{ border: "var(--border-active)", background: "var(--color-panel)" }}
        aria-label="Activate Framecraft"
      >
        <div className="flex flex-col gap-1.5">
          <span className="system-label text-red">Framecraft</span>
          <h1 className="text-[18px] text-soft-white">{title}</h1>
          <p className="font-mono text-[12px] text-dim">{description}</p>
        </div>
        <LicenseActivationFields {...fieldProps} />
      </div>
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = getRegisteredShortcuts();
  useShortcut("escape", onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-5 w-full max-w-md rounded-card p-6"
        style={{ border: "var(--border-default)", background: "var(--color-panel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="system-label text-soft-white">KEYBOARD SHORTCUTS</span>
          <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-sm"
              style={{ border: "var(--border-dim)" }}>
              <span className="font-mono text-[12px] text-readable">{s.description}</span>
              <kbd className="font-mono text-[10px] text-amber px-2 py-1 rounded-sm shrink-0"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                {formatShortcutKeys(s.keys)}
              </kbd>
            </div>
          ))}
        </div>
        <span className="font-mono text-[9px] text-dim/40">Press Esc or ⌘/ to close</span>
      </div>
    </div>
  );
}
