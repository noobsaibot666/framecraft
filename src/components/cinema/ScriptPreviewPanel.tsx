import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

interface Props {
  scriptContent?: string;
  title?: string;
  defaultExpanded?: boolean;
}

export function ScriptPreviewPanel({ scriptContent, title = "SCRIPT", defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2">
          <FileText size={12} className="text-cyan" />
          <span className="system-label text-[11px]">{title}</span>
        </div>
        {expanded ? <ChevronDown size={13} className="text-muted group-hover:text-white transition-precise" /> : <ChevronRight size={13} className="text-muted group-hover:text-white transition-precise" />}
      </button>
      {expanded && (
        scriptContent?.trim() ? (
          <p className="font-mono text-[11.5px] text-readable leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {scriptContent}
          </p>
        ) : (
          <span className="font-mono text-[11px] text-muted">No script yet — write one in Script Studio.</span>
        )
      )}
    </div>
  );
}
