import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Star, AlertTriangle, Check, X,
  LayoutGrid, Columns2, ImageOff, Zap, ChevronDown, GitCompare, Upload, Edit2, Sparkles,
  Images, ShieldAlert, Boxes, GitBranch, Target, Compass, Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ProviderBadge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  addItemToSession,
  removeItemFromSession,
  getItemsForSession,
  setItemWinner,
  clearItemWinner,
  setItemRejected,
  updateItemNotes,
  loadProjectResults,
  loadSessionItemResults,
  syncDecisionsToResults,
  getBestDimension,
  getWeakestDimension,
} from "@/lib/comparisons";
import { summarizeComparisonSlots } from "@/lib/comparisonSummary";
import {
  formatDecisionOutcome,
  generateComparisonDecision,
  isEmptyDecision,
  type ComparisonDecision,
} from "@/lib/comparisonDecision";
import {
  COMPARISON_TYPES,
  buildComparisonOutcome,
  formatComparisonRole,
  getComparisonDefinition,
  getComparisonRoles,
} from "@/lib/comparisonWorkflow";
import { createPrompt, createResult } from "@/lib/db";
import { saveResultImage } from "@/lib/fileStore";
import { fileToDataUrl, validateMediaFile } from "@/lib/imageUtils";
import { addPromptToProject, addResultToProject, getProjectById } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import type {
  ComparisonSession,
  ComparisonResult,
  ComparisonSourceRole,
  ComparisonType,
} from "@/types";

// ─── Comparison type presentation (icons + grouping) ───────────
// COMPARISON_TYPES (comparisonWorkflow.ts) carries the business-logic label
// and a full descriptive sentence — the sentence is too much to show on every
// button at once, so it moves into a hover tooltip and the button itself only
// shows an icon + short label, grouped by what's actually being judged.

const TYPE_ICON: Record<ComparisonType, LucideIcon> = {
  result_result: Images,
  ai_risk: ShieldAlert,
  provider_provider: Boxes,
  prompt_version: GitBranch,
  reference_result: Target,
  direction_result: Compass,
  sref_sref: Palette,
};

const TYPE_SECTIONS: { label: string; types: ComparisonType[] }[] = [
  { label: "Results", types: ["result_result", "ai_risk"] },
  { label: "Providers & Versions", types: ["provider_provider", "prompt_version"] },
  { label: "Creative Direction", types: ["reference_result", "direction_result", "sref_sref"] },
];

function ComparisonTypeButton({ typeId, selected, onSelect, wrapperClassName }: {
  typeId: ComparisonType;
  selected: boolean;
  onSelect: () => void;
  wrapperClassName?: string;
}) {
  const type = getComparisonDefinition(typeId);
  const Icon = TYPE_ICON[typeId];
  return (
    <Tooltip text={type.purpose} className={wrapperClassName ?? "relative flex"}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex flex-1 flex-col items-center gap-2 px-3 py-3.5 rounded-sm text-center transition-precise",
          selected ? "bg-cyan/10 text-white" : "text-readable hover:text-white hover:bg-white/5"
        )}
        style={{ border: selected ? "1px solid rgba(56,183,200,0.5)" : "var(--border-dim)" }}
      >
        <Icon size={16} className={selected ? "text-cyan" : "text-readable/70"} />
        <span className="font-mono text-[10px] tracking-wide leading-tight">{type.label}</span>
      </button>
    </Tooltip>
  );
}

// ─── Score bar ────────────────────────────────────────────────

function SafeResultImage({ src, alt = "", className }: { src?: string; alt?: string; className: string }) {
  const image = useImageDisplaySrc(src);
  const displaySrc = image.src;
  if (!displaySrc) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-black/30")}>
        <ImageOff size={22} className="text-muted" />
      </div>
    );
  }
  return <img src={displaySrc} referrerPolicy="no-referrer" alt={alt} className={className} onError={image.onError} />;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-readable w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-px relative" style={{ background: "rgba(255,255,255,0.14)" }}>
        <div
          className="absolute left-0 top-0 h-full transition-all"
          style={{ width: `${(value / 5) * 100}%`, background: "rgba(223,168,58,0.78)" }}
        />
      </div>
      <span className="font-mono text-[10px] text-readable w-5 text-right shrink-0">{value}</span>
    </div>
  );
}

// ─── Comparison slot ──────────────────────────────────────────

interface SlotState {
  result: ComparisonResult;
  itemId?: string;
  sourceRole: ComparisonSourceRole;
  notes: string;
  isWinner: boolean;
  isRejected: boolean;
}

function ComparisonSlot({
  slot,
  onRemove,
  onWinner,
  onRejected,
  onNotesChange,
}: {
  slot: SlotState;
  onRemove: () => void;
  onWinner: () => void;
  onRejected: () => void;
  onNotesChange: (notes: string) => void;
}) {
  const r = slot.result;
  const best = getBestDimension(r);
  const weak = getWeakestDimension(r);

  return (
    <div
      className={cn(
        "flex flex-col rounded-card overflow-hidden transition-precise relative",
        slot.isWinner && "ring-1 ring-amber/55",
        slot.isRejected && "opacity-50"
      )}
      style={{ border: slot.isWinner ? "1px solid rgba(223,168,58,0.70)" : "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Source label (Phase 188) — SREF slots also show the style ref code (doc 04 §3) */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(56,183,200,0.18)", background: "rgba(56,183,200,0.06)" }}>
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-cyan">{formatComparisonRole(slot.sourceRole)}</span>
        {slot.sourceRole.startsWith("sref_") && (
          <span className="font-mono text-[9px] text-cyan/60 truncate">
            {r.prompt_style_ref ? `--sref ${r.prompt_style_ref}` : "no sref"}
          </span>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
        <SafeResultImage src={r.thumbnail_path ?? r.file_path} alt="" className="w-full h-full object-cover" />

        {/* Winner / Rejected badges */}
        {slot.isWinner && (
          <div className="absolute top-10 left-2 flex items-center gap-1 px-2 py-1 rounded-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <Star size={10} className="text-amber fill-amber/45" />
            <span className="font-mono text-[9px] text-white">WINNER</span>
          </div>
        )}
        {slot.isRejected && (
          <div className="absolute top-10 left-2 flex items-center gap-1 px-2 py-1 rounded-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <AlertTriangle size={9} className="text-red/60" />
            <span className="font-mono text-[8px] text-red/60">REJECTED</span>
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1.5 rounded-sm text-readable hover:text-red transition-precise"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <X size={12} />
        </button>

        {/* AI risk overlay */}
        {r.score_ai_risk >= 4 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-sm"
            style={{ background: "rgba(215,25,33,0.15)", border: "1px solid rgba(215,25,33,0.3)" }}>
            <AlertTriangle size={8} className="text-red/60" />
            <span className="font-mono text-[8px] text-red/60">AI risk {r.score_ai_risk}/5</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-5 p-5 flex-1">

        {/* Prompt info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="font-sans text-[16px] font-semibold text-white block truncate">{r.prompt_title}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <ProviderBadge provider={r.prompt_provider} />
              <span className="font-mono text-[10px] text-readable">v{r.prompt_version}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < r.score_overall ? "bg-amber/80" : "bg-white/14")} />
            ))}
          </div>
        </div>

        {/* Score bars */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] text-readable tracking-widest uppercase">Review scores</span>
          <ScoreBar label="REALISM" value={r.score_realism} />
          <ScoreBar label="BRAND FIT" value={r.score_brand_fit} />
          <ScoreBar label="COMPOSIT." value={r.score_composition} />
          <ScoreBar label="LIGHTING" value={r.score_lighting} />
        </div>

        {/* Artifacts */}
        {r.artifacts && r.artifacts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.artifacts.slice(0, 3).map((a, i) => (
              <span key={i} className="font-mono text-[9px] text-red px-2 py-1 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.2)" }}>
                {a}
              </span>
            ))}
            {r.artifacts.length > 3 && (
              <span className="font-mono text-[8px] text-red/40">+{r.artifacts.length - 3}</span>
            )}
          </div>
        )}

        {/* Decision support */}
        {(best || weak) && (
          <div className="flex gap-3">
            {best && (
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-cyan" />
                <span className="font-mono text-[10px] text-readable">Best: {best}</span>
              </div>
            )}
            {weak && (
              <div className="flex items-center gap-1">
                <ChevronDown size={10} className="text-muted" />
                <span className="font-mono text-[10px] text-muted">Weak: {weak}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <textarea
          value={slot.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Comparison notes…"
          rows={2}
          className="w-full px-3 py-2.5 font-mono text-[13px] text-soft-white placeholder:text-readable/55 bg-black/20 rounded-sm resize-none focus:outline-none"
          style={{ border: "var(--border-default)" }}
        />

        {/* Decision buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onWinner}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise",
              slot.isWinner
                ? "bg-amber/12 text-white border-amber/45"
                : "text-readable hover:text-white hover:bg-white/5"
            )}
            style={{ border: slot.isWinner ? "1px solid rgba(223,168,58,0.55)" : "var(--border-default)" }}
          >
            <Star size={9} className={slot.isWinner ? "fill-white/50" : ""} />
            {slot.isWinner ? "Winner" : "Winner"}
          </button>

          <button
            type="button"
            onClick={onRejected}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise",
              slot.isRejected
                ? "bg-red/10 text-red/70 border-red/30"
                : "text-readable hover:text-red hover:bg-red/5"
            )}
            style={{ border: slot.isRejected ? "1px solid rgba(215,25,33,0.3)" : "var(--border-default)" }}
          >
            <X size={9} />
            {slot.isRejected ? "Rejected" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dimension matrix (Phase 189) ────────────────────────────

const DIMENSIONS: { key: keyof ComparisonResult; label: string }[] = [
  { key: "score_realism",     label: "Realism" },
  { key: "score_brand_fit",   label: "Brand Fit" },
  { key: "score_composition", label: "Composition" },
  { key: "score_lighting",    label: "Lighting" },
];

function DimensionMatrix({ slots }: { slots: (SlotState | null)[] }) {
  const filled = slots.filter((s): s is SlotState => Boolean(s));
  if (filled.length < 2) return null;

  return (
    <div className="flex flex-col gap-3 p-5 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <span className="system-label">DIMENSION BREAKDOWN</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="font-mono text-[9px] tracking-widest uppercase text-dim pb-3 pr-4 w-28">Dimension</th>
              {filled.map((s) => (
                <th key={s.result.result_id}
                  className={cn("font-mono text-[9px] tracking-widest uppercase pb-3 px-3 text-center", s.isWinner ? "text-amber" : "text-readable")}>
                  {formatComparisonRole(s.sourceRole)}
                  {s.isWinner && <span className="ml-1 text-amber">★</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map(({ key, label }) => {
              const scores = filled.map((s) => s.result[key] as number);
              const maxScore = Math.max(...scores);
              return (
                <tr key={key} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td className="font-mono text-[10px] text-readable py-2.5 pr-4">{label}</td>
                  {filled.map((s) => {
                    const score = s.result[key] as number;
                    const isTop = score === maxScore && maxScore > 0;
                    return (
                      <td key={s.result.result_id} className="py-2.5 px-3 text-center">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm",
                          isTop ? "text-cyan" : "text-dim/60")}
                          style={isTop ? { border: "1px solid rgba(56,183,200,0.3)", background: "rgba(56,183,200,0.07)" } : {}}>
                          <span className="font-mono text-[12px]">{score}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <div key={j} className={cn("w-1 h-1 rounded-full",
                                j < score ? (isTop ? "bg-cyan/70" : "bg-white/25") : "bg-white/8")} />
                            ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Empty slot ───────────────────────────────────────────────

function EmptySlot({ role, onClick, onDrop, disabled = false }: {
  role: ComparisonSourceRole;
  onClick?: () => void;
  onDrop?: (files: FileList) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-card transition-precise aspect-4/3 px-5 py-4",
        disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-cyan/6"
      )}
      style={{ border: "2px dashed rgba(56,183,200,0.5)", background: "rgba(56,183,200,0.06)" }}
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled && e.dataTransfer.files.length) onDrop?.(e.dataTransfer.files);
      }}
    >
      <span className="font-mono text-[10px] tracking-widest uppercase text-cyan mb-3">
        {formatComparisonRole(role)}
      </span>
      <Upload size={18} className="text-cyan mb-2" />
      <span className="font-mono text-[12px] text-readable leading-relaxed">{disabled ? "Importing…" : "Drop image or video, or click"}</span>
      <span className="font-mono text-[10px] text-muted mt-1">Import into next slot</span>
    </div>
  );
}

// ─── Result picker row ────────────────────────────────────────

function PickerRow({
  result,
  selected,
  onAdd,
}: {
  result: ComparisonResult;
  selected: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      disabled={selected}
      onClick={onAdd}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3.5 rounded-sm text-left transition-precise",
        selected ? "opacity-50 cursor-default" : "hover:bg-white/6 cursor-pointer"
      )}
      style={{ border: "var(--border-default)" }}
    >
      <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0 bg-black/30 flex items-center justify-center">
        <SafeResultImage src={result.thumbnail_path ?? result.file_path} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[14px] text-soft-white block truncate">{result.prompt_title}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[10px] text-readable">v{result.prompt_version}</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < result.score_overall ? "bg-amber/80" : "bg-white/14")} />
            ))}
          </div>
          {result.is_winner && <Star size={9} className="text-amber fill-amber/40" />}
        </div>
      </div>
      {!selected && <span className="font-mono text-[10px] text-cyan shrink-0">+ Add</span>}
      {selected && <Check size={10} className="text-readable shrink-0" />}
    </button>
  );
}

// ─── Session gallery ──────────────────────────────────────────

function SessionCard({ session, onOpen, onDelete }: {
  session: ComparisonSession;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const definition = getComparisonDefinition(session.comparison_type);
  const TypeIcon = TYPE_ICON[session.comparison_type];
  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-card cursor-pointer hover:bg-white/6 transition-precise"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-sm shrink-0"
            style={{ border: "1px solid rgba(56,183,200,0.3)", background: "rgba(56,183,200,0.08)" }}>
            <TypeIcon size={13} className="text-cyan" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-sans text-[15px] font-semibold text-soft-white truncate">{session.title}</span>
            <span className="font-mono text-[9.5px] tracking-widest uppercase text-dim/50">{definition.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
            onDelete();
          }}
          className={cn("font-mono text-[9px] tracking-widest uppercase transition-precise px-2 py-1 rounded-sm shrink-0",
            confirmDelete ? "text-red bg-red/10" : "text-muted hover:text-red"
          )}
          style={{ border: confirmDelete ? "1px solid rgba(215,25,33,0.35)" : "1px solid rgba(255,255,255,0.08)" }}
        >
          {confirmDelete ? "Confirm" : "Delete"}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-[12px] text-readable">{session.item_count} item{session.item_count !== 1 ? "s" : ""}</span>
        {session.winner_count > 0 && (
          <div className="flex items-center gap-1">
            <Star size={10} className="text-amber fill-amber/40" />
            <span className="font-mono text-[12px] text-readable">{session.winner_count} winner{session.winner_count !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {session.outcome_summary && (
        <p className="font-mono text-[11px] leading-relaxed text-readable/85 line-clamp-2 pl-3"
          style={{ borderLeft: "2px solid rgba(255,255,255,0.10)" }}>
          {session.outcome_summary}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ComparisonLab() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session management
  const [sessions, setSessions] = useState<ComparisonSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [comparisonType, setComparisonType] = useState<ComparisonType>("result_result");
  const [outcomeSummary, setOutcomeSummary] = useState("");

  // Available results to compare
  const [availableResults, setAvailableResults] = useState<ComparisonResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Active comparison state
  const [slots, setSlots] = useState<(SlotState | null)[]>([null, null, null, null]);
  const [layout, setLayout] = useState<"2up" | "4up">("2up");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Sync feedback
  const [synced, setSynced] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Outcome edit (Phase 190)
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [outcomeEditValue, setOutcomeEditValue] = useState("");

  // AI decision summary (doc 04 §3)
  const [decision, setDecision] = useState<ComparisonDecision | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  // Project validation — only relevant when projectId is set
  const [projectLoadState, setProjectLoadState] = useState<"idle" | "loading" | "not-found">("idle");

  // ── Load sessions ──────────────────────────────────────────

  const reloadSessions = useCallback(async () => {
    setSessions(await getSessions(projectId));
  }, [projectId]);

  useEffect(() => { reloadSessions(); }, [reloadSessions]);

  // ── Validate project and load available results ────────────

  useEffect(() => {
    if (!projectId) return;
    setProjectLoadState("loading");
    getProjectById(projectId).then((p) => {
      setProjectLoadState(p ? "idle" : "not-found");
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoadingResults(true);
    loadProjectResults(projectId)
      .then(setAvailableResults)
      .finally(() => setLoadingResults(false));
  }, [projectId]);

  // ── Create / open session ──────────────────────────────────

  const handleNewSession = async () => {
    const title = sessionTitle.trim() || (projectId ? "Project Comparison" : "New Comparison");
    const id = await createSession({ title, project_id: projectId, comparison_type: comparisonType });
    setActiveSessionId(id);
    setOutcomeSummary("");
    setSessionTitle("");
    setSessions((prev) => [{
      id,
      title,
      project_id: projectId,
      comparison_type: comparisonType,
      item_count: 0,
      winner_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, ...prev]);
  };

  const handleOpenSession = async (id: string) => {
    const session = await getSessionById(id);
    if (!session) return;
    const items = await getItemsForSession(id);

    // Load any results not already in memory (e.g., standalone uploads from a prior session)
    const knownIds = new Set(availableResults.map((r) => r.result_id));
    const hasMissing = items.some((item) => !knownIds.has(item.result_id));
    let allResults = availableResults;
    if (hasMissing) {
      const extra = await loadSessionItemResults(id);
      allResults = [...availableResults, ...extra.filter((r) => !knownIds.has(r.result_id))];
      setAvailableResults(allResults);
    }

    // Rebuild slots from saved items
    const newSlots: (SlotState | null)[] = [null, null, null, null];
    for (const item of items) {
      const result = allResults.find((r) => r.result_id === item.result_id);
      if (result) {
        const pos = Math.min(item.position, 3);
        newSlots[pos] = {
          result,
          itemId: item.id,
          sourceRole: item.source_role,
          notes: item.notes ?? "",
          isWinner: item.is_winner,
          isRejected: item.is_rejected,
        };
      }
    }
    setSlots(newSlots);
    setComparisonType(session.comparison_type);
    setOutcomeSummary(session.outcome_summary ?? "");
    setActiveSessionId(id);
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    if (activeSessionId === id) { setActiveSessionId(null); setSlots([null, null, null, null]); }
    reloadSessions();
  };

  // ── Add result to slot ─────────────────────────────────────

  const handleAddResult = async (result: ComparisonResult, persist = true) => {
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return; // all slots filled

    let itemId: string | undefined;
    if (activeSessionId && persist) {
      const sourceRole = getComparisonRoles(comparisonType, 4)[firstEmpty];
      itemId = await addItemToSession(activeSessionId, result.result_id, firstEmpty, sourceRole);
    }

    setSlots((prev) => {
      const next = [...prev];
      next[firstEmpty] = {
        result,
        itemId,
        sourceRole: getComparisonRoles(comparisonType, 4)[firstEmpty],
        notes: "",
        isWinner: false,
        isRejected: false,
      };
      return next;
    });
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!file || uploading) return;
    if (slots.every(Boolean)) {
      setUploadError("All comparison slots are full. Remove one before adding another image.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      await validateMediaFile(file);
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Comparison upload";
      const dataUrl = await fileToDataUrl(file);
      let result: ComparisonResult;

      if (projectId) {
        const promptId = await createPrompt({
          title: `Comparison upload — ${title}`,
          provider: "midjourney",
          prompt_text: `Uploaded comparison image: ${title}`,
          tags: ["comparison-upload"],
        });
        await addPromptToProject(projectId, promptId);

        const resultId = crypto.randomUUID().replace(/-/g, "");
        const saved = await saveResultImage(resultId, dataUrl);
        await createResult({
          id: resultId,
          prompt_id: promptId,
          file_path: saved.filePath,
          thumbnail_path: saved.thumbPath,
          provider: "midjourney",
          notes: `Imported in Comparison Lab from ${file.name}`,
        });
        await addResultToProject(projectId, resultId);

        result = {
          result_id: resultId,
          prompt_id: promptId,
          prompt_title: title,
          prompt_provider: "midjourney",
          prompt_version: 1,
          thumbnail_path: saved.thumbPath,
          file_path: saved.filePath,
          score_overall: 0,
          score_realism: 0,
          score_brand_fit: 0,
          score_composition: 0,
          score_lighting: 0,
          score_ai_risk: 0,
          is_winner: false,
          is_failed: false,
          artifacts: [],
          created_at: new Date().toISOString(),
        };
        setAvailableResults((prev) => [result, ...prev.filter((r) => r.result_id !== result.result_id)]);
      } else {
        // No project context — still persist to DB so the session can be reopened
        const promptId = await createPrompt({
          title: `Standalone comparison — ${title}`,
          provider: "midjourney",
          prompt_text: `Uploaded for standalone comparison: ${title}`,
          tags: ["comparison-upload"],
        });
        const resultId = crypto.randomUUID().replace(/-/g, "");
        const saved = await saveResultImage(resultId, dataUrl);
        await createResult({
          id: resultId,
          prompt_id: promptId,
          file_path: saved.filePath,
          thumbnail_path: saved.thumbPath,
          provider: "midjourney",
          notes: `Standalone comparison upload from ${file.name}`,
        });
        result = {
          result_id: resultId,
          prompt_id: promptId,
          prompt_title: title,
          prompt_provider: "midjourney",
          prompt_version: 1,
          thumbnail_path: saved.thumbPath,
          file_path: saved.filePath,
          score_overall: 0,
          score_realism: 0,
          score_brand_fit: 0,
          score_composition: 0,
          score_lighting: 0,
          score_ai_risk: 0,
          is_winner: false,
          is_failed: false,
          artifacts: [],
          created_at: new Date().toISOString(),
        };
      }

      await handleAddResult(result, Boolean(projectId));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to import image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveSlot = async (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    if (slot.itemId) await removeItemFromSession(slot.itemId);
    setSlots((prev) => { const next = [...prev]; next[index] = null; return next; });
  };

  // ── Decisions ─────────────────────────────────────────────

  const handleWinner = async (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    // Toggle off if already winner
    if (slot.isWinner) {
      if (activeSessionId) await clearItemWinner(activeSessionId);
      setSlots((prev) => prev.map((s) => s ? { ...s, isWinner: false } : s));
      return;
    }
    if (slot.itemId && activeSessionId) await setItemWinner(slot.itemId, activeSessionId);
    setSlots((prev) => prev.map((s, i) => s ? { ...s, isWinner: i === index, isRejected: i === index ? false : s.isRejected } : s));
  };

  const handleRejected = async (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    const next = !slot.isRejected;
    if (slot.itemId) await setItemRejected(slot.itemId, next);
    setSlots((prev) => prev.map((s, i) => s && i === index ? { ...s, isRejected: next, isWinner: next ? false : s.isWinner } : s));
  };

  const handleNotesChange = async (index: number, notes: string) => {
    const slot = slots[index];
    if (!slot) return;
    if (slot.itemId) await updateItemNotes(slot.itemId, notes);
    setSlots((prev) => prev.map((s, i) => s && i === index ? { ...s, notes } : s));
  };

  const handleApplyDecision = async () => {
    if (!activeSessionId) return;
    const outcome = buildComparisonOutcome(
      comparisonType,
      slots.filter((slot): slot is SlotState => Boolean(slot)).map((slot) => ({
        label: slot.result.prompt_title,
        provider: slot.result.prompt_provider,
        promptVersion: slot.result.prompt_version,
        overallScore: slot.result.score_overall,
        isWinner: slot.isWinner,
        isRejected: slot.isRejected,
        notes: slot.notes,
      }))
    );
    if (!outcome) return;

    setApplyError("");
    try {
      await syncDecisionsToResults(activeSessionId);
      await updateSession(activeSessionId, { outcome_summary: outcome });
      setOutcomeSummary(outcome);
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
      reloadSessions();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Unable to save comparison outcome.");
    }
  };

  // ── Change comparison type (Phase 187) ───────────────────
  const handleChangeType = async (newType: ComparisonType) => {
    setComparisonType(newType);
    if (activeSessionId) {
      await updateSession(activeSessionId, { comparison_type: newType });
      reloadSessions();
    }
  };

  // ── AI decision summary (doc 04 §3) ───────────────────────
  const handleGenerateDecision = async () => {
    setDecisionLoading(true);
    setDecisionError("");
    try {
      // Direction vs Result judges against the project's applied creative direction.
      let directionContext: string | undefined;
      if (comparisonType === "direction_result" && projectId) {
        const proj = await getProjectById(projectId);
        directionContext = [proj?.visual_direction, proj?.creative_goals].filter(Boolean).join("\n") || undefined;
      }
      const result = await generateComparisonDecision({
        type: comparisonType,
        slots: slots
          .filter((slot): slot is SlotState => Boolean(slot))
          .map((slot) => ({
            label: formatComparisonRole(slot.sourceRole) + ` — ${slot.result.prompt_title}`,
            result: slot.result,
            isWinner: slot.isWinner,
            isRejected: slot.isRejected,
            notes: slot.notes,
          })),
        directionContext,
      });
      if (isEmptyDecision(result)) {
        setDecisionError("The model returned no usable decision — try again.");
      } else {
        setDecision(result);
      }
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Decision analysis failed.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleSaveDecisionOutcome = async () => {
    if (!activeSessionId || !decision) return;
    const text = formatDecisionOutcome(decision);
    if (!text) return;
    await updateSession(activeSessionId, { outcome_summary: text });
    setOutcomeSummary(text);
    setDecision(null);
    reloadSessions();
  };

  // ── Save edited outcome (Phase 190) ──────────────────────
  const handleSaveOutcome = async () => {
    if (!activeSessionId) return;
    const trimmed = outcomeEditValue.trim();
    await updateSession(activeSessionId, { outcome_summary: trimmed || undefined });
    setOutcomeSummary(trimmed);
    setEditingOutcome(false);
    reloadSessions();
  };

  // ── Derived ───────────────────────────────────────────────

  const filledSlots = slots.filter(Boolean).length;
  const selectedResultIds = new Set(slots.filter(Boolean).map((s) => s!.result.result_id));
  const displaySlots = layout === "2up" ? slots.slice(0, 2) : slots;
  const comparisonSummary = summarizeComparisonSlots(slots);
  const slotRoles = getComparisonRoles(comparisonType, displaySlots.length);

  // ── Render ────────────────────────────────────────────────

  if (projectLoadState === "not-found") {
    return (
      <PageContainer title="COMPARISON LAB" subtitle="PROJECT NOT FOUND">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-readable" />
          <p className="font-mono text-[13px] text-readable">Project not found or has been deleted.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/compare")}>
            <ArrowLeft size={11} /> Standalone comparison
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!activeSessionId) {
    // Session gallery + create
    return (
      <PageContainer
        title="COMPARISON LAB"
        subtitle="EVALUATE RESULTS SIDE BY SIDE"
        action={
          <Button variant="ghost" size="sm" onClick={() => projectId ? navigate(`/projects/${projectId}`) : navigate("/projects")}>
            <ArrowLeft size={11} /> {projectId ? "Project" : "Projects"}
          </Button>
        }
      >
        <div className="flex flex-col gap-8 max-w-4xl">

          {/* Create new */}
          <div
            className="flex flex-col gap-6 p-7 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="system-label">New Comparison</span>
              <span className="font-mono text-[10.5px] text-dim/50">Pick what you're judging — hover an option to see what it's for.</span>
            </div>

            <div className="flex flex-col gap-4">
              {TYPE_SECTIONS.map((section) => (
                <div key={section.label} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-dim/45">{section.label}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {section.types.map((typeId) => (
                      <ComparisonTypeButton
                        key={typeId}
                        typeId={typeId}
                        selected={comparisonType === typeId}
                        onSelect={() => setComparisonType(typeId)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNewSession()}
                placeholder="Session name… (optional)"
                className="w-full h-10 px-3 font-sans text-[15px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              />
              <Button variant="primary" size="md" onClick={handleNewSession} className="self-start">
                <GitCompare size={11} />
                Start Comparison
              </Button>
            </div>
          </div>

          {/* Existing sessions */}
          {sessions.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="system-label">SAVED SESSIONS</span>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onOpen={() => handleOpenSession(s.id)}
                    onDelete={() => handleDeleteSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-2">
              <span className="font-mono text-[12px] text-muted">No saved comparison sessions yet.</span>
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  // ── Active comparison view ─────────────────────────────────

  return (
    <PageContainer
      title="COMPARISON LAB"
      subtitle={`${filledSlots} OF ${displaySlots.length} SLOTS FILLED`}
      action={
        <div className="flex items-center gap-3">
          {synced && (
            <span className="font-mono text-[10px] text-cyan flex items-center gap-1 shrink-0">
              <Check size={9} /> Saved
            </span>
          )}

          {(filledSlots >= 2 || comparisonSummary.canApplyDecisions) && (
            <>
              <div className="flex items-center gap-2">
                {filledSlots >= 2 && (
                  <Button variant="ghost" size="sm" onClick={handleGenerateDecision} disabled={decisionLoading}
                    title="AI judges the filled slots: stronger option, why, what failed, what to reuse and avoid">
                    <Sparkles size={11} /> {decisionLoading ? "Judging…" : "AI Decision"}
                  </Button>
                )}
                {comparisonSummary.canApplyDecisions && (
                  <Button variant="primary" size="sm" onClick={handleApplyDecision}
                    title="Write your Winner/Reject picks back onto the result records">
                    <Check size={11} /> Apply
                  </Button>
                )}
              </div>
              <div className="w-px h-5 bg-white/8" />
            </>
          )}

          <div className="flex items-center rounded-sm overflow-hidden" style={{ border: "var(--border-dim)" }}
            title="Comparison grid layout">
            {(["2up", "4up"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLayout(l)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 font-mono text-[9px] transition-precise",
                  layout === l ? "bg-white/10 text-white" : "text-dim/50 hover:text-white"
                )}
              >
                {l === "2up" ? <Columns2 size={9} /> : <LayoutGrid size={9} />}
                {l === "2up" ? "2-UP" : "4-UP"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-white/8" />

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setActiveSessionId(null); setSlots([null, null, null, null]); }}
              title="Back to all comparison sessions">
              <ArrowLeft size={11} /> Sessions
            </Button>
            {projectId && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft size={11} /> Project
              </Button>
            )}
          </div>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
      />
      <div className="flex flex-col gap-4">
        {/* Type toggle bar (Phase 187) */}
        <div className="flex flex-col gap-2">
          <span className="system-label">Comparison Type</span>
          <div className="flex flex-wrap gap-2">
            {COMPARISON_TYPES.map((type) => (
              <ComparisonTypeButton
                key={type.id}
                typeId={type.id}
                selected={comparisonType === type.id}
                onSelect={() => handleChangeType(type.id)}
                wrapperClassName="relative flex w-24"
              />
            ))}
          </div>
        </div>

        {/* Outcome summary (Phase 190) */}
        {(outcomeSummary || editingOutcome) && (
          <div className="flex flex-col gap-3 px-5 py-4 rounded-sm" style={{ border: "1px solid rgba(223,168,58,0.28)", background: "rgba(223,168,58,0.05)" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-amber">
                <Star size={10} className="fill-amber/30" /> Saved Outcome
              </span>
              {!editingOutcome && (
                <button type="button" onClick={() => { setOutcomeEditValue(outcomeSummary); setEditingOutcome(true); }}
                  className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-amber/70 hover:text-amber px-2.5 py-1.5 rounded-sm transition-precise"
                  style={{ border: "1px solid rgba(223,168,58,0.25)" }}>
                  <Edit2 size={9} />Edit
                </button>
              )}
            </div>
            {editingOutcome ? (
              <div className="flex flex-col gap-2.5">
                <textarea
                  autoFocus
                  value={outcomeEditValue}
                  onChange={(e) => setOutcomeEditValue(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveOutcome(); if (e.key === "Escape") setEditingOutcome(false); }}
                  rows={4}
                  className="w-full p-3 font-mono text-[12px] text-soft-white bg-black/30 rounded-sm resize-none focus:outline-none leading-relaxed"
                  style={{ border: "1px solid rgba(223,168,58,0.3)" }}
                />
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSaveOutcome}
                    style={{ borderColor: "rgba(223,168,58,0.4)", background: "rgba(223,168,58,0.08)", color: "#DFA83A" }}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingOutcome(false)}>
                    Cancel
                  </Button>
                  <span className="font-mono text-[9px] text-dim/30 ml-auto">⌘↩ save</span>
                </div>
              </div>
            ) : (
              <p className="font-mono text-[12px] leading-relaxed text-soft-white">{outcomeSummary}</p>
            )}
          </div>
        )}

        {/* AI decision summary (doc 04 §3) */}
        {decisionError && (
          <p className="font-mono text-[11px] text-red/80 px-1">{decisionError}</p>
        )}
        {decision && (
          <div className="flex flex-col gap-3 px-5 py-4 rounded-sm" style={{ border: "1px solid rgba(56,183,200,0.32)", background: "rgba(56,183,200,0.045)" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-cyan">
                <Sparkles size={10} /> AI Decision Summary
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleSaveDecisionOutcome}
                  className="font-mono text-[9px] tracking-widest uppercase text-cyan/70 hover:text-cyan px-2.5 py-1.5 rounded-sm transition-precise"
                  style={{ border: "1px solid rgba(56,183,200,0.3)" }}>
                  Save as Outcome
                </button>
                <button type="button" onClick={() => setDecision(null)}
                  className="flex items-center justify-center w-6 h-6 rounded-sm text-cyan/60 hover:text-white hover:bg-white/10 transition-precise"
                  title="Dismiss">
                  <X size={11} />
                </button>
              </div>
            </div>
            {decision.stronger_option && (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/50 w-16 shrink-0">Stronger</span>
                <span className="font-mono text-[12px] text-soft-white leading-relaxed">{decision.stronger_option}</span>
              </div>
            )}
            {decision.why_stronger && (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/50 w-16 shrink-0">Why</span>
                <span className="font-mono text-[11px] text-white/70 leading-relaxed">{decision.why_stronger}</span>
              </div>
            )}
            {decision.what_failed && (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-red/60 w-16 shrink-0">Failed</span>
                <span className="font-mono text-[11px] text-white/70 leading-relaxed">{decision.what_failed}</span>
              </div>
            )}
            {decision.reuse.length > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-amber/60 w-16 shrink-0">Reuse</span>
                <span className="font-mono text-[11px] text-white/70 leading-relaxed">{decision.reuse.join(" · ")}</span>
              </div>
            )}
            {decision.avoid.length > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-red/60 w-16 shrink-0">Avoid</span>
                <span className="font-mono text-[11px] text-white/70 leading-relaxed">{decision.avoid.join(" · ")}</span>
              </div>
            )}
            {decision.intelligence && (
              <div className="flex items-baseline gap-2 pt-2" style={{ borderTop: "1px solid rgba(56,183,200,0.15)" }}>
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/50 w-16 shrink-0">Intel</span>
                <span className="font-mono text-[11px] text-cyan/80 leading-relaxed">{decision.intelligence}</span>
              </div>
            )}
          </div>
        )}

        {applyError && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(applyError)}
            className="w-full px-4 py-3 text-left font-mono text-[12px] leading-relaxed text-red rounded-sm hover:bg-red/5"
            style={{ border: "1px solid rgba(215,25,33,0.28)" }}
            title="Click to copy error"
          >
            {applyError}
          </button>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1.5 px-5 py-4 rounded-sm" style={{ border: "var(--border-default)", background: "rgba(255,255,255,0.045)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Loaded</span>
            <span className="font-sans text-[22px] font-semibold text-white">{comparisonSummary.filledCount}</span>
          </div>
          <div className="flex flex-col gap-1.5 px-5 py-4 rounded-sm" style={{ border: "1px solid rgba(223,168,58,0.34)", background: "rgba(223,168,58,0.07)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Winner</span>
            <span className="font-sans text-[22px] font-semibold text-amber">{comparisonSummary.winnerCount}</span>
          </div>
          <div className="flex flex-col gap-1.5 px-5 py-4 rounded-sm" style={{ border: "1px solid rgba(215,25,33,0.28)", background: "rgba(215,25,33,0.055)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Rejected</span>
            <span className="font-sans text-[22px] font-semibold text-red">{comparisonSummary.rejectedCount}</span>
          </div>
          <div className="flex flex-col gap-1.5 px-5 py-4 rounded-sm" style={{ border: "var(--border-default)", background: "rgba(255,255,255,0.035)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Pending</span>
            <span className="font-sans text-[22px] font-semibold text-soft-white">{comparisonSummary.pendingDecisionCount}</span>
          </div>
          <div className="col-span-2 xl:col-span-1 flex flex-col gap-1.5 px-5 py-4 rounded-sm min-w-0" style={{ border: "1px solid rgba(56,183,200,0.28)", background: "rgba(56,183,200,0.045)" }}>
            <span className="font-mono text-[10px] tracking-widest uppercase text-readable">Top score</span>
            <span className="font-sans text-[15px] font-semibold text-white truncate">
              {comparisonSummary.topScoreLabel ?? "No result"}
            </span>
            <span className="font-mono text-[10px] text-cyan">
              {comparisonSummary.topScore !== null ? `${comparisonSummary.topScore}/5 overall` : "Add images to compare"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-7 min-w-0">

        {/* Left: result picker */}
        {(availableResults.length > 0 || projectId) && (
          <div className="flex flex-col gap-5 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
              }}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-2 rounded-card py-8 transition-precise disabled:opacity-60 hover:bg-cyan/6"
              style={{ border: "2px dashed rgba(56,183,200,0.5)", background: "rgba(56,183,200,0.06)" }}
            >
              <Upload size={18} className="text-cyan" />
              <span className="font-mono text-[13px] text-soft-white">{uploading ? "Importing…" : "Drop image or video, or click to import"}</span>
              <span className="font-mono text-[10px] text-readable">Creates a project result and fills a slot</span>
            </button>
            {uploadError && (
              <span className="font-mono text-[12px] text-red leading-snug">{uploadError}</span>
            )}
            <div className="flex flex-col gap-1">
              <span className="system-label">PROJECT RESULTS</span>
              <span className="font-mono text-[10px] text-readable">Add images here, decide on cards, apply once.</span>
            </div>
            {loadingResults ? (
              <span className="font-mono text-[12px] text-muted">Loading...</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {availableResults.map((r) => (
                  <PickerRow
                    key={r.result_id}
                    result={r}
                    selected={selectedResultIds.has(r.result_id)}
                    onAdd={() => handleAddResult(r)}
                  />
                ))}
                {availableResults.length === 0 && (
                  <span className="font-mono text-[12px] text-muted">No results yet. Import an image above.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main: comparison grid */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "grid gap-5",
            layout === "2up" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4"
          )}>
            {displaySlots.map((slot, i) =>
              slot ? (
                <ComparisonSlot
                  key={slot.result.result_id}
                  slot={slot}
                  onRemove={() => handleRemoveSlot(i)}
                  onWinner={() => handleWinner(i)}
                  onRejected={() => handleRejected(i)}
                  onNotesChange={(n) => handleNotesChange(i, n)}
                />
              ) : (
                <EmptySlot
                  key={i}
                  role={slotRoles[i]}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleUploadFiles}
                  disabled={uploading}
                />
              )
            )}
          </div>

          {/* Dimension matrix (Phase 189) */}
          {filledSlots >= 2 && (
            <DimensionMatrix slots={slots} />
          )}

          {/* No results hint */}
          {availableResults.length === 0 && filledSlots === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <span className="font-mono text-[12px] text-muted">
                {projectId
                  ? "This project has no results yet. Import an image to create the first result."
                  : "Navigate to a project comparison to load results automatically."}
              </span>
            </div>
          )}
        </div>
      </div>
      </div>
    </PageContainer>
  );
}
