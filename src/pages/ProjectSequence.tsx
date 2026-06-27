import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Film,
  GripVertical,
  Image,
  ImageOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getProjectById } from "@/lib/projects";
import { getPromptsForProject, getResultsForProject } from "@/lib/projects";
import {
  createShot,
  deleteShot,
  getProjectShots,
  reorderShots,
  SHOT_TYPES,
  updateShot,
} from "@/lib/shotSequence";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import type { Project, Shot, ShotType } from "@/types";

// ─── Types ────────────────────────────────────────────────────

type ProjectPrompt = { id: string; title: string; provider: string; rating: number; is_winner: boolean; is_failed: boolean };
type ProjectResult = { id: string; score_overall: number; is_winner: boolean; is_failed: boolean; thumbnail_path?: string };

// ─── Helpers ──────────────────────────────────────────────────

function shotTypeLabel(type: ShotType): string {
  return SHOT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// ─── Thumbnail ────────────────────────────────────────────────

function ResultThumb({ src, className }: { src?: string; className: string }) {
  const image = useImageDisplaySrc(src);
  if (!image.src) {
    return (
      <div className={cn(className, "flex items-center justify-center bg-white/5")}>
        <ImageOff size={12} className="text-white/25" />
      </div>
    );
  }
  return <img src={image.src} alt="" className={cn(className, "object-cover")} onError={image.onError} />;
}

// ─── Connect Prompt Picker ────────────────────────────────────

function PromptPicker({
  prompts,
  onSelect,
  onClose,
}: {
  prompts: ProjectPrompt[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = prompts.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close" />
      <div
        className="relative z-10 w-full max-w-[520px] rounded-card shadow-2xl flex flex-col"
        style={{ border: "var(--border-default)", background: "#121212", maxHeight: "72vh" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8">
          <span className="system-label text-[13px] text-white">Connect Prompt</span>
          <button type="button" onClick={onClose} className="text-readable hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-white/8">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-readable pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts…"
              className="w-full h-9 pl-8 pr-3 font-mono text-[12px] text-soft-white placeholder:text-readable/60 bg-white/5 rounded-sm focus:outline-none"
              style={{ border: "var(--border-default)" }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[11px] text-readable">No prompts found</span>
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p.id); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-left hover:bg-white/7 transition-precise"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-[13px] text-soft-white truncate block">{p.title}</span>
                  <span className="font-mono text-[10px] text-readable uppercase">{p.provider}</span>
                </div>
                {p.is_winner && <span className="font-mono text-[9px] text-amber">WINNER</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connect Result Picker ────────────────────────────────────

function ResultPicker({
  results,
  onSelect,
  onClose,
}: {
  results: ProjectResult[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close" />
      <div
        className="relative z-10 w-full max-w-[540px] rounded-card shadow-2xl flex flex-col"
        style={{ border: "var(--border-default)", background: "#121212", maxHeight: "72vh" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8">
          <span className="system-label text-[13px] text-white">Connect Result</span>
          <button type="button" onClick={onClose} className="text-readable hover:text-white transition-precise">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[11px] text-readable">No results in this project</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onSelect(r.id); onClose(); }}
                  className="relative aspect-square rounded-sm overflow-hidden group"
                  style={{ border: "var(--border-default)" }}
                >
                  <ResultThumb src={r.thumbnail_path} className="w-full h-full" />
                  {r.is_winner && (
                    <span className="absolute top-1 right-1 font-mono text-[8px] text-amber bg-black/60 px-1 rounded-sm">W</span>
                  )}
                  <div className="absolute inset-0 bg-cyan/10 opacity-0 group-hover:opacity-100 transition-precise" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Shot Form ────────────────────────────────────────────

function AddShotForm({
  projectId,
  nextOrder,
  onCreated,
  onCancel,
}: {
  projectId: string;
  nextOrder: number;
  onCreated: (shot: Shot) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ShotType>("hero");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const id = await createShot({ project_id: projectId, sort_order: nextOrder, shot_type: type, label: label.trim() || shotTypeLabel(type) });
      onCreated({ id, project_id: projectId, sort_order: nextOrder, shot_type: type, label: label.trim() || shotTypeLabel(type), created_at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-card"
      style={{ border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ShotType)}
          className="h-8 px-2 font-mono text-[11px] text-soft-white bg-dark rounded-sm focus:outline-none"
          style={{ border: "var(--border-default)" }}
        >
          {SHOT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
          placeholder="Shot label (optional)"
          className="flex-1 min-w-[160px] h-8 px-3 font-mono text-[12px] text-soft-white placeholder:text-readable/60 bg-dark rounded-sm focus:outline-none"
          style={{ border: "var(--border-default)" }}
        />
        <Button variant="accent" size="sm" onClick={handleSubmit} disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Shot Card ────────────────────────────────────────────────

interface ShotCardProps {
  shot: Shot;
  index: number;
  linkedPrompt?: ProjectPrompt;
  linkedResult?: ProjectResult;
  onUpdate: (id: string, changes: Partial<Shot>) => void;
  onDelete: (id: string) => void;
  onConnectPrompt: (shotId: string) => void;
  onConnectResult: (shotId: string) => void;
}

function ShotCard({
  shot,
  index,
  linkedPrompt,
  linkedResult,
  onUpdate,
  onDelete,
  onConnectPrompt,
  onConnectResult,
}: ShotCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState(shot.label);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(shot.notes ?? "");

  const commitLabel = () => {
    setEditingLabel(false);
    const trimmed = labelText.trim() || shotTypeLabel(shot.shot_type);
    if (trimmed !== shot.label) onUpdate(shot.id, { label: trimmed });
  };

  const commitNotes = () => {
    setEditingNotes(false);
    const trimmed = notesText.trim();
    if (trimmed !== (shot.notes ?? "")) onUpdate(shot.id, { notes: trimmed || undefined });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, border: "var(--border-default)", background: "var(--surface-card)" }}
      className="flex items-start gap-0 rounded-card overflow-hidden"
    >
      {/* Drag handle column */}
      <div
        className="flex items-center justify-center w-9 shrink-0 self-stretch cursor-grab active:cursor-grabbing text-readable hover:text-cyan transition-precise bg-white/3"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </div>

      {/* Thumbnail */}
      <div className="w-[72px] h-[72px] shrink-0 self-stretch border-r border-white/10 overflow-hidden">
        {linkedResult ? (
          <ResultThumb src={linkedResult.thumbnail_path} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/4">
            <Image size={14} className="text-white/20" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shot number */}
          <span className="font-mono text-[10px] text-dim w-5 shrink-0">{String(index + 1).padStart(2, "0")}</span>

          {/* Type badge */}
          <span
            className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-readable"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          >
            {shotTypeLabel(shot.shot_type)}
          </span>

          {/* Type select */}
          <select
            value={shot.shot_type}
            onChange={(e) => onUpdate(shot.id, { shot_type: e.target.value as ShotType })}
            className="h-6 px-1.5 font-mono text-[10px] text-readable bg-transparent rounded-sm focus:outline-none hover:text-white transition-precise"
            style={{ border: "1px solid transparent" }}
          >
            {SHOT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div className="flex items-center gap-1.5">
          {editingLabel ? (
            <input
              autoFocus
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commitLabel(); }}
              className="flex-1 font-sans text-[13px] text-soft-white bg-transparent focus:outline-none border-b border-cyan/50"
            />
          ) : (
            <span
              className="font-sans text-[13px] text-soft-white cursor-text hover:text-white transition-precise"
              onClick={() => { setLabelText(shot.label); setEditingLabel(true); }}
              title="Click to edit label"
            >
              {shot.label || shotTypeLabel(shot.shot_type)}
            </span>
          )}
          {!editingLabel && (
            <button
              type="button"
              onClick={() => { setLabelText(shot.label); setEditingLabel(true); }}
              className="text-readable hover:text-cyan transition-precise opacity-0 group-hover:opacity-100"
            >
              <Pencil size={10} />
            </button>
          )}
        </div>

        {/* Linked prompt */}
        {linkedPrompt && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-readable">Prompt:</span>
            <span className="font-mono text-[10px] text-soft-white truncate">{linkedPrompt.title}</span>
            <button
              type="button"
              onClick={() => onUpdate(shot.id, { prompt_id: undefined })}
              className="text-readable hover:text-red transition-precise ml-auto shrink-0"
              title="Remove prompt link"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Notes */}
        {(editingNotes || shot.notes) && (
          <div>
            {editingNotes ? (
              <textarea
                autoFocus
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                onBlur={commitNotes}
                onKeyDown={(e) => { if (e.key === "Escape") commitNotes(); }}
                rows={2}
                placeholder="Notes…"
                className="w-full font-mono text-[11px] text-readable bg-white/4 rounded-sm px-2 py-1.5 focus:outline-none resize-none"
                style={{ border: "var(--border-default)" }}
              />
            ) : (
              <span
                className="font-mono text-[11px] text-readable cursor-text hover:text-soft-white transition-precise block"
                onClick={() => { setNotesText(shot.notes ?? ""); setEditingNotes(true); }}
                title="Click to edit notes"
              >
                {shot.notes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1.5 px-2 py-2.5 shrink-0 border-l border-white/8">
        <button
          type="button"
          onClick={() => onConnectPrompt(shot.id)}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-readable hover:text-cyan transition-precise py-1"
          title="Connect prompt"
        >
          <Film size={10} />
        </button>
        <button
          type="button"
          onClick={() => onConnectResult(shot.id)}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-readable hover:text-cyan transition-precise py-1"
          title="Connect result"
        >
          <Image size={10} />
        </button>
        {!editingNotes && (
          <button
            type="button"
            onClick={() => { setNotesText(shot.notes ?? ""); setEditingNotes(true); }}
            className="font-mono text-[9px] uppercase tracking-widest text-readable hover:text-cyan transition-precise py-1"
            title="Edit notes"
          >
            <Pencil size={10} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(shot.id)}
          className="font-mono text-[9px] uppercase tracking-widest text-readable hover:text-red transition-precise py-1 mt-auto"
          title="Delete shot"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function ProjectSequence() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [prompts, setPrompts] = useState<ProjectPrompt[]>([]);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [connectPromptFor, setConnectPromptFor] = useState<string | null>(null);
  const [connectResultFor, setConnectResultFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [proj, projectShots, projectPrompts, projectResults] = await Promise.all([
      getProjectById(id),
      getProjectShots(id),
      getPromptsForProject(id),
      getResultsForProject(id),
    ]);
    setProject(proj ?? null);
    setShots(projectShots);
    setPrompts(projectPrompts);
    setResults(projectResults);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !id) return;
    const oldIndex = shots.findIndex((s) => s.id === active.id);
    const newIndex = shots.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(shots, oldIndex, newIndex);
    setShots(reordered);
    await reorderShots(id, reordered.map((s) => s.id));
  };

  const handleShotUpdate = async (shotId: string, changes: Partial<Shot>) => {
    setShots((prev) => prev.map((s) => s.id === shotId ? { ...s, ...changes } : s));
    const { id: _id, project_id: _pid, sort_order: _so, created_at: _ca, ...rest } = changes as Record<string, unknown>;
    if (Object.keys(rest).length > 0) await updateShot(shotId, rest);
  };

  const handleDelete = async (shotId: string) => {
    setShots((prev) => prev.filter((s) => s.id !== shotId));
    await deleteShot(shotId);
  };

  const handleShotCreated = (shot: Shot) => {
    setShots((prev) => [...prev, shot]);
    setShowAddForm(false);
  };

  const handleConnectPrompt = async (promptId: string) => {
    if (!connectPromptFor) return;
    await updateShot(connectPromptFor, { prompt_id: promptId });
    setShots((prev) => prev.map((s) => s.id === connectPromptFor ? { ...s, prompt_id: promptId } : s));
    setConnectPromptFor(null);
  };

  const handleConnectResult = async (resultId: string) => {
    if (!connectResultFor) return;
    await updateShot(connectResultFor, { result_id: resultId });
    setShots((prev) => prev.map((s) => s.id === connectResultFor ? { ...s, result_id: resultId } : s));
    setConnectResultFor(null);
  };

  if (loading) {
    return (
      <PageContainer title="Shot Sequence" subtitle="Loading…">
        <div className="flex items-center justify-center py-20">
          <span className="font-mono text-[10px] uppercase tracking-widest text-dim/50">Loading</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={project?.title ?? "Shot Sequence"}
      subtitle="SHOT SEQUENCE"
    >
      <div className="flex flex-col gap-6 max-w-3xl">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}`)}
          className="flex items-center gap-2 text-readable hover:text-white transition-precise self-start"
        >
          <ArrowLeft size={13} />
          <span className="font-mono text-[11px] uppercase tracking-widest">Back to Project</span>
        </button>

        {/* Header controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-[15px] font-semibold text-white">
              {shots.length} {shots.length === 1 ? "shot" : "shots"}
            </span>
            <span className="font-mono text-[11px] text-readable">
              {shots.filter((s) => s.result_id).length} with results · {shots.filter((s) => s.prompt_id).length} with prompts
            </span>
          </div>
          {!showAddForm && (
            <Button variant="accent" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus size={11} />
              Add Shot
            </Button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <AddShotForm
            projectId={id!}
            nextOrder={shots.length}
            onCreated={handleShotCreated}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Shot list */}
        {shots.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 py-16 rounded-card"
            style={{ border: "var(--border-dim)", borderStyle: "dashed" }}
          >
            <Film size={28} className="text-white/20" />
            <div className="flex flex-col items-center gap-1.5">
              <span className="font-sans text-[14px] font-semibold text-white">No shots yet</span>
              <span className="font-mono text-[12px] text-readable text-center max-w-[280px]">
                Add shots to define your production sequence — each shot connects a prompt and result image to a specific scene.
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus size={11} />
              Add First Shot
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {shots.map((shot, index) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    index={index}
                    linkedPrompt={prompts.find((p) => p.id === shot.prompt_id)}
                    linkedResult={results.find((r) => r.id === shot.result_id)}
                    onUpdate={handleShotUpdate}
                    onDelete={handleDelete}
                    onConnectPrompt={(shotId) => setConnectPromptFor(shotId)}
                    onConnectResult={(shotId) => setConnectResultFor(shotId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {connectPromptFor && (
        <PromptPicker
          prompts={prompts}
          onSelect={handleConnectPrompt}
          onClose={() => setConnectPromptFor(null)}
        />
      )}
      {connectResultFor && (
        <ResultPicker
          results={results}
          onSelect={handleConnectResult}
          onClose={() => setConnectResultFor(null)}
        />
      )}
    </PageContainer>
  );
}
