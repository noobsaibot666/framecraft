import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
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
  Settings2,
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
  getActiveSharedIngestStatus,
  getLibrarySettingsState,
  importLibraryIntoActiveFromDialog,
  isRepairableLibraryPackageError,
  migrateCurrentDataToLibraryFromDialog,
  openLibraryFromDialog,
  processActiveSharedIngestInbox,
  repairActiveLibraryDatabaseSchema,
  revealActiveLibraryFolder,
  retryActiveFailedSharedIngestJobs,
  restoreLibraryFromDialog,
  useLocalAppDataLibrary,
  type LibrarySettingsState,
} from "@/lib/librarySettings";
import type { SharedIngestStatus } from "@/lib/sharedIngest";
import {
  getPreferences,
  PREF_ASPECT_RATIOS,
  PREF_CATEGORIES,
  PREF_LIBRARY_PAGE_SIZES,
  resetPreferences,
  setDefaultAspectRatio,
  setDefaultCategory,
  setDefaultProvider,
  setAutoAnalyzeDraft,
  setLibraryPageSize,
  type UserPreferences,
} from "@/lib/userPreferences";
import { SUPPORTED_CREATIVE_PROVIDERS } from "@/lib/appInfo";
import { getLibraryHealth, EMPTY_LIBRARY_HEALTH, type LibraryHealth } from "@/lib/libraryHealth";
import { useNavigate } from "react-router-dom";
import type { Prompt } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { getRegisteredShortcuts, formatShortcutKeys } from "@/lib/shortcuts";

function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <div className="flex items-center gap-3">
        <span className="system-label text-[13px] text-white">{label}</span>
        <div className="flex-1 h-px bg-white/22" />
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-baseline gap-7">
      <span className="system-label text-[11.5px] text-readable">{label}</span>
      <span className="font-mono text-[13.5px] leading-relaxed text-white wrap-break-word">{value}</span>
    </div>
  );
}

function CopyableError({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy error"
      className="group flex w-full items-start gap-3 rounded-sm p-4 text-left transition-precise hover:bg-red/8"
      style={{ border: "1px solid rgba(215,25,33,0.28)", background: "rgba(215,25,33,0.045)" }}
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red/80" />
      <span className="min-w-0 flex-1 font-mono text-[12px] leading-relaxed text-red/85 wrap-break-word">
        {message}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-readable group-hover:text-white">
        {copied ? <Check size={10} className="text-cyan" /> : <Copy size={10} />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
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
    toast.success(`${label} saved`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest uppercase text-readable">{label}</span>
        {hasValue && (
          <span
            className={`font-mono text-[9.5px] tracking-widest uppercase px-2 py-1 rounded-sm ${validation.valid ? "text-readable" : "text-red"}`}
            style={{ border: validation.valid ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(215,25,33,0.42)" }}
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
            className="w-full h-10 pl-3 pr-9 font-mono text-[13px] text-soft-white placeholder:text-readable/60 bg-dark rounded-sm focus:outline-none transition-precise"
            style={{ border: "1px solid rgba(255,255,255,0.24)" }}
          />
          <button type="button" onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-readable hover:text-cyan transition-precise">
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSave}>
          {saved ? <><Check size={9} /> Saved</> : "Save"}
        </Button>
      </div>
      {hasValue && !validation.valid && (
        <span className="font-mono text-[11px] text-red">{validation.message}</span>
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
  const [prefs, setPrefs] = useState<UserPreferences>(() => getPreferences());
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<{ done: number; total: number; finished: boolean } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [libraryState, setLibraryState] = useState<LibrarySettingsState | null>(null);
  const [libraryBusy, setLibraryBusy] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [sharedIngestStatus, setSharedIngestStatus] = useState<SharedIngestStatus | null>(null);
  const [health, setHealth] = useState<LibraryHealth>(EMPTY_LIBRARY_HEALTH);
  const navigate = useNavigate();

  const canRepairLibraryPackage =
    libraryState?.selection.mode === "portable" &&
    libraryState.validation?.errors.some(isRepairableLibraryPackageError);

  useEffect(() => {
    fetchStats();
    refreshLibraryState();
    getLibraryHealth().then(setHealth).catch(() => {});
  }, [fetchStats]);

  const refreshLibraryState = async () => {
    const state = await getLibrarySettingsState();
    setLibraryState(state);
    setSharedIngestStatus(await getActiveSharedIngestStatus().catch(() => null));
  };

  const runLibraryAction = async <T,>(
    label: string,
    action: () => Promise<T | null>,
    message?: (result: T) => string
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
              : isRestartResult(result)
                ? "Library selected. Restart Framecraft to use it."
                : "Library action completed."
        );
      }
      await refreshLibraryState();
      fetchStats();
    } catch (error) {
      setLibraryError(formatLibraryActionError(error));
    } finally {
      setLibraryBusy(null);
    }
  };

  const isRestartResult = (result: unknown): result is { restartRequired: true } =>
    Boolean(result && typeof result === "object" && "restartRequired" in result);

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

  const handleImportLibraryIntoActive = () => {
    runLibraryAction(
      "merge-library",
      importLibraryIntoActiveFromDialog,
      (report) => report
        ? `Library merged. Prompts ${report.prompts.imported} imported, ${report.prompts.skippedDuplicates} skipped, ${report.prompts.remapped} remapped. Results ${report.results.imported} imported, ${report.results.skippedDuplicates} skipped, ${report.results.remapped} remapped. References ${report.references.imported} imported, ${report.references.skippedDuplicates} skipped, ${report.references.remapped} remapped.`
        : "Library import cancelled."
    );
  };

  const handleRepairLibraryPackage = () => {
    runLibraryAction(
      "repair-package",
      async () => {
        await repairActiveLibraryDatabaseSchema();
        return "repaired";
      },
      () => "Library package repaired. Restart Framecraft, then run diagnostics again."
    );
  };

  const handleProcessSharedIngest = () => {
    runLibraryAction(
      "process-shared-ingest",
      async () => {
        const result = await processActiveSharedIngestInbox();
        return `Applied ${result.applied}, skipped ${result.skipped}, failed ${result.failed}.`;
      },
      (message) => String(message)
    );
  };

  const handleRetryFailedSharedIngest = () => {
    runLibraryAction(
      "retry-shared-ingest",
      async () => {
        const result = await retryActiveFailedSharedIngestJobs();
        return `Retried ${result.retried}, skipped ${result.skipped}.`;
      },
      (message) => String(message)
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

  const savePrefs = (next: UserPreferences) => {
    setDefaultProvider(next.defaultProvider);
    setDefaultAspectRatio(next.defaultAspectRatio);
    setDefaultCategory(next.defaultCategory);
    setAutoAnalyzeDraft(next.autoAnalyzeDraft);
    setLibraryPageSize(next.libraryPageSize);
    setPrefs(next);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const handleResetPrefs = () => {
    resetPreferences();
    setPrefs(getPreferences());
  };

  return (
    <PageContainer title="Settings" subtitle="APP CONFIGURATION">
      <div className="flex flex-col gap-14 max-w-5xl">

        {/* Preferences */}
        <Section label="PREFERENCES" className="order-05">
          <div className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center gap-3">
              <Settings2 size={15} className="text-readable" />
              <span className="font-sans text-[14px] font-semibold text-white tracking-wide">CRAFT DEFAULTS</span>
            </div>
            <p className="font-mono text-[12px] text-readable leading-relaxed -mt-2">
              Applied when starting a new prompt with no project context.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Default provider */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] tracking-widest uppercase text-readable">Default Provider</span>
                <select
                  value={prefs.defaultProvider}
                  onChange={(e) => savePrefs({ ...prefs, defaultProvider: e.target.value })}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                >
                  {SUPPORTED_CREATIVE_PROVIDERS.map((p) => (
                    <option key={p} value={p.toLowerCase().replace(/\s+/g, "_")}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Default aspect ratio */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] tracking-widest uppercase text-readable">Default Aspect Ratio</span>
                <select
                  value={prefs.defaultAspectRatio}
                  onChange={(e) => savePrefs({ ...prefs, defaultAspectRatio: e.target.value })}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                >
                  {PREF_ASPECT_RATIOS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Default category */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] tracking-widest uppercase text-readable">Default Category</span>
                <select
                  value={prefs.defaultCategory}
                  onChange={(e) => savePrefs({ ...prefs, defaultCategory: e.target.value })}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                >
                  {PREF_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Library page size */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] tracking-widest uppercase text-readable">Prompts per Page</span>
                <select
                  value={prefs.libraryPageSize}
                  onChange={(e) => savePrefs({ ...prefs, libraryPageSize: parseInt(e.target.value, 10) })}
                  className="h-10 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                >
                  {PREF_LIBRARY_PAGE_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <span className="font-mono text-[9px] text-dim/50">Applies to Prompt Library pagination</span>
              </div>

              {/* Auto-analyze */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] tracking-widest uppercase text-readable">Auto-Analyze Draft</span>
                <label className="flex items-center gap-3 cursor-pointer h-10">
                  <div
                    onClick={() => savePrefs({ ...prefs, autoAnalyzeDraft: !prefs.autoAnalyzeDraft })}
                    className={`relative w-10 h-5 rounded-pill transition-precise cursor-pointer ${prefs.autoAnalyzeDraft ? "bg-cyan/30" : "bg-white/10"}`}
                    style={{ border: prefs.autoAnalyzeDraft ? "1px solid rgba(0,255,200,0.4)" : "var(--border-dim)" }}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${prefs.autoAnalyzeDraft ? "left-5 bg-cyan" : "left-0.5 bg-white/30"}`}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-readable">
                    {prefs.autoAnalyzeDraft ? "On — runs on draft assembly" : "Off — manual only"}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {prefsSaved && (
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
                  <Check size={10} /> Saved
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={handleResetPrefs} className="ml-auto">
                <RotateCcw size={10} />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </Section>

        {/* Library Health */}
        <Section label="LIBRARY HEALTH" className="order-06">
          <div className="flex flex-col gap-5 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center gap-3">
              <Database size={15} className="text-readable" />
              <span className="font-sans text-[14px] font-semibold text-white tracking-wide">PRODUCTION QUALITY</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "PROMPTS", value: health.totalPrompts },
                { label: "RATED", value: `${health.ratedCount} (${health.ratedPercent}%)` },
                { label: "WINNERS", value: health.winnerCount },
                { label: "FAILED", value: health.failedCount },
                { label: "UNREVIEWED", value: health.unreviewedResults },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-1 p-3 rounded-sm"
                  style={{ background: "rgba(255,255,255,0.04)", border: "var(--border-default)" }}>
                  <span className="font-mono text-[9px] tracking-widest uppercase text-readable">{s.label}</span>
                  <span className="font-mono text-[16px] text-white">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Top tokens */}
            {health.topTokens.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Top Performing Tokens</span>
                <div className="flex flex-wrap gap-2">
                  {health.topTokens.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => navigate(`/tokens/${t.id}`)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-[11px] text-white hover:bg-white/15 transition-precise"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                      {t.text}
                      <span className="text-white/40">{t.quality_score.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Negative tokens */}
            {health.negativeTokens.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Flagged Tokens</span>
                <div className="flex flex-wrap gap-2">
                  {health.negativeTokens.map((t) => (
                    <span key={t.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-[11px] text-white"
                      style={{ background: "rgba(215,25,33,0.1)", border: "1px solid rgba(215,25,33,0.3)" }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red/60 shrink-0" />
                      {t.text}
                      <span className="text-white/40">{t.quality_score.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              {health.unreviewedResults > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/results?filter=unreviewed")}>
                  <Eye size={11} />
                  Review {health.unreviewedResults} Pending
                </Button>
              )}
              {health.failedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/library?filter=failed")}>
                  <AlertTriangle size={11} />
                  {health.failedCount} Failed Prompts
                </Button>
              )}
            </div>
          </div>
        </Section>

        {/* Keyboard Shortcuts */}
        <Section label="KEYBOARD SHORTCUTS" className="order-45">
          <div
            className="flex flex-col gap-0 rounded-card overflow-hidden"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            {getRegisteredShortcuts().map(({ keys, description }) => (
              <div
                key={keys}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "var(--border-dim)" }}
              >
                <span className="font-mono text-[11px] text-readable">{description}</span>
                <kbd className="font-mono text-[11px] text-cyan/80 px-2 py-0.5 rounded-sm"
                  style={{ background: "rgba(0,255,200,0.06)", border: "1px solid rgba(0,255,200,0.18)" }}>
                  {formatShortcutKeys(keys)}
                </kbd>
              </div>
            ))}
          </div>
        </Section>

        {/* App Info */}
        <Section label="APPLICATION" className="order-50">
          <div
            className="flex flex-col gap-5 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Info size={15} className="text-readable" />
              <span className="font-sans text-[14px] font-semibold text-white tracking-wide">FRAMECRAFT</span>
            </div>
            <InfoRow label="VERSION" value="1.0.0" />
            <InfoRow label="BUILD" value="Sprint 23 · Phase 167–170 Complete" />
            <InfoRow label="ENGINE" value="Tauri 2 · React 19 · SQLite" />
            <InfoRow label="MODE" value={typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "Native (Tauri)" : "Browser (Dev)"} />
          </div>
        </Section>

        {/* Database Stats */}
        <Section label="DATABASE" className="order-60">
          <div
            className="flex flex-col gap-5 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Database size={15} className="text-readable" />
              <span className="font-sans text-[14px] font-semibold text-white tracking-wide">STORAGE</span>
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
            className="flex flex-col gap-7 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <HardDrive size={15} className="text-readable mt-0.5 shrink-0" />
                <div className="flex flex-col gap-2 min-w-0">
                  <span className="font-sans text-[14px] font-semibold text-white tracking-wide">ACTIVE STORAGE</span>
                  <span className="font-mono text-[12px] text-readable leading-relaxed">
                    Use a `.framecraftlib` folder to move work between machines or store it on shared storage.
                  </span>
                </div>
              </div>
              {libraryState?.selection.mode === "portable" && (
                <span className="font-mono text-[8.5px] tracking-widest uppercase px-2 py-1 rounded-sm text-readable"
                  style={{ border: "1px solid rgba(255,255,255,0.22)" }}>
                  Restart required
                </span>
              )}
            </div>

            {/* Connection state banner */}
            {libraryState?.selection.mode === "portable" ? (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-sm"
                style={{ background: "rgba(0,255,200,0.05)", border: "1px solid rgba(0,255,200,0.2)" }}
              >
                <span className="w-2 h-2 rounded-full bg-cyan shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-cyan/80">Portable Library Connected</span>
                  <p className="font-mono text-[10px] text-readable/70 mt-0.5 truncate">{libraryState.paths.baseDir}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRevealLibrary} disabled={!!libraryBusy || !libraryState?.nativeAvailable}>
                  <FolderOpen size={10} /> Reveal
                </Button>
              </div>
            ) : libraryState?.nativeAvailable ? (
              <div
                className="flex items-start gap-3 px-4 py-4 rounded-sm"
                style={{ background: "rgba(255,255,255,0.03)", border: "var(--border-dim)" }}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-readable/60">No Library Connected</span>
                  <p className="font-mono text-[10px] text-dim/50 mt-1 leading-relaxed">
                    Create a new package or open an existing one from a NAS or shared folder.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button variant="primary" size="sm" onClick={handleOpenLibrary} disabled={!!libraryBusy}>
                    <FolderOpen size={10} /> Connect Library
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCreateLibrary} disabled={!!libraryBusy}>
                    <FolderPlus size={10} /> Create Package
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-4">
              <InfoRow label="MODE" value={libraryState?.selection.mode === "portable" ? "Portable library" : "Local app data"} />
              <InfoRow label="PATH" value={libraryState?.paths.baseDir ?? "Checking..."} />
              {libraryState?.selection.mode === "portable" && (
                <InfoRow
                  label="WRITER"
                  value={
                    libraryState.activeLock
                      ? `${libraryState.activeLock.user} on ${libraryState.activeLock.machine} · ${new Date(libraryState.activeLock.updated_at).toLocaleString()}`
                      : "No active writer lock"
                  }
                />
              )}
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

            {libraryState?.selection.mode === "portable" && sharedIngestStatus && (
              <div
                className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-sm"
                style={{ border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.035)" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="system-label">PENDING</span>
                  <span className="font-mono text-[20px] text-soft-white">{sharedIngestStatus.pending}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="system-label">FAILED</span>
                  <span className={cn("font-mono text-[20px]", sharedIngestStatus.failed ? "text-red" : "text-soft-white")}>
                    {sharedIngestStatus.failed}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="system-label">APPLIED</span>
                  <span className="font-mono text-[20px] text-soft-white">{sharedIngestStatus.applied}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="system-label">LAST SYNC</span>
                  <span className="font-mono text-[11px] text-readable wrap-break-word">
                    {sharedIngestStatus.lastAppliedAt ? new Date(sharedIngestStatus.lastAppliedAt).toLocaleString() : "No jobs applied"}
                  </span>
                </div>
              </div>
            )}

            {canRepairLibraryPackage && (
              <div
                className="flex flex-col gap-4 p-4 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.28)", background: "rgba(215,25,33,0.055)" }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-red/75 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-sans text-[13px] font-semibold text-white tracking-wide">LIBRARY PACKAGE NEEDS REPAIR</span>
                    <span className="font-mono text-[11.5px] text-readable leading-relaxed">
                      Initialize missing package folders or an empty database schema. Existing partial databases are refused to protect data.
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRepairLibraryPackage}
                  disabled={!!libraryBusy || !libraryState?.nativeAvailable}
                  className="self-start"
                >
                  <Database size={11} />
                  {libraryBusy === "repair-package" ? "Repairing..." : "Repair Library Package"}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleImportLibraryIntoActive}
                disabled={!!libraryBusy || !libraryState?.nativeAvailable || libraryState?.selection.mode !== "portable"}
              >
                <Upload size={11} />
                {libraryBusy === "merge-library" ? "Importing..." : "Import Library"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleProcessSharedIngest}
                disabled={!!libraryBusy || !libraryState?.nativeAvailable || libraryState?.selection.mode !== "portable"}
              >
                <Database size={11} />
                {libraryBusy === "process-shared-ingest" ? "Processing..." : "Process Shared Inbox"}
              </Button>
              <Button
                variant={sharedIngestStatus?.failed ? "accent" : "ghost"}
                size="sm"
                onClick={handleRetryFailedSharedIngest}
                disabled={!!libraryBusy || !sharedIngestStatus?.failed || libraryState?.selection.mode !== "portable"}
              >
                <RotateCcw size={11} />
                {libraryBusy === "retry-shared-ingest" ? "Retrying..." : "Retry Failed Jobs"}
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
              <CopyableError message={libraryError} />
            )}
          </div>
        </Section>

        {/* AI Integration */}
        <Section label="AI INTEGRATION" className="order-30">
          <div className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center gap-3">
              <Cpu size={15} className="text-readable" />
              <span className="font-sans text-[14px] font-semibold text-white tracking-wide">API KEYS</span>
            </div>
            <p className="font-mono text-[12px] text-readable leading-relaxed -mt-2">
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
          <div className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 min-w-0">
                <span className="font-sans text-[14px] font-semibold text-white tracking-wide">NATIVE READINESS</span>
                <span className="font-mono text-[12px] text-readable leading-relaxed">
                  Checks runtime, SQLite schema, file storage, dialogs, active library, and shared-library folders.
                </span>
              </div>
              <Button variant="accent" size="md" onClick={handleRunDiagnostics} disabled={diagnosticsRunning} className="shrink-0 min-w-37.5">
                {diagnosticsRunning ? "Running..." : "Run Checks"}
              </Button>
            </div>

            {diagnostics && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-muted">
                    {formatDiagnosticSummary(diagnostics)}
                  </span>
                  <span className="font-mono text-[10px] text-readable">
                    {new Date(diagnostics.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {diagnostics.checks.map((check) => (
                    <div key={check.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 px-4 py-3.5 rounded-sm"
                      style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.035)" }}>
                      <span className={`font-mono text-[10px] tracking-widest uppercase ${
                        check.status === "pass" ? "text-readable" : check.status === "fail" ? "text-red" : "text-muted"
                      }`}>
                        {check.status}
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-mono text-[13px] text-soft-white">{check.label}</span>
                        {check.status === "fail" ? (
                          <CopyableError message={check.message} />
                        ) : (
                          <span className="font-mono text-[11.5px] text-readable leading-relaxed">{check.message}</span>
                        )}
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
            className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <p className="font-mono text-[12px] text-readable leading-relaxed">
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
              <div className="font-mono text-[11px] text-readable">
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
            className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-red/60 mt-0.5 shrink-0" />
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[14px] font-semibold text-red">CLEAR ALL DATA</span>
                <p className="font-mono text-[12px] text-readable leading-relaxed">
                  This will permanently delete all prompts, results, recipes, and SREFs. This action cannot be undone.
                </p>
              </div>
            </div>

            {cleared && (
              <div className="font-mono text-[11px] text-readable">
                All data cleared successfully.
              </div>
            )}

            {confirmClear && (
              <div
                className="px-4 py-3 rounded-sm font-mono text-[11px] text-red"
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
