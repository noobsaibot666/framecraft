import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, Download, ImageOff, Layers, Search, Square, Star, SlidersHorizontal, Trash2, X } from "lucide-react";
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
    <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2" style={{ borderTop: "var(--border-dim)" }}>
      {dims.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted w-10 shrink-0">{d.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className={d.invert
                ? `h-full rounded-full ${d.value >= 4 ? "bg-red/75" : d.value >= 2 ? "bg-amber/60" : "bg-white/20"}`
                : `h-full rounded-full ${d.value >= 4 ? "bg-cyan/90" : d.value >= 2 ? "bg-amber/55" : "bg-white/20"}`
              }
              style={{ width: `${(d.value / 5) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[9px] text-readable w-3 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Top Shot Card ────────────────────────────────────────────

function TopShotCard({ result, onClick }: { result: GalleryResult; onClick: () => void }) {
  const thumb = useImageDisplaySrc(result.thumbnail_path ?? result.file_path);
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
  result, onClick, batchMode, selected, onSelect, onToggleWinner, onDelete,
}: {
  result: GalleryResult;
  onClick: () => void;
  batchMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleWinner?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const thumb = useImageDisplaySrc(result.thumbnail_path ?? result.file_path);
  const hasDims = result.score_realism > 0 || result.score_composition > 0 || result.score_lighting > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete?.(result.id);
  };

  return (
    <div
      onClick={batchMode ? () => onSelect(result.id) : onClick}
      className={cn(
        "flex flex-col gap-0 rounded-card overflow-hidden group transition-precise cursor-pointer",
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
        {/* Winner toggle / Failed badge */}
        {result.is_failed && !result.is_winner ? (
          <div className="absolute top-2 right-2 font-mono text-[7px] uppercase tracking-widest text-red/80 px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(215,25,33,0.15)", border: "1px solid rgba(215,25,33,0.3)" }}>
            Failed
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleWinner?.(result.id); }}
            className={cn(
              "absolute top-2 right-2 p-0.5 rounded-sm transition-precise",
              result.is_winner ? "text-amber opacity-100" : "text-white/30 opacity-0 group-hover:opacity-100 hover:text-amber"
            )}
            style={{ background: result.is_winner ? "transparent" : "rgba(0,0,0,0.55)" }}
            title={result.is_winner ? "Remove winner" : "Mark as winner"}
          >
            <Star size={12} className={result.is_winner ? "fill-amber/60" : ""} />
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-sans text-[12px] font-medium text-white/80 truncate text-left">{result.prompt_title}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-readable uppercase tracking-wider">
              {result.score_overall > 0 ? `${result.score_overall}/5` : "Unrated"}
            </span>
            {result.provider && (
              <span className="font-mono text-[8px] text-muted uppercase tracking-widest">{result.provider}</span>
            )}
          </div>
        </div>
        {!batchMode && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "shrink-0 p-1.5 rounded-sm transition-precise",
              confirmDelete ? "text-red bg-red/15 opacity-100" : "text-dim/50 opacity-0 group-hover:opacity-100 hover:text-red"
            )}
            title={confirmDelete ? "Click again to delete" : "Delete result"}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Dimension bars — always visible (previously hover-only) */}
      {hasDims && <DimBars result={result} />}
    </div>
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
  { value: "oldest", label: "Oldest" },
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
  const [searchText, setSearchText] = useState("");
  const [groupByPrompt, setGroupByPrompt] = useState(false);

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

  const handleToggleWinner = async (id: string) => {
    const result = results.find((r) => r.id === id);
    if (!result) return;
    const next = !result.is_winner;
    await updateResult(id, { is_winner: next, is_failed: next ? false : result.is_failed });
    setResults((prev) => prev.map((r) => r.id === id ? { ...r, is_winner: next, is_failed: next ? false : r.is_failed } : r));
  };

  const handleDeleteResult = async (id: string) => {
    try {
      await deleteResult(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      toast.success("Result deleted");
    } catch {
      toast.error("Failed to delete result");
    }
  };

  const handleBatchScore = async (score: number) => {
    if (selectedIds.size === 0 || batchWorking) return;
    setBatchWorking(true);
    try {
      for (const id of selectedIds) await updateResult(id, { score_overall: score });
      toast.success(`${selectedIds.size} result${selectedIds.size !== 1 ? "s" : ""} scored ${score}/5`);
      exitBatch();
      await load();
    } catch {
      toast.error("Batch score failed");
    } finally {
      setBatchWorking(false);
    }
  };

  const handleExportResultsCSV = () => {
    const selected = selectedIds.size > 0
      ? displayResults.filter((r) => selectedIds.has(r.id))
      : displayResults;
    if (selected.length === 0) return;
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ["prompt_title", "score_overall", "score_composition", "score_lighting", "score_realism", "score_brand_fit", "score_ai_risk", "is_winner", "is_failed", "notes", "created_at"];
    const rows = selected.map((r) => [
      esc(r.prompt_title ?? ""),
      String(r.score_overall),
      String(r.score_composition),
      String(r.score_lighting),
      String(r.score_realism),
      String(r.score_brand_fit),
      String(r.score_ai_risk),
      r.is_winner ? "1" : "0",
      r.is_failed ? "1" : "0",
      esc(r.notes ?? ""),
      esc(r.created_at),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "framecraft-results.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.info(`${selected.length} result${selected.length !== 1 ? "s" : ""} exported as CSV`);
    if (selectedIds.size > 0) exitBatch();
  };

  const displayResults = results.filter((r) => {
    if (minScore > 0 && r.score_overall < minScore) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!r.prompt_title.toLowerCase().includes(q) && !(r.notes ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const topShots = results
    .filter((r) => r.score_overall >= 4)
    .sort((a, b) => b.score_overall - a.score_overall)
    .slice(0, 4);

  return (
    <PageContainer
      title="Results"
      subtitle="ALL OUTPUT"
      description="Score, mark winners, and correct results here — this is what trains the app's token quality and recommendation signals."
      action={
        <div className="flex items-center gap-2">
          <Button
            variant={batchMode ? "primary" : "ghost"}
            size="sm"
            onClick={() => batchMode ? exitBatch() : setBatchMode(true)}
          >
            {batchMode ? <><X size={10} /> Cancel</> : "Select"}
          </Button>
          <Button
            variant={groupByPrompt ? "primary" : "ghost"}
            size="sm"
            onClick={() => setGroupByPrompt((v) => !v)}
            className={groupByPrompt ? "bg-white/8 text-white" : ""}
          >
            <Layers size={11} /> {groupByPrompt ? "Grouped" : "Group"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportResultsCSV} disabled={displayResults.length === 0}>
            <Download size={11} /> CSV
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
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-readable pointer-events-none" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by prompt…"
              className="h-8 pl-8 pr-3 w-44 font-mono text-[11px] text-soft-white placeholder:text-muted bg-transparent rounded-sm focus:outline-none focus:border-cyan/50"
              style={{ border: "var(--border-default)" }}
            />
          </div>
          <SlidersHorizontal size={13} className="text-readable shrink-0" />

          {/* Filter */}
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-sm font-mono text-[11px] uppercase tracking-widest transition-precise",
                  filter === opt.value
                    ? "text-white bg-cyan/15"
                    : "text-readable hover:text-white hover:bg-white/5"
                )}
                style={{ border: filter === opt.value ? "1px solid rgba(56,183,200,0.55)" : "var(--border-default)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/16" />

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as GallerySort)}
            className="h-8 px-2 font-mono text-[11px] text-soft-white bg-transparent rounded-sm focus:outline-none focus:border-cyan/50"
            style={{ border: "var(--border-default)" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-panel text-white">{opt.label}</option>
            ))}
          </select>

          {/* Provider */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="h-8 px-2 font-mono text-[11px] text-soft-white bg-transparent rounded-sm focus:outline-none focus:border-cyan/50"
            style={{ border: "var(--border-default)" }}
          >
            <option value="" className="bg-panel text-white">All Providers</option>
            {SUPPORTED_CREATIVE_PROVIDERS.map((p) => (
              <option key={p} value={p.toLowerCase().replace(/\s+/g, "_")} className="bg-panel text-white">{p}</option>
            ))}
          </select>

          <div className="w-px h-4 bg-white/16" />

          {/* Score filter */}
          <div className="flex items-center gap-1">
            {([0, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinScore(n)}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-mono text-[10px] uppercase tracking-widest transition-precise",
                  minScore === n ? "text-white bg-amber/15" : "text-readable hover:text-white hover:bg-white/5"
                )}
                style={{ border: minScore === n ? "1px solid rgba(223,168,58,0.6)" : "var(--border-default)" }}
              >
                {n === 0 ? "Any ★" : `${n}+★`}
              </button>
            ))}
          </div>

          <span className="ml-auto font-mono text-[10px] text-muted">{displayResults.length} result{displayResults.length !== 1 ? "s" : ""}</span>
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
            <span className="font-mono text-[9px] text-muted uppercase tracking-widest">Score:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button"
                onClick={() => handleBatchScore(n)}
                disabled={selectedIds.size === 0 || batchWorking}
                className="font-mono text-[9px] text-readable hover:text-amber disabled:opacity-30 transition-precise px-1.5 py-1 rounded-sm"
                style={{ border: "var(--border-dim)" }}>
                {"★".repeat(n)}
              </button>
            ))}
            <button type="button"
              onClick={() => handleBatchScore(0)}
              disabled={selectedIds.size === 0 || batchWorking}
              className="font-mono text-[9px] text-dim/60 hover:text-white disabled:opacity-30 transition-precise px-1.5 py-1 rounded-sm"
              style={{ border: "var(--border-dim)" }}
              title="Clear score">
              ☆
            </button>
            <div className="w-px h-4 bg-white/10" />
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
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleExportResultsCSV}
              className="flex items-center gap-1.5 font-mono text-[10px] text-readable hover:text-white disabled:opacity-30 transition-precise"
            >
              <Download size={10} /> CSV
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
              <span className="font-sans text-[15px] text-readable">No results found</span>
              <span className="font-mono text-[12px] text-muted">
                {filter !== "all" || minScore > 0 || searchText ? "Try a different filter, or " : ""}
                Add results from Prompt Detail pages.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {searchText && (
                <Button variant="ghost" size="sm" onClick={() => setSearchText("")}>Clear Search</Button>
              )}
              {filter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Clear Filter</Button>
              )}
              {minScore > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setMinScore(0)}>Clear Score</Button>
              )}
            </div>
          </div>
        ) : groupByPrompt ? (
          (() => {
            const groups: { promptTitle: string; promptId: string; results: GalleryResult[] }[] = [];
            const seen = new Map<string, number>();
            for (const r of displayResults) {
              const key = r.prompt_id ?? r.prompt_title;
              if (seen.has(key)) {
                groups[seen.get(key)!].results.push(r);
              } else {
                seen.set(key, groups.length);
                groups.push({ promptTitle: r.prompt_title ?? "Untitled", promptId: r.prompt_id, results: [r] });
              }
            }
            return (
              <div className="flex flex-col gap-8">
                {groups.map((g) => (
                  <div key={g.promptId} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => navigate(`/library/${g.promptId}`)}
                        className="font-mono text-[12px] text-soft-white hover:text-cyan transition-precise truncate max-w-sm text-left">
                        {g.promptTitle}
                      </button>
                      <span className="font-mono text-[9px] text-dim/40 shrink-0">{g.results.length} result{g.results.length !== 1 ? "s" : ""}</span>
                      <div className="flex-1 h-px bg-white/8" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                      {g.results.map((r) => (
                        <GalleryCard key={r.id} result={r}
                          onClick={() => navigate(`/results/view/${r.id}`)}
                          batchMode={batchMode} selected={selectedIds.has(r.id)} onSelect={toggleSelect}
                          onToggleWinner={handleToggleWinner} onDelete={handleDeleteResult} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
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
                onToggleWinner={handleToggleWinner}
                onDelete={handleDeleteResult}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
