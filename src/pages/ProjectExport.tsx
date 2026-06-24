import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, FileText, Code2, Globe,
  Check, AlertTriangle,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  buildReport,
  reportToMarkdown,
  reportToJSON,
  reportToHTML,
  downloadText,
  slugify,
  type ExportReport,
  type ExportFormat,
} from "@/lib/exportReport";
import { cn } from "@/lib/utils";

// ─── Format option ────────────────────────────────────────────

const FORMATS: { id: ExportFormat; label: string; ext: string; mime: string; icon: typeof FileText; description: string }[] = [
  {
    id: "markdown",
    label: "Markdown",
    ext: "md",
    mime: "text/markdown",
    icon: FileText,
    description: "Human-readable report. Works in any Markdown viewer.",
  },
  {
    id: "json",
    label: "JSON",
    ext: "json",
    mime: "application/json",
    icon: Code2,
    description: "Structured data export. Can be re-imported or processed.",
  },
  {
    id: "html",
    label: "Print / HTML",
    ext: "html",
    mime: "text/html",
    icon: Globe,
    description: "Printable report. Open in browser and print to PDF.",
  },
];

// ─── Stats row ────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5"
      style={{ borderBottom: "var(--border-dim)" }}>
      <span className="font-mono text-[9px] text-dim/50 uppercase tracking-widest">{label}</span>
      <span className="font-mono text-[10px] text-soft-white">{value}</span>
    </div>
  );
}

// ─── Preview pane ─────────────────────────────────────────────

function PreviewPane({ report, format }: { report: ExportReport; format: ExportFormat }) {
  const text = format === "markdown"
    ? reportToMarkdown(report)
    : format === "json"
    ? reportToJSON(report)
    : reportToHTML(report);

  if (format === "html") {
    return (
      <div className="flex flex-col gap-2">
        <span className="system-label">HTML PREVIEW</span>
        <div className="rounded-sm overflow-hidden" style={{ border: "var(--border-default)" }}>
          <iframe
            srcDoc={text}
            title="HTML preview"
            className="w-full bg-white"
            style={{ height: "500px", border: "none" }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="system-label">
        {format === "markdown" ? "MARKDOWN PREVIEW" : "JSON PREVIEW"}
      </span>
      <pre className="overflow-auto rounded-sm p-4 font-mono text-[10px] text-soft-white/70 leading-relaxed max-h-[500px]"
        style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
        {text}
      </pre>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ProjectExport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<ExportReport | null>(null);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await buildReport(id);
    setReport(r);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = () => {
    if (!report) return;
    const slug = slugify(report.project.title);
    const f = FORMATS.find((x) => x.id === format)!;
    const content = format === "markdown"
      ? reportToMarkdown(report)
      : format === "json"
      ? reportToJSON(report)
      : reportToHTML(report);
    downloadText(content, `${slug}-report.${f.ext}`, f.mime);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const handleOpenPrint = () => {
    if (!report) return;
    const html = reportToHTML(report);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    } else {
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <PageContainer title="EXPORT">
        <div className="flex items-center justify-center py-32">
          <span className="font-ndot text-[32px] text-dim/30 dot-blink">···</span>
        </div>
      </PageContainer>
    );
  }

  if (!report) {
    return (
      <PageContainer title="EXPORT">
        <div className="flex items-center gap-2 py-12">
          <AlertTriangle size={12} className="text-red/50" />
          <span className="font-mono text-[10px] text-red/50">Project not found.</span>
        </div>
      </PageContainer>
    );
  }

  const { project: proj, prompts, results, references, deliverables } = report;
  const winners = prompts.filter((p) => p.is_winner).length;
  const failed = prompts.filter((p) => p.is_failed).length;

  return (
    <PageContainer
      title="EXPORT"
      subtitle={proj.title.toUpperCase()}
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft size={11} /> Project
        </Button>
      }
    >
      <div className="flex gap-6">

        {/* Left: settings */}
        <div className="w-[260px] shrink-0 flex flex-col gap-5">

          {/* Project stats */}
          <div className="flex flex-col gap-0">
            <span className="system-label mb-2">PROJECT SUMMARY</span>
            <StatRow label="Prompts" value={prompts.length} />
            <StatRow label="Winners" value={winners} />
            <StatRow label="Failed" value={failed} />
            <StatRow label="Results" value={results.length} />
            <StatRow label="References" value={references.length} />
            <StatRow label="Deliverables" value={deliverables.length} />
            <StatRow label="Suggestions" value={report.suggestions.length} />
          </div>

          {/* Format selector */}
          <div className="flex flex-col gap-2">
            <span className="system-label">EXPORT FORMAT</span>
            {FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-sm text-left transition-precise",
                    format === f.id
                      ? "bg-white/8"
                      : "hover:bg-white/4"
                  )}
                  style={{ border: format === f.id ? "1px solid rgba(255,255,255,0.15)" : "var(--border-dim)" }}
                >
                  <Icon size={12} className={cn("mt-0.5 shrink-0", format === f.id ? "text-white/70" : "text-dim/30")} />
                  <div className="flex flex-col gap-0.5">
                    <span className={cn("font-sans text-[11px] font-medium", format === f.id ? "text-white" : "text-dim/60")}>
                      {f.label}
                    </span>
                    <span className="font-mono text-[8px] text-dim/30">{f.description}</span>
                  </div>
                  {format === f.id && (
                    <Check size={9} className="text-white/50 ml-auto mt-0.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              className="w-full justify-center"
            >
              {downloaded
                ? <><Check size={10} /> Downloaded</>
                : <><Download size={10} /> Download {FORMATS.find((f) => f.id === format)?.label}</>
              }
            </Button>
            {format === "html" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenPrint}
                className="w-full justify-center text-dim"
              >
                <Globe size={10} /> Open for Print / PDF
              </Button>
            )}
          </div>

          {/* Offline note */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-sm"
            style={{ border: "var(--border-dim)", background: "transparent" }}>
            <Check size={8} className="text-dim/30 mt-0.5 shrink-0" />
            <span className="font-mono text-[8px] text-dim/30 leading-snug">
              Export works fully offline. No API keys required.
            </span>
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex-1 min-w-0">
          <PreviewPane report={report} format={format} />
        </div>
      </div>
    </PageContainer>
  );
}
