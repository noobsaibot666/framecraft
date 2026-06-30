import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Star, Clock, BookMarked, ImageOff, Search, AlertCircle, Zap, TrendingUp, FolderKanban, ArrowRight, ListChecks, Wand2, Upload, CheckSquare, ChevronDown, FolderPlus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProviderBadge } from "@/components/ui/Badge";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { getRecentResults, getRecentWins, getResultStats, getTopTags, getPromptsWithoutResultsCount, getProviderStats } from "@/lib/db";
import { getDashboardHealth, getWeeklyActivity, type ProductionHealth, type DayActivity, EMPTY_HEALTH } from "@/lib/dashboardHealth";
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

function HealthChip({ label, value, unit, alert }: { label: string; value: number | string; unit?: string; alert?: boolean }) {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-5 rounded-sm flex-1"
      style={{
        border: alert ? "1px solid rgba(215,25,33,0.25)" : "var(--border-dim)",
        background: alert ? "rgba(215,25,33,0.04)" : "var(--surface-card)",
      }}
    >
      <span className={`system-label text-[9px] ${alert ? "text-red/60" : "text-muted"}`}>{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-ndot text-[22px] leading-none ${alert ? "text-red/80" : "text-white/70"}`}>
          {value}
        </span>
        {unit && <span className="font-mono text-[9px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function ActivityChip({ data }: { data: DayActivity[] }) {
  if (!data.length || data.every((d) => d.prompts === 0 && d.results === 0)) return null;
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.prompts, d.results]));
  const H = 28;
  const BAR_W = 4;
  return (
    <div
      className="flex flex-col gap-2 px-4 py-5 rounded-sm min-w-[140px]"
      style={{ border: "var(--border-dim)", background: "var(--surface-card)" }}
    >
      <span className="system-label text-[9px] text-muted">7-DAY ACTIVITY</span>
      <div className="flex items-end gap-0.5 mt-auto">
        {data.map((d, i) => {
          const ph = Math.max(1, Math.round((d.prompts / maxVal) * H));
          const rh = Math.max(d.results > 0 ? 1 : 0, Math.round((d.results / maxVal) * H));
          return (
            <div key={i} className="flex items-end gap-px">
              <div className="rounded-sm" style={{ width: BAR_W, height: ph, background: "rgba(72,229,232,0.55)" }} />
              <div className="rounded-sm" style={{ width: BAR_W, height: rh, background: "rgba(255,255,255,0.18)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromptRow({ prompt, onClick }: { prompt: Prompt; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-4 py-3.5 rounded-sm text-left transition-precise hover:bg-cyan/6 hover:text-cyan"
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
      className="flex items-center gap-4 w-full px-4 py-3.5 text-left transition-precise hover:bg-cyan/6 rounded-sm"
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

function FirstRunGuide({ onCraft, onImport }: { onCraft: () => void; onImport: () => void }) {
  const steps = [
    {
      n: "01",
      icon: <Wand2 size={16} className="text-cyan" />,
      title: "Craft a prompt",
      desc: "Use the Craft page to build, assemble, and version your first AI image prompt.",
      cta: "Start Crafting",
      onClick: onCraft,
    },
    {
      n: "02",
      icon: <ListChecks size={16} className="text-white/50" />,
      title: "Queue and generate",
      desc: "Send your prompt to the queue, then generate it in Midjourney, DALL·E, or any provider.",
    },
    {
      n: "03",
      icon: <CheckSquare size={16} className="text-white/50" />,
      title: "Import and review",
      desc: "Drop result images in — Framecraft tracks scores, winners, and version history automatically.",
    },
  ];

  return (
    <div
      className="flex flex-col gap-6 p-6 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-sans text-[18px] font-semibold text-white">Welcome to Framecraft</span>
          <span className="font-mono text-[11px] text-readable">Your prompt engineering workspace is ready. Here's how to get started.</span>
        </div>
        <button
          type="button"
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 rounded-sm font-mono text-[10px] text-readable hover:text-white transition-precise"
          style={{ border: "var(--border-dim)" }}
        >
          <Upload size={10} /> Import Prompts
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex flex-col gap-3 p-4 rounded-sm"
            style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.03)" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-ndot text-[13px] text-dim/40">{s.n}</span>
              {s.icon}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-[13px] font-semibold text-white">{s.title}</span>
              <span className="font-mono text-[11px] text-readable leading-relaxed">{s.desc}</span>
            </div>
            {s.cta && s.onClick && (
              <Button variant="primary" size="sm" onClick={s.onClick}>
                {s.cta}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading, fetchStats } = useDashboardStore();
  const [recentResults, setRecentResults] = useState<(Result & { prompt_title: string })[]>([]);
  const [recentWins, setRecentWins] = useState<(Result & { prompt_title: string })[]>([]);
  const [resultStats, setResultStats] = useState<{ total: number; winners: number }>({ total: 0, winners: 0 });
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([]);
  const [promptsWithoutResults, setPromptsWithoutResults] = useState(0);
  const [providerStats, setProviderStats] = useState<{ provider: string; total: number; winners: number; win_rate: number }[]>([]);
  const [health, setHealth] = useState<ProductionHealth>(EMPTY_HEALTH);
  const [weeklyActivity, setWeeklyActivity] = useState<DayActivity[]>([]);
  const [search, setSearch] = useState("");
  const [recentPromptsOpen, setRecentPromptsOpen] = useState(true);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { getRecentResults(6).then(setRecentResults).catch(console.error); }, []);
  useEffect(() => { getRecentWins(4).then(setRecentWins).catch(console.error); }, []);
  useEffect(() => { getResultStats().then(setResultStats).catch(console.error); }, []);
  useEffect(() => { getTopTags(12).then(setTopTags).catch(console.error); }, []);
  useEffect(() => { getPromptsWithoutResultsCount().then(setPromptsWithoutResults).catch(console.error); }, []);
  useEffect(() => { getProviderStats().then(setProviderStats).catch(console.error); }, []);
  useEffect(() => { getDashboardHealth().then(setHealth).catch(console.error); }, []);
  useEffect(() => { getWeeklyActivity().then(setWeeklyActivity).catch(console.error); }, []);

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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={() => navigate("/projects/new")}>
            <FolderPlus size={12} />
            New Project
          </Button>
          <Button variant="primary" size="md" onClick={() => navigate("/craft")}>
            <Plus size={12} />
            Craft Prompt
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-12 min-w-0">
        <div className="flex items-center justify-end gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-48 pl-7 pr-3 rounded-sm bg-transparent font-mono text-[11px] text-soft-white placeholder:text-dim focus:outline-none focus:w-64 transition-all duration-200"
              style={{ border: "var(--border-default)" }}
            />
          </div>
          {search && (
            <button type="button" onClick={() => setSearch("")} className="font-mono text-[10px] text-muted hover:text-white">
              Clear
            </button>
          )}
        </div>

        {/* First-run onboarding */}
        {!loading && stats.total_prompts === 0 && (
          <FirstRunGuide
            onCraft={() => navigate("/craft")}
            onImport={() => navigate("/import")}
          />
        )}

        {/* Library totals */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 min-w-0">
          <StatModule label="TOTAL PROMPTS" value={stats.total_prompts} sub="IN LIBRARY" />
          <StatModule label="TOTAL RESULTS" value={resultStats.total} sub="GENERATED" />
          <StatModule label="WINNERS" value={resultStats.winners} sub="FLAGGED" />
          <StatModule
            label="WIN RATE"
            value={resultStats.total > 0 ? `${Math.round((resultStats.winners / resultStats.total) * 100)}%` : "—"}
            sub="RESULTS → WINNERS"
          />
          <StatModule
            label="NO RESULTS"
            value={promptsWithoutResults}
            sub="PROMPTS UNGENERATED"
          />
        </div>

        {/* Recent Wins */}
        {recentWins.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="system-label flex items-center gap-1.5"><Star size={10} className="text-amber fill-amber/30" /> RECENT WINS</span>
              <div className="flex-1 h-px bg-white/10" />
              <button type="button" onClick={() => navigate("/results?filter=winner")}
                className="font-mono text-[8px] uppercase tracking-widest text-dim/50 hover:text-white flex items-center gap-1 transition-precise">
                View all <ArrowRight size={8} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentWins.map((r) => (
                <button key={r.id} type="button"
                  onClick={() => navigate(`/results/view/${r.id}`)}
                  className="group flex flex-col gap-2 rounded-card overflow-hidden text-left transition-precise hover:-translate-y-0.5"
                  style={{ border: "1px solid rgba(255,193,7,0.18)", background: "var(--surface-card)" }}>
                  <div className="w-full aspect-video bg-black/40 overflow-hidden">
                    <ResultThumb result={r} promptId={r.prompt_id} />
                  </div>
                  <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
                    <span className="font-mono text-[10px] text-soft-white truncate">{r.prompt_title}</span>
                    {r.score_overall > 0 && (
                      <span className="font-mono text-[9px] text-amber">{r.score_overall}/5</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top tags */}
        {topTags.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="system-label">TOP TAGS</span>
              <div className="flex-1 h-px bg-white/10" />
              <button type="button" onClick={() => navigate("/library")}
                className="font-mono text-[8px] uppercase tracking-widest text-dim/50 hover:text-white flex items-center gap-1 transition-precise">
                Browse <ArrowRight size={8} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigate(`/library?tag=${encodeURIComponent(tag)}`)}
                  className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-2.5 py-1.5 rounded-sm text-readable hover:text-cyan hover:border-cyan/35 transition-precise"
                  style={{ border: "var(--border-dim)" }}
                >
                  {tag}
                  <span className="text-dim/40 text-[9px]">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Provider performance */}
        {providerStats.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="system-label">PROVIDER PERFORMANCE</span>
              <div className="flex-1 h-px bg-white/10" />
              <span className="font-mono text-[8px] text-dim/40 uppercase tracking-widest">WIN RATE BY PROVIDER</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {providerStats.map(({ provider, total, winners, win_rate }) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => navigate(`/library?provider=${encodeURIComponent(provider)}`)}
                  className="flex flex-col gap-2 p-3 rounded-card text-left transition-precise hover:bg-cyan/6 hover:border-cyan/30 group"
                  style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
                >
                  <ProviderBadge provider={provider as import("@/types").Provider} />
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">WIN RATE</span>
                      <span className="font-mono text-[11px] font-medium text-amber">{win_rate}%</span>
                    </div>
                    {/* progress bar */}
                    <div className="h-0.5 rounded-full w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-0.5 rounded-full bg-amber/60 transition-all"
                        style={{ width: `${win_rate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="font-mono text-[8px] text-dim/40">{total} prompts</span>
                      <span className="font-mono text-[8px] text-dim/40">{winners} wins</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Production health — activity this week */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="system-label flex items-center gap-1.5"><TrendingUp size={10} /> PRODUCTION HEALTH</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className="font-mono text-[8px] text-dim/40 uppercase tracking-widest">THIS WEEK</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <HealthChip label="PROMPTS CRAFTED" value={health.promptsThisWeek} unit="prompts" />
            <HealthChip label="RESULTS REVIEWED" value={health.resultsThisWeek} unit="results" />
            <HealthChip label="WIN RATE" value={`${health.winRate}%`} />
            <HealthChip
              label="NEEDS REVIEW"
              value={health.pendingReviewCount}
              unit={health.pendingReviewCount === 1 ? "result" : "results"}
              alert={health.pendingReviewCount > 0}
            />
            <HealthChip label="ACTIVE PROJECTS" value={health.activeProjectCount} unit="projects" />
            <HealthChip label="QUEUE DEPTH" value={health.queueDepth} unit="pending" alert={health.queueDepth > 5} />
            <ActivityChip data={weeklyActivity} />
          </div>
        </div>

        {/* Continue where you left off */}
        {health.lastTouchedPrompt && (
          <button
            type="button"
            onClick={() => navigate(`/library/${health.lastTouchedPrompt!.id}`)}
            className="flex items-center justify-between gap-4 w-full px-5 py-4 rounded-card text-left transition-precise hover:bg-cyan/6 hover:border-cyan/30 group"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="system-label text-dim/50">CONTINUE WHERE YOU LEFT OFF</span>
              <span className="font-sans text-[15px] font-medium text-white truncate">{health.lastTouchedPrompt.title}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[10px] text-readable uppercase tracking-widest">{health.lastTouchedPrompt.provider}</span>
                {health.lastTouchedPrompt.is_winner && <Star size={10} className="text-amber fill-amber/40" />}
                <span className="font-mono text-[10px] text-dim/50">{formatDate(health.lastTouchedPrompt.updated_at)}</span>
              </div>
            </div>
            <ArrowRight size={16} className="text-dim/40 group-hover:text-white transition-precise shrink-0" />
          </button>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 min-w-0">
          {/* Recent Prompts */}
          <div className="xl:col-span-2 min-w-0">
            <Card>
              <CardHeader
                label="Recent Prompts"
                count={stats.recent_prompts.length}
                action={
                  <div className="flex items-center gap-2">
                    <Button variant="muted" size="sm" onClick={() => navigate("/library")}>
                      View All
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRecentPromptsOpen((v) => !v)}
                      className="text-dim/40 hover:text-white transition-precise p-1"
                      title={recentPromptsOpen ? "Collapse" : "Expand"}
                    >
                      <ChevronDown size={12} className={`transition-transform duration-200 ${recentPromptsOpen ? "" : "-rotate-90"}`} />
                    </button>
                  </div>
                }
              />
              {recentPromptsOpen && (
                <CardBody>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="font-ndot text-[24px] text-dim/30">···</span>
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
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Recent Results — top, aligns with Recent Prompts */}
            <Card>
              <CardHeader
                label="Recent Results"
                action={<StatusDot active={recentResults.length > 0} />}
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

            {/* Active Projects */}
            {health.activeProjects.length > 0 && (
              <Card>
                <CardHeader
                  label="Active Projects"
                  count={health.activeProjectCount}
                  action={
                    <Button variant="muted" size="sm" onClick={() => navigate("/projects")}>
                      View All
                    </Button>
                  }
                />
                <CardBody>
                  <div className="flex flex-col">
                    {health.activeProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-left transition-precise hover:bg-cyan/6 hover:text-cyan rounded-sm"
                        style={{ borderBottom: "var(--border-dim)" }}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-sans text-[12px] text-white/90 truncate">{p.title}</span>
                          {p.client && <span className="font-mono text-[9px] text-muted truncate">{p.client}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[9px] text-dim/50">{p.prompt_count}p</span>
                          <FolderKanban size={10} className="text-dim/40" />
                        </div>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Needs Review */}
            {health.pendingResults.length > 0 && (
              <Card>
                <CardHeader
                  label="Needs Review"
                  action={<AlertCircle size={12} className="text-red/60" />}
                />
                <CardBody>
                  <div className="flex flex-col">
                    {health.pendingResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => navigate(`/results/${r.prompt_id}`)}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-left transition-precise hover:bg-cyan/6 hover:text-cyan rounded-sm"
                        style={{ borderBottom: "var(--border-dim)" }}
                      >
                        <span className="font-sans text-[12px] text-white/80 truncate">{r.prompt_title}</span>
                        <span className="font-mono text-[9px] text-muted shrink-0">Rate →</span>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Top Proven Tokens */}
            {health.topProvenTokens.length > 0 && (
              <Card>
                <CardHeader label="Proven Tokens" action={<Zap size={11} className="text-white/40" />} />
                <CardBody>
                  <div className="flex flex-col gap-0">
                    {health.topProvenTokens.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                        style={{ borderBottom: "var(--border-dim)" }}
                      >
                        <span className="font-mono text-[11px] text-white/80 truncate">{t.text}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/50" />
                          <span className="font-mono text-[9px] text-dim tabular-nums">{t.quality_score.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Winner Token Correlations */}
            {health.winnerTokens.length > 0 && (
              <Card>
                <CardHeader
                  label="Winner Tokens"
                  action={<Star size={11} className="text-amber fill-amber/30" />}
                />
                <CardBody>
                  <div className="flex flex-col gap-0">
                    {health.winnerTokens.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 px-4 py-2"
                        style={{ borderBottom: "var(--border-dim)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-dim/30 w-4 text-right shrink-0">{i + 1}</span>
                          <span className="font-mono text-[11px] text-soft-white truncate">{t.text}</span>
                        </div>
                        <span className="font-mono text-[9px] text-amber/60 shrink-0">{t.win_appearances}★</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate("/tokens")}
                      className="font-mono text-[9px] text-dim/50 hover:text-white transition-precise"
                    >
                      View all tokens →
                    </button>
                  </div>
                </CardBody>
              </Card>
            )}

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
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <span className="system-label">QUICK ACTIONS</span>
          <div className="flex-1 h-px bg-white/16" />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/queue")}>
              <ListChecks size={11} />
              Queue {health.queueDepth > 0 && <span className="font-mono text-[9px] text-cyan/80 ml-0.5">({health.queueDepth})</span>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/import")}>
              <BookMarked size={11} />
              Import
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
