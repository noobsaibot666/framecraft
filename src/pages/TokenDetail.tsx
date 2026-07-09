import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, ExternalLink, Heart, Zap } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import {
  getTokenById,
  getPromptsUsingToken,
  getTokenCombos,
  getTokenStats,
  type TokenDetailPrompt,
  type TokenCombo,
  type TokenStats,
} from "@/lib/tokenDetail";
import { getTopPatterns, type TopPattern } from "@/lib/tokenPatterns";
import { toggleTokenFavorite } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Token } from "@/types";

// ─── Stat chip ───────────────────────────────────────────────

function StatChip({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-4 rounded-sm"
      style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
      <span className="font-mono text-[22px] tabular-nums font-medium text-soft-white">{value}</span>
      {sub && <span className="font-mono text-[10px] text-dim/50">{sub}</span>}
      <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{label}</span>
    </div>
  );
}

// ─── Rating stars ─────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={9} className={cn(i < rating ? "text-amber fill-amber/40" : "text-white/14")} />
      ))}
    </div>
  );
}

// ─── Prompt row ───────────────────────────────────────────────

function PromptRow({ prompt, onClick }: { prompt: TokenDetailPrompt; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-sm group cursor-pointer hover:bg-white/3 transition-precise"
      style={{ border: "var(--border-dim)" }}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[14px] text-soft-white truncate block">{prompt.title}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{prompt.provider}</span>
          {prompt.is_winner && <span className="font-mono text-[9px] text-amber">WINNER</span>}
          {prompt.is_failed && <span className="font-mono text-[9px] text-red">FAILED</span>}
        </div>
      </div>
      <Stars rating={prompt.rating} />
      <ExternalLink size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-precise shrink-0" />
    </div>
  );
}

// ─── Combo row ────────────────────────────────────────────────

function ComboRow({ combo, onClick }: { combo: TokenCombo; onClick: () => void }) {
  const rating = Math.round(combo.avg_rating * 10) / 10;
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-sm group cursor-pointer hover:bg-white/3 transition-precise"
      style={{ border: "var(--border-dim)" }}
      onClick={onClick}
    >
      <Zap size={9} className="text-cyan shrink-0" />
      <span className="flex-1 font-mono text-[13px] text-soft-white truncate">{combo.partner_text}</span>
      <span className="font-mono text-[10px] text-readable tabular-nums">{rating.toFixed(1)} avg</span>
      <span className="font-mono text-[9px] text-muted">{combo.co_occurrence_count}×</span>
    </div>
  );
}

// ─── Quality bar ──────────────────────────────────────────────

function QualityBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, ((score + 10) / 20) * 100));
  const isNegative = score < 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className={cn("h-full rounded-full transition-all", isNegative ? "bg-red" : "bg-cyan")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("font-mono text-[12px] tabular-nums shrink-0", isNegative ? "text-red" : "text-cyan")}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function TokenDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [token, setToken] = useState<(Token & { category_name: string }) | null>(null);
  const [stats, setStats] = useState<TokenStats>({
    use_count: 0, quality_score: 0, winner_count: 0,
    total_prompt_count: 0, win_rate: 0, avg_rating: 0,
  });
  const [prompts, setPrompts] = useState<TokenDetailPrompt[]>([]);
  const [combos, setCombos] = useState<TokenCombo[]>([]);
  const [patterns, setPatterns] = useState<TopPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [tok, s, p, c, pats] = await Promise.all([
        getTokenById(id),
        getTokenStats(id),
        getPromptsUsingToken(id),
        getTokenCombos(id),
        getTopPatterns(6),
      ]);
      setToken(tok);
      setStats(s);
      setPrompts(p);
      setCombos(c);
      setPatterns(pats);
      setFavorite(tok?.is_favorite ?? false);
      setLoading(false);
    })();
  }, [id]);

  const handleToggleFavorite = async () => {
    if (!id || togglingFav) return;
    setTogglingFav(true);
    try {
      await toggleTokenFavorite(id, !favorite);
      setFavorite((f) => !f);
    } finally {
      setTogglingFav(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Token" subtitle="LOADING…">
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[10px] text-dim/40">Loading…</span>
        </div>
      </PageContainer>
    );
  }

  if (!token) {
    return (
      <PageContainer title="Token" subtitle="NOT FOUND"
        action={<Button variant="ghost" size="md" onClick={() => navigate(-1)}><ArrowLeft size={11} /> Back</Button>}>
        <div className="flex items-center justify-center h-40">
          <span className="font-mono text-[12px] text-muted">Token not found.</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={token.text}
      subtitle={[token.category_name?.toUpperCase(), token.provider?.toUpperCase()].filter(Boolean).join(" · ")}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={togglingFav}
            className={cn(
              "flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise",
              favorite ? "text-red" : "text-dim hover:text-white"
            )}
            style={{ border: favorite ? "1px solid rgba(215,25,33,0.4)" : "var(--border-dim)" }}
          >
            <Heart size={10} className={cn(favorite && "fill-red")} />
            {favorite ? "Favorited" : "Favorite"}
          </button>
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            <ArrowLeft size={11} /> Back
          </Button>
        </div>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatChip label="Used In" value={stats.use_count} sub="prompts" />
        <StatChip label="Winners" value={stats.winner_count} />
        <StatChip label="Win Rate" value={`${stats.win_rate}%`} />
        <StatChip label="Avg Rating" value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "—"} />
        <div className="flex flex-col gap-2 px-5 py-4 rounded-sm col-span-2 sm:col-span-1"
          style={{ background: "rgba(255,255,255,0.045)", border: "var(--border-default)" }}>
          <span className="font-mono text-[10px] text-readable tracking-widest uppercase">Quality Score</span>
          <QualityBar score={stats.quality_score} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8">
        {/* Left — prompts */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="system-label text-soft-white">PROMPTS</span>
            <span className="font-mono text-[10px] text-readable">({prompts.length})</span>
          </div>
          {prompts.length === 0 ? (
            <span className="font-mono text-[12px] text-muted">
              No prompts have used this token yet. Add it in Prompt Craft to start building its history.
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {prompts.map((p) => (
                <PromptRow
                  key={p.id}
                  prompt={p}
                  onClick={() => navigate(`/library/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — combos + metadata */}
        <div className="flex flex-col gap-6">
          {/* Proven combos */}
          <CollapsibleCard title="PROVEN COMBOS" gap="gap-3">
            {combos.length === 0 ? (
              <span className="font-mono text-[12px] text-muted">
                No co-occurrence data yet. Rate results to build pattern intelligence.
              </span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {combos.map((c) => (
                  <ComboRow
                    key={c.partner_id}
                    combo={c}
                    onClick={() => navigate(`/tokens/${c.partner_id}`)}
                  />
                ))}
              </div>
            )}
          </CollapsibleCard>

          {/* Top system patterns */}
          {patterns.length > 0 && (
            <CollapsibleCard title="TOP PATTERNS" gap="gap-3">
              <span className="font-mono text-[9px] text-dim/40">Highest-rated token pairs library-wide</span>
              <div className="flex flex-col gap-1.5">
                {patterns.map((pat, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-sm"
                    style={{ border: "var(--border-dim)" }}>
                    <span className="font-mono text-[10px] text-soft-white/80 flex-1 truncate">
                      <span className="text-dim/60">{pat.token_a_text}</span>
                      <span className="text-dim/30 mx-1">+</span>
                      <span className="text-dim/60">{pat.token_b_text}</span>
                    </span>
                    <span className="font-mono text-[9px] text-amber shrink-0">{pat.avg_rating.toFixed(1)}★</span>
                    <span className="font-mono text-[8px] text-dim/40 shrink-0">{pat.co_occurrence_count}×</span>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Token metadata */}
          <CollapsibleCard title="METADATA" gap="gap-3">
            <div className="flex flex-col gap-2">
              {[
                { label: "CATEGORY", value: token.category_name },
                { label: "PROVIDER", value: token.provider ?? "all" },
                { label: "TYPE", value: token.is_builtin ? "Built-in" : "Custom" },
                { label: "FAVORITE", value: favorite ? "Yes" : "No" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{label}</span>
                  <span className="font-mono text-[12px] text-readable">{value}</span>
                </div>
              ))}
            </div>
          </CollapsibleCard>

          {/* Quick action */}
          <Button variant="ghost" size="sm"
            className="w-full justify-center"
            onClick={() => navigate(`/craft?tokenId=${id}`)}>
            Use in Craft
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
