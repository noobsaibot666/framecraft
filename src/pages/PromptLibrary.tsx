import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Copy, Star, Trash2, ChevronDown, LayoutGrid, LayoutList, ListPlus, Sparkles, ImageOff, CheckSquare, X, Download } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, ProviderBadge, RiskBadge } from "@/components/ui/Badge";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { usePromptStore } from "@/stores/usePromptStore";
import { getResultSummaryMap, getResultCoverMap, getResultThumbsMap, getVersionCountMap, batchUpdatePrompts, deletePrompt } from "@/lib/db";
import { getPromptProjectMap } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { getPromptLibraryMetrics } from "@/lib/libraryMetrics";
import { addToQueue } from "@/lib/queue";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { getPreferences } from "@/lib/userPreferences";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";
import { THUMBNAIL_UPDATED_EVENT } from "@/lib/thumbnailMigration";

registerShortcutLabel("cmd+n", "New prompt (Prompt Library)");
registerShortcutLabel("escape", "Exit batch mode (Prompt Library)");
registerShortcutLabel("i", "Import prompt (Prompt Library)");
import type { Prompt, Provider, Category, SortOption } from "@/types";

const PROVIDER_OPTIONS: { value: Provider | ""; label: string }[] = [
  { value: "", label: "All Providers" },
  { value: "midjourney", label: "Midjourney" },
  { value: "dalle", label: "DALL·E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
  { value: "firefly", label: "Firefly" },
  { value: "ideogram", label: "Ideogram" },
  { value: "flux", label: "Flux" },
  { value: "nano_banana", label: "Nano Banana" },
  { value: "gpt_image", label: "GPT Image" },
  { value: "seedance", label: "Seedance" },
  { value: "kling", label: "Kling" },
  { value: "runway", label: "Runway" },
  { value: "higgsfield", label: "Higgsfield" },
  { value: "other", label: "Other" },
];

const CATEGORY_OPTIONS: { value: Category | ""; label: string }[] = [
  { value: "", label: "All Categories" },
  { value: "advertising", label: "Advertising" },
  { value: "editorial", label: "Editorial" },
  { value: "product", label: "Product" },
  { value: "fashion", label: "Fashion" },
  { value: "automotive", label: "Automotive" },
  { value: "architecture", label: "Architecture" },
  { value: "portrait", label: "Portrait" },
  { value: "cinematic", label: "Cinematic" },
  { value: "abstract", label: "Abstract" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "rating_asc", label: "Lowest Rated" },
  { value: "most_used", label: "Most Results" },
  { value: "ai_risk_desc", label: "Highest Risk" },
  { value: "ai_risk_asc", label: "Lowest Risk" },
];

const RATING_FILTER_OPTIONS = [
  { value: "", label: "Any Rating" },
  { value: "1", label: "1+ Stars" },
  { value: "2", label: "2+ Stars" },
  { value: "3", label: "3+ Stars" },
  { value: "4", label: "4+ Stars" },
  { value: "5", label: "5 Stars" },
];

const AI_RISK_FILTER_OPTIONS = [
  { value: "", label: "Any Risk" },
  { value: "2", label: "Risk ≤ 2" },
  { value: "4", label: "Risk ≤ 4" },
  { value: "6", label: "Risk ≤ 6" },
  { value: "8", label: "Risk ≤ 8" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Any Status" },
  { value: "winner", label: "Winners" },
  { value: "failed", label: "Failed" },
];


function LibraryStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className="flex min-w-30 flex-col gap-1 rounded-[6px] px-4 py-3"
      style={{ border: accent ? "1px solid rgba(56,183,200,0.38)" : "var(--border-default)", background: accent ? "rgba(56,183,200,0.08)" : "rgba(255,255,255,0.045)" }}
    >
      <span className="font-mono text-[18px] font-medium leading-none text-white tabular-nums">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-readable">{label}</span>
    </div>
  );
}

function PromptCardThumb({ src }: { src: string }) {
  const { src: displaySrc } = useImageDisplaySrc(src);
  if (!displaySrc) return null;
  return (
    <div className="w-full h-32 rounded-sm overflow-hidden mb-1 -mt-1 relative">
      <img src={displaySrc} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-precise" />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
    </div>
  );
}

function CarouselMiniThumb({ src }: { src: string }) {
  const { src: displaySrc } = useImageDisplaySrc(src);
  if (!displaySrc) return (
    <div className="w-9 h-9 rounded-sm shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />
  );
  return <img src={displaySrc} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-sm object-cover shrink-0" />;
}

function PromptCard({ prompt, resultSummary, coverImage, resultThumbs, versionCount, projectRelation, onCopy, onDelete, onQueue, onRate, batchMode, selected, onSelect, index, pendingDelete }: {
  prompt: Prompt;
  resultSummary?: { count: number; avg_score: number };
  coverImage?: string;
  resultThumbs?: string[];
  versionCount?: number;
  projectRelation?: { projectTitle: string; campaignTitle?: string };
  onCopy: (p: Prompt) => void;
  onDelete: (p: Prompt) => void;
  onQueue: (p: Prompt) => void;
  onRate: (p: Prompt, rating: number) => void;
  batchMode: boolean;
  selected: boolean;
  onSelect: (id: string, selected: boolean, index: number, shiftHeld: boolean) => void;
  index: number;
  pendingDelete: boolean;
}) {
  const navigate = useNavigate();
  const carouselThumbs = (resultThumbs ?? []).slice(1); // first one is already the hero coverImage

  return (
    <article
      className="group flex min-h-70 flex-col gap-5 rounded-card p-5 cursor-pointer transition-precise hover:-translate-y-0.5 hover:border-cyan/45"
      style={{ border: selected ? "1px solid rgba(56,183,200,0.70)" : "var(--border-default)", background: selected ? "rgba(56,183,200,0.08)" : "var(--surface-card)" }}
      onClick={() => { if (!batchMode) navigate(`/library/${prompt.id}`); }}
    >
      {/* Cover thumbnail */}
      {coverImage && <PromptCardThumb src={coverImage} />}

      {/* Result carousel — additional thumbnails beyond the hero cover */}
      {carouselThumbs.length > 0 && (
        <div className="flex gap-1.5 -mt-3 overflow-x-auto">
          {carouselThumbs.map((src, i) => <CarouselMiniThumb key={i} src={src} />)}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        {batchMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => { e.stopPropagation(); onSelect(prompt.id, e.target.checked, index, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey); }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 accent-cyan"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-sans text-[16px] font-semibold text-white leading-tight truncate">
            {prompt.title}
          </span>
          {prompt.description && (
            <span className="font-mono text-[13px] text-readable leading-snug line-clamp-2">
              {prompt.description}
            </span>
          )}
        </div>
        {prompt.is_winner && (
          <Star size={15} className="text-amber fill-amber/45 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Prompt preview */}
      <p className="prompt-text text-[13.5px] text-soft-white line-clamp-5 leading-relaxed">
        {prompt.prompt_text}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ProviderBadge provider={prompt.provider} />
        {prompt.parent_id && (
          <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-dim/50"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
            copy
          </span>
        )}
        {prompt.category && <Badge variant="category">{prompt.category}</Badge>}
        {prompt.aspect_ratio && <Badge variant="default">{prompt.aspect_ratio}</Badge>}
        {!!versionCount && (
          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-cyan/70"
            style={{ border: "1px solid rgba(72,229,232,0.28)" }}>
            {versionCount} version{versionCount !== 1 ? "s" : ""}
          </span>
        )}
        {projectRelation && (
          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-readable truncate max-w-30"
            style={{ border: "1px solid rgba(255,255,255,0.14)" }}
            title={projectRelation.campaignTitle ? `${projectRelation.campaignTitle} / ${projectRelation.projectTitle}` : projectRelation.projectTitle}>
            {projectRelation.projectTitle}
          </span>
        )}
        {prompt.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="tag">{tag}</Badge>
        ))}
        {(prompt.tags?.length ?? 0) > 2 && (
          <span className="font-mono text-[10px] text-readable">+{(prompt.tags?.length ?? 0) - 2}</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-4 pt-3" style={{ borderTop: "var(--border-default)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5" title="Click to rate">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); onRate(prompt, i + 1 === prompt.rating ? 0 : i + 1); }}
                className={cn("w-1.5 h-1.5 rounded-full transition-precise hover:scale-125", i < prompt.rating ? "bg-amber/80" : "bg-white/14 hover:bg-amber/40")}
              />
            ))}
          </div>
          {prompt.ai_look_risk > 0 && <RiskBadge score={prompt.ai_look_risk} />}
          {resultSummary && resultSummary.count > 0 ? (
            <span className="font-mono text-[10.5px] text-readable">
              {resultSummary.count} result{resultSummary.count !== 1 ? "s" : ""}
              {resultSummary.avg_score > 0 && ` · ${resultSummary.avg_score.toFixed(1)} avg`}
            </span>
          ) : (
            <span className="font-mono text-[9px] text-dim/35 flex items-center gap-1">
              <ImageOff size={8} /> no results
            </span>
          )}
        </div>
        <div className={cn("flex items-center gap-1.5 transition-precise md:opacity-0 md:group-hover:opacity-100", pendingDelete && "md:opacity-100")}>
          <button
            className="rounded-[5px] border border-white/14 p-2 text-readable hover:border-cyan/45 hover:text-cyan transition-precise"
            onClick={(e) => { e.stopPropagation(); onQueue(prompt); }}
            title="Add to Queue"
          >
            <ListPlus size={13} />
          </button>
          <button
            className="rounded-[5px] border border-white/14 p-2 text-readable hover:border-cyan/45 hover:text-cyan transition-precise"
            onClick={(e) => { e.stopPropagation(); onCopy(prompt); }}
            title="Copy prompt"
          >
            <Copy size={13} />
          </button>
          <button
            className={cn(
              "rounded-[5px] border p-2 transition-precise",
              pendingDelete
                ? "border-red/60 text-red opacity-100"
                : "border-white/14 text-readable hover:border-red/45 hover:text-red"
            )}
            onClick={(e) => { e.stopPropagation(); onDelete(prompt); }}
            title={pendingDelete ? "Click again to confirm delete" : "Delete prompt"}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="system-label text-[10.5px] text-readable">{formatDate(prompt.created_at)}</div>
    </article>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none pr-7",
          "font-mono text-[12px] tracking-[0.06em] uppercase",
          "bg-transparent text-readable",
          "rounded-sm px-3 py-2.5",
          "focus:outline-none focus:text-white transition-precise",
          "cursor-pointer"
        )}
        style={{ border: "var(--border-default)" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
    </div>
  );
}

export function PromptLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    loading,
    fetchPrompts,
    search,
    setFilters,
    setSortBy,
    filters,
    sortBy,
    remove,
    update,
    patch,
    filteredAndSorted,
  } = usePromptStore();

  const PAGE_SIZE = getPreferences().libraryPageSize;

  const [searchVal, setSearchVal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Prompt | null>(null);
  // Ref mirrors confirmDelete for synchronous reads inside callbacks.
  // State alone is unsafe: if the user clicks twice before React re-renders,
  // the second click still sees the stale closure where confirmDelete is null,
  // enters the else-branch, and never actually deletes.
  const confirmDeleteRef = useRef<string | null>(null);
  const [resultMap, setResultMap] = useState<Record<string, { count: number; avg_score: number }>>({});
  const [coverMap, setCoverMap] = useState<Record<string, string>>({});
  const [thumbsMap, setThumbsMap] = useState<Record<string, string[]>>({});
  const [versionCountMap, setVersionCountMap] = useState<Record<string, number>>({});
  const [projectMap, setProjectMap] = useState<Record<string, { projectTitle: string; campaignTitle?: string }>>({});
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [batchWorking, setBatchWorking] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tagFilter, setTagFilter] = useState<string>(searchParams.get("tag") ?? "");
  const [noResultsOnly, setNoResultsOnly] = useState(false);
  const [originalsOnly, setOriginalsOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  // Listen for background thumbnail migrations and patch the store live
  useEffect(() => {
    const handleThumbUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; thumbnail_data: string }>;
      patch(customEvent.detail.id, { thumbnail_data: customEvent.detail.thumbnail_data });
    };
    window.addEventListener(THUMBNAIL_UPDATED_EVENT, handleThumbUpdate);
    return () => window.removeEventListener(THUMBNAIL_UPDATED_EVENT, handleThumbUpdate);
  }, [patch]);

  useEffect(() => { getResultSummaryMap().then(setResultMap); }, []);
  useEffect(() => { getResultThumbsMap(5).then(setThumbsMap); }, []);
  useEffect(() => { getVersionCountMap().then(setVersionCountMap); }, []);
  useEffect(() => { getPromptProjectMap().then(setProjectMap); }, []);
  useEffect(() => { getResultCoverMap().then(setCoverMap); }, []);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchVal, filters, sortBy, tagFilter, noResultsOnly, originalsOnly]);

  // One-time URL param init — read ?provider and ?status on mount
  useEffect(() => {
    const p = searchParams.get("provider");
    const s = searchParams.get("status");
    if (p) setFilters({ provider: p as Provider });
    if (s === "winner") setFilters({ isWinner: true });
    else if (s === "failed") setFilters({ isFailed: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchVal(q);
      if (q.trim()) {
        search(q);
      } else {
        fetchPrompts();
      }
    },
    [search, fetchPrompts]
  );

  const handleClearAllFilters = useCallback(() => {
    handleSearch("");
    setFilters({ provider: undefined, category: undefined, minRating: undefined, maxAiRisk: undefined, isWinner: undefined, isFailed: undefined });
    setSortBy("newest");
    setTagFilter("");
    setNoResultsOnly(false);
    setOriginalsOnly(false);
  }, [handleSearch, setFilters, setSortBy]);

  const handleCopy = useCallback(async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      toast.info("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  const handleDelete = useCallback(async (prompt: Prompt) => {
    if (confirmDeleteRef.current === prompt.id) {
      // Second click — confirmed. Clear synchronously before await so a third
      // rapid click cannot fire a second delete.
      confirmDeleteRef.current = null;
      setConfirmDelete(null);
      try {
        await remove(prompt.id);
      } catch {
        toast.error("Failed to delete — check library connection");
      }
    } else {
      // First click — arm confirmation.
      confirmDeleteRef.current = prompt.id;
      setConfirmDelete(prompt);
      setTimeout(() => {
        confirmDeleteRef.current = null;
        setConfirmDelete(null);
      }, 5000);
    }
  }, [remove]); // remove is stable; confirmDeleteRef is a ref, not a dep

  const handleQueue = useCallback(async (prompt: Prompt) => {
    try {
      await addToQueue(prompt.id);
      toast.success("Added to queue");
    } catch {
      toast.error("Failed to add to queue");
    }
  }, []);

  const handleRate = useCallback(async (prompt: Prompt, rating: number) => {
    try {
      await update(prompt.id, { rating });
      await fetchPrompts();
    } catch {
      toast.error("Failed to rate prompt");
    }
  }, [update, fetchPrompts]);

  const exitBatch = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  useShortcut("cmd+n", () => navigate("/craft"), !batchMode);
  useShortcut("i", () => navigate("/import"), !batchMode);
  useShortcut("escape", exitBatch, batchMode);

  const handleBatchQueue = useCallback(async () => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      for (const id of selectedIds) await addToQueue(id);
      toast.success(`${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} added to queue`);
      exitBatch();
    } catch {
      toast.error("Failed to add to queue");
    } finally { setBatchWorking(false); }
  }, [selectedIds, batchWorking, exitBatch]);

  const handleSelect = useCallback((id: string, isSelected: boolean, index: number, shiftHeld: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (shiftHeld && lastSelectedIndex !== null) {
        const currentPrompts = filteredAndSorted(resultMap);
        const [lo, hi] = [Math.min(lastSelectedIndex, index), Math.max(lastSelectedIndex, index)];
        for (let i = lo; i <= hi; i++) {
          if (currentPrompts[i]) {
            if (isSelected) next.add(currentPrompts[i].id); else next.delete(currentPrompts[i].id);
          }
        }
      } else {
        if (isSelected) next.add(id); else next.delete(id);
      }
      return next;
    });
    setLastSelectedIndex(index);
  }, [lastSelectedIndex, filteredAndSorted, resultMap]);

  const handleBatchRate = useCallback(async (rating: number) => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      await batchUpdatePrompts([...selectedIds], { rating });
      await fetchPrompts();
      toast.success(`Rated ${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} — ${rating}/5`);
      exitBatch();
    } catch {
      toast.error("Failed to rate prompts");
    } finally { setBatchWorking(false); }
  }, [selectedIds, batchWorking, fetchPrompts, exitBatch]);

  const handleBatchMarkWinner = useCallback(async () => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      await batchUpdatePrompts([...selectedIds], { is_winner: true });
      await fetchPrompts();
      toast.success(`${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} marked as winner`);
      exitBatch();
    } catch {
      toast.error("Failed to mark winners");
    } finally { setBatchWorking(false); }
  }, [selectedIds, batchWorking, fetchPrompts, exitBatch]);

  const handleBatchMarkFailed = useCallback(async () => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      await batchUpdatePrompts([...selectedIds], { is_failed: true });
      await fetchPrompts();
      toast.success(`${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} marked as failed`);
      exitBatch();
    } catch {
      toast.error("Failed to mark prompts");
    } finally { setBatchWorking(false); }
  }, [selectedIds, batchWorking, fetchPrompts, exitBatch]);

  const handleBatchExport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const currentPrompts = filteredAndSorted(resultMap);
    const selected = currentPrompts.filter((p) => selectedIds.has(p.id));
    const text = selected.map((p) => `# ${p.title}\n${p.prompt_text}`).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.info(`${selected.length} prompt${selected.length !== 1 ? "s" : ""} copied to clipboard`);
    } catch {
      toast.error("Failed to copy prompts");
    }
  }, [selectedIds, filteredAndSorted, resultMap]);

  const handleBatchExportCSV = useCallback(() => {
    if (selectedIds.size === 0) return;
    const currentPrompts = filteredAndSorted(resultMap);
    const selected = currentPrompts.filter((p) => selectedIds.has(p.id));
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["title", "provider", "category", "prompt_text", "tags", "rating", "is_winner", "created_at"];
    const rows = selected.map((p) => [
      esc(p.title),
      esc(p.provider),
      esc(p.category ?? ""),
      esc(p.prompt_text),
      esc((p.tags ?? []).join("; ")),
      String(p.rating),
      p.is_winner ? "1" : "0",
      esc(p.created_at),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `framecraft-prompts.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info(`${selected.length} prompt${selected.length !== 1 ? "s" : ""} exported as CSV`);
  }, [selectedIds, filteredAndSorted, resultMap]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0 || batchWorking) return;
    if (!window.confirm(`Delete ${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} permanently?`)) return;
    setBatchWorking(true);
    try {
      for (const id of selectedIds) await deletePrompt(id);
      await fetchPrompts();
      toast.success(`${selectedIds.size} prompt${selectedIds.size !== 1 ? "s" : ""} deleted`);
      exitBatch();
    } catch {
      toast.error("Failed to delete prompts");
    } finally { setBatchWorking(false); }
  }, [selectedIds, batchWorking, fetchPrompts, exitBatch]);

  const handleSelectAll = useCallback(() => {
    const currentPrompts = filteredAndSorted(resultMap);
    if (selectedIds.size === currentPrompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentPrompts.map((p) => p.id)));
    }
  }, [filteredAndSorted, resultMap, selectedIds.size]);

  const allPrompts = filteredAndSorted(resultMap);
  const uniqueTags = [...new Set(allPrompts.flatMap((p) => p.tags ?? []))].sort();
  const tagFilteredPrompts = tagFilter ? allPrompts.filter((p) => (p.tags ?? []).includes(tagFilter)) : allPrompts;
  const noResultsFiltered = noResultsOnly
    ? tagFilteredPrompts.filter((p) => !resultMap[p.id] || resultMap[p.id].count === 0)
    : tagFilteredPrompts;
  const originalsFiltered = originalsOnly
    ? noResultsFiltered.filter((p) => !p.parent_id)
    : noResultsFiltered;
  const prompts = originalsFiltered.slice(0, visibleCount);
  const hasMoreVisible = visibleCount < originalsFiltered.length;
  const metrics = getPromptLibraryMetrics(allPrompts, resultMap);
  const statusFilter = filters.isWinner ? "winner" : filters.isFailed ? "failed" : "";

  return (
    <PageContainer
      title="Prompt Library"
      subtitle="STORED PROMPT ASSETS"
      action={
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setViewMode((v) => v === "grid" ? "list" : "grid")}
            className="p-2 rounded-sm text-readable hover:text-white transition-precise"
            style={{ border: "var(--border-dim)" }}
            title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}>
            {viewMode === "grid" ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
          </button>
          <Button variant="ghost" size="md" onClick={() => { batchMode ? exitBatch() : setBatchMode(true); }}>
            <CheckSquare size={11} /> {batchMode ? "Exit Select" : "Select"}
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate("/craft")}>
            <Plus size={12} />
            New Prompt
          </Button>
        </div>
      }
    >
      <div className="mb-8 flex flex-col gap-5 rounded-card p-5" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[7px] border border-cyan/35 bg-cyan/8 text-cyan">
              <Sparkles size={18} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-sans text-[18px] font-semibold text-white">Library overview</span>
              <span className="font-mono text-[13px] leading-relaxed text-readable">
                Scan saved prompts by quality, provider, result coverage, and reuse potential.
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <LibraryStat label="Prompts" value={metrics.total} accent />
            <LibraryStat label="Winners" value={metrics.winners} />
            <LibraryStat label="Recipes" value={metrics.recipes} />
            <LibraryStat label="Results" value={metrics.resultCount} />
            <LibraryStat label="Top provider" value={metrics.topProvider?.toUpperCase() ?? "-"} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative xl:max-w-100">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-readable pointer-events-none"
            />
            <Input
              placeholder="Search prompts..."
              className="pl-9 min-w-65"
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* auto-fit wraps filters onto additional rows instead of overflowing
              the viewport when the available width can't fit all 6 columns */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(128px,1fr))]">
            <NativeSelect value={filters.provider ?? ""} onChange={(v) => setFilters({ provider: (v as Provider) || undefined })} options={PROVIDER_OPTIONS} />
            <NativeSelect value={filters.category ?? ""} onChange={(v) => setFilters({ category: (v as Category) || undefined })} options={CATEGORY_OPTIONS} />
            <NativeSelect value={sortBy} onChange={(v) => setSortBy(v as SortOption)} options={SORT_OPTIONS} />
            <NativeSelect value={filters.minRating != null ? String(filters.minRating) : ""} onChange={(v) => setFilters({ minRating: v ? Number(v) : undefined })} options={RATING_FILTER_OPTIONS} />
            <NativeSelect value={filters.maxAiRisk != null ? String(filters.maxAiRisk) : ""} onChange={(v) => setFilters({ maxAiRisk: v ? Number(v) : undefined })} options={AI_RISK_FILTER_OPTIONS} />
            <NativeSelect
              value={statusFilter}
              onChange={(v) => setFilters({
                isWinner: v === "winner" || undefined,
                isFailed: v === "failed" || undefined,
              })}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        {/* Clear All Filters */}
        {(searchVal || filters.provider || filters.category || filters.minRating != null || filters.maxAiRisk != null || statusFilter || tagFilter || noResultsOnly || originalsOnly || sortBy !== "newest") && (
          <div className="flex justify-end">
            <button type="button" onClick={handleClearAllFilters}
              className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-white px-2 py-1 rounded-sm transition-precise"
              style={{ border: "var(--border-dim)" }}>
              <X size={8} /> Clear All Filters
            </button>
          </div>
        )}

        {/* Tag filter chips */}
        {(uniqueTags.length > 0 || noResultsOnly || originalsOnly) && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setOriginalsOnly(!originalsOnly)}
              className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise flex items-center gap-1",
                originalsOnly ? "text-white" : "text-dim/60 hover:text-muted")}
              style={{ border: originalsOnly ? "1px solid rgba(255,255,255,0.30)" : "var(--border-dim)" }}>
              Originals
            </button>
            <button type="button" onClick={() => setNoResultsOnly(!noResultsOnly)}
              className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise flex items-center gap-1",
                noResultsOnly ? "text-white" : "text-dim/60 hover:text-muted")}
              style={{ border: noResultsOnly ? "1px solid rgba(215,25,33,0.40)" : "var(--border-dim)" }}>
              <ImageOff size={8} /> No Results
            </button>
            {tagFilter && (
              <button type="button" onClick={() => setTagFilter("")}
                className="flex items-center gap-1 font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm text-white transition-precise"
                style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)" }}>
                <X size={8} /> Clear
              </button>
            )}
            {uniqueTags.map((tag) => (
              <button key={tag} type="button"
                onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
                className={cn("font-mono text-[8px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise",
                  tagFilter === tag ? "text-white" : "text-dim/60 hover:text-muted")}
                style={{ border: tagFilter === tag ? "1px solid rgba(255,255,255,0.35)" : "var(--border-dim)" }}>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Batch toolbar */}
      {batchMode && (
        <div className="mb-5 flex items-center gap-2 flex-wrap px-4 py-3 rounded-sm"
          style={{ border: "1px solid rgba(56,183,200,0.28)", background: "rgba(56,183,200,0.06)" }}>
          <button type="button" onClick={handleSelectAll}
            className="font-mono text-[9px] tracking-widest uppercase text-cyan hover:text-white transition-precise px-2 py-1 rounded-sm"
            style={{ border: "1px solid rgba(56,183,200,0.32)" }}>
            {selectedIds.size === prompts.length ? "Deselect All" : "Select All"}
          </button>
          <span className="font-mono text-[10px] text-readable">
            {selectedIds.size} selected
          </span>
          <span className="w-px h-4 bg-white/10 mx-1" />
          {/* Rate */}
          <span className="font-mono text-[9px] text-muted uppercase tracking-widest">Rate:</span>
          {[1, 2, 3, 4, 5].map((r) => (
            <button key={r} type="button"
              onClick={() => handleBatchRate(r)}
              disabled={selectedIds.size === 0 || batchWorking}
              className="font-mono text-[9px] tracking-widest uppercase text-readable hover:text-amber disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
              style={{ border: "var(--border-dim)" }}>
              {"★".repeat(r)}
            </button>
          ))}
          <span className="w-px h-4 bg-white/10 mx-1" />
          <button type="button" onClick={handleBatchMarkWinner}
            disabled={selectedIds.size === 0 || batchWorking}
            className="font-mono text-[9px] tracking-widest uppercase text-amber hover:text-white disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "1px solid rgba(255,193,7,0.32)" }}>
            Mark Winner
          </button>
          <button type="button" onClick={handleBatchMarkFailed}
            disabled={selectedIds.size === 0 || batchWorking}
            className="font-mono text-[9px] tracking-widest uppercase text-readable hover:text-red disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            Mark Failed
          </button>
          <button type="button" onClick={() => handleBatchQueue()}
            disabled={selectedIds.size === 0 || batchWorking}
            className="font-mono text-[9px] tracking-widest uppercase text-readable hover:text-cyan disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            <ListPlus size={9} className="inline mr-1" /> Queue
          </button>
          <button type="button" onClick={handleBatchExport}
            disabled={selectedIds.size === 0}
            className="font-mono text-[9px] tracking-widest uppercase text-readable hover:text-white disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            <Copy size={9} className="inline mr-1" /> Copy Text
          </button>
          <button type="button" onClick={handleBatchExportCSV}
            disabled={selectedIds.size === 0}
            className="font-mono text-[9px] tracking-widest uppercase text-readable hover:text-white disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "var(--border-dim)" }}>
            <Download size={9} className="inline mr-1" /> CSV
          </button>
          <button type="button" onClick={handleBatchDelete}
            disabled={selectedIds.size === 0 || batchWorking}
            className="font-mono text-[9px] tracking-widest uppercase text-red/70 hover:text-red disabled:opacity-40 transition-precise px-2 py-1 rounded-sm"
            style={{ border: "1px solid rgba(215,25,33,0.28)" }}>
            <Trash2 size={9} className="inline mr-1" /> Delete
          </button>
          <div className="flex-1" />
          <button type="button" onClick={exitBatch}
            className="text-muted hover:text-white transition-precise">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mb-4 px-4 py-3 rounded-sm font-mono text-[12px] text-red flex items-center justify-between"
          style={{ background: "rgba(215,25,33,0.06)", border: "var(--border-active)" }}>
          <span>Click delete again to confirm: <span className="text-white/60">{confirmDelete.title}</span></span>
          <button className="text-dim hover:text-white" onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="font-ndot text-[32px] text-dim/30">···</span>
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div
            className="flex flex-col items-center gap-3 p-8 rounded-card max-w-sm w-full"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <ImageOff size={28} className="text-cyan" />
            <span className="system-label">LIBRARY EMPTY</span>
            <span className="font-mono text-[13px] text-readable text-center leading-relaxed">
              {searchVal
                ? "No prompts match your search."
                : "No prompts stored yet. Craft your first prompt or import one."}
            </span>
            <div className="flex gap-2 mt-2">
              {searchVal ? (
                <Button variant="ghost" size="sm" onClick={() => handleSearch("")}>
                  Clear Search
                </Button>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={() => navigate("/craft")}>
                    Prompt Craft
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/import")}>
                    Import
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <span className="system-label text-soft-white">
              <DotMatrix value={tagFilteredPrompts.length} size="sm" className="inline-block mr-2" />
              {tagFilteredPrompts.length === 1 ? "PROMPT" : "PROMPTS"}
              {tagFilter && <span className="text-dim/50 ml-2">#{tagFilter}</span>}
            </span>
            <span className="font-mono text-[12px] text-readable">
              {metrics.withResults} with results · {metrics.failed} failed marked
            </span>
          </div>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {prompts.map((p, i) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  resultSummary={resultMap[p.id]}
                  coverImage={coverMap[p.id] ?? p.thumbnail_data}
                  resultThumbs={thumbsMap[p.id]}
                  versionCount={versionCountMap[p.id]}
                  projectRelation={projectMap[p.id]}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onQueue={handleQueue}
                  onRate={handleRate}
                  batchMode={batchMode}
                  selected={selectedIds.has(p.id)}
                  onSelect={handleSelect}
                  index={i}
                  pendingDelete={confirmDelete?.id === p.id}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderTop: "var(--border-dim)", borderBottom: "var(--border-dim)" }}>
              {prompts.map((p, i) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-4 py-2.5 px-1 cursor-pointer hover:bg-white/3 transition-precise"
                  onClick={() => { if (!batchMode) navigate(`/library/${p.id}`); }}
                >
                  {batchMode && (
                    <input type="checkbox" checked={selectedIds.has(p.id)}
                      onChange={(e) => { e.stopPropagation(); handleSelect(p.id, e.target.checked, i, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey); }}
                      onClick={(e) => e.stopPropagation()} className="h-4 w-4 accent-cyan shrink-0" />
                  )}
                  <ProviderBadge provider={p.provider} />
                  {p.is_winner && <Star size={10} className="text-amber fill-amber/40 shrink-0" />}
                  <span className="font-sans text-[14px] font-medium text-white truncate flex-1 min-w-0">{p.title}</span>
                  {p.parent_id && (
                    <span className="font-mono text-[7px] uppercase tracking-widest px-1 py-0.5 rounded-sm text-dim/40 shrink-0"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}>copy</span>
                  )}
                  {(p.tags ?? []).slice(0, 3).map((tag) => (
                    <span key={tag} className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-dim/50 shrink-0 hidden md:inline"
                      style={{ border: "var(--border-dim)" }}>{tag}</span>
                  ))}
                  {resultMap[p.id]?.count > 0 ? (
                    <span className="font-mono text-[9px] text-readable shrink-0 w-16 text-right">{resultMap[p.id].count} result{resultMap[p.id].count !== 1 ? "s" : ""}</span>
                  ) : (
                    <span className="font-mono text-[9px] text-dim/30 shrink-0 w-16 text-right flex items-center justify-end gap-1"><ImageOff size={8} /> none</span>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div key={idx} className={cn("w-1 h-1 rounded-full", idx < p.rating ? "bg-amber/70" : "bg-white/12")} />
                    ))}
                  </div>
                  <span className="font-mono text-[9px] text-dim/40 shrink-0 hidden lg:inline">{formatDate(p.created_at)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-precise shrink-0">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleQueue(p); }}
                      className="p-1.5 rounded-sm text-dim/60 hover:text-cyan transition-precise" title="Add to Queue"><ListPlus size={11} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(p); }}
                      className="p-1.5 rounded-sm text-dim/60 hover:text-cyan transition-precise" title="Copy"><Copy size={11} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                      className={cn("p-1.5 rounded-sm transition-precise", confirmDelete?.id === p.id ? "text-red" : "text-dim/60 hover:text-red")} title="Delete"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMoreVisible && (
            <div className="flex flex-col items-center gap-2 py-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="font-mono text-[10px] uppercase tracking-widest text-readable hover:text-white transition-precise px-4 py-2 rounded-sm"
                style={{ border: "var(--border-dim)" }}
              >
                Load more
              </button>
              <span className="font-mono text-[9px] text-dim/50">
                Showing {prompts.length} of {allPrompts.length}
              </span>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
