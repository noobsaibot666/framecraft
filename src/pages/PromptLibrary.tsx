import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PromptLibrary() {
  const navigate = useNavigate();

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
      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 relative">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
          />
          <Input
            placeholder="Search prompts…"
            className="pl-8"
          />
        </div>
        <Button variant="ghost" size="md">
          <Filter size={12} />
          Filter
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="flex flex-col items-center gap-3 p-8 rounded-[10px] max-w-sm"
          style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
        >
          <span className="font-ndot text-[48px] text-dim/40">000</span>
          <span className="system-label">LIBRARY EMPTY</span>
          <span className="font-mono text-[11px] text-dim text-center leading-relaxed">
            No prompts stored yet. Craft your first prompt or import one from an external source.
          </span>
          <div className="flex gap-2 mt-2">
            <Button variant="primary" size="sm" onClick={() => navigate("/craft")}>
              Craft Prompt
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/import")}>
              Import
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
