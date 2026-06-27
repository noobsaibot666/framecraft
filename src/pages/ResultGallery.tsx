import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImageOff, Star, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { getAllGalleryResults, type GalleryFilter, type GallerySort, type GalleryResult } from "@/lib/resultGallery";
import { SUPPORTED_CREATIVE_PROVIDERS } from "@/lib/appInfo";
import { cn } from "@/lib/utils";

// ─── Card ─────────────────────────────────────────────────────

function GalleryCard({ result, onClick }: { result: GalleryResult; onClick: () => void }) {
  const thumb = useImageDisplaySrc(result.thumbnail_path);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-0 rounded-card overflow-hidden group transition-precise hover:border-white/20"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden relative">
        {thumb.src
          ? <img src={thumb.src} alt="" className="w-full h-full object-cover" onError={thumb.onError} />
          : <ImageOff size={20} className="text-dim/40" />
        }
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

  return (
    <PageContainer
      title="Results"
      subtitle="ALL OUTPUT"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/craft")}>
          Craft New
        </Button>
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

          <span className="ml-auto font-mono text-[10px] text-dim/50">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="font-ndot text-[28px] text-dim/30">···</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <ImageOff size={24} className="text-dim/30" />
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[14px] text-readable">No results found</span>
              <span className="font-mono text-[11px] text-muted">
                {filter !== "all" ? "Try a different filter, or " : ""}
                Add results from Prompt Detail pages.
              </span>
            </div>
            {filter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>View All</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map((r) => (
              <GalleryCard key={r.id} result={r} onClick={() => navigate(`/library/${r.prompt_id}`)} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
