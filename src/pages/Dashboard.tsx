import { useNavigate } from "react-router-dom";
import { Plus, Star, Clock, BookMarked, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DotMatrix } from "@/components/ui/DotMatrix";
import { StatusDot } from "@/components/ui/StatusDot";

function StatModule({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
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

export function Dashboard() {
  const navigate = useNavigate();

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
      <div className="flex flex-col gap-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          <StatModule label="TOTAL PROMPTS" value={0} sub="IN LIBRARY" />
          <StatModule label="TOTAL RESULTS" value={0} sub="GENERATED" />
          <StatModule label="WINNERS" value={0} sub="FLAGGED" />
          <StatModule label="RECIPES" value={0} sub="STORED" />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent Prompts */}
          <div className="col-span-2">
            <Card>
              <CardHeader
                label="Recent Prompts"
                count={0}
                action={
                  <Button variant="muted" size="sm" onClick={() => navigate("/library")}>
                    View All
                  </Button>
                }
              />
              <CardBody>
                <EmptyState
                  icon={<Clock size={20} className="text-dim" />}
                  label="No prompts yet"
                  action="Craft your first prompt to get started."
                  cta="Craft Prompt"
                  onCta={() => navigate("/craft")}
                />
              </CardBody>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Top Rated */}
            <Card>
              <CardHeader label="Top Rated" action={<Star size={12} className="text-dim" />} />
              <CardBody>
                <EmptyState
                  icon={<Star size={16} className="text-dim" />}
                  label="Rate your results"
                  compact
                />
              </CardBody>
            </Card>

            {/* AI-Look Watchlist */}
            <Card>
              <CardHeader
                label="Risk Watchlist"
                action={<StatusDot active={false} />}
              />
              <CardBody>
                <EmptyState
                  icon={<TrendingUp size={16} className="text-dim" />}
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
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? "py-4" : "py-8"}`}
    >
      {icon}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[12px] text-muted">{label}</span>
        {action && (
          <span className="font-mono text-[10px] text-dim">{action}</span>
        )}
      </div>
      {cta && onCta && (
        <Button variant="ghost" size="sm" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}
