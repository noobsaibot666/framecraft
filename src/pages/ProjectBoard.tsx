import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, ChevronRight, ChevronLeft,
  AlertTriangle, Check, Trash2, Star, ImageOff, X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  createDeliverable,
  getDeliverablesForProject,
  updateDeliverable,
  deleteDeliverable,
  advanceDeliverable,
  retreatDeliverable,
  isMissingResult,
  STATUS_ORDER,
  STATUS_LABEL,
} from "@/lib/deliverables";
import { getProjectById } from "@/lib/projects";
import { usePromptStore } from "@/stores/usePromptStore";
import { cn } from "@/lib/utils";
import type { Deliverable, DeliverableStatus, Project } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const ASPECT_OPTIONS = ["", "1:1", "16:9", "9:16", "4:5", "4:3", "21:9", "3:2"];
const FORMAT_OPTIONS = [
  "", "Hero Banner", "Social Post", "Story", "Product Shot",
  "Campaign Visual", "Editorial", "Background", "Icon", "Other",
];

// ─── Inline create form ───────────────────────────────────────

function CreateForm({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (d: Deliverable) => void;
}) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("");
  const [aspect, setAspect] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const id = await createDeliverable({
      project_id: projectId,
      title: title.trim(),
      target_format: format || undefined,
      aspect_ratio: aspect || undefined,
    });
    onCreated({
      id,
      project_id: projectId,
      title: title.trim(),
      status: "planned",
      target_format: format || undefined,
      aspect_ratio: aspect || undefined,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setTitle("");
    setFormat("");
    setAspect("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full px-3 py-2 rounded-sm font-mono text-[9px] text-dim/40 hover:text-white/60 transition-precise"
        style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
      >
        <Plus size={9} /> New deliverable
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Deliverable title…"
        className="w-full h-7 px-2 font-sans text-[12px] text-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.10)" }}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="h-6 px-1.5 font-mono text-[9px] text-soft-white bg-dark rounded-sm focus:outline-none appearance-none"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Format…</option>
          {FORMAT_OPTIONS.slice(1).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={aspect}
          onChange={(e) => setAspect(e.target.value)}
          className="h-6 px-1.5 font-mono text-[9px] text-soft-white bg-dark rounded-sm focus:outline-none appearance-none"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Ratio…</option>
          {ASPECT_OPTIONS.slice(1).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="flex gap-1.5">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!title.trim()} className="flex-1 justify-center">
          <Check size={9} /> Add
        </Button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-2 font-mono text-[9px] text-dim/50 hover:text-white transition-precise">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Deliverable card ─────────────────────────────────────────

function DeliverableCard({
  deliverable,
  onAdvance,
  onRetreat,
  onDelete,
  onEdit,
  onCraftPrompt,
}: {
  deliverable: Deliverable;
  onAdvance: () => void;
  onRetreat: () => void;
  onDelete: () => void;
  onEdit: (d: Deliverable) => void;
  onCraftPrompt: () => void;
}) {
  const navigate = useNavigate();
  const missing = isMissingResult(deliverable);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(deliverable.title);
  const [editFormat, setEditFormat] = useState(deliverable.target_format ?? "");
  const [editAspect, setEditAspect] = useState(deliverable.aspect_ratio ?? "");
  const [editNotes, setEditNotes] = useState(deliverable.notes ?? "");

  const atStart = deliverable.status === "planned";
  const atEnd = deliverable.status === "final";

  const handleSaveEdit = async () => {
    await updateDeliverable(deliverable.id, {
      title: editTitle.trim() || deliverable.title,
      target_format: editFormat || undefined,
      aspect_ratio: editAspect || undefined,
      notes: editNotes || undefined,
    });
    onEdit({ ...deliverable, title: editTitle.trim() || deliverable.title, target_format: editFormat || undefined, aspect_ratio: editAspect || undefined, notes: editNotes || undefined });
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-sm",
        deliverable.status === "final" && "opacity-70"
      )}
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Title + delete */}
      <div className="flex items-start gap-1.5">
        <span className="font-sans text-[11px] text-soft-white flex-1 leading-snug">{deliverable.title}</span>
        <button
          type="button"
          onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
            onDelete();
          }}
          className={cn(
            "shrink-0 transition-precise",
            confirmDelete ? "text-red/70" : "text-dim/20 hover:text-red/50"
          )}
        >
          <Trash2 size={9} />
        </button>
      </div>

      {/* Badges */}
      {(deliverable.target_format || deliverable.aspect_ratio) && (
        <div className="flex flex-wrap gap-1">
          {deliverable.target_format && (
            <span className="font-mono text-[7px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
              style={{ border: "var(--border-dim)", color: "rgba(255,255,255,0.35)" }}>
              {deliverable.target_format}
            </span>
          )}
          {deliverable.aspect_ratio && (
            <span className="font-mono text-[7px] tracking-widest px-1.5 py-0.5 rounded-sm"
              style={{ border: "var(--border-dim)", color: "rgba(255,255,255,0.25)" }}>
              {deliverable.aspect_ratio}
            </span>
          )}
        </div>
      )}

      {/* Linked prompt */}
      {deliverable.linked_prompt_id ? (
        <button
          type="button"
          onClick={() => navigate(`/library/${deliverable.linked_prompt_id}`)}
          className="flex items-center gap-1.5 text-left hover:text-white transition-precise"
        >
          <Star size={8} className="text-white/30 shrink-0" />
          <span className="font-mono text-[9px] text-dim/60 truncate">Prompt linked</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onCraftPrompt}
          className="flex items-center gap-1.5 text-left hover:text-white/60 transition-precise"
        >
          <Plus size={8} className="text-dim/30 shrink-0" />
          <span className="font-mono text-[9px] text-dim/30">Craft prompt</span>
        </button>
      )}

      {/* Linked result */}
      {deliverable.linked_result_id ? (
        <div className="flex items-center gap-1.5">
          <ImageOff size={8} className="text-white/20 shrink-0" />
          <span className="font-mono text-[9px] text-dim/40 truncate">Result linked</span>
        </div>
      ) : null}

      {/* Missing result warning */}
      {missing && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
          style={{ background: "rgba(215,25,33,0.06)", border: "1px solid rgba(215,25,33,0.2)" }}>
          <AlertTriangle size={8} className="text-red/50 shrink-0" />
          <span className="font-mono text-[8px] text-red/50">No result yet</span>
        </div>
      )}

      {/* Notes (collapsed) */}
      {deliverable.notes && !editing && (
        <p className="font-mono text-[8px] text-dim/40 leading-relaxed line-clamp-2">{deliverable.notes}</p>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "var(--border-dim)" }}>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="w-full h-6 px-2 font-mono text-[10px] text-white bg-dark rounded-sm focus:outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
          <div className="grid grid-cols-2 gap-1">
            <select value={editFormat} onChange={(e) => setEditFormat(e.target.value)}
              className="h-6 px-1 font-mono text-[9px] text-soft-white bg-dark rounded-sm focus:outline-none appearance-none"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <option value="">Format…</option>
              {FORMAT_OPTIONS.slice(1).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={editAspect} onChange={(e) => setEditAspect(e.target.value)}
              className="h-6 px-1 font-mono text-[9px] text-soft-white bg-dark rounded-sm focus:outline-none appearance-none"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <option value="">Ratio…</option>
              {ASPECT_OPTIONS.slice(1).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes…" rows={2}
            className="w-full px-2 py-1 font-mono text-[9px] text-soft-white placeholder:text-dim/30 bg-dark rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex gap-1">
            <Button variant="primary" size="sm" onClick={handleSaveEdit} className="flex-1 justify-center">
              <Check size={9} /> Save
            </Button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-2 font-mono text-[9px] text-dim/50 hover:text-white transition-precise">
              <X size={9} />
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-1 pt-1" style={{ borderTop: "var(--border-dim)" }}>
          <button type="button" onClick={onRetreat} disabled={atStart}
            className={cn("p-1 rounded-sm transition-precise",
              atStart ? "text-dim/15 cursor-not-allowed" : "text-dim/40 hover:text-white hover:bg-white/5"
            )}>
            <ChevronLeft size={10} />
          </button>
          <button type="button" onClick={onAdvance} disabled={atEnd}
            className={cn("p-1 rounded-sm transition-precise",
              atEnd ? "text-dim/15 cursor-not-allowed" : "text-dim/50 hover:text-white hover:bg-white/5"
            )}>
            <ChevronRight size={10} />
          </button>
          <span className="flex-1" />
          <button type="button" onClick={() => setEditing(true)}
            className="font-mono text-[8px] text-dim/30 hover:text-white transition-precise px-1.5 py-0.5 rounded-sm hover:bg-white/5">
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Board column ─────────────────────────────────────────────

function BoardColumn({
  status,
  deliverables,
  projectId,
  onCreated,
  onAdvance,
  onRetreat,
  onDelete,
  onEdit,
  onCraftPrompt,
}: {
  status: DeliverableStatus;
  deliverables: Deliverable[];
  projectId: string;
  onCreated: (d: Deliverable) => void;
  onAdvance: (id: string) => void;
  onRetreat: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (d: Deliverable) => void;
  onCraftPrompt: (d: Deliverable) => void;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-[200px] w-[200px] shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="system-label">{STATUS_LABEL[status]}</span>
        {deliverables.length > 0 && (
          <span className="font-mono text-[8px] text-dim/30">{deliverables.length}</span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {deliverables.map((d) => (
          <DeliverableCard
            key={d.id}
            deliverable={d}
            onAdvance={() => onAdvance(d.id)}
            onRetreat={() => onRetreat(d.id)}
            onDelete={() => onDelete(d.id)}
            onEdit={onEdit}
            onCraftPrompt={() => onCraftPrompt(d)}
          />
        ))}
      </div>

      {/* Add new — only in PLANNED */}
      {status === "planned" && (
        <CreateForm projectId={projectId} onCreated={onCreated} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { create: createPrompt } = usePromptStore();

  const [project, setProject] = useState<Project | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    const [proj, dels] = await Promise.all([
      getProjectById(id),
      getDeliverablesForProject(id),
    ]);
    setProject(proj);
    setDeliverables(dels);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // ── Handlers ──────────────────────────────────────────────

  const handleCreated = (d: Deliverable) => {
    setDeliverables((prev) => [...prev, d]);
  };

  const handleAdvance = async (deliverableId: string) => {
    const next = await advanceDeliverable(deliverableId);
    if (next) {
      setDeliverables((prev) =>
        prev.map((d) => d.id === deliverableId ? { ...d, status: next } : d)
      );
    }
  };

  const handleRetreat = async (deliverableId: string) => {
    const prev = await retreatDeliverable(deliverableId);
    if (prev) {
      setDeliverables((ds) =>
        ds.map((d) => d.id === deliverableId ? { ...d, status: prev } : d)
      );
    }
  };

  const handleDelete = async (deliverableId: string) => {
    await deleteDeliverable(deliverableId);
    setDeliverables((prev) => prev.filter((d) => d.id !== deliverableId));
  };

  const handleEdit = (updated: Deliverable) => {
    setDeliverables((prev) => prev.map((d) => d.id === updated.id ? updated : d));
  };

  const handleCraftPrompt = async (deliverable: Deliverable) => {
    const newId = await createPrompt({
      title: deliverable.title,
      use_case: deliverable.target_format || undefined,
      provider: "midjourney",
      prompt_text: `[Draft for: ${deliverable.title}]`,
    });
    await updateDeliverable(deliverable.id, { linked_prompt_id: newId, status: "prompting" });
    setDeliverables((prev) =>
      prev.map((d) => d.id === deliverable.id
        ? { ...d, linked_prompt_id: newId, status: "prompting" }
        : d
      )
    );
    navigate(`/craft/${newId}`);
  };

  // ── Derived ───────────────────────────────────────────────

  const byStatus = (status: DeliverableStatus) =>
    deliverables.filter((d) => d.status === status);

  const missingCount = deliverables.filter(isMissingResult).length;

  if (loading) {
    return (
      <PageContainer title="PIPELINE BOARD">
        <div className="flex items-center justify-center py-32">
          <span className="font-ndot text-[32px] text-dim/30 dot-blink">···</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="PIPELINE BOARD"
      subtitle={project?.title?.toUpperCase() ?? "PROJECT"}
      action={
        <div className="flex items-center gap-2">
          {missingCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
              style={{ background: "rgba(215,25,33,0.06)", border: "1px solid rgba(215,25,33,0.2)" }}>
              <AlertTriangle size={9} className="text-red/50" />
              <span className="font-mono text-[9px] text-red/50">{missingCount} missing result{missingCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft size={11} /> Project
          </Button>
        </div>
      }
    >
      {deliverables.length === 0 ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-center py-16 gap-3"
            style={{ border: "2px dashed rgba(255,255,255,0.06)", borderRadius: "8px" }}>
            <span className="font-mono text-[10px] text-dim/30">No deliverables yet.</span>
            <span className="font-mono text-[9px] text-dim/20">Add one in the PLANNED column below.</span>
          </div>
          <div className="w-[200px]">
            <CreateForm projectId={id!} onCreated={handleCreated} />
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mb-4">
          {STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              deliverables={byStatus(status)}
              projectId={id!}
              onCreated={handleCreated}
              onAdvance={handleAdvance}
              onRetreat={handleRetreat}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onCraftPrompt={handleCraftPrompt}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
