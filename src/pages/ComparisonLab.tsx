import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Star, AlertTriangle, Check, X,
  LayoutGrid, Columns2, ImageOff, Zap, ChevronDown, GitCompare, Upload,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ProviderBadge } from "@/components/ui/Badge";
import {
  createSession,
  getSessions,
  getSessionById,
  deleteSession,
  addItemToSession,
  removeItemFromSession,
  getItemsForSession,
  setItemWinner,
  clearItemWinner,
  setItemRejected,
  updateItemNotes,
  loadProjectResults,
  syncDecisionsToResults,
  getBestDimension,
  getWeakestDimension,
} from "@/lib/comparisons";
import { createPrompt, createResult } from "@/lib/db";
import { saveResultImage } from "@/lib/fileStore";
import { fileToDataUrl } from "@/lib/imageUtils";
import { addPromptToProject, addResultToProject } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import type { ComparisonSession, ComparisonResult } from "@/types";

// ─── Score bar ────────────────────────────────────────────────

function SafeResultImage({ src, alt = "", className }: { src?: string; alt?: string; className: string }) {
  const image = useImageDisplaySrc(src);
  const displaySrc = image.src;
  if (!displaySrc) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-black/30")}>
        <ImageOff size={20} className="text-dim/25" />
      </div>
    );
  }
  return <img src={displaySrc} alt={alt} className={className} onError={image.onError} />;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[8px] text-dim/50 w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-px relative" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="absolute left-0 top-0 h-full transition-all"
          style={{ width: `${(value / 5) * 100}%`, background: "rgba(255,255,255,0.35)" }}
        />
      </div>
      <span className="font-mono text-[8px] text-dim/40 w-4 text-right shrink-0">{value}</span>
    </div>
  );
}

// ─── Comparison slot ──────────────────────────────────────────

interface SlotState {
  result: ComparisonResult;
  itemId?: string;
  notes: string;
  isWinner: boolean;
  isRejected: boolean;
}

function ComparisonSlot({
  slot,
  sessionId,
  onRemove,
  onWinner,
  onRejected,
  onNotesChange,
  onApplyDecision,
}: {
  slot: SlotState;
  sessionId?: string;
  onRemove: () => void;
  onWinner: () => void;
  onRejected: () => void;
  onNotesChange: (notes: string) => void;
  onApplyDecision: () => void;
}) {
  const r = slot.result;
  const best = getBestDimension(r);
  const weak = getWeakestDimension(r);
  const hasDecision = slot.isWinner || slot.isRejected;

  return (
    <div
      className={cn(
        "flex flex-col rounded-card overflow-hidden transition-precise relative",
        slot.isWinner && "ring-1 ring-white/30",
        slot.isRejected && "opacity-50"
      )}
      style={{ border: slot.isWinner ? "1px solid rgba(255,255,255,0.25)" : "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Image */}
      <div className="relative w-full aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
        <SafeResultImage src={r.thumbnail_path ?? r.file_path} alt="" className="w-full h-full object-cover" />

        {/* Winner / Rejected badges */}
        {slot.isWinner && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <Star size={9} className="text-white/70 fill-white/50" />
            <span className="font-mono text-[8px] text-white/70">WINNER</span>
          </div>
        )}
        {slot.isRejected && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}>
            <AlertTriangle size={9} className="text-red/60" />
            <span className="font-mono text-[8px] text-red/60">REJECTED</span>
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded-sm text-dim/50 hover:text-red/70 transition-precise"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <X size={10} />
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
      <div className="flex flex-col gap-3 p-3 flex-1">

        {/* Prompt info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="font-sans text-[11px] text-soft-white block truncate">{r.prompt_title}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <ProviderBadge provider={r.prompt_provider} />
              <span className="font-mono text-[8px] text-dim/40">v{r.prompt_version}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < r.score_overall ? "bg-white/50" : "bg-white/10")} />
            ))}
          </div>
        </div>

        {/* Score bars */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8px] text-dim/35 tracking-widest uppercase">Review scores</span>
          <ScoreBar label="REALISM" value={r.score_realism} />
          <ScoreBar label="BRAND FIT" value={r.score_brand_fit} />
          <ScoreBar label="COMPOSIT." value={r.score_composition} />
          <ScoreBar label="LIGHTING" value={r.score_lighting} />
        </div>

        {/* Artifacts */}
        {r.artifacts && r.artifacts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.artifacts.slice(0, 3).map((a, i) => (
              <span key={i} className="font-mono text-[8px] text-red/50 px-1.5 py-0.5 rounded-sm"
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
                <Zap size={8} className="text-white/30" />
                <span className="font-mono text-[8px] text-white/40">Best: {best}</span>
              </div>
            )}
            {weak && (
              <div className="flex items-center gap-1">
                <ChevronDown size={8} className="text-dim/30" />
                <span className="font-mono text-[8px] text-dim/40">Weak: {weak}</span>
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
          className="w-full px-2 py-1.5 font-mono text-[9px] text-soft-white/80 placeholder:text-dim/30 bg-black/20 rounded-sm resize-none focus:outline-none"
          style={{ border: "var(--border-dim)" }}
        />

        {/* Decision buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={slot.isWinner ? () => { /* toggle off handled by clearWinner */ } : onWinner}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] transition-precise",
              slot.isWinner
                ? "bg-white/15 text-white border-white/30"
                : "text-dim/60 hover:text-white hover:bg-white/5"
            )}
            style={{ border: slot.isWinner ? "1px solid rgba(255,255,255,0.3)" : "var(--border-dim)" }}
          >
            <Star size={9} className={slot.isWinner ? "fill-white/50" : ""} />
            {slot.isWinner ? "Winner" : "Mark Winner"}
          </button>

          <button
            type="button"
            onClick={onRejected}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] transition-precise",
              slot.isRejected
                ? "bg-red/10 text-red/70 border-red/30"
                : "text-dim/60 hover:text-red/60 hover:bg-red/5"
            )}
            style={{ border: slot.isRejected ? "1px solid rgba(215,25,33,0.3)" : "var(--border-dim)" }}
          >
            <X size={9} />
            {slot.isRejected ? "Rejected" : "Reject"}
          </button>
        </div>

        {/* Apply decision */}
        {hasDecision && sessionId && (
          <button
            type="button"
            onClick={onApplyDecision}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] text-white/50 hover:text-white hover:bg-white/5 transition-precise"
            style={{ border: "var(--border-dim)" }}
          >
            <Check size={9} />
            Apply to Library
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty slot ───────────────────────────────────────────────

function EmptySlot({ onClick, onDrop, disabled = false }: {
  onClick?: () => void;
  onDrop?: (files: FileList) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card transition-precise aspect-[4/3]",
        disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-white/3"
      )}
      style={{ border: "2px dashed rgba(215,25,33,0.22)", background: "rgba(215,25,33,0.025)" }}
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled && e.dataTransfer.files.length) onDrop?.(e.dataTransfer.files);
      }}
    >
      <Upload size={16} className="text-red/45 mb-2" />
      <span className="font-mono text-[9px] text-red/60">{disabled ? "Importing image..." : "Drop image or click"}</span>
      <span className="font-mono text-[8px] text-dim/35 mt-1">Import into next slot</span>
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
        "flex items-center gap-2.5 w-full px-2 py-2 rounded-sm text-left transition-precise",
        selected ? "opacity-40 cursor-default" : "hover:bg-white/5 cursor-pointer"
      )}
      style={{ border: "var(--border-dim)" }}
    >
      <div className="w-10 h-10 rounded-sm overflow-hidden shrink-0 bg-black/30 flex items-center justify-center">
        <SafeResultImage src={result.thumbnail_path ?? result.file_path} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[10px] text-soft-white block truncate">{result.prompt_title}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[8px] text-dim/40">v{result.prompt_version}</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("w-1 h-1 rounded-full", i < result.score_overall ? "bg-white/40" : "bg-white/10")} />
            ))}
          </div>
          {result.is_winner && <Star size={7} className="text-white/40 fill-white/25" />}
        </div>
      </div>
      {!selected && <span className="font-mono text-[8px] text-dim/30 shrink-0">+ Add</span>}
      {selected && <Check size={8} className="text-dim/30 shrink-0" />}
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
  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-card cursor-pointer hover:bg-white/3 transition-precise"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <span className="font-sans text-[12px] text-soft-white">{session.title}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
            onDelete();
          }}
          className={cn("font-mono text-[8px] transition-precise px-1.5 py-0.5 rounded-sm",
            confirmDelete ? "text-red/70 bg-red/10" : "text-dim/30 hover:text-red/50"
          )}
        >
          {confirmDelete ? "Confirm" : "Delete"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] text-dim/40">{session.item_count} items</span>
        {session.winner_count > 0 && (
          <div className="flex items-center gap-1">
            <Star size={8} className="text-white/40 fill-white/25" />
            <span className="font-mono text-[9px] text-white/40">{session.winner_count} winner{session.winner_count !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
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

  // ── Load sessions ──────────────────────────────────────────

  const reloadSessions = useCallback(async () => {
    setSessions(await getSessions(projectId));
  }, [projectId]);

  useEffect(() => { reloadSessions(); }, [reloadSessions]);

  // ── Load available results if projectId set ────────────────

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
    const id = await createSession({ title, project_id: projectId });
    setActiveSessionId(id);
    setSessionTitle("");
    setSessions((prev) => [{ id, title, project_id: projectId, item_count: 0, winner_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
  };

  const handleOpenSession = async (id: string) => {
    const session = await getSessionById(id);
    if (!session) return;
    const items = await getItemsForSession(id);
    // Rebuild slots from saved items
    const newSlots: (SlotState | null)[] = [null, null, null, null];
    for (const item of items) {
      const result = availableResults.find((r) => r.result_id === item.result_id);
      if (result) {
        const pos = Math.min(item.position, 3);
        newSlots[pos] = {
          result,
          itemId: item.id,
          notes: item.notes ?? "",
          isWinner: item.is_winner,
          isRejected: item.is_rejected,
        };
      }
    }
    setSlots(newSlots);
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
      itemId = await addItemToSession(activeSessionId, result.result_id, firstEmpty);
    }

    setSlots((prev) => {
      const next = [...prev];
      next[firstEmpty] = { result, itemId, notes: "", isWinner: false, isRejected: false };
      return next;
    });
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (!file || uploading) return;
    if (slots.every(Boolean)) {
      setUploadError("All comparison slots are full. Remove one before adding another image.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
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
        const id = `local_${crypto.randomUUID().replace(/-/g, "")}`;
        result = {
          result_id: id,
          prompt_id: id,
          prompt_title: title,
          prompt_provider: "midjourney",
          prompt_version: 1,
          thumbnail_path: dataUrl,
          file_path: dataUrl,
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
    await syncDecisionsToResults(activeSessionId);
    setSynced(true);
    setTimeout(() => setSynced(false), 2000);
    // Reload session to reflect winner counts
    reloadSessions();
  };

  // ── Derived ───────────────────────────────────────────────

  const filledSlots = slots.filter(Boolean).length;
  const selectedResultIds = new Set(slots.filter(Boolean).map((s) => s!.result.result_id));
  const displaySlots = layout === "2up" ? slots.slice(0, 2) : slots;

  // ── Render ────────────────────────────────────────────────

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
        <div className="flex flex-col gap-6 max-w-2xl">

          {/* Create new */}
          <div
            className="flex flex-col gap-3 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">NEW COMPARISON</span>
            <input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewSession()}
              placeholder="Session name… (optional)"
              className="w-full h-8 px-3 font-sans text-[13px] text-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none transition-precise"
              style={{ border: "1px solid rgba(255,255,255,0.10)" }}
            />
            <Button variant="primary" size="md" onClick={handleNewSession} className="self-start">
              <GitCompare size={11} />
              Start Comparison
            </Button>
          </div>

          {/* Existing sessions */}
          {sessions.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="system-label">SAVED SESSIONS</span>
              <div className="grid grid-cols-2 gap-3">
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
              <span className="font-mono text-[9px] text-dim/30">No saved comparison sessions yet.</span>
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
        <div className="flex items-center gap-2">
          {synced && (
            <span className="font-mono text-[9px] text-white/40 flex items-center gap-1">
              <Check size={9} /> Applied to library
            </span>
          )}
          <div className="flex items-center rounded-sm overflow-hidden" style={{ border: "var(--border-dim)" }}>
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
          <Button variant="ghost" size="sm" onClick={() => { setActiveSessionId(null); setSlots([null, null, null, null]); }}>
            <ArrowLeft size={11} /> Sessions
          </Button>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 max-w-3xl">
          {[
            ["1", "Import or select results"],
            ["2", "Compare review scores"],
            ["3", "Mark winner or reject"],
          ].map(([n, label]) => (
            <div key={n} className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.025)" }}>
              <span className="w-5 h-5 rounded-sm flex items-center justify-center font-mono text-[9px] text-red/70" style={{ border: "1px solid rgba(215,25,33,0.35)", background: "rgba(215,25,33,0.06)" }}>{n}</span>
              <span className="font-mono text-[9px] text-dim/65">{label}</span>
            </div>
          ))}
        </div>

      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-5 min-w-0">

        {/* Left: result picker */}
        {(availableResults.length > 0 || projectId) && (
          <div className="flex flex-col gap-4 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
              }}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-1.5 rounded-card py-5 transition-precise disabled:opacity-60"
              style={{ border: "2px dashed rgba(215,25,33,0.30)", background: "rgba(215,25,33,0.045)" }}
            >
              <Upload size={15} className="text-red/55" />
              <span className="font-mono text-[9px] text-red/70">{uploading ? "Importing..." : "Import image"}</span>
              <span className="font-mono text-[8px] text-dim/45">Creates a project result and fills a slot</span>
            </button>
            {uploadError && (
              <span className="font-mono text-[9px] text-red/65 leading-snug">{uploadError}</span>
            )}
            <div className="flex flex-col gap-1">
              <span className="system-label">PROJECT RESULTS</span>
              <span className="font-mono text-[8px] text-dim/35">Scores are defined in Result Review.</span>
            </div>
            {loadingResults ? (
              <span className="font-mono text-[9px] text-dim/30">Loading…</span>
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
                  <span className="font-mono text-[9px] text-dim/30">No results yet. Import an image above.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main: comparison grid */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "grid gap-4",
            layout === "2up" ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4"
          )}>
            {displaySlots.map((slot, i) =>
              slot ? (
                <ComparisonSlot
                  key={slot.result.result_id}
                  slot={slot}
                  sessionId={activeSessionId}
                  onRemove={() => handleRemoveSlot(i)}
                  onWinner={() => handleWinner(i)}
                  onRejected={() => handleRejected(i)}
                  onNotesChange={(n) => handleNotesChange(i, n)}
                  onApplyDecision={() => handleApplyDecision()}
                />
              ) : (
                <EmptySlot
                  key={i}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleUploadFiles}
                  disabled={uploading}
                />
              )
            )}
          </div>

          {/* No results hint */}
          {availableResults.length === 0 && filledSlots === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <span className="font-mono text-[9px] text-dim/30">
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
