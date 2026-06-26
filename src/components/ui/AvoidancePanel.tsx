import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { getAvoidancePatterns, getFailedResultArtifacts, createAvoidancePattern, deleteAvoidancePattern } from "@/lib/db";
import { detectRisks, calculateRiskScore } from "@/lib/avoidanceEngine";
import { cn } from "@/lib/utils";
import type { AvoidancePattern, DetectedRisk } from "@/types";

interface AvoidancePanelProps {
  promptText: string;
  category?: string;
  provider?: string;
  onAddCorrection: (text: string) => void;
  onRiskScoreChange: (score: number) => void;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red",
  high: "bg-red/60",
  medium: "bg-white/40",
  low: "bg-white/20",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

function RiskItem({
  risk,
  dismissed,
  onAddCorrection,
  onDismiss,
}: {
  risk: DetectedRisk;
  dismissed: boolean;
  onAddCorrection: (text: string) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { pattern } = risk;

  if (dismissed) return null;

  return (
    <div
      className="flex flex-col rounded-sm overflow-hidden"
      style={{ border: "var(--border-default)" }}
    >
      {/* Header row */}
      <div className="flex min-h-10 items-center gap-2.5 px-3 py-2.5">
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", SEVERITY_DOT[pattern.severity] ?? "bg-white/20")}
        />
        <span className="font-mono text-[10px] text-readable tracking-widest uppercase shrink-0">
          {SEVERITY_LABEL[pattern.severity]}
        </span>
        <span className="flex-1 font-mono text-[11px] text-soft-white truncate">{pattern.label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-readable hover:text-cyan transition-precise"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-readable hover:text-red transition-precise"
            title="Dismiss"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="flex flex-col gap-2 px-3 pb-3"
          style={{ borderTop: "var(--border-dim)" }}
        >
          {pattern.description && (
            <p className="font-mono text-[11px] text-readable leading-relaxed pt-2">{pattern.description}</p>
          )}
          {risk.triggered_by && risk.triggered_by.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="font-mono text-[10px] text-readable uppercase tracking-widest mr-1">Triggered by:</span>
              {risk.triggered_by.map((kw) => (
                <span key={kw} className="font-mono text-[10px] text-readable px-2 py-1 rounded-sm" style={{ border: "var(--border-default)" }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
          {pattern.correction_prompt && (
            <button
              type="button"
              onClick={() => onAddCorrection(pattern.correction_prompt!)}
              className="flex min-h-8 items-center gap-1.5 self-start font-mono text-[10px] text-readable hover:text-cyan px-2.5 py-1.5 rounded-sm transition-precise"
              style={{ border: "var(--border-default)", background: "rgba(255,255,255,0.05)" }}
            >
              <Plus size={10} />
              Add correction
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Rule Form ────────────────────────────────────────────

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

function AddRuleForm({ onSave, onClose }: { onSave: (p: AvoidancePattern) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [artifactType] = useState("");
  const [severity, setSeverity] = useState<typeof SEVERITY_OPTIONS[number]>("medium");
  const [description, setDescription] = useState("");
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { labelRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const pattern = await createAvoidancePattern({
        label: label.trim(),
        artifact_type: artifactType.trim() || label.trim().toLowerCase().replace(/\s+/g, "_"),
        severity,
        description: description || undefined,
        correction_prompt: correction || undefined,
      });
      onSave(pattern);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-sm"
      style={{ border: "var(--border-strong)", background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-readable uppercase tracking-widest">Custom Rule</span>
        <button type="button" onClick={onClose} className="text-readable hover:text-white transition-precise"><X size={11} /></button>
      </div>
      <input ref={labelRef} value={label} onChange={(e) => setLabel(e.target.value)}
        placeholder="Rule label (e.g. Over-processed skin)"
        className="h-9 px-3 font-mono text-[11px] text-white placeholder:text-readable/60 bg-dark rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.22)" }}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }} />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-readable uppercase tracking-widest">Severity</span>
          <div className="relative">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="w-full appearance-none h-9 px-3 font-mono text-[11px] text-white bg-dark rounded-sm focus:outline-none cursor-pointer"
              style={{ border: "1px solid rgba(255,255,255,0.22)" }}>
              {SEVERITY_OPTIONS.map((s) => <option key={s} value={s} className="bg-panel">{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-readable uppercase tracking-widest">Correction</span>
          <input value={correction} onChange={(e) => setCorrection(e.target.value)}
            placeholder="Fix phrase to append…"
            className="h-9 px-3 font-mono text-[11px] text-soft-white placeholder:text-readable/60 bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.22)" }} />
        </div>
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="h-9 px-3 font-mono text-[11px] text-soft-white placeholder:text-readable/60 bg-dark rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.20)" }} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSave} disabled={!label.trim() || saving}
          className="flex min-h-9 items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-white px-3 py-1.5 rounded-sm transition-precise disabled:opacity-40"
          style={{ border: "var(--border-strong)", background: "rgba(255,255,255,0.07)" }}>
          <Plus size={10} />{saving ? "Saving..." : "Add Rule"}
        </button>
        <button type="button" onClick={onClose}
          className="font-mono text-[10px] tracking-widest uppercase text-readable hover:text-white px-3 py-1.5 transition-precise">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────

export function AvoidancePanel({ promptText, category, provider, onAddCorrection, onRiskScoreChange }: AvoidancePanelProps) {
  const [patterns, setPatterns] = useState<AvoidancePattern[]>([]);
  const [risks, setRisks] = useState<DetectedRisk[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [riskScore, setRiskScore] = useState(0);
  const [pastArtifacts, setPastArtifacts] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAvoidancePatterns().then(setPatterns);
  }, []);

  useEffect(() => {
    getFailedResultArtifacts(category, provider).then(setPastArtifacts);
  }, [category, provider]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const detected = detectRisks(promptText, patterns);
      setRisks(detected);
      // Only update score from active (non-dismissed) risks
      const active = detected.filter((r) => !dismissed.has(r.pattern.id));
      const score = calculateRiskScore(active);
      setRiskScore(score);
      onRiskScoreChange(score);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText, patterns]);

  // Recalculate score when a risk is dismissed
  useEffect(() => {
    const active = risks.filter((r) => !dismissed.has(r.pattern.id));
    const score = calculateRiskScore(active);
    setRiskScore(score);
    onRiskScoreChange(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);

  const activeRisks = risks.filter((r) => !dismissed.has(r.pattern.id));
  const criticalCount = activeRisks.filter((r) => r.pattern.severity === "critical").length;
  const highCount = activeRisks.filter((r) => r.pattern.severity === "high").length;

  const handleAddAll = () => {
    const corrections = activeRisks
      .filter((r) => r.pattern.correction_prompt)
      .map((r) => r.pattern.correction_prompt!)
      .join(", ");
    if (corrections) onAddCorrection(corrections);
  };

  const handleDismiss = (patternId: string) => {
    setDismissed((prev) => new Set([...prev, patternId]));
  };

  const handleAddRule = (pattern: AvoidancePattern) => {
    setPatterns((prev) => [...prev, pattern]);
    setShowAddForm(false);
  };

  const handleDeletePattern = async (patternId: string) => {
    await deleteAvoidancePattern(patternId);
    setPatterns((prev) => prev.filter((p) => p.id !== patternId));
    setRisks((prev) => prev.filter((r) => r.pattern.id !== patternId));
  };

  if (risks.length === 0 && promptText.trim().length < 8) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-3 py-3 rounded-sm" style={{ border: "var(--border-default)" }}>
          <AlertTriangle size={12} className="text-readable shrink-0" />
          <span className="font-mono text-[11px] text-readable flex-1">Risk analysis runs as you build the prompt.</span>
          <button type="button" onClick={() => setShowAddForm((v) => !v)}
            className="flex min-h-8 items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan px-2.5 py-1 rounded-sm transition-precise"
            style={{ border: "var(--border-default)" }}>
            <Plus size={9} />Rule
          </button>
        </div>
        {showAddForm && <AddRuleForm onSave={handleAddRule} onClose={() => setShowAddForm(false)} />}
      </div>
    );
  }

  if (activeRisks.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-3 py-3 rounded-sm" style={{ border: "var(--border-default)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
          <span className="font-mono text-[11px] text-readable flex-1">No risks detected. Risk score: 0/10.</span>
          <button type="button" onClick={() => setShowAddForm((v) => !v)}
            className="flex min-h-8 items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan px-2.5 py-1 rounded-sm transition-precise"
            style={{ border: "var(--border-default)" }}>
            <Plus size={9} />Rule
          </button>
        </div>
        {showAddForm && <AddRuleForm onSave={handleAddRule} onClose={() => setShowAddForm(false)} />}
      </div>
    );
  }

  const scoreColor = riskScore >= 7 ? "text-red" : riskScore >= 5 ? "text-red/80" : riskScore >= 3 ? "text-muted" : "text-readable";

  return (
    <div className="flex flex-col gap-2">
      {/* Summary header */}
      <div
        className="flex items-center gap-3 px-3 py-3 rounded-sm"
        style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      >
        <AlertTriangle size={12} className={cn("shrink-0", riskScore >= 5 ? "text-red/80" : "text-readable")} />
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] text-readable uppercase tracking-widest">
              {activeRisks.length} risk{activeRisks.length !== 1 ? "s" : ""} detected
            </span>
            {criticalCount > 0 && (
              <span className="font-mono text-[10px] text-red uppercase tracking-widest">{criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span className="font-mono text-[10px] text-red/80 uppercase tracking-widest">{highCount} high</span>
            )}
          </div>
        </div>
        <span className={cn("font-mono text-[12px] font-medium shrink-0", scoreColor)}>
          {riskScore.toFixed(1)}<span className="text-readable text-[10px]">/10</span>
        </span>
        <button type="button" onClick={() => setShowAddForm((v) => !v)}
          className={cn("flex min-h-8 items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-sm transition-precise",
            showAddForm ? "text-white" : "text-readable hover:text-cyan")}
          style={{ border: showAddForm ? "var(--border-strong)" : "var(--border-default)" }}>
          <Plus size={9} />Rule
        </button>
      </div>

      {/* Add rule form */}
      {showAddForm && <AddRuleForm onSave={handleAddRule} onClose={() => setShowAddForm(false)} />}

      {/* Risk list */}
      <div className="flex flex-col gap-1">
        {risks.map((risk) => (
          <div key={risk.pattern.id} className="group/risk relative">
            <RiskItem
              risk={risk}
              dismissed={dismissed.has(risk.pattern.id)}
              onAddCorrection={onAddCorrection}
              onDismiss={() => handleDismiss(risk.pattern.id)}
            />
            {!risk.pattern.is_builtin && !dismissed.has(risk.pattern.id) && (
              <button type="button" onClick={() => handleDeletePattern(risk.pattern.id)}
                className="absolute top-2 right-8 opacity-0 group-hover/risk:opacity-100 text-readable hover:text-red transition-precise"
                title="Delete custom rule">
                <Trash2 size={9} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bulk action */}
      {activeRisks.some((r) => r.pattern.correction_prompt) && (
        <button
          type="button"
          onClick={handleAddAll}
          className="flex min-h-9 items-center justify-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan rounded-sm transition-precise"
          style={{ border: "var(--border-default)" }}
        >
          <Plus size={10} />
          Add all corrections
        </button>
      )}

      {/* Past failure artifacts */}
      {pastArtifacts.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="font-mono text-[10px] text-readable uppercase tracking-widest">From your past failures</span>
          <div className="flex flex-wrap gap-1">
            {pastArtifacts.slice(0, 8).map((label) => (
              <span
                key={label}
                className="font-mono text-[10px] text-red/80 px-2 py-1 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.2)" }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
