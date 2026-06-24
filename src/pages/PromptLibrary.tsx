import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Copy, Star, Trash2, ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, ProviderBadge, RiskBadge } from "@/components/ui/Badge";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { usePromptStore } from "@/stores/usePromptStore";
import { getResultSummaryMap } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";
import type { Prompt, Provider, Category, SortOption } from "@/types";

const PROVIDER_OPTIONS: { value: Provider | ""; label: string }[] = [
  { value: "", label: "All Providers" },
  { value: "midjourney", label: "Midjourney" },
  { value: "dalle", label: "DALL·E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
  { value: "firefly", label: "Firefly" },
  { value: "ideogram", label: "Ideogram" },
  { value: "flux", label: "Flux" },
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
];

function RatingDots({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            i < rating ? "bg-white/60" : "bg-white/12"
          )}
        />
      ))}
    </div>
  );
}

function PromptCard({ prompt, resultSummary, onCopy, onDelete }: {
  prompt: Prompt;
  resultSummary?: { count: number; avg_score: number };
  onCopy: (p: Prompt) => void;
  onDelete: (p: Prompt) => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="group flex flex-col gap-3 p-4 rounded-card cursor-pointer transition-precise"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
      onClick={() => navigate(`/library/${prompt.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-sans text-[12px] font-semibold text-white leading-tight truncate">
            {prompt.title}
          </span>
          {prompt.description && (
            <span className="font-mono text-[10px] text-dim leading-snug line-clamp-1">
              {prompt.description}
            </span>
          )}
        </div>
        {prompt.is_winner && (
          <Star size={10} className="text-white/40 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Prompt preview */}
      <p className="prompt-text text-[11px] text-muted/80 line-clamp-2 leading-relaxed">
        {prompt.prompt_text}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ProviderBadge provider={prompt.provider} />
        {prompt.category && <Badge variant="category">{prompt.category}</Badge>}
        {prompt.aspect_ratio && <Badge variant="default">{prompt.aspect_ratio}</Badge>}
        {prompt.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="tag">{tag}</Badge>
        ))}
        {(prompt.tags?.length ?? 0) > 2 && (
          <span className="font-mono text-[9px] text-dim">+{(prompt.tags?.length ?? 0) - 2}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: "var(--border-dim)" }}>
        <div className="flex items-center gap-3">
          <RatingDots rating={prompt.rating} />
          {prompt.ai_look_risk > 0 && <RiskBadge score={prompt.ai_look_risk} />}
          {resultSummary && resultSummary.count > 0 && (
            <span className="font-mono text-[8px] text-dim/60">
              {resultSummary.count} result{resultSummary.count !== 1 ? "s" : ""}
              {resultSummary.avg_score > 0 && ` · ${resultSummary.avg_score.toFixed(1)} avg`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-precise">
          <button
            className="p-1 rounded text-dim hover:text-white transition-precise"
            onClick={(e) => { e.stopPropagation(); onCopy(prompt); }}
            title="Copy prompt"
          >
            <Copy size={11} />
          </button>
          <button
            className="p-1 rounded text-dim hover:text-red transition-precise"
            onClick={(e) => { e.stopPropagation(); onDelete(prompt); }}
            title="Delete prompt"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="system-label text-[8px]">{formatDate(prompt.created_at)}</div>
    </div>
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
          "font-mono text-[10px] tracking-[0.06em] uppercase",
          "bg-transparent text-muted",
          "rounded-sm px-2.5 py-1.5",
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
        size={10}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
      />
    </div>
  );
}

export function PromptLibrary() {
  const navigate = useNavigate();
  const {
    loading,
    fetchPrompts,
    search,
    setFilters,
    setSortBy,
    filters,
    sortBy,
    remove,
    filteredAndSorted,
  } = usePromptStore();

  const [searchVal, setSearchVal] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Prompt | null>(null);
  const [resultMap, setResultMap] = useState<Record<string, { count: number; avg_score: number }>>({});

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);
  useEffect(() => { getResultSummaryMap().then(setResultMap); }, []);

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

  const handleCopy = useCallback(async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopied(prompt.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }, []);

  const handleDelete = useCallback(async (prompt: Prompt) => {
    if (confirmDelete?.id === prompt.id) {
      await remove(prompt.id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(prompt);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }, [confirmDelete, remove]);

  const prompts = filteredAndSorted();

  return (
    <PageContainer
      title="Prompt Library"
      subtitle="STORED PROMPT ASSETS"
      action={
        <Button variant="primary" size="md" onClick={() => navigate("/craft")}>
          <Plus size={12} />
          New Prompt
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 relative">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
          />
          <Input
            placeholder="Search prompts…"
            className="pl-8"
            value={searchVal}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <NativeSelect
          value={filters.provider ?? ""}
          onChange={(v) => setFilters({ provider: (v as Provider) || undefined })}
          options={PROVIDER_OPTIONS}
          className="w-36"
        />

        <NativeSelect
          value={filters.category ?? ""}
          onChange={(v) => setFilters({ category: (v as Category) || undefined })}
          options={CATEGORY_OPTIONS}
          className="w-36"
        />

        <NativeSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as SortOption)}
          options={SORT_OPTIONS}
          className="w-36"
        />

        <div className="flex items-center gap-1">
          <button
            className={cn(
              "font-mono text-[9px] tracking-widest uppercase px-2 py-1.5 rounded transition-precise",
              filters.isWinner
                ? "text-white border-white/30"
                : "text-dim border-white/10"
            )}
            style={{ border: filters.isWinner ? "var(--border-strong)" : "var(--border-dim)" }}
            onClick={() => setFilters({ isWinner: !filters.isWinner || undefined })}
          >
            Winners
          </button>
        </div>
      </div>

      {/* Copy feedback */}
      {copied && (
        <div className="mb-4 px-3 py-2 rounded-sm font-mono text-[10px] text-white/70 flex items-center gap-2"
          style={{ background: "var(--surface-card)", border: "var(--border-default)" }}>
          <Copy size={10} className="text-white/40" />
          Prompt copied to clipboard
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mb-4 px-3 py-2 rounded-sm font-mono text-[10px] text-red/80 flex items-center justify-between"
          style={{ background: "rgba(215,25,33,0.06)", border: "var(--border-active)" }}>
          <span>Click delete again to confirm: <span className="text-white/60">{confirmDelete.title}</span></span>
          <button className="text-dim hover:text-white" onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="font-ndot text-[32px] text-dim/30 dot-blink">···</span>
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div
            className="flex flex-col items-center gap-3 p-8 rounded-card max-w-sm w-full"
            style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
          >
            <DotMatrix value="000" size="lg" />
            <span className="system-label">LIBRARY EMPTY</span>
            <span className="font-mono text-[11px] text-dim text-center leading-relaxed">
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
                    Craft Prompt
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
          <div className="flex items-center justify-between mb-4">
            <span className="system-label">
              <DotMatrix value={prompts.length} size="sm" className="inline-block mr-2" />
              {prompts.length === 1 ? "PROMPT" : "PROMPTS"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {prompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                resultSummary={resultMap[p.id]}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
