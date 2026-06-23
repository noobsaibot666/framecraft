import { useEffect, useState } from "react";
import { AlertTriangle, Download, Upload, Database, Info } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { clearAllData, getPrompts } from "@/lib/db";
import type { Prompt } from "@/types";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="system-label">{label}</span>
        <div className="flex-1 h-px bg-white/7" />
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="system-label w-40 shrink-0">{label}</span>
      <span className="font-mono text-[11px] text-soft-white">{value}</span>
    </div>
  );
}

export function Settings() {
  const { stats, fetchStats } = useDashboardStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { version: number; prompts: Prompt[] };
        if (!data.prompts || !Array.isArray(data.prompts)) {
          alert("Invalid export file format.");
          return;
        }
        // Future: batch import prompts
        alert(`Found ${data.prompts.length} prompts in export. Full import will be available in a future update.`);
      } catch {
        alert("Failed to read import file.");
      }
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
      <div className="flex flex-col gap-8 max-w-xl">

        {/* App Info */}
        <Section label="APPLICATION">
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Info size={12} className="text-dim" />
              <span className="font-sans text-[11px] font-semibold text-white tracking-wide">FRAMECRAFT</span>
            </div>
            <InfoRow label="VERSION" value="0.1.0" />
            <InfoRow label="BUILD" value="Phase 01 Foundation" />
            <InfoRow label="ENGINE" value="Tauri 2 · React 19 · SQLite" />
            <InfoRow label="MODE" value={typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "Native (Tauri)" : "Browser (Dev)"} />
          </div>
        </Section>

        {/* Database Stats */}
        <Section label="DATABASE">
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Database size={12} className="text-dim" />
              <span className="font-sans text-[11px] font-semibold text-white tracking-wide">STORAGE</span>
            </div>
            <InfoRow label="LOCATION" value={typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? "~/.local/share/framecraft/framecraft.db" : "localStorage (dev)"} />
            <InfoRow label="TOTAL PROMPTS" value={stats.total_prompts} />
            <InfoRow label="TOTAL RESULTS" value={stats.total_results} />
            <InfoRow label="TOTAL RECIPES" value={stats.total_recipes} />
            <InfoRow label="WINNERS" value={stats.total_winners} />
          </div>
        </Section>

        {/* Export / Import */}
        <Section label="BACKUP">
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <p className="font-mono text-[10px] text-muted leading-relaxed">
              Export your prompt library as JSON to back it up or transfer to another device.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting || stats.total_prompts === 0}
              >
                <Download size={11} />
                {exporting ? "Exporting…" : `Export Library (${stats.total_prompts} prompts)`}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImport}>
                <Upload size={11} />
                Import JSON
              </Button>
            </div>
          </div>
        </Section>

        {/* Danger Zone */}
        <Section label="DANGER ZONE">
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-red/60 mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[11px] font-semibold text-red/80">CLEAR ALL DATA</span>
                <p className="font-mono text-[10px] text-muted leading-relaxed">
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
