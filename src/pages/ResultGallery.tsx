import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, ImageOff, Square, Star, SlidersHorizontal, Trash2, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { getAllGalleryResults, type GalleryFilter, type GallerySort, type GalleryResult } from "@/lib/resultGallery";
import { updateResult, deleteResult } from "@/lib/db";
import { toast } from "@/lib/toast";
import { SUPPORTED_CREATIVE_PROVIDERS } from "@/lib/appInfo";
import { cn } from "@/lib/utils";

// ─── Sub-components ──────────────────────────────────────────

function DimBars({ result }: { result: GalleryResult }) {
  const dims = [
    { label: "REAL", value: result.score_realism },
    { label: "BRAND", value: result.score_brand_fit },
    { label: "COMP", value: result.score_composition },
    { label: "LIGHT", value: result.score_lighting },
    { label: "RISK", value: result.score_ai_risk, invert: true },
  ];
  return (
    <div className="flex flex-col gap-1 px-3 pb-2 pt-1">
      {dims.map((d) => (
        <div key={d.label} className="flex items-center gap-1.5">
          <span className="font-mono text-[7px] text-dim/40 w-8 shrink-0">{d.label}</span>
          <div className="flex-1 h-0.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className={d.invert
                ? `h-full rounded-full ${d.value >= 4 ? "bg-red/60" : d.value >= 2 ? "bg-amber/50" : "bg-white/20"}`
                : `h-full rounded-full ${d.value >= 4 ? "bg-cyan/70" : d.value >= 2 ? "bg-white/40" : "bg-white/15"}`
              }
              style={{ width: `${(d.value / 5) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[7px] text-dim/30 w-3 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top Shot Card ────────────────────────────────────────────

function TopShotCard({ result, onClick }: { result: GalleryResult; onClick: () => void }) {
  const thumb = useImageDisplaySrc(result.thumbnail_path);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-0 rounded-card overflow-hidden group transition-precise hover:border-amber/30"
      style={{ border: "1px solid rgba(251,191,36,0.18)", background: "var(--surface-card)" }}
    >
      <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden relative">
        {thumb.src
          ? <img src={thumb.src} alt="" className="w-full h-full object-cover" onError={thumb.onError} />
          : <ImageOff size={18} className="text-dim/40" />
        }
        <div className="absolute top-2 right-2 font-mono text-[9px] text-amber font-medium px-1.5 py-0.5 rounded-sm"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          {result.score_overall}/5
        </div>
        {result.is_winner && (
          <div className="absolute top-2 left-2">
            <Star size={10} className="text-amber fill-amber/60" />
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <span className="font-sans text-[10px] font-medium text-white/70 truncate block text-left">{result.prompt_title}</span>
      </div>
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────

function GalleryCard({
  result, onClick, batchMode, selected, onSelect,
}: {
  result: GalleryResult;
  onClick: () => void;
  batchMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const thumb = useImageDisplaySrc(result.thumbnail_path);
  const hasDims = result.score_realism > 0 || result.score_composition > 0 || result.score_lighting > 0;

  return (
    <button
      type="button"
      onClick={batchMode ? () => onSelect(result.id) : onClick}
      className={cn(
        "flex flex-col gap-0 rounded-card overflow-hidden group transition-precise",
        selected ? "ring-2 ring-cyan/60 border-cyan/40" : "hover:border-white/20"
      )}
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden relative">
        {thumb.src
          ? <img src={thumb.src} alt="" className="w-full h-full object-cover" onError={thumb.onError} />
          : <ImageOff size={20} className="text-dim/40" />
        }
        {/* Batch select overlay */}
        {batchMode && (
          <div className="absolute top-2 left-2">
            {selected
              ? <CheckSquare size={14} className="text-cyan" />
              : <Square size={14} className="text-white/50" />
            }
          </div>
        )}
        {/* Score overlay */}
        <div className="absolute bottom-2 left-2 flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full",
                i < result.score_overall ? "bg-amber/80" : "bg-black/50"
              )}
            />
          ))}
        </div>
        {/* Winner / Failed badge */}
        {result.is_winner && (
          <div className="absolute top-2 right-2">
            <Star size={12} className="text-amber fill-amber/60" />
          </div>
        )}
        {result.is_failed && (
          <div className="absolute top-2 right-2 font-mono text-[7px] uppercase tracking-widest text-red/80 px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(215,25,33,0.15)", border: "1px solid rgba(215,25,33,0.3)" }}>
            Failed
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5 flex flex-col gap-0.5">
        <span className="font-sans text-[11px] font-medium text-white/80 truncate text-left">{result.prompt_title}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-dim/60 uppercase tracking-wider">
            {result.score_overall > 0 ? `${result.score_overall}/5` : "Unrated"}
          </span>
          {result.provider && (
            <span className="font-mono text-[8px] text-dim/40 uppercase tracking-widest">{result.provider}</span>
          )}
        </div>
      </div>

      {/* Dimension bars — revealed on hover */}
      {hasDims && (
        <div className="opacity-0 group-hover:opacity-100 transition-precise">
          <DimBars result={result} />
        </div>
      )}
    </button>
  );
}

// ─── Filter + Sort bar ────────────────────────────────────────

const FILTER_OPTIONS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "winner", label: "Winners" },
  { value: "failed", label: "Failed" },
  { value: "unreviewed", label: "Unreviewed" },
];

const SORT_OPTIONS: { value: GallerySort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest_score", label: "Highest Score" },
  { value: "winner_first", label: "Winners First" },
];

// ─── Page ─────────────────────────────────────────────────────

export function ResultGallery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [results, setResults] = useState<GalleryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchWorking, setBatchWorking] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);

  const filter = (searchParams.get("filter") as GalleryFilter) ?? "all";
  const sort = (searchParams.get("sort") as GallerySort) ?? "newest";
  const provider = searchParams.get("provider") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllGalleryResults({ filter, sort, provider: provider || undefined });
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, provider]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (f: GalleryFilter) => setSearchParams({ filter: f, sort, ...(provider ? { provider } : {}) });
  const setSort = (s: GallerySort) => setSearchParams({ filter, sort: s, ...(provider ? { provider } : {}) });
  const setProvider = (p: string) => setSearchParams({ filter, sort, ...(p ? { provider: p } : {}) });

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exitBatch = () => { setBatchMode(false); setSelectedIds(new Set()); };

  const handleBatchAction = async (action: "winner" | "failed" | "delete") => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      for (const id of selectedIds) {
        if (action === "winner") await updateResult(id, { is_winner: true, is_failed: false });
        else if (action === "failed") await updateResult(id, { is_failed: true, is_winner: false });
        else await deleteResult(id);
      }
      const count = selectedIds.size;
      const label = action === "winner" ? "marked as winners" : action === "failed" ? "marked as failed" : "deleted";
      toast.success(`${count} result${count !== 1 ? "s" : ""} ${label}`);
      exitBatch();
      await load();
    } catch {
      toast.error("Batch action failed");
    } finally {
      setBatchWorking(false);
    }
  };

  const displayResults = minScore > 0 ? results.filter((r) => r.score_overall >= minScore) : results;
  const topShots = results
    .filter((r) => r.score_overall >= 4)
    .sort((a, b) => b.score_overall - a.score_overall)
    .slice(0, 4);

  return (
    <PageContainer
      title="Results"
      subtitle="ALL OUTPUT"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant={batchMode ? "primary" : "ghost"}
            size="sm"
            onClick={() => batchMode ? exitBatch() : setBatchMode(true)}
          >
            {batchMode ? <><X size={10} /> Cancel</> : "Select"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/craft")}>
            Craft New
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 min-w-0">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal size={13} className="text-dim/60 shrink-0" />

          {/* Filter */}
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-widest transition-precise",
                  filter === opt.value
                    ? "text-white bg-white/10"
                    : "text-muted hover:text-white"
                )}
                style={{ border: filter === opt.value ? "var(--border-strong)" : "var(--border-dim)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/12" />

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as GallerySort)}
            className="h-8 px-2 font-mono text-[10px] text-muted bg-transparent rounded-sm focus:outline-none"
            style={{ border: "var(--border-dim)" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Provider */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="h-8 px-2 font-mono text-[10px] text-muted bg-transparent rounded-sm focus:outline-none"
            style={{ border: "var(--border-dim)" }}
          >
            <option value="">All Providers</option>
            {SUPPORTED_CREATIVE_PROVIDERS.map((p) => (
              <option key={p} value={p.toLowerCase().replace(/\s+/g, "_")}>{p}</option>
            ))}
          </select>

          <div className="w-px h-4 bg-white/12" />

          {/* Score filter */}
          <div className="flex items-center gap-1">
            {([0, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinScore(n)}
                className={cn(
                  "px-2 py-1 rounded-sm font-mono text-[9px] uppercase tracking-widest transition-precise",
                  minScore === n ? "text-white bg-white/10" : "text-muted hover:text-white"
                )}
                style={{ border: minScore === n ? "var(--border-strong)" : "var(--border-dim)" }}
              >
                {n === 0 ? "Any ★" : `${n}+★`}
              </button>
            ))}
          </div>

          <span className="ml-auto font-mono text-[10px] text-dim/50">{displayResults.length} result{displayResults.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Batch action bar */}
        {batchMode && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-sm"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="font-mono text-[10px] text-readable">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedIds.size === 0 || batchWorking}
              onClick={() => handleBatchAction("winner")}
            >
              <Star size={10} /> Mark Winners
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedIds.size === 0 || batchWorking}
              onClick={() => handleBatchAction("failed")}
            >
              Mark Failed
            </Button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || batchWorking}
              onClick={() => handleBatchAction("delete")}
              className="flex items-center gap-1.5 font-mono text-[10px] text-red/70 hover:text-red disabled:opacity-30 transition-precise"
            >
              <Trash2 size={10} /> Delete
            </button>
          </div>
        )}

        {/* Top Shots strip */}
        {!loading && topShots.length > 0 && minScore === 0 && filter === "all" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Star size={10} className="text-amber fill-amber/40 shrink-0" />
              <span className="system-label text-soft-white">TOP SHOTS</span>
              <span className="font-mono text-[9px] text-dim/40">Score ≥ 4</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {topShots.map((r) => (
                <TopShotCard key={r.id} result={r} onClick={() => navigate(`/results/view/${r.id}`)} />
              ))}
            </div>
            <div className="h-px bg-white/6" />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="font-ndot text-[28px] text-dim/30">···</span>
          </div>
        ) : displayResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <ImageOff size={24} className="text-dim/30" />
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[14px] text-readable">No results found</span>
              <span className="font-mono text-[11px] text-muted">
                {filter !== "all" || minScore > 0 ? "Try a different filter, or " : ""}
                Add results from Prompt Detail pages.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Clear Filter</Button>
              )}
              {minScore > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setMinScore(0)}>Clear Score</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayResults.map((r) => (
              <GalleryCard
                key={r.id}
                result={r}
                onClick={() => navigate(`/results/view/${r.id}`)}
                batchMode={batchMode}
                selected={selectedIds.has(r.id)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
