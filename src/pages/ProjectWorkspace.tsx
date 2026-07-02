import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Save, Trash2, ChevronDown, Plus, X,
  Star, Check, Image, FileText, Upload, Sparkles,
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
import { getPrompts, getRecentResults, searchPrompts } from "@/lib/db";
import { getReferences, searchReferences } from "@/lib/references";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { BatchImportZone } from "@/components/ui/BatchImportZone";
import { DirectionStudio } from "@/components/projects/DirectionStudio";
import { getProjectShots } from "@/lib/shotSequence";
import { getCampaigns } from "@/lib/campaigns";
import { buildReport, generateDeliveryReceipt, downloadText, slugify } from "@/lib/exportReport";
import { toast } from "@/lib/toast";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { AIImproveButton } from "@/components/ui/AIImproveButton";

registerShortcutLabel("cmd+s", "Save (Craft / Project Workspace)");
import type { Campaign, Project, ProjectStatus, Category, Prompt, Reference } from "@/types";

// ─── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "draft",     label: "Draft" },
  { value: "active",    label: "Active" },
  { value: "review",    label: "Review" },
  { value: "delivered", label: "Delivered" },
  { value: "archived",  label: "Archived" },
];

const STATUS_DOT: Record<ProjectStatus, string> = {
  draft:     "bg-readable",
  active:    "bg-cyan",
  review:    "bg-amber",
  archived:  "bg-white/10",
  delivered: "bg-white",
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

const PROVIDER_TARGET_OPTIONS = ["midjourney", "nano banana", "gpt image", "seedance", "kling", "runway", "higgsfield"];
const VIDEO_ONLY_PROVIDERS = new Set(["seedance", "kling", "runway", "higgsfield"]);

// ─── Shared field atoms ───────────────────────────────────────

function FieldLabel({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  if (ai) {
    return (
      <div className="flex items-center gap-1.5">
        <label className="system-label text-[12px] text-muted">{children}</label>
        <Sparkles size={9} className="text-cyan/55" />
      </div>
    );
  }
  return <label className="system-label text-[12px] text-muted">{children}</label>;
}

function FieldInput({ value, onChange, placeholder, mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={cn(
        "h-10 px-3 text-[14px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full",
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
      className="px-3 py-2.5 font-mono text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none w-full resize-none"
      style={{ border: "1px solid rgba(255,255,255,0.16)" }} />
  );
}

function FieldSelect<T extends string>({ value, onChange, options, empty }: {
  value: string; onChange: (v: T) => void; options: { value: T; label: string }[]; empty?: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none h-10 pl-3 pr-7 font-mono text-[13px] text-white bg-transparent rounded-sm focus:outline-none w-full cursor-pointer"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
        {empty && <option value="" className="bg-panel text-dim/50">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

function TagChipInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap gap-1.5 min-h-10 px-2.5 py-2 rounded-sm"
      style={{ border: "1px solid rgba(255,255,255,0.16)" }}>
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 h-6 px-2 rounded-sm font-mono text-[10px] text-readable bg-white/8 border border-white/12">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-muted hover:text-white leading-none">
            <X size={8} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
          if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Add tags…" : ""}
        className="flex-1 min-w-20 bg-transparent font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none"
      />
    </div>
  );
}

function ProviderSelect({ values, options, onChange }: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((o) => !values.includes(o));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <select
          value=""
          onChange={(e) => { if (e.target.value) onChange([...values, e.target.value]); }}
          className="appearance-none h-10 w-full pl-3 pr-7 font-mono text-[13px] text-white bg-transparent rounded-sm focus:outline-none cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        >
          <option value="" className="bg-panel text-dim/50">
            {values.length === 0 ? "Add provider…" : "Add another…"}
          </option>
          {available.map((o) => (
            <option key={o} value={o} className="bg-panel text-white">{o}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="flex items-center gap-1 h-6 px-2 rounded-sm font-mono text-[10px] tracking-widest uppercase text-cyan bg-cyan/8 border border-cyan/25">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-cyan/40 hover:text-white transition-precise">
                <X size={8} />
              </button>
            </span>
          ))}
        </div>
      )}
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
  return <img src={displaySrc} referrerPolicy="no-referrer" alt={alt} className={className} onError={image.onError} />;
}

// ─── Linked prompt row ────────────────────────────────────────

type ProjectResult = { id: string; prompt_id?: string; score_overall: number; is_winner: boolean; is_failed: boolean; thumbnail_path?: string };

type ProjectPrompt = { id: string; title: string; provider: string; rating: number; is_winner: boolean; is_failed: boolean; version: number; parent_id?: string; thumbnail_data?: string };

function PromptRow({ prompt, results = [], onRemove, onOpen, onImport }: {
  prompt: ProjectPrompt;
  results?: ProjectResult[];
  onRemove: () => void;
  onOpen: () => void;
  onImport?: () => void;
}) {
  return (
    <div className="flex flex-col rounded-sm group overflow-hidden"
      style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
      <div className="flex items-center gap-3 px-3 py-3">
        {prompt.thumbnail_data && (
          <div className="shrink-0 w-10 h-10 rounded-sm overflow-hidden cursor-pointer" onClick={onOpen}>
            <SafeThumb src={prompt.thumbnail_data} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-1.5">
            {prompt.version > 1 && (
              <span className="font-mono text-[9px] text-cyan border border-cyan/30 px-1 py-0.5 rounded-sm shrink-0">v{prompt.version}</span>
            )}
            <span className="font-sans text-[14px] text-soft-white truncate block">{prompt.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{prompt.provider}</span>
            {prompt.is_winner && <span className="font-mono text-[9px] text-amber">WINNER</span>}
            {prompt.is_failed && <span className="font-mono text-[9px] text-red">FAILED</span>}
            {results.length > 0 && (
              <span className="font-mono text-[9px] text-muted">{results.length} result{results.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
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
      {results.length > 0 ? (
        <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto">
          {results.slice(0, 12).map((r) => (
            <div key={r.id} className="relative shrink-0 w-14 h-14 rounded-sm overflow-hidden cursor-pointer" onClick={onOpen}>
              <SafeThumb src={r.thumbnail_path} className="w-full h-full object-cover" />
              {r.is_winner && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-sm bg-black/60 flex items-center justify-center">
                  <Star size={7} className="text-amber fill-amber/60" />
                </span>
              )}
            </div>
          ))}
          {onImport && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onImport(); }}
              className="shrink-0 w-14 h-14 rounded-sm border border-dashed border-white/14 hover:border-white/30 flex items-center justify-center text-dim/40 hover:text-white transition-precise"
              title="Import results for this prompt">
              <Upload size={11} />
            </button>
          )}
        </div>
      ) : onImport ? (
        <div className="px-3 pb-2.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); onImport(); }}
            className="flex items-center gap-1 h-7 px-2.5 rounded-sm font-mono text-[9px] text-dim/50 hover:text-white border border-dashed border-white/10 hover:border-white/25 transition-precise"
            title="Import results for this prompt">
            <Upload size={9} /> Import results
          </button>
        </div>
      ) : null}
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
        <span className="font-sans text-[14px] text-soft-white truncate block">{r.title}</span>
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
        className="h-10 px-3 font-mono text-[13px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
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

  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const hydratedRef = useRef(false);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [campaign, setCampaign] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
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
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const hasImageProvider = providerTargets.length === 0 || providerTargets.some((p) => !VIDEO_ONLY_PROVIDERS.has(p));
  const hasVideoProvider = providerTargets.length === 0 || providerTargets.some((p) => VIDEO_ONLY_PROVIDERS.has(p));

  // Linked content
  const [linkedPrompts, setLinkedPrompts] = useState<Awaited<ReturnType<typeof getPromptsForProject>>>([]);
  const [linkedRefs, setLinkedRefs] = useState<Awaited<ReturnType<typeof getReferencesForProject>>>([]);
  const [linkedResults, setLinkedResults] = useState<Awaited<ReturnType<typeof getResultsForProject>>>([]);

  // Results grouped by owning prompt
  const resultsByPromptId = linkedResults.reduce<Record<string, ProjectResult[]>>((acc, r) => {
    if (r.prompt_id) {
      (acc[r.prompt_id] ??= []).push(r);
    }
    return acc;
  }, {});
  const [shotCount, setShotCount] = useState(0);
  const [shotComplete, setShotComplete] = useState(0);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [batchImportPromptId, setBatchImportPromptId] = useState<string | null>(null);

  // Picker
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  useEffect(() => {
    getCampaigns().then(setAllCampaigns).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    hydratedRef.current = false;
    (async () => {
      setLoadState("loading");
      try {
        const [proj, prompts, refs, results, shots] = await Promise.all([
          getProjectById(id),
          getPromptsForProject(id),
          getReferencesForProject(id),
          getResultsForProject(id),
          getProjectShots(id),
        ]);
        if (!proj) { setLoadState("not-found"); return; }

        setTitle(proj.title);
        setClient(proj.client ?? "");
        setCampaign(proj.campaign ?? "");
        setCampaignId(proj.campaign_id ?? "");
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
        setTags(proj.tags ?? []);
        setNotes(proj.notes ?? "");
        setLinkedPrompts(prompts);
        setLinkedRefs(refs);
        setLinkedResults(results);
        setShotCount(shots.length);
        setShotComplete(shots.filter((s) => s.prompt_id && s.result_id).length);
        setLoadState("ready");
        hydratedRef.current = true;
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoadState("error");
      }
    })();
  }, [id]);

  const buildInput = (): CreateProjectInput => ({
    title: title.trim(),
    client: client.trim() || undefined,
    campaign: campaign.trim() || undefined,
    campaign_id: campaignId || undefined,
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
    tags: tags.length ? tags : undefined,
    notes: notes.trim() || undefined,
  });

  const handleSave = async () => {
    if (!id || !title.trim()) return;
    setSaving(true);
    try {
      await updateProject(id, buildInput());
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      toast.success("Project saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  useShortcut("cmd+s", () => { if (!saving) handleSave(); });

  useEffect(() => {
    if (!id || loadState !== "ready" || !hydratedRef.current || !title.trim()) return;
    const timer = window.setTimeout(() => {
      setSaving(true);
      updateProject(id, buildInput())
        .then(() => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1200);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(msg || "Auto-save failed");
        })
        .finally(() => setSaving(false));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    id, loadState, title, client, campaign, campaignId, status, projectType, intendedOutput,
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
    setTags([]);
    setNotes("");
    setLinkedPrompts([]);
    setLinkedRefs([]);
    setLinkedResults([]);
    setPickerMode(null);
    setConfirmReset(false);
  };

  const handleMarkDelivered = async () => {
    if (!confirmDeliver) { setConfirmDeliver(true); return; }
    if (!id || delivering) return;
    setDelivering(true);
    try {
      await updateProject(id, { ...buildInput(), status: "delivered" });
      setStatus("delivered");
      const report = await buildReport(id);
      if (report) {
        const deliveredAt = new Date().toISOString().slice(0, 10);
        const receipt = generateDeliveryReceipt(report, deliveredAt);
        downloadText(receipt, `delivery-${slugify(title)}-${deliveredAt}.md`, "text/markdown");
        toast.success("Project delivered — receipt downloaded");
      } else {
        toast.success("Project marked as delivered");
      }
    } catch {
      toast.error("Failed to mark project as delivered");
    } finally {
      setDelivering(false);
      setConfirmDeliver(false);
    }
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

  const winnerCount = linkedPrompts.filter((p) => p.is_winner).length;
  const failedCount = linkedPrompts.filter((p) => p.is_failed).length;

  if (loadState === "loading") {
    return (
      <PageContainer title="Project" subtitle="LOADING…">
        <div className="flex items-center gap-3 py-8">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading project…</span>
        </div>
      </PageContainer>
    );
  }

  if (loadState === "not-found") {
    return (
      <PageContainer title="Project" subtitle="NOT FOUND">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-readable" />
          <p className="font-mono text-[13px] text-readable">Project not found or has been deleted.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
            <ArrowLeft size={11} /> Back to Projects
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (loadState === "error") {
    return (
      <PageContainer title="Project" subtitle="ERROR">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-red/60" />
          <p className="font-mono text-[13px] text-readable">Failed to load project data.</p>
          {loadError && <p className="font-mono text-[10px] text-red/60 max-w-sm wrap-break-word">{loadError}</p>}
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
            <ArrowLeft size={11} /> Back to Projects
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={title || "Project"}
      subtitle={[allCampaigns.find((c) => c.id === campaignId)?.client ?? client, campaign].filter(Boolean).join(" · ") || "PROJECT WORKSPACE"}
      action={
        <div className="flex items-center gap-2">
          {/* Status pill — same h-10 as Button size="md" */}
          <div className="flex items-center gap-2 h-10 px-3 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[status])} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="appearance-none font-mono text-[13px] tracking-widest uppercase text-white bg-transparent border-none focus:outline-none focus-visible:outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={confirmDelete ? "text-red border-red/40" : "text-dim hover:text-red"}
          >
            <Trash2 size={11} /> {confirmDelete ? "Confirm" : "Delete"}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={handleResetProject}
            onBlur={() => setConfirmReset(false)}
            className={confirmReset ? "text-red border-red/40" : "text-dim hover:text-red"}
          >
            <X size={11} /> {confirmReset ? "Confirm Reset" : "Reset"}
          </Button>
          <Button variant="ghost" size="md" onClick={() => navigate("/projects")}>
            <ArrowLeft size={11} /> Projects
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={!title.trim() || saving}>
            <Save size={11} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        </div>
      }
    >
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
                <span className="font-mono text-[12px] text-readable">Add provider targets in Setup. Aspect ratio is set per prompt in Prompt Craft.</span>
              )}
            </div>
            {(intendedOutput || creativeGoals) && (
              <p className="font-mono text-[13px] leading-relaxed text-readable max-w-4xl">
                {intendedOutput || creativeGoals}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="primary" size="sm" onClick={() => navigate(`/craft?projectId=${id}`)}>
              <Plus size={10} /> New Prompt
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
            {shotCount > 0 && <StatChip label="Complete" value={shotComplete} />}
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
              <FieldLabel>CAMPAIGN</FieldLabel>
              {allCampaigns.length > 0 ? (
                <select
                  value={campaignId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const found = allCampaigns.find((c) => c.id === newId);
                    setCampaignId(newId);
                    setCampaign(found?.title ?? "");
                  }}
                  className="h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.24)" }}
                >
                  <option value="">— no campaign —</option>
                  {allCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              ) : (
                <FieldInput value={campaign} onChange={setCampaign} placeholder="Campaign…" mono />
              )}
            </div>
          </div>

          {/* Setup */}
          <Panel title="SETUP">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel ai>PROJECT TYPE</FieldLabel>
                <FieldSelect<string>
                  value={projectType}
                  onChange={setProjectType}
                  options={PROJECT_TYPE_OPTIONS}
                  empty="-- project type --"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel ai>INTENDED OUTPUT</FieldLabel>
                <FieldInput value={intendedOutput} onChange={setIntendedOutput} placeholder="Final assets, prompt systems, boards, videos…" mono />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel ai>PROVIDER TARGETS</FieldLabel>
                <ProviderSelect values={providerTargets} options={PROVIDER_TARGET_OPTIONS} onChange={setProviderTargets} />
              </div>
            </div>
          </Panel>

          {/* Brief */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText size={9} className="text-dim/40" />
                <FieldLabel ai>BRIEF</FieldLabel>
              </div>
              <AIImproveButton
                value={briefText}
                fieldName="brief"
                projectTitle={title}
                projectContext={productionGoal || undefined}
                onImproved={setBriefText}
              />
            </div>
            <FieldTextarea value={briefText} onChange={setBriefText} placeholder="Paste brief, goals, or creative direction…" rows={5} />
          </div>

          {/* Production goal */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel ai>PRODUCTION GOAL</FieldLabel>
              <AIImproveButton
                value={productionGoal}
                fieldName="production goal"
                projectTitle={title}
                projectContext={briefText || undefined}
                onImproved={setProductionGoal}
              />
            </div>
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
              tags: tags.length ? tags : undefined,
              notes: notes || undefined,
              created_at: "",
              updated_at: "",
            }}
            onApplied={(fields) => {
              if (fields.visual_direction !== undefined) setVisualDirection(fields.visual_direction);
              if (fields.creative_goals !== undefined) setCreativeGoals(fields.creative_goals);
              if (fields.constraints !== undefined) setConstraints(fields.constraints);
            }}
          />

          <Panel
            title="PRE-CRAFT"
            count={linkedPrompts.length}
            action={
              <Button variant="primary" size="sm" onClick={() => navigate(`/craft?projectId=${id}`)}>
                <Plus size={10} /> New Prompt
              </Button>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Row 1: Visual direction + primary needs field */}
              <div className={cn("flex flex-col gap-1.5", !hasImageProvider && !hasVideoProvider && "lg:col-span-2")}>
                <FieldLabel ai>VISUAL DIRECTION</FieldLabel>
                <FieldTextarea value={visualDirection} onChange={setVisualDirection} placeholder="Look, style, realism level..." rows={4} />
              </div>
              {hasImageProvider && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel ai>IMAGE NEEDS</FieldLabel>
                  <FieldTextarea value={imageNeeds} onChange={setImageNeeds} placeholder="Hero, product, background, variations..." rows={4} />
                </div>
              )}
              {!hasImageProvider && hasVideoProvider && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel ai>VIDEO NEEDS</FieldLabel>
                  <FieldTextarea value={videoNeeds} onChange={setVideoNeeds} placeholder="Motion tests, frames, transitions..." rows={4} />
                </div>
              )}
              {/* Row 2: Video needs (only if both providers active — full width) */}
              {hasImageProvider && hasVideoProvider && (
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                  <FieldLabel ai>VIDEO NEEDS</FieldLabel>
                  <FieldTextarea value={videoNeeds} onChange={setVideoNeeds} placeholder="Motion tests, frames, transitions..." rows={3} />
                </div>
              )}
              {/* Row last: Creative goals + constraints — always equal */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel ai>CREATIVE GOALS</FieldLabel>
                <FieldTextarea value={creativeGoals} onChange={setCreativeGoals} placeholder="What good looks like, what to avoid, and what should become reusable..." rows={4} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel ai>CONSTRAINTS</FieldLabel>
                <FieldTextarea value={constraints} onChange={setConstraints} placeholder="Brand, legal, AI-look, or production limits..." rows={4} />
              </div>
            </div>
          </Panel>

          {/* Prompts & Results panel */}
          <Panel
            title="PROMPTS & RESULTS"
            count={linkedPrompts.length + (linkedResults.length > 0 ? linkedResults.length : 0)}
            action={
              <div className="flex items-center gap-1.5">
                <button type="button"
                  onClick={() => { setBatchImportOpen((v) => !v); setPickerMode(null); }}
                  disabled={linkedPrompts.length === 0}
                  title={linkedPrompts.length === 0 ? "Link a prompt first" : "Import image results"}
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-white disabled:opacity-35 transition-precise px-2.5 py-1.5 rounded-sm"
                  style={{ border: "var(--border-default)" }}>
                  <Upload size={10} /> Import
                </button>
                <button type="button"
                  onClick={() => { setPickerMode(pickerMode === "results" ? null : "results"); setBatchImportOpen(false); }}
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-white transition-precise px-2.5 py-1.5 rounded-sm"
                  style={{ border: "var(--border-default)" }}>
                  <Plus size={10} /> Add Result
                </button>
                <button type="button"
                  onClick={() => { setPickerMode(pickerMode === "prompts" ? null : "prompts"); setBatchImportOpen(false); }}
                  className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-white transition-precise px-2.5 py-1.5 rounded-sm"
                  style={{ border: "var(--border-default)" }}>
                  <Plus size={10} /> Add Prompt
                </button>
              </div>
            }
          >
            {/* Pickers */}
            {pickerMode === "prompts" && (
              <div className="mb-3 p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
                <PromptPicker
                  projectId={id!}
                  onAdd={reloadLinks}
                  onClose={() => setPickerMode(null)}
                />
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
            {batchImportOpen && linkedPrompts.length > 0 && (() => {
              const importTarget = linkedPrompts.find((p) => p.id === batchImportPromptId) ?? linkedPrompts[0];
              return (
                <div className="mb-3 flex flex-col gap-2">
                  {linkedPrompts.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-readable">Import to:</span>
                      <select
                        value={importTarget.id}
                        onChange={(e) => setBatchImportPromptId(e.target.value)}
                        className="h-7 px-2 rounded-sm bg-dark font-mono text-[10px] text-soft-white focus:outline-none"
                        style={{ border: "var(--border-default)" }}
                      >
                        {linkedPrompts.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
                    <BatchImportZone
                      projectId={id!}
                      promptId={importTarget.id}
                      promptProvider={importTarget.provider}
                      onComplete={() => { setBatchImportOpen(false); reloadLinks(); }}
                      onCancel={() => setBatchImportOpen(false)}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Prompt cards with inline results */}
            {linkedPrompts.length === 0 && !pickerMode && !batchImportOpen ? (
              <span className="font-mono text-[12px] text-muted">No prompts linked yet. Add a prompt to start.</span>
            ) : (() => {
              if (linkedPrompts.length === 0) return null;
              const promptIds = new Set(linkedPrompts.map((p) => p.id));
              const roots = linkedPrompts.filter((p) => !p.parent_id || !promptIds.has(p.parent_id));
              const childrenOf = linkedPrompts.reduce<Record<string, ProjectPrompt[]>>((acc, p) => {
                if (p.parent_id && promptIds.has(p.parent_id)) {
                  (acc[p.parent_id] ??= []).push(p);
                }
                return acc;
              }, {});
              const orphanResults = linkedResults.filter((r) => !r.prompt_id || !promptIds.has(r.prompt_id));
              return (
                <div className="flex flex-col gap-2">
                  {roots.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1">
                      <PromptRow
                        prompt={p}
                        results={resultsByPromptId[p.id] ?? []}
                        onRemove={() => handleRemovePrompt(p.id)}
                        onOpen={() => navigate(`/library/${p.id}`)}
                        onImport={() => { setBatchImportPromptId(p.id); setBatchImportOpen(true); setPickerMode(null); }}
                      />
                      {(childrenOf[p.id] ?? []).map((child) => (
                        <div key={child.id} className="pl-4">
                          <PromptRow
                            prompt={child}
                            results={resultsByPromptId[child.id] ?? []}
                            onRemove={() => handleRemovePrompt(child.id)}
                            onOpen={() => navigate(`/library/${child.id}`)}
                            onImport={() => { setBatchImportPromptId(child.id); setBatchImportOpen(true); setPickerMode(null); }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  {orphanResults.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">Unlinked results</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {orphanResults.map((r) => (
                          <div key={r.id} className="relative w-14 h-14 rounded-sm overflow-hidden group">
                            <SafeThumb src={r.thumbnail_path} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => handleRemoveResult(r.id)}
                              className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-sm bg-black/70 text-white/60 hover:text-red opacity-0 group-hover:opacity-100 transition-precise flex items-center justify-center">
                              <Trash2 size={9} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
              <TagChipInput tags={tags} onChange={setTags} />
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
              <span className="font-mono text-[12px] text-muted">No inspirations linked yet.</span>
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
              context={{ category: category || undefined, provider: providerTargets[0] || undefined, projectId: id }}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>NOTES</FieldLabel>
            <FieldTextarea value={notes} onChange={setNotes} placeholder="Internal notes…" rows={2} />
          </div>

          {/* Quick actions */}
          {status !== "delivered" && (
            <button
              type="button"
              onClick={handleMarkDelivered}
              onBlur={() => setConfirmDeliver(false)}
              disabled={delivering}
              className={cn(
                "w-full font-mono text-[9px] tracking-widest uppercase px-3 py-2 rounded-sm transition-precise disabled:opacity-50",
                confirmDeliver
                  ? "text-white bg-cyan/10 border-cyan/40"
                  : "text-readable hover:text-white"
              )}
              style={{ border: confirmDeliver ? "1px solid" : "var(--border-dim)" }}
            >
              {delivering ? "Delivering…" : confirmDeliver ? "Confirm — Downloads Receipt" : "Mark Delivered"}
            </button>
          )}
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
            <Plus size={10} /> New Prompt for Project
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
