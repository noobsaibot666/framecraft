import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Star, Clock, BookMarked, ImageOff, Search } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProviderBadge } from "@/components/ui/Badge";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { getRecentResults } from "@/lib/db";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { formatDate } from "@/lib/utils";
import type { Prompt, Result } from "@/types";

function StatModule({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      <span className="system-label">{label}</span>
      <DotMatrix value={value} size="lg" />
      {sub && <span className="system-label text-[10px] text-muted">{sub}</span>}
    </div>
  );
}

function PromptRow({ prompt, onClick }: { prompt: Prompt; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 rounded-sm text-left transition-precise hover:bg-white/6"
      style={{ borderBottom: "var(--border-dim)" }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-sans text-[13px] font-medium text-white truncate">{prompt.title}</span>
        <span className="font-mono text-[10.5px] text-readable">{formatDate(prompt.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ProviderBadge provider={prompt.provider} />
        {prompt.is_winner && <Star size={11} className="text-amber fill-amber/40" />}
      </div>
    </button>
  );
}

function EmptyState({
  icon,
  label,
  action,
  cta,
  onCta,
  compact,
}: {
  icon?: React.ReactNode;
  label: string;
  action?: string;
  cta?: string;
  onCta?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? "py-4" : "py-8"}`}>
      {icon}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[13px] text-readable">{label}</span>
        {action && <span className="font-mono text-[11px] text-muted">{action}</span>}
      </div>
      {cta && onCta && (
        <Button variant="ghost" size="sm" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}

function ResultThumb({ result, promptId }: { result: Result & { prompt_title: string }; promptId: string }) {
  const navigate = useNavigate();
  const thumb = useImageDisplaySrc(result.thumbnail_path);
  return (
    <button
      onClick={() => navigate(`/library/${promptId}`)}
      className="flex items-center gap-4 w-full px-4 py-3.5 text-left transition-precise hover:bg-white/6 rounded-sm"
      style={{ borderBottom: "var(--border-dim)" }}
    >
      <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0 bg-black/30 flex items-center justify-center" style={{ border: "var(--border-default)" }}>
        {thumb.src
          ? <img src={thumb.src} alt="" className="w-full h-full object-cover" onError={thumb.onError} />
          : <ImageOff size={14} className="text-dim" />
        }
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-sans text-[13px] font-medium text-white truncate">{result.prompt_title || "Untitled"}</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < result.score_overall ? "bg-amber/80" : "bg-white/14"}`} />
            ))}
          </div>
          <span className="font-mono text-[10px] text-readable">{formatDate(result.created_at)}</span>
        </div>
      </div>
      {result.is_winner && <Star size={11} className="text-amber fill-amber/40 shrink-0 ml-auto" />}
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading, fetchStats } = useDashboardStore();
  const [recentResults, setRecentResults] = useState<(Result & { prompt_title: string })[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getRecentResults(6).then(setRecentResults); }, []);
  const q = search.trim().toLowerCase();
  const recentPrompts = q
    ? stats.recent_prompts.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.prompt_text.toLowerCase().includes(q) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    : stats.recent_prompts;
  const topRated = q
    ? stats.top_rated.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.prompt_text.toLowerCase().includes(q) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    : stats.top_rated;
  const filteredResults = q
    ? recentResults.filter((r) => r.prompt_title.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q))
    : recentResults;

  return (
    <PageContainer
      title="Dashboard"
      subtitle="PRODUCTION WORKSPACE"
      action={
        <Button variant="primary" size="md" onClick={() => navigate("/craft")}>
          <Plus size={12} />
          Craft Prompt
        </Button>
      }
    >
      <div className="flex flex-col gap-8 min-w-0">
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-[520px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recent prompts, tags, and results..."
              className="w-full h-10 pl-9 pr-3 rounded-sm bg-transparent font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none"
              style={{ border: "var(--border-default)" }}
            />
          </div>
          {search && (
            <button type="button" onClick={() => setSearch("")} className="font-mono text-[10px] text-muted hover:text-white">
              Clear
            </button>
          )}
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
          <StatModule label="TOTAL PROMPTS" value={stats.total_prompts} sub="IN LIBRARY" />
          <StatModule label="TOTAL RESULTS" value={stats.total_results} sub="GENERATED" />
          <StatModule label="WINNERS" value={stats.total_winners} sub="FLAGGED" />
          <StatModule label="RECIPES" value={stats.total_recipes} sub="STORED" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 min-w-0">
          {/* Recent Prompts */}
          <div className="xl:col-span-2 min-w-0">
            <Card>
              <CardHeader
                label="Recent Prompts"
                count={stats.recent_prompts.length}
                action={
                  <Button variant="muted" size="sm" onClick={() => navigate("/library")}>
                    View All
                  </Button>
                }
              />
              <CardBody>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="font-ndot text-[24px] text-dim/30 dot-blink">···</span>
                  </div>
                ) : stats.recent_prompts.length > 0 ? (
                  <div className="flex flex-col">
                    {recentPrompts.map((p) => (
                      <PromptRow key={p.id} prompt={p} onClick={() => navigate(`/library/${p.id}`)} />
                    ))}
                    {recentPrompts.length === 0 && (
                      <span className="font-mono text-[11px] text-muted px-4 py-6">No recent prompts match search.</span>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Clock size={20} className="text-dim" />}
                    label="No prompts yet"
                    action="Craft your first prompt to get started."
                    cta="Craft Prompt"
                    onCta={() => navigate("/craft")}
                  />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Top Rated */}
            <Card>
              <CardHeader label="Top Rated" action={<Star size={13} className="text-amber" />} />
              <CardBody>
                {topRated.length > 0 ? (
                  <div className="flex flex-col">
                    {topRated.map((p) => (
                      <PromptRow key={p.id} prompt={p} onClick={() => navigate(`/library/${p.id}`)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Star size={16} className="text-dim" />}
                    label="Rate your results"
                    compact
                  />
                )}
              </CardBody>
            </Card>

            {/* Recent Results */}
            <Card>
              <CardHeader
                label="Recent Results"
                action={
                  <StatusDot active={recentResults.length > 0} />
                }
              />
              <CardBody>
                {filteredResults.length > 0 ? (
                  <div className="flex flex-col">
                    {filteredResults.map((r) => (
                      <ResultThumb key={r.id} result={r} promptId={r.prompt_id} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<ImageOff size={16} className="text-dim" />}
                    label="No results yet"
                    action="Add outputs from Prompt Detail pages."
                    compact
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <span className="system-label">QUICK ACTIONS</span>
          <div className="flex-1 h-px bg-white/16" />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/import")}>
              <BookMarked size={11} />
              Import Prompt
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/recipes")}>
              Recipes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/srefs")}>
              SREFs
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
