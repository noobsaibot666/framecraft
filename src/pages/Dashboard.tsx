import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Star, Clock, BookMarked } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProviderBadge } from "@/components/ui/Badge";
import { useDashboardStore } from "@/stores/useDashboardStore";
import { formatDate } from "@/lib/utils";
import type { Prompt } from "@/types";

function StatModule({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      <span className="system-label">{label}</span>
      <DotMatrix value={value} size="lg" />
      {sub && <span className="system-label text-[8px]">{sub}</span>}
    </div>
  );
}

function PromptRow({ prompt, onClick }: { prompt: Prompt; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm text-left transition-precise hover:bg-white/4"
      style={{ borderBottom: "var(--border-dim)" }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-sans text-[11px] text-white truncate">{prompt.title}</span>
        <span className="font-mono text-[9px] text-dim">{formatDate(prompt.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ProviderBadge provider={prompt.provider} />
        {prompt.is_winner && <Star size={9} className="text-white/30" />}
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
        <span className="font-sans text-[12px] text-muted">{label}</span>
        {action && <span className="font-mono text-[10px] text-dim">{action}</span>}
      </div>
      {cta && onCta && (
        <Button variant="ghost" size="sm" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading, fetchStats } = useDashboardStore();

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
      <div className="flex flex-col gap-6 min-w-0">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 min-w-0">
          <StatModule label="TOTAL PROMPTS" value={stats.total_prompts} sub="IN LIBRARY" />
          <StatModule label="TOTAL RESULTS" value={stats.total_results} sub="GENERATED" />
          <StatModule label="WINNERS" value={stats.total_winners} sub="FLAGGED" />
          <StatModule label="RECIPES" value={stats.total_recipes} sub="STORED" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-4 min-w-0">
          {/* Recent Prompts */}
          <div className="col-span-2 min-w-0">
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
                    {stats.recent_prompts.map((p) => (
                      <PromptRow key={p.id} prompt={p} onClick={() => navigate(`/library/${p.id}`)} />
                    ))}
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
          <div className="flex flex-col gap-4">
            {/* Top Rated */}
            <Card>
              <CardHeader label="Top Rated" action={<Star size={12} className="text-dim" />} />
              <CardBody>
                {stats.top_rated.length > 0 ? (
                  <div className="flex flex-col">
                    {stats.top_rated.map((p) => (
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

            {/* Risk Watchlist */}
            <Card>
              <CardHeader label="Risk Watchlist" action={<StatusDot active={false} />} />
              <CardBody>
                <EmptyState
                  icon={<Star size={16} className="text-dim" />}
                  label="No high-risk prompts"
                  compact
                />
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <span className="system-label">QUICK ACTIONS</span>
          <div className="flex-1 h-px bg-white/7" />
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
