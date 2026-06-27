import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, Trash2, ChevronDown, Plus, X,
  Star, AlertTriangle, Check, Image, FileText, Upload,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  getProjectById,
  updateProject,
  deleteProject,
  getPromptsForProject,
  getResultsForProject,
  getReferencesForProject,
  addResultToProject,
  removeResultFromProject,
  addPromptToProject,
  removePromptFromProject,
  addReferenceToProject,
  removeReferenceFromProject,
  resetProjectContent,
  type CreateProjectInput,
} from "@/lib/projects";
import { getPrompts, getRecentResults, recomputePromptResultSummary, searchPrompts } from "@/lib/db";
import { getReferences, searchReferences } from "@/lib/references";
import { fileToDataUrl } from "@/lib/imageUtils";
import { importProjectResultImage } from "@/lib/sharedImport";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { DirectionStudio } from "@/components/projects/DirectionStudio";
import { getProjectShots } from "@/lib/shotSequence";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus, Category, Prompt, Reference } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "draft",    label: "Draft" },
  { value: "active",   label: "Active" },
  { value: "review",   label: "Review" },
  { value: "archived", label: "Archived" },
];

const STATUS_DOT: Record<ProjectStatus, string> = {
  draft:    "bg-readable",
  active:   "bg-cyan",
  review:   "bg-amber",
  archived: "bg-white/10",
};

const CATEGORY_OPTIONS: Category[] = [
  "advertising", "editorial", "product", "fashion", "automotive",
  "architecture", "portrait", "cinematic", "abstract", "other",
];

const PROJECT_TYPE_OPTIONS = [
  { value: "campaign", label: "Campaign" },
  { value: "image-series", label: "Image series" },
  { value: "video-sequence", label: "Video sequence" },
  { value: "brand-system", label: "Brand system" },
  { value: "research", label: "Research" },
];

const ASPECT_RATIO_OPTIONS = ["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"];
const PROVIDER_TARGET_OPTIONS = ["midjourney", "nano banana", "gpt image", "seedance", "kling", "runway", "higgsfield"];

// ─── Shared field atoms ───────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="system-label text-[11px] text-muted">{children}</label>;
}

function FieldInput({ value, onChange, placeholder, mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={cn(
        "h-10 px-3 text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full",
        mono ? "font-mono" : "font-sans"
      )}
      style={{ border: "1px solid rgba(255,255,255,0.16)" }} />
  );
}

function FieldTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      rows={rows}
      className="px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full resize-none"
      style={{ border: "1px solid rgba(255,255,255,0.16)" }} />
  );
}

function FieldSelect<T extends string>({ value, onChange, options, empty }: {
  value: string; onChange: (v: T) => void; options: { value: T; label: string }[]; empty?: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none h-10 pl-3 pr-7 font-mono text-[12px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
        {empty && <option value="" className="bg-panel text-dim/50">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

function PillToggleGroup({ values, options, onChange }: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={cn(
              "h-8 px-3 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise",
              selected ? "text-black bg-cyan" : "text-readable hover:text-white"
            )}
            style={selected ? undefined : { border: "var(--border-default)" }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

// ─── Panel Section wrapper ────────────────────────────────────

function Panel({ title, count, children, action }: {
  title: string; count?: number; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="system-label text-soft-white">{title}</span>
          {count != null && <span className="font-mono text-[10px] text-readable">({count})</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SafeThumb({ src, alt = "", className }: { src?: string; alt?: string; className: string }) {
  const image = useImageDisplaySrc(src);
  const displaySrc = image.src;
  if (!displaySrc) {
    return (
      <div className={cn(className, "flex items-center justify-center")} style={{ background: "rgba(255,255,255,0.05)" }}>
        <Image size={12} className="text-white/20" />
      </div>
    );
  }
  return <img src={displaySrc} alt={alt} className={className} onError={image.onError} />;
}

// ─── Linked prompt row ────────────────────────────────────────

function PromptRow({ prompt, onRemove, onOpen }: {
  prompt: { id: string; title: string; provider: string; rating: number; is_winner: boolean; is_failed: boolean };
  onRemove: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-sm group"
      style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <span className="font-sans text-[13px] text-soft-white truncate block">{prompt.title}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{prompt.provider}</span>
          {prompt.is_winner && <span className="font-mono text-[9px] text-amber">WINNER</span>}
          {prompt.is_failed && <span className="font-mono text-[9px] text-red">FAILED</span>}
        </div>
      </div>
      {/* Stars */}
      <div className="flex items-center gap-0.5 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={9} className={cn(i < prompt.rating ? "text-amber fill-amber/40" : "text-white/14")} />
        ))}
      </div>
      <button type="button" onClick={onRemove}
        className="text-muted hover:text-red transition-precise opacity-0 group-hover:opacity-100 shrink-0">
        <X size={11} />
      </button>
    </div>
  );
}

// ─── Linked reference row ────────────────────────────────────

function RefRow({ ref: r, onRemove, onOpen }: {
  ref: { id: string; title: string; kind: string; thumbnail_data?: string; rating: number };
  onRemove: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-sm group"
      style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
      <SafeThumb src={r.thumbnail_data} className="w-11 h-11 object-cover rounded-sm shrink-0" />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <span className="font-sans text-[13px] text-soft-white truncate block">{r.title}</span>
        <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{r.kind}</span>
      </div>
      <button type="button" onClick={onRemove}
        className="text-muted hover:text-red transition-precise opacity-0 group-hover:opacity-100 shrink-0">
        <X size={11} />
      </button>
    </div>
  );
}

// ─── Add Picker ───────────────────────────────────────────────

type PickerMode = "prompts" | "references" | "results" | null;

function PromptPicker({ projectId, onAdd, onClose }: {
  projectId: string;
  onAdd: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Prompt[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const results = search.trim() ? await searchPrompts(search.trim()) : await getPrompts();
      setItems(results.slice(0, 20));
    };
    load();
  }, [search]);

  const handleAdd = async (id: string) => {
    await addPromptToProject(projectId, id);
    setAdded((prev) => new Set([...prev, id]));
    await onAdd();
    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search prompts…" autoFocus
        className="h-10 px-3 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }} />
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-sm hover:bg-white/3 transition-precise">
            <div className="flex-1 min-w-0">
              <span className="font-sans text-[10px] text-soft-white truncate block">{p.title}</span>
              <span className="font-mono text-[8px] text-dim/40 tracking-widest uppercase">{p.provider}</span>
            </div>
            {added.has(p.id) ? (
              <span className="flex items-center gap-1 font-mono text-[8px] text-white/30"><Check size={8} /> Added</span>
            ) : (
              <button type="button" onClick={() => handleAdd(p.id)}
                className="font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-red/70 hover:text-white transition-precise"
                style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                <Plus size={7} className="inline mr-0.5" /> Add
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <span className="font-mono text-[9px] text-dim/40 px-2 py-2">No prompts found.</span>
        )}
      </div>
      <div className="flex justify-end pt-1">
        <button type="button" onClick={onClose} className="font-mono text-[9px] text-dim/50 hover:text-white transition-precise">
          Done
        </button>
      </div>
    </div>
  );
}

function ReferencePicker({ projectId, onAdd, onClose }: {
  projectId: string;
  onAdd: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Reference[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const results = search.trim() ? await searchReferences(search.trim()) : await getReferences();
      setItems(results.slice(0, 20));
    };
    load();
  }, [search]);

  const handleAdd = async (id: string) => {
    await addReferenceToProject(projectId, id);
    setAdded((prev) => new Set([...prev, id]));
    onAdd();
  };

  return (
    <div className="flex flex-col gap-2">
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search references…" autoFocus
        className="h-7 px-3 font-mono text-[10px] text-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.15)" }} />
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {items.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-sm hover:bg-white/3 transition-precise">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <SafeThumb src={r.thumbnail_data} className="w-7 h-7 object-cover rounded-sm shrink-0" />
              <div className="min-w-0">
                <span className="font-sans text-[10px] text-soft-white truncate block">{r.title}</span>
                <span className="font-mono text-[8px] text-dim/40 tracking-widest uppercase">{r.kind}</span>
              </div>
            </div>
            {added.has(r.id) ? (
              <span className="flex items-center gap-1 font-mono text-[8px] text-white/30"><Check size={8} /> Added</span>
            ) : (
              <button type="button" onClick={() => handleAdd(r.id)}
                className="font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-red/70 hover:text-white transition-precise"
                style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                <Plus size={7} className="inline mr-0.5" /> Add
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <span className="font-mono text-[9px] text-dim/40 px-2 py-2">No references found.</span>
        )}
      </div>
      <div className="flex justify-end pt-1">
        <button type="button" onClick={onClose} className="font-mono text-[9px] text-dim/50 hover:text-white transition-precise">
          Done
        </button>
      </div>
    </div>
  );
}

function ResultPicker({ projectId, onAdd, onClose }: {
  projectId: string;
  onAdd: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getRecentResults>>>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => { getRecentResults(24).then(setItems); }, []);

  const handleAdd = async (resultId: string) => {
    await addResultToProject(projectId, resultId);
    setAdded((prev) => new Set([...prev, resultId]));
    await onAdd();
    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[9px] text-dim/50">Recent results</span>
      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
        {items.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleAdd(r.id)}
              disabled={added.has(r.id)}
              className="relative aspect-square rounded-sm overflow-hidden text-left disabled:opacity-50"
              style={{ border: added.has(r.id) ? "1px solid rgba(255,255,255,0.35)" : "var(--border-dim)", background: "rgba(255,255,255,0.04)" }}
            >
              <SafeThumb src={r.thumbnail_path} className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 font-mono text-[7px] text-white/70 truncate"
                style={{ background: "rgba(0,0,0,0.65)" }}>
                {added.has(r.id) ? "Added" : r.prompt_title || r.id.slice(0, 6)}
              </span>
            </button>
        ))}
        {items.length === 0 && (
          <span className="col-span-4 font-mono text-[9px] text-dim/30">No results yet. Add results from a prompt or the generation queue.</span>
        )}
      </div>
      <div className="flex justify-end pt-1">
        <button type="button" onClick={onClose} className="font-mono text-[9px] text-dim/50 hover:text-white transition-precise">
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────

function StatChip({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-sm"
      style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
      <span className={cn("font-mono text-[22px] tabular-nums font-medium", alert && value > 0 ? "text-red" : "text-soft-white")}>
        {value}
      </span>
      <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resultInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const hydratedRef = useRef(false);

  // Form state
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [campaign, setCampaign] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [projectType, setProjectType] = useState("");
  const [intendedOutput, setIntendedOutput] = useState("");
  const [imageNeeds, setImageNeeds] = useState("");
  const [videoNeeds, setVideoNeeds] = useState("");
  const [aspectRatios, setAspectRatios] = useState<string[]>([]);
  const [providerTargets, setProviderTargets] = useState<string[]>([]);
  const [visualDirection, setVisualDirection] = useState("");
  const [constraints, setConstraints] = useState("");
  const [creativeGoals, setCreativeGoals] = useState("");
  const [briefText, setBriefText] = useState("");
  const [productionGoal, setProductionGoal] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  // Linked content
  const [linkedPrompts, setLinkedPrompts] = useState<Awaited<ReturnType<typeof getPromptsForProject>>>([]);
  const [linkedRefs, setLinkedRefs] = useState<Awaited<ReturnType<typeof getReferencesForProject>>>([]);
  const [linkedResults, setLinkedResults] = useState<Awaited<ReturnType<typeof getResultsForProject>>>([]);
  const [shotCount, setShotCount] = useState(0);
  const [resultImporting, setResultImporting] = useState(false);
  const [resultImportError, setResultImportError] = useState("");
  const [resultImportSaved, setResultImportSaved] = useState(false);

  // Picker
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [proj, prompts, refs, results, shots] = await Promise.all([
        getProjectById(id),
        getPromptsForProject(id),
        getReferencesForProject(id),
        getResultsForProject(id),
        getProjectShots(id),
      ]);
      if (!proj) { navigate("/projects"); return; }

      setTitle(proj.title);
      setClient(proj.client ?? "");
      setCampaign(proj.campaign ?? "");
      setStatus(proj.status);
      setProjectType(proj.project_type ?? "");
      setIntendedOutput(proj.intended_output ?? "");
      setImageNeeds(proj.image_needs ?? "");
      setVideoNeeds(proj.video_needs ?? "");
      setAspectRatios(proj.aspect_ratios ?? []);
      setProviderTargets(proj.provider_targets ?? []);
      setVisualDirection(proj.visual_direction ?? "");
      setConstraints(proj.constraints ?? "");
      setCreativeGoals(proj.creative_goals ?? "");
      setBriefText(proj.brief_text ?? "");
      setProductionGoal(proj.production_goal ?? "");
      setCategory(proj.category ?? "");
      setTags((proj.tags ?? []).join(", "));
      setNotes(proj.notes ?? "");
      setLinkedPrompts(prompts);
      setLinkedRefs(refs);
      setLinkedResults(results);
      setShotCount(shots.length);
      setLoading(false);
      hydratedRef.current = true;
    })();
  }, [id]);

  const buildInput = (): CreateProjectInput => ({
    title: title.trim(),
    client: client.trim() || undefined,
    campaign: campaign.trim() || undefined,
    status,
    project_type: projectType || undefined,
    intended_output: intendedOutput.trim() || undefined,
    image_needs: imageNeeds.trim() || undefined,
    video_needs: videoNeeds.trim() || undefined,
    aspect_ratios: aspectRatios,
    provider_targets: providerTargets,
    visual_direction: visualDirection.trim() || undefined,
    constraints: constraints.trim() || undefined,
    creative_goals: creativeGoals.trim() || undefined,
    brief_text: briefText.trim() || undefined,
    production_goal: productionGoal.trim() || undefined,
    category: (category || undefined) as Project["category"] | undefined,
    tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    notes: notes.trim() || undefined,
  });

  const handleSave = async () => {
    if (!id || !title.trim()) return;
    setSaving(true);
    try {
      await updateProject(id, buildInput());
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!id || loading || !hydratedRef.current || !title.trim()) return;
    const timer = window.setTimeout(() => {
      setSaving(true);
      updateProject(id, buildInput())
        .then(() => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1200);
        })
        .finally(() => setSaving(false));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    id, loading, title, client, campaign, status, projectType, intendedOutput,
    imageNeeds, videoNeeds, aspectRatios, providerTargets, visualDirection,
    constraints, creativeGoals, briefText, productionGoal, category, tags, notes,
  ]);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteProject(id!);
    navigate("/projects");
  };

  const handleResetProject = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    await resetProjectContent(id!);
    setBriefText("");
    setProductionGoal("");
    setIntendedOutput("");
    setImageNeeds("");
    setVideoNeeds("");
    setAspectRatios([]);
    setProviderTargets([]);
    setVisualDirection("");
    setConstraints("");
    setCreativeGoals("");
    setCategory("");
    setTags("");
    setNotes("");
    setLinkedPrompts([]);
    setLinkedRefs([]);
    setLinkedResults([]);
    setPickerMode(null);
    setConfirmReset(false);
  };

  const handleRemovePrompt = async (promptId: string) => {
    await removePromptFromProject(id!, promptId);
    setLinkedPrompts((prev) => prev.filter((p) => p.id !== promptId));
  };

  const handleRemoveRef = async (refId: string) => {
    await removeReferenceFromProject(id!, refId);
    setLinkedRefs((prev) => prev.filter((r) => r.id !== refId));
  };

  const handleRemoveResult = async (resultId: string) => {
    await removeResultFromProject(id!, resultId);
    setLinkedResults((prev) => prev.filter((r) => r.id !== resultId));
  };

  const reloadLinks = async () => {
    if (!id) return;
    const [prompts, refs, results] = await Promise.all([
      getPromptsForProject(id),
      getReferencesForProject(id),
      getResultsForProject(id),
    ]);
    setLinkedPrompts(prompts);
    setLinkedRefs(refs);
    setLinkedResults(results);
  };

  const handleImportProjectResult = async (files: FileList | null) => {
    const file = files?.[0];
    if (!id || !file || resultImporting) return;

    const prompt = linkedPrompts[0];
    if (!prompt) {
      setResultImportError("Link a prompt before importing a result.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setResultImportError("Choose an image file.");
      return;
    }

    setResultImporting(true);
    setResultImportError("");
    setResultImportSaved(false);
    try {
      const resultId = crypto.randomUUID().replace(/-/g, "");
      const dataUrl = await fileToDataUrl(file);
      const result = await importProjectResultImage({
        resultId,
        projectId: id,
        promptId: prompt.id,
        dataUrl,
        originalName: file.name,
        result: {
          provider: prompt.provider,
          notes: `Imported from project workspace: ${file.name}`,
        },
      });
      if (!result.queued) {
        await recomputePromptResultSummary(prompt.id);
        await reloadLinks();
      }
      setPickerMode(null);
      setResultImportSaved(true);
      setTimeout(() => setResultImportSaved(false), 1800);
    } catch (error) {
      setResultImportError(error instanceof Error ? error.message : "Result import failed.");
    } finally {
      setResultImporting(false);
      if (resultInputRef.current) resultInputRef.current.value = "";
    }
  };

  const winnerCount = linkedPrompts.filter((p) => p.is_winner).length;
  const failedCount = linkedPrompts.filter((p) => p.is_failed).length;

  if (loading) {
    return (
      <PageContainer title="Project" subtitle="LOADING…">
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || "Project"}
      subtitle={[client, campaign].filter(Boolean).join(" · ") || "PROJECT WORKSPACE"}
      action={
        <div className="flex items-center gap-2">
          {/* Status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
            <FieldSelect<ProjectStatus>
              value={status}
              onChange={(v) => { setStatus(v); }}
              options={STATUS_OPTIONS}
            />
          </div>
          <button type="button" onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise",
              confirmDelete ? "text-red border-red/40" : "text-dim hover:text-red"
            )}
            style={{ border: confirmDelete ? "1px solid" : "var(--border-dim)" }}>
            <Trash2 size={9} className="inline mr-1" />
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
          <button type="button" onClick={handleResetProject}
            onBlur={() => setConfirmReset(false)}
            className={cn(
              "font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise",
              confirmReset ? "text-red border-red/40" : "text-dim hover:text-red"
            )}
            style={{ border: confirmReset ? "1px solid" : "var(--border-dim)" }}>
            <X size={9} className="inline mr-1" />
            {confirmReset ? "Confirm Reset" : "Reset"}
          </button>
          <Button variant="ghost" size="md" onClick={() => navigate("/projects")}>
            <ArrowLeft size={11} /> Projects
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={!title.trim() || saving}>
            <Save size={11} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        </div>
      }
    >
      <input
        ref={resultInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleImportProjectResult(event.target.files)}
      />
      <div className="flex flex-col gap-5 p-5 rounded-card mb-7"
        style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
              <span className="system-label text-soft-white">PROJECT WORKSPACE</span>
              {projectType && (
                <span className="font-mono text-[10px] tracking-widest uppercase text-readable px-2 py-1 rounded-sm"
                  style={{ border: "var(--border-dim)" }}>
                  {projectType}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {providerTargets.slice(0, 5).map((provider) => (
                <span key={provider} className="font-mono text-[10px] tracking-widest uppercase text-cyan px-2 py-1 rounded-sm"
                  style={{ border: "1px solid rgba(72, 229, 232, 0.28)", background: "rgba(72, 229, 232, 0.06)" }}>
                  {provider}
                </span>
              ))}
              {aspectRatios.slice(0, 5).map((ratio) => (
                <span key={ratio} className="font-mono text-[10px] tracking-widest uppercase text-readable px-2 py-1 rounded-sm"
                  style={{ border: "var(--border-dim)" }}>
                  {ratio}
                </span>
              ))}
              {!providerTargets.length && !aspectRatios.length && (
                <span className="font-mono text-[11px] text-readable">Add provider and ratio targets in Setup.</span>
              )}
            </div>
            {(intendedOutput || creativeGoals) && (
              <p className="font-mono text-[12px] leading-relaxed text-readable max-w-4xl">
                {intendedOutput || creativeGoals}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="primary" size="sm" onClick={() => navigate(`/craft?projectId=${id}`)}>
              <Plus size={10} /> Craft Prompt
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}/sequence`)}>
              Sequence
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}/board`)}>
              Pipeline
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/compare/${id}`)}>
              Compare
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-8">

        {/* Left column — setup + production */}
        <div className="flex flex-col gap-6">

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatChip label="Prompts" value={linkedPrompts.length} />
            <StatChip label="Results" value={linkedResults.length} />
            <StatChip label="Shots" value={shotCount} />
            <StatChip label="Winners" value={winnerCount} />
            <StatChip label="Failed" value={failedCount} alert />
          </div>

          {/* Title + Client + Campaign */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_220px] gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>TITLE</FieldLabel>
              <FieldInput value={title} onChange={setTitle} placeholder="Project name…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>CLIENT</FieldLabel>
              <FieldInput value={client} onChange={setClient} placeholder="Client name…" mono />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>CAMPAIGN</FieldLabel>
              <FieldInput value={campaign} onChange={setCampaign} placeholder="Campaign…" mono />
            </div>
          </div>

          {/* Setup */}
          <Panel title="SETUP">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>PROJECT TYPE</FieldLabel>
                <FieldSelect<string>
                  value={projectType}
                  onChange={setProjectType}
                  options={PROJECT_TYPE_OPTIONS}
                  empty="-- project type --"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>INTENDED OUTPUT</FieldLabel>
                <FieldTextarea value={intendedOutput} onChange={setIntendedOutput} placeholder="Final assets, prompt systems, boards, videos..." rows={3} />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel>ASPECT RATIOS</FieldLabel>
                <PillToggleGroup values={aspectRatios} options={ASPECT_RATIO_OPTIONS} onChange={setAspectRatios} />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel>PROVIDER TARGETS</FieldLabel>
                <PillToggleGroup values={providerTargets} options={PROVIDER_TARGET_OPTIONS} onChange={setProviderTargets} />
              </div>
            </div>
          </Panel>

          {/* Brief */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <FileText size={9} className="text-dim/40" />
              <FieldLabel>BRIEF</FieldLabel>
            </div>
            <FieldTextarea value={briefText} onChange={setBriefText} placeholder="Paste brief, goals, or creative direction…" rows={5} />
          </div>

          {/* Production goal */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>PRODUCTION GOAL</FieldLabel>
            <FieldTextarea value={productionGoal} onChange={setProductionGoal} placeholder="What does success look like for this production?" rows={3} />
          </div>

          <DirectionStudio
            project={{
              id: id!,
              title,
              client: client || undefined,
              campaign: campaign || undefined,
              status,
              project_type: projectType || undefined,
              intended_output: intendedOutput || undefined,
              image_needs: imageNeeds || undefined,
              video_needs: videoNeeds || undefined,
              aspect_ratios: aspectRatios,
              provider_targets: providerTargets,
              visual_direction: visualDirection || undefined,
              constraints: constraints || undefined,
              creative_goals: creativeGoals || undefined,
              brief_text: briefText || undefined,
              production_goal: productionGoal || undefined,
              category: (category || undefined) as Project["category"] | undefined,
              tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
              notes: notes || undefined,
              created_at: "",
              updated_at: "",
            }}
            onApplied={(fields) => {
              setVisualDirection(fields.visual_direction ?? "");
              setCreativeGoals(fields.creative_goals ?? "");
            }}
          />

          <Panel
            title="CRAFT"
            count={linkedPrompts.length}
            action={
              <Button variant="primary" size="sm" onClick={() => navigate(`/craft?projectId=${id}`)}>
                <Plus size={10} /> Craft Prompt
              </Button>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>VISUAL DIRECTION</FieldLabel>
                <FieldTextarea value={visualDirection} onChange={setVisualDirection} placeholder="Look, style, realism level..." rows={4} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>IMAGE NEEDS</FieldLabel>
                <FieldTextarea value={imageNeeds} onChange={setImageNeeds} placeholder="Hero, product, background, variations..." rows={4} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>VIDEO NEEDS</FieldLabel>
                <FieldTextarea value={videoNeeds} onChange={setVideoNeeds} placeholder="Motion tests, frames, transitions..." rows={4} />
              </div>
              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <FieldLabel>CREATIVE GOALS</FieldLabel>
                <FieldTextarea value={creativeGoals} onChange={setCreativeGoals} placeholder="What good looks like, what to avoid, and what should become reusable..." rows={3} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>CONSTRAINTS</FieldLabel>
                <FieldTextarea value={constraints} onChange={setConstraints} placeholder="Brand, legal, AI-look, or production limits..." rows={3} />
              </div>
            </div>
          </Panel>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>NOTES</FieldLabel>
            <FieldTextarea value={notes} onChange={setNotes} placeholder="Internal notes…" rows={2} />
          </div>

          {/* Prompts panel */}
          <Panel
            title="PROMPTS"
            count={linkedPrompts.length}
            action={
              <button type="button"
                onClick={() => setPickerMode(pickerMode === "prompts" ? null : "prompts")}
                className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-red hover:text-white transition-precise px-2.5 py-1.5 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                <Plus size={10} /> Add
              </button>
            }
          >
            {pickerMode === "prompts" && (
              <div className="mb-3 p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
                <PromptPicker
                  projectId={id!}
                  onAdd={reloadLinks}
                  onClose={() => setPickerMode(null)}
                />
              </div>
            )}
            {linkedPrompts.length === 0 && pickerMode !== "prompts" ? (
              <span className="font-mono text-[11px] text-muted">No prompts linked yet.</span>
            ) : (
              <div className="flex flex-col gap-1">
                {linkedPrompts.map((p) => (
                  <PromptRow
                    key={p.id}
                    prompt={p}
                    onRemove={() => handleRemovePrompt(p.id)}
                    onOpen={() => navigate(`/library/${p.id}`)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="RESULTS"
            count={linkedResults.length}
            action={
              <div className="flex items-center gap-1.5">
                <button type="button"
                  onClick={() => setPickerMode(pickerMode === "results" ? null : "results")}
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-red hover:text-white transition-precise px-2.5 py-1.5 rounded-sm"
                  style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                  <Plus size={10} /> Add Existing
                </button>
                <button type="button"
                  onClick={() => resultInputRef.current?.click()}
                  disabled={resultImporting || linkedPrompts.length === 0}
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-red hover:text-white disabled:opacity-35 disabled:hover:text-red/70 transition-precise px-2.5 py-1.5 rounded-sm"
                  style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                  <Upload size={10} /> {resultImporting ? "Importing" : "Import Image"}
                </button>
              </div>
            }
          >
            {(resultImportError || resultImportSaved) && (
              <div
                className={cn(
                  "mb-3 px-3 py-2 rounded-sm font-mono text-[11px]",
                  resultImportError ? "text-red/70" : "text-white/50"
                )}
                style={{ border: resultImportError ? "1px solid rgba(215,25,33,0.30)" : "var(--border-dim)", background: resultImportError ? "rgba(215,25,33,0.08)" : "rgba(255,255,255,0.04)" }}
              >
                {resultImportError || "Result imported and linked."}
              </div>
            )}
            {pickerMode === "results" && (
              <div className="mb-3 p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
                <ResultPicker
                  projectId={id!}
                  onAdd={reloadLinks}
                  onClose={() => setPickerMode(null)}
                />
              </div>
            )}
            {linkedResults.length === 0 && pickerMode !== "results" ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] text-muted">
                  {linkedPrompts.length === 0
                    ? "No results linked yet. Link a prompt first, then import an image result."
                    : "No results linked yet. Import an image result or add an existing result."}
                </span>
                {linkedPrompts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resultInputRef.current?.click()}
                    disabled={resultImporting}
                    className="self-start flex items-center gap-1.5 px-3 py-2 rounded-sm font-mono text-[10px] text-white hover:text-cyan disabled:opacity-50 transition-precise"
                    style={{ border: "var(--border-default)", background: "rgba(255,255,255,0.045)" }}
                  >
                    <Upload size={9} /> {resultImporting ? "Importing..." : "Import Image Result"}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2.5">
                {linkedResults.map((r) => (
                    <div key={r.id} className="relative rounded-sm overflow-hidden aspect-square group">
                      <SafeThumb src={r.thumbnail_path} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveResult(r.id)}
                        className="absolute bottom-1 right-1 w-6 h-6 rounded-sm bg-black/70 text-white/60 hover:text-red opacity-0 group-hover:opacity-100 transition-precise flex items-center justify-center"
                        title="Remove result from project"
                      >
                        <Trash2 size={10} />
                      </button>
                      {r.is_winner && (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center">
                          <Star size={8} className="text-white/80 fill-white/60" />
                        </span>
                      )}
                      {r.is_failed && (
                        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-sm bg-red/20 flex items-center justify-center">
                          <AlertTriangle size={7} className="text-red/70" />
                        </span>
                      )}
                    </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column — metadata + inspirations */}
        <div className="flex flex-col gap-6">

          {/* Metadata */}
          <div className="flex flex-col gap-5 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <span className="system-label text-soft-white">METADATA</span>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>CATEGORY</FieldLabel>
              <FieldSelect<Category>
                value={category}
                onChange={(v) => setCategory(v)}
                options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                empty="— category —"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>TAGS</FieldLabel>
              <FieldInput value={tags} onChange={setTags} placeholder="tag1, tag2, tag3" mono />
              <span className="font-mono text-[10px] text-muted">Comma-separated</span>
            </div>
          </div>

          {/* Inspirations panel */}
          <Panel
            title="INSPIRATIONS"
            count={linkedRefs.length}
            action={
              <button type="button"
                onClick={() => setPickerMode(pickerMode === "references" ? null : "references")}
                className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-red hover:text-white transition-precise px-2.5 py-1.5 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.32)", background: "rgba(215,25,33,0.06)" }}>
                <Plus size={10} /> Add
              </button>
            }
          >
            {pickerMode === "references" && (
              <div className="mb-3 p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
                <ReferencePicker
                  projectId={id!}
                  onAdd={reloadLinks}
                  onClose={() => setPickerMode(null)}
                />
              </div>
            )}
            {linkedRefs.length === 0 && pickerMode !== "references" ? (
              <span className="font-mono text-[11px] text-muted">No inspirations linked yet.</span>
            ) : (
              <div className="flex flex-col gap-1">
                {linkedRefs.map((r) => (
                  <RefRow
                    key={r.id}
                    ref={r}
                    onRemove={() => handleRemoveRef(r.id)}
                    onOpen={() => navigate(`/references/${r.id}`)}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* Recommendations */}
          <div className="flex flex-col gap-4 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <RecommendationPanel
              context={{ category: category || undefined, projectId: id }}
            />
          </div>

          {/* Quick actions */}
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${id}/export`)}
            className="w-full justify-center">
            Export Report
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${id}/assistant`)}
            className="w-full justify-center">
            Assistant
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${id}/sequence`)}
            className="w-full justify-center">
            Shot Sequence
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/projects/${id}/board`)}
            className="w-full justify-center">
            Pipeline Board
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/compare/${id}`)}
            className="w-full justify-center">
            Compare Results
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/queue?project=${id}`)}
            className="w-full justify-center">
            Generation Queue
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => navigate(`/craft?projectId=${id}`)}
            className="w-full justify-center">
            <Plus size={10} /> Craft New Prompt for Project
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
