import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, FileText } from "lucide-react";
import { copyToClipboard } from "@/lib/cinemaExport";
import { useToastStore } from "@/stores/useToastStore";

interface Props {
  scriptContent?: string;
  title?: string;
  defaultExpanded?: boolean;
}

export function ScriptPreviewPanel({ scriptContent, title = "SCRIPT", defaultExpanded = true }: Props) {
  const toast = useToastStore((s) => s.add);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleCopy = async () => {
    if (!scriptContent?.trim()) return;
    try {
      await copyToClipboard(scriptContent);
      toast("Script copied to clipboard", "success");
    } catch {
      toast("Failed to copy — your browser may block clipboard access here", "error");
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group flex-1 min-w-0"
        >
          <FileText size={12} className="text-cyan shrink-0" />
          <span className="system-label text-[11px]">{title}</span>
          {expanded ? <ChevronDown size={13} className="text-muted group-hover:text-white transition-precise" /> : <ChevronRight size={13} className="text-muted group-hover:text-white transition-precise" />}
        </button>
        {scriptContent?.trim() && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy script text"
            className="text-muted hover:text-cyan transition-precise shrink-0"
          >
            <Copy size={11} />
          </button>
        )}
      </div>
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
