import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Download, Search, Star, Zap, Tag } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { getAllTokens, searchTokens, getTokenCategories, toggleTokenFavorite } from "@/lib/db";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { Token, TokenCategory } from "@/types";

registerShortcutLabel("f", "Toggle favorite (Token Library — hover)");

type SortOption = "quality" | "use" | "alpha" | "rating" | "winners";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "quality", label: "Quality" },
  { value: "use", label: "Most Used" },
  { value: "alpha", label: "A–Z" },
  { value: "rating", label: "Rating" },
  { value: "winners", label: "Winners" },
];

function QualityBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${score > 0.6 ? "bg-cyan" : score > 0.3 ? "bg-white/50" : "bg-white/20"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[8px] text-dim/50 tabular-nums w-6 text-right">{pct}</span>
    </div>
  );
}

function TokenCard({ token, onFavoriteToggle }: { token: Token; onFavoriteToggle: (id: string, next: boolean) => void }) {
  const navigate = useNavigate();
  const [fav, setFav] = useState(token.is_favorite ?? false);
  const [copied, setCopied] = useState(false);

  const handleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    await toggleTokenFavorite(token.id, next);
    onFavoriteToggle(token.id, next);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(token.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      onClick={() => navigate(`/tokens/${token.id}`)}
      className="group flex flex-col gap-3 p-4 rounded-card cursor-pointer transition-precise hover:border-white/20"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[12px] text-soft-white/90 leading-snug wrap-break-word flex-1">{token.text}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className={`transition-precise opacity-0 group-hover:opacity-100 ${copied ? "text-cyan" : "text-dim/40 hover:text-white"}`}
            aria-label="Copy token text"
            title="Copy text"
          >
            <Copy size={10} />
          </button>
          <button
            type="button"
            onClick={handleFav}
            className={`transition-precise ${fav ? "text-amber" : "text-dim/30 opacity-0 group-hover:opacity-100"}`}
            aria-label="Toggle favorite"
          >
            <Star size={11} className={fav ? "fill-amber/40" : ""} />
          </button>
        </div>
      </div>

      <QualityBar score={token.quality_score ?? 0} />

      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] text-dim/50 flex items-center gap-1">
          <Zap size={8} /> {token.use_count ?? 0} uses
        </span>
        {(token.avg_rating ?? 0) > 0 && (
          <span className="font-mono text-[9px] text-dim/50">{(token.avg_rating ?? 0).toFixed(1)} avg</span>
        )}
        {(token.win_appearances ?? 0) > 0 && (
          <span className="font-mono text-[9px] text-amber font-medium">{token.win_appearances}★</span>
        )}
        {token.is_builtin && (
          <span className="font-mono text-[8px] uppercase tracking-widest text-dim/30">built-in</span>
        )}
      </div>
    </div>
  );
}

export function TokenLibrary() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [categories, setCategories] = useState<TokenCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sort, setSort] = useState<SortOption>("quality");
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTokens = useCallback(async (q: string, catId: string, s: SortOption) => {
    setLoading(true);
    try {
      const results = q || catId
        ? await searchTokens(q, catId || undefined)
        : await getAllTokens(s);
      setTokens(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { getTokenCategories().then(setCategories); }, []);
  useEffect(() => { loadTokens(searchVal, categoryFilter, sort); }, [searchVal, categoryFilter, sort, loadTokens]);

  const handleFavoriteToggle = useCallback((id: string, next: boolean) => {
    setTokens((prev) => prev.map((t) => t.id === id ? { ...t, is_favorite: next } : t));
  }, []);

  useShortcut("f", () => searchRef.current?.focus());

  const total = tokens.length;
  const favorites = tokens.filter((t) => t.is_favorite).length;
  const highQuality = tokens.filter((t) => (t.quality_score ?? 0) > 0.5).length;

  const handleExportCSV = () => {
    if (tokens.length === 0) return;
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["text", "category", "quality_score", "use_count", "avg_rating", "win_appearances", "is_favorite", "is_builtin"];
    const rows = tokens.map((t) => [
      esc(t.text),
      esc(t.category_name ?? ""),
      String((t.quality_score ?? 0).toFixed(3)),
      String(t.use_count ?? 0),
      String((t.avg_rating ?? 0).toFixed(2)),
      String(t.win_appearances ?? 0),
      t.is_favorite ? "1" : "0",
      t.is_builtin ? "1" : "0",
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "framecraft-tokens.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer
      title="Token Library"
      subtitle={`${total} TOKENS · ${highQuality} HIGH QUALITY · ${favorites} FAVORITES`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={handleExportCSV} disabled={tokens.length === 0}>
            <Download size={11} /> CSV
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate("/settings#tokens")}>
            <Tag size={11} /> Manage
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim/50" />
            <input
              ref={searchRef}
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search tokens…"
              className="w-full h-9 pl-9 pr-3 font-mono text-[12px] text-soft-white placeholder:text-dim/40 bg-transparent rounded-sm focus:outline-none"
              style={{ border: "var(--border-default)" }}
            />
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className={cn("font-mono text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-pill transition-precise", categoryFilter === "" ? "bg-white/12 text-white" : "text-dim/60 hover:text-white")}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id === categoryFilter ? "" : c.id)}
                className={cn("font-mono text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-pill transition-precise", categoryFilter === c.id ? "bg-white/12 text-white" : "text-dim/60 hover:text-white")}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSort(s.value)}
                className={cn("font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm transition-precise", sort === s.value ? "text-cyan" : "text-dim/50 hover:text-white")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="font-ndot text-[32px] text-dim/30">···</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Tag size={24} className="text-dim/30" />
            <span className="font-mono text-[11px] text-muted">
              {searchVal || categoryFilter ? "No tokens match your search." : "No tokens yet — add some in Settings."}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {tokens.map((t) => (
              <TokenCard key={t.id} token={t} onFavoriteToggle={handleFavoriteToggle} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
