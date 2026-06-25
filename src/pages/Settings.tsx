import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  RotateCcw,
  Upload,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { clearAllData, getPrompts, createPrompt } from "@/lib/db";
import { AI_KEY_ANTHROPIC, AI_KEY_OPENAI, validateApiKey, type AIProvider } from "@/lib/aiConfig";
import { formatDiagnosticSummary, runReleaseDiagnostics, type DiagnosticResult } from "@/lib/releaseDiagnostics";
import {
  backupActiveLibrary,
  createLibraryFromDialog,
  exportActiveLibraryFromDialog,
  formatLibraryActionError,
  getLibrarySettingsState,
  migrateCurrentDataToLibraryFromDialog,
  openLibraryFromDialog,
  repairActiveLibraryDatabaseSchema,
  revealActiveLibraryFolder,
  restoreLibraryFromDialog,
  useLocalAppDataLibrary,
  type LibrarySettingsState,
} from "@/lib/librarySettings";
import type { Prompt } from "@/types";
import { cn } from "@/lib/utils";

function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-center gap-3">
        <span className="system-label">{label}</span>
        <div className="flex-1 h-px bg-white/12" />
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] items-baseline gap-5">
      <span className="system-label">{label}</span>
      <span className="font-mono text-[12px] leading-relaxed text-soft-white break-words">{value}</span>
    </div>
  );
}

// ─── API Key Sub-component ────────────────────────────────────

function ApiKeyField({ label, provider, storageKey, placeholder, mask }: {
  label: string; provider: AIProvider; storageKey: string; placeholder: string;
  mask: (v: string) => string;
}) {
  const [value, setValue] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const validation = validateApiKey(provider, value);
  const hasValue = value.trim().length > 0;

  const handleSave = () => {
    if (value.trim()) localStorage.setItem(storageKey, value.trim());
    else localStorage.removeItem(storageKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-widest uppercase text-dim/60">{label}</span>
        {hasValue && (
          <span
            className={`font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm ${validation.valid ? "text-white/40" : "text-red/70"}`}
            style={{ border: validation.valid ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(215,25,33,0.25)" }}
          >
            {validation.valid ? "VALID FORMAT" : "CHECK FORMAT"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={show ? value : mask(value)}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShow(true)}
            placeholder={placeholder}
            className="w-full h-8 pl-3 pr-8 font-mono text-[11px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none transition-precise"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}
          />
          <button type="button" onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-dim/40 hover:text-white transition-precise">
            {show ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSave}>
          {saved ? <><Check size={9} /> Saved</> : "Save"}
        </Button>
      </div>
      {hasValue && !validation.valid && (
        <span className="font-mono text-[9px] text-red/60">{validation.message}</span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function Settings() {
  const { stats, fetchStats } = useDashboardStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [importStatus, setImportStatus] = useState<{ done: number; total: number; finished: boolean } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [libraryState, setLibraryState] = useState<LibrarySettingsState | null>(null);
  const [libraryBusy, setLibraryBusy] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const canRepairLibrarySchema =
    libraryState?.selection.mode === "portable" &&
    libraryState.validation?.errors.includes("Missing database schema");

  useEffect(() => {
    fetchStats();
    getLibrarySettingsState().then(setLibraryState).catch(() => {});
  }, [fetchStats]);

  const refreshLibraryState = async () => {
    setLibraryState(await getLibrarySettingsState());
  };

  const runLibraryAction = async (
    label: string,
    action: () => Promise<string | null | { restartRequired: true }>,
    message?: (result: string | { restartRequired: true }) => string
  ) => {
    setLibraryBusy(label);
    setLibraryError(null);
    setLibraryMessage(null);
    try {
      const result = await action();
      if (result) {
        setLibraryMessage(
          message
            ? message(result)
            : typeof result === "string"
              ? "Library package created. Use Migrate Current Data to make it active with your current work."
              : "Library selected. Restart Framecraft to use it."
        );
      }
      await refreshLibraryState();
    } catch (error) {
      setLibraryError(formatLibraryActionError(error));
    } finally {
      setLibraryBusy(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const prompts = await getPrompts();
      const data = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), prompts }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `framecraft-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagnosticsRunning(true);
    try {
      setDiagnostics(await runReleaseDiagnostics());
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  const handleCreateLibrary = () => {
    runLibraryAction("create", createLibraryFromDialog);
  };

  const handleOpenLibrary = () => {
    runLibraryAction("open", openLibraryFromDialog);
  };

  const handleMigrateLibrary = () => {
    runLibraryAction("migrate", migrateCurrentDataToLibraryFromDialog);
  };

  const handleBackupLibrary = () => {
    runLibraryAction("backup", backupActiveLibrary, (path) => `Backup created and validated: ${String(path)}`);
  };

  const handleExportLibrary = () => {
    runLibraryAction("export", exportActiveLibraryFromDialog, (path) => `Export copy created and validated: ${String(path)}`);
  };

  const handleRestoreLibrary = () => {
    runLibraryAction("restore", restoreLibraryFromDialog, () => "Backup/library selected. Restart Framecraft to use it.");
  };

  const handleRepairLibrarySchema = () => {
    runLibraryAction(
      "repair-schema",
      async () => {
        await repairActiveLibraryDatabaseSchema();
        return "repaired";
      },
      () => "Library database schema repaired. Restart Framecraft, then run diagnostics again."
    );
  };

  const handleRevealLibrary = () => {
    runLibraryAction("reveal", async () => {
      await revealActiveLibraryFolder();
      return null;
    });
  };

  const handleUseLocalLibrary = () => {
    useLocalAppDataLibrary();
    setLibraryMessage("Local app-data storage selected. Restart Framecraft to use it.");
    setLibraryError(null);
    refreshLibraryState();
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      let data: { version: number; prompts: Prompt[] };
      try {
        data = JSON.parse(await file.text()) as { version: number; prompts: Prompt[] };
      } catch {
        alert("Failed to read import file.");
        return;
      }
      if (!data.prompts || !Array.isArray(data.prompts)) {
        alert("Invalid export file format.");
        return;
      }
      const total = data.prompts.length;
      setImportStatus({ done: 0, total, finished: false });
      let done = 0;
      for (const p of data.prompts) {
        await createPrompt({
          title: p.title,
          description: p.description ?? undefined,
          provider: p.provider,
          category: p.category ?? undefined,
          use_case: p.use_case ?? undefined,
          prompt_text: p.prompt_text,
          avoidance_text: p.avoidance_text ?? undefined,
          aspect_ratio: p.aspect_ratio ?? undefined,
          model_version: p.model_version ?? undefined,
          camera: p.camera ?? undefined,
          lens: p.lens ?? undefined,
          lighting: p.lighting ?? undefined,
          style_ref: p.style_ref ?? undefined,
          parameters: p.parameters ?? undefined,
          tags: p.tags ?? undefined,
          rating: p.rating ?? undefined,
          ai_look_risk: p.ai_look_risk ?? undefined,
          is_winner: p.is_winner ?? undefined,
          is_failed: p.is_failed ?? undefined,
          is_recipe: p.is_recipe ?? undefined,
          failure_notes: p.failure_notes ?? undefined,
          notes: p.notes ?? undefined,
          version: p.version ?? undefined,
        });
        done++;
        setImportStatus({ done, total, finished: false });
      }
      setImportStatus({ done, total, finished: true });
      fetchStats();
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    setClearing(true);
    try {
      await clearAllData();
      setCleared(true);
      setConfirmClear(false);
      fetchStats();
    } finally {
      setClearing(false);
    }
  };

  return (
    <PageContainer title="Settings" subtitle="APP CONFIGURATION">
      <div className="flex flex-col gap-10 max-w-3xl">

        {/* App Info */}
        <Section label="APPLICATION" className="order-50">
          <div
            className="flex flex-col gap-4 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className="text-readable" />
              <span className="font-sans text-[12px] font-semibold text-white tracking-wide">FRAMECRAFT</span>
            </div>
            <InfoRow label="VERSION" value="1.0.0" />
            <InfoRow label="BUILD" value="V1 · All Phases Complete" />
            <InfoRow label="ENGINE" value="Tauri 2 · React 19 · SQLite" />
            <InfoRow label="MODE" value={typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "Native (Tauri)" : "Browser (Dev)"} />
          </div>
        </Section>

        {/* Database Stats */}
        <Section label="DATABASE" className="order-60">
          <div
            className="flex flex-col gap-4 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Database size={13} className="text-readable" />
              <span className="font-sans text-[12px] font-semibold text-white tracking-wide">STORAGE</span>
            </div>
            <InfoRow label="LOCATION" value={typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "~/.local/share/framecraft/framecraft.db" : "localStorage (dev)"} />
            <InfoRow label="TOTAL PROMPTS" value={stats.total_prompts} />
            <InfoRow label="TOTAL RESULTS" value={stats.total_results} />
            <InfoRow label="TOTAL RECIPES" value={stats.total_recipes} />
            <InfoRow label="WINNERS" value={stats.total_winners} />
          </div>
        </Section>

        <Section label="LIBRARY" className="order-10">
          <div
            className="flex flex-col gap-6 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <HardDrive size={13} className="text-readable mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="font-sans text-[12px] font-semibold text-white tracking-wide">ACTIVE STORAGE</span>
                  <span className="font-mono text-[11px] text-readable leading-relaxed">
                    Use a `.framecraftlib` folder to move work between machines or store it on shared storage.
                  </span>
                </div>
              </div>
              {libraryState?.selection.mode === "portable" && (
                <span className="font-mono text-[8.5px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
                  Restart required
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <InfoRow label="MODE" value={libraryState?.selection.mode === "portable" ? "Portable library" : "Local app data"} />
              <InfoRow label="PATH" value={libraryState?.paths.baseDir ?? "Checking..."} />
              <InfoRow
                label="STATUS"
                value={
                  libraryState?.validation
                    ? libraryState.validation.ok
                      ? "Valid library package"
                      : libraryState.validation.errors.join(", ")
                    : libraryState?.nativeAvailable
                      ? "Local default"
                      : "Native app required"
                }
              />
            </div>

            {canRepairLibrarySchema && (
              <div
                className="flex flex-col gap-3 p-3 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.28)", background: "rgba(215,25,33,0.055)" }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-red/75 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-sans text-[12px] font-semibold text-white tracking-wide">DATABASE SCHEMA MISSING</span>
                    <span className="font-mono text-[10.5px] text-readable leading-relaxed">
                      Initialize the empty portable database for this library. Existing partial databases are refused to protect data.
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRepairLibrarySchema}
                  disabled={!!libraryBusy || !libraryState?.nativeAvailable}
                  className="self-start"
                >
                  <Database size={11} />
                  {libraryBusy === "repair-schema" ? "Repairing..." : "Repair Database Schema"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="ghost" size="sm" onClick={handleMigrateLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <Upload size={11} />
                {libraryBusy === "migrate" ? "Migrating..." : "Migrate Current Data"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleBackupLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <Download size={11} />
                {libraryBusy === "backup" ? "Backing up..." : "Backup Active"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleOpenLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <FolderOpen size={11} />
                {libraryBusy === "open" ? "Opening..." : "Open Library"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRestoreLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <RotateCcw size={11} />
                {libraryBusy === "restore" ? "Opening..." : "Open Backup"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCreateLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <FolderPlus size={11} />
                {libraryBusy === "create" ? "Creating..." : "Create Package"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <Download size={11} />
                {libraryBusy === "export" ? "Exporting..." : "Export Copy"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRevealLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                <FolderOpen size={11} />
                Reveal Folder
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={handleUseLocalLibrary}
              disabled={!!libraryBusy || libraryState?.selection.mode !== "portable"}>
              <RotateCcw size={10} />
              Use Local App Data
            </Button>

            {libraryMessage && (
              <div className="font-mono text-[10px] text-white/50">
                <Check size={10} className="inline mr-1 text-white/40" />
                {libraryMessage}
              </div>
            )}
            {libraryError && (
              <div className="font-mono text-[10px] text-red/70 leading-relaxed">
                <AlertTriangle size={10} className="inline mr-1" />
                {libraryError}
              </div>
            )}
          </div>
        </Section>

        {/* AI Integration */}
        <Section label="AI INTEGRATION" className="order-30">
          <div className="flex flex-col gap-5 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center gap-2">
              <Cpu size={13} className="text-readable" />
              <span className="font-sans text-[12px] font-semibold text-white tracking-wide">API KEYS</span>
            </div>
            <p className="font-mono text-[11px] text-readable leading-relaxed -mt-2">
              Keys are stored locally and never leave your device.
            </p>
            <ApiKeyField
              label="Anthropic"
              provider="anthropic"
              storageKey={AI_KEY_ANTHROPIC}
              placeholder="sk-ant-api03-…"
              mask={(v) => v.length > 8 ? `sk-ant-${"·".repeat(14)}${v.slice(-4)}` : v}
            />
            <ApiKeyField
              label="OpenAI"
              provider="openai"
              storageKey={AI_KEY_OPENAI}
              placeholder="sk-proj-…"
              mask={(v) => v.length > 8 ? `sk-proj-${"·".repeat(12)}${v.slice(-4)}` : v}
            />

          </div>
        </Section>

        <Section label="RELEASE DIAGNOSTICS" className="order-20">
          <div className="flex flex-col gap-5 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="font-sans text-[12px] font-semibold text-white tracking-wide">NATIVE READINESS</span>
                <span className="font-mono text-[11px] text-readable leading-relaxed">
                  Checks Tauri runtime, required SQLite tables, file storage, and native dialog plugin availability.
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={handleRunDiagnostics} disabled={diagnosticsRunning} className="shrink-0 min-w-[126px]">
                {diagnosticsRunning ? "Running..." : "Run Checks"}
              </Button>
            </div>

            {diagnostics && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-dim/60">
                    {formatDiagnosticSummary(diagnostics)}
                  </span>
                  <span className="font-mono text-[8px] text-dim/35">
                    {new Date(diagnostics.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {diagnostics.checks.map((check) => (
                    <div key={check.id} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2.5 rounded-sm"
                      style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.025)" }}>
                      <span className={`font-mono text-[8px] tracking-widest uppercase ${
                        check.status === "pass" ? "text-white/60" : check.status === "fail" ? "text-red/70" : "text-dim/50"
                      }`}>
                        {check.status}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[11px] text-soft-white">{check.label}</span>
                        <span className="font-mono text-[10px] text-readable leading-relaxed">{check.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Export / Import */}
        <Section label="BACKUP" className="order-40">
          <div
            className="flex flex-col gap-5 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <p className="font-mono text-[11px] text-readable leading-relaxed">
              Export your prompt library as JSON to back it up or transfer to another device.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting || stats.total_prompts === 0}
              >
                <Download size={11} />
                {exporting ? "Exporting…" : `Export Library (${stats.total_prompts} prompts)`}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImport}
                disabled={importStatus !== null && !importStatus.finished}>
                <Upload size={11} />
                Import JSON
              </Button>
            </div>
            {importStatus && (
              <div className="font-mono text-[10px] text-white/50">
                {importStatus.finished
                  ? <span className="flex items-center gap-1.5"><Check size={10} className="text-white/40" /> Imported {importStatus.done} of {importStatus.total} prompts.</span>
                  : `Importing… ${importStatus.done} / ${importStatus.total}`}
              </div>
            )}
          </div>
        </Section>

        {/* Danger Zone */}
        <Section label="DANGER ZONE" className="order-70">
          <div
            className="flex flex-col gap-5 p-5 rounded-card"
            style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-red/60 mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[12px] font-semibold text-red/80">CLEAR ALL DATA</span>
                <p className="font-mono text-[11px] text-readable leading-relaxed">
                  This will permanently delete all prompts, results, recipes, and SREFs. This action cannot be undone.
                </p>
              </div>
            </div>

            {cleared && (
              <div className="font-mono text-[10px] text-white/50">
                All data cleared successfully.
              </div>
            )}

            {confirmClear && (
              <div
                className="px-3 py-2 rounded-sm font-mono text-[10px] text-red/80"
                style={{ border: "var(--border-active)", background: "rgba(215,25,33,0.08)" }}
              >
                Click the button again to confirm. This cannot be undone.
              </div>
            )}

            <Button
              variant={confirmClear ? "primary" : "ghost"}
              size="sm"
              onClick={handleClearAll}
              disabled={clearing}
              className={confirmClear ? "border-red/60 text-red bg-red/10" : "text-red/60 border-red/20 hover:border-red/40"}
            >
              <AlertTriangle size={10} />
              {clearing ? "Clearing…" : confirmClear ? "Confirm — Clear All Data" : "Clear All Data"}
            </Button>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
