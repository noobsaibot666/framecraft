import { PageContainer } from "@/components/layout/PageContainer";
import { DotMatrix } from "@/components/ui/DotMatrix";

export function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <DotMatrix value="—" size="xl" muted />
        <span className="system-label">COMING IN NEXT PHASE</span>
        <span className="font-mono text-[11px] text-dim text-center max-w-xs leading-relaxed">
          This section is planned and documented in{" "}
          <span className="text-muted">_dev-docs</span>. Build Phase 01 first.
        </span>
      </div>
    </PageContainer>
  );
}
