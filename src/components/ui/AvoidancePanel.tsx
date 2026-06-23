import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { getAvoidancePatterns } from "@/lib/db";
import { detectRisks, calculateRiskScore } from "@/lib/avoidanceEngine";
import { cn } from "@/lib/utils";
import type { AvoidancePattern, DetectedRisk } from "@/types";

interface AvoidancePanelProps {
  promptText: string;
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
      style={{ border: "var(--border-dim)" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", SEVERITY_DOT[pattern.severity] ?? "bg-white/20")}
        />
        <span className="font-mono text-[9px] text-dim/70 tracking-widest uppercase shrink-0">
          {SEVERITY_LABEL[pattern.severity]}
        </span>
        <span className="flex-1 font-mono text-[10px] text-soft-white truncate">{pattern.label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-dim/50 hover:text-muted transition-precise"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-dim/40 hover:text-red transition-precise"
            title="Dismiss"
          >
            <X size={9} />
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
            <p className="font-mono text-[9px] text-dim/70 leading-relaxed pt-2">{pattern.description}</p>
          )}
          {risk.triggered_by && risk.triggered_by.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="font-mono text-[8px] text-dim/50 uppercase tracking-widest mr-1">Triggered by:</span>
              {risk.triggered_by.map((kw) => (
                <span key={kw} className="font-mono text-[8px] text-dim/60 px-1.5 py-0.5 rounded-sm" style={{ border: "var(--border-dim)" }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
          {pattern.correction_prompt && (
            <button
              type="button"
              onClick={() => onAddCorrection(pattern.correction_prompt!)}
              className="flex items-center gap-1.5 self-start font-mono text-[9px] text-dim hover:text-white px-2.5 py-1.5 rounded-sm transition-precise"
              style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.04)" }}
            >
              <Plus size={8} />
              Add correction
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AvoidancePanel({ promptText, onAddCorrection, onRiskScoreChange }: AvoidancePanelProps) {
  const [patterns, setPatterns] = useState<AvoidancePattern[]>([]);
  const [risks, setRisks] = useState<DetectedRisk[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [riskScore, setRiskScore] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAvoidancePatterns().then(setPatterns);
  }, []);

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

  if (risks.length === 0 && promptText.trim().length < 8) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-sm"
        style={{ border: "var(--border-dim)" }}
      >
        <AlertTriangle size={10} className="text-dim/30 shrink-0" />
        <span className="font-mono text-[9px] text-dim/40">Risk analysis runs as you build the prompt.</span>
      </div>
    );
  }

  if (activeRisks.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-sm"
        style={{ border: "var(--border-dim)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
        <span className="font-mono text-[9px] text-dim/50">No risks detected. Risk score: 0/10.</span>
      </div>
    );
  }

  const scoreColor = riskScore >= 7 ? "text-red" : riskScore >= 5 ? "text-red/70" : riskScore >= 3 ? "text-muted" : "text-dim";

  return (
    <div className="flex flex-col gap-2">
      {/* Summary header */}
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-sm"
        style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      >
        <AlertTriangle size={10} className={cn("shrink-0", riskScore >= 5 ? "text-red/70" : "text-dim/50")} />
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-dim/70 uppercase tracking-widest">
              {activeRisks.length} risk{activeRisks.length !== 1 ? "s" : ""} detected
            </span>
            {criticalCount > 0 && (
              <span className="font-mono text-[8px] text-red uppercase tracking-widest">{criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span className="font-mono text-[8px] text-red/60 uppercase tracking-widest">{highCount} high</span>
            )}
          </div>
        </div>
        <span className={cn("font-mono text-[11px] font-medium shrink-0", scoreColor)}>
          {riskScore.toFixed(1)}<span className="text-dim/50 text-[9px]">/10</span>
        </span>
      </div>

      {/* Risk list */}
      <div className="flex flex-col gap-1">
        {risks.map((risk) => (
          <RiskItem
            key={risk.pattern.id}
            risk={risk}
            dismissed={dismissed.has(risk.pattern.id)}
            onAddCorrection={onAddCorrection}
            onDismiss={() => handleDismiss(risk.pattern.id)}
          />
        ))}
      </div>

      {/* Bulk action */}
      {activeRisks.some((r) => r.pattern.correction_prompt) && (
        <button
          type="button"
          onClick={handleAddAll}
          className="flex items-center justify-center gap-1.5 h-7 font-mono text-[9px] tracking-widest uppercase text-dim hover:text-white rounded-sm transition-precise"
          style={{ border: "var(--border-dim)" }}
        >
          <Plus size={8} />
          Add all corrections
        </button>
      )}
    </div>
  );
}
