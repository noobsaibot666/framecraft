import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertTriangle, ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { usePromptStore } from "@/stores/usePromptStore";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";

// ─── Parameter Detection ──────────────────────────────────────

interface DetectedParams {
  aspect_ratio?: string;
  model_version?: string;
  stylize?: string;
  sref?: string;
  chaos?: string;
  quality?: string;
  weird?: string;
  no?: string;
}

function detectMidjourneyParams(text: string): DetectedParams {
  const params: DetectedParams = {};
  const ar = text.match(/--ar\s+([\d:]+)/);
  if (ar) params.aspect_ratio = ar[1];
  const v = text.match(/--v\s+(\S+)/);
  if (v) params.model_version = v[1];
  const s = text.match(/--s(?:tylize)?\s+(\d+)/);
  if (s) params.stylize = s[1];
  const sref = text.match(/--sref\s+(\S+)/);
  if (sref) params.sref = sref[1];
  const chaos = text.match(/--chaos\s+(\d+)/);
  if (chaos) params.chaos = chaos[1];
  const q = text.match(/--q(?:uality)?\s+(\S+)/);
  if (q) params.quality = q[1];
  const weird = text.match(/--weird\s+(\d+)/);
  if (weird) params.weird = weird[1];
  const no = text.match(/--no\s+([^-]+)/);
  if (no) params.no = no[1].trim();
  return params;
}

function stripParams(text: string): string {
  return text
    .replace(/--ar\s+[\d:]+/g, "")
    .replace(/--v\s+\S+/g, "")
    .replace(/--s(?:tylize)?\s+\d+/g, "")
    .replace(/--sref\s+\S+/g, "")
    .replace(/--chaos\s+\d+/g, "")
    .replace(/--q(?:uality)?\s+\S+/g, "")
    .replace(/--weird\s+\d+/g, "")
    .replace(/--no\s+[^-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Provider detection hint ──────────────────────────────────

function detectProvider(text: string): Provider {
  if (text.includes("--v ") || text.includes("--sref") || text.includes("--ar")) return "midjourney";
  if (text.toLowerCase().includes("dall-e") || text.toLowerCase().includes("dalle")) return "dalle";
  return "midjourney";
}

// ─── Select ──────────────────────────────────────────────────

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pr-7 h-8 px-3 font-mono text-[12px] text-white bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Tag Input ────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const commit = (raw: string) => {
    const parts = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    onChange([...new Set([...tags, ...parts])]);
    setInput("");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label">TAGS</label>
      <div
        className="flex flex-wrap gap-1.5 p-2 rounded-sm min-h-9"
        style={{ border: "1px solid rgba(255,255,255,0.10)", background: "var(--color-dark)" }}
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border border-white/10 text-dim">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-dim/50 hover:text-red transition-precise leading-none">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (input.trim()) commit(input); }
            else if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => { if (input.trim()) commit(input); }}
          placeholder={tags.length ? "" : "Type tag + Enter…"}
          className="flex-1 min-w-16 bg-transparent font-mono text-[10px] text-soft-white placeholder:text-dim/40 outline-none"
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "midjourney", label: "Midjourney" },
  { value: "dalle", label: "DALL·E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
  { value: "firefly", label: "Firefly" },
  { value: "ideogram", label: "Ideogram" },
  { value: "flux", label: "Flux" },
  { value: "other", label: "Other" },
];

export function ManualImport() {
  const navigate = useNavigate();
  const { create } = usePromptStore();

  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState<Provider>("midjourney");
  const [tags, setTags] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedParams>({});
  const [analyzed, setAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = useCallback(() => {
    if (!raw.trim()) return;
    const params = detectMidjourneyParams(raw);
    const autoProvider = detectProvider(raw);
    setDetected(params);
    setProvider(autoProvider);
    setAnalyzed(true);
  }, [raw]);

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!raw.trim()) { setError("Prompt text is required"); return; }
    setError("");
    setSaving(true);

    const clean = stripParams(raw);
    const params = detectMidjourneyParams(raw);

    try {
      const id = await create({
        title: title.trim(),
        provider,
        prompt_text: clean || raw,
        aspect_ratio: params.aspect_ratio,
        model_version: params.model_version,
        tags: tags.length ? tags : undefined,
      });
      navigate(`/library/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const paramCount = Object.keys(detected).filter((k) => detected[k as keyof DetectedParams]).length;

  return (
    <PageContainer
      title="Manual Import"
      subtitle="PASTE & IMPORT EXTERNAL PROMPT"
      action={
        <Button variant="primary" size="md" onClick={handleSave} disabled={saving || !raw.trim()}>
          <Upload size={11} />
          {saving ? "Importing…" : "Import to Library"}
        </Button>
      }
    >
      <div className="flex gap-6 min-w-0">
        {/* Left: Paste area */}
        <div className="flex flex-col gap-5 flex-1 min-w-0">

          {/* Paste area */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">PASTE PROMPT</span>
              {raw.trim() && !analyzed && (
                <Button variant="ghost" size="sm" onClick={handleAnalyze}>
                  Detect Parameters
                </Button>
              )}
              {analyzed && paramCount > 0 && (
                <span className="font-mono text-[9px] text-white/50">
                  {paramCount} parameter{paramCount > 1 ? "s" : ""} detected
                </span>
              )}
            </div>
            <Textarea
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setAnalyzed(false);
                setDetected({});
              }}
              placeholder="Paste your full prompt here, including any --parameters flags…"
              rows={8}
              mono
            />
          </div>

          {/* Detected parameters */}
          {analyzed && paramCount > 0 && (
            <div
              className="flex flex-col gap-3 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
            >
              <span className="system-label">DETECTED PARAMETERS</span>
              <div className="flex flex-wrap gap-2">
                {detected.aspect_ratio && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--ar</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.aspect_ratio}</span>
                  </div>
                )}
                {detected.model_version && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--v</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.model_version}</span>
                  </div>
                )}
                {detected.stylize && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--s</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.stylize}</span>
                  </div>
                )}
                {detected.sref && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--sref</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.sref}</span>
                  </div>
                )}
                {detected.chaos && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--chaos</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.chaos}</span>
                  </div>
                )}
                {detected.quality && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--q</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.quality}</span>
                  </div>
                )}
                {detected.weird && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default">--weird</Badge>
                    <span className="font-mono text-[10px] text-soft-white">{detected.weird}</span>
                  </div>
                )}
              </div>
              {detected.no && (
                <div className="flex items-start gap-1.5">
                  <Badge variant="default" severity="medium">--no</Badge>
                  <span className="font-mono text-[10px] text-muted leading-relaxed">{detected.no}</span>
                </div>
              )}
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
                Parameters will be stored separately. The clean prompt text will be saved to the prompt field.
              </p>
            </div>
          )}

          {analyzed && paramCount === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
              style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}>
              <AlertTriangle size={10} className="text-dim" />
              <span className="font-mono text-[10px] text-dim">
                No Midjourney parameters detected. Prompt will be imported as-is.
              </span>
            </div>
          )}

          {/* Clean preview */}
          {analyzed && raw.trim() && (
            <div className="flex flex-col gap-2">
              <span className="system-label">CLEAN PROMPT PREVIEW</span>
              <div
                className="p-3 rounded-sm"
                style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
              >
                <pre className="font-mono text-[11px] text-soft-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">
                  {stripParams(raw) || raw}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata */}
        <div className="flex flex-col gap-4 w-64 shrink-0">
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">PROMPT METADATA</span>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <label className="system-label">TITLE</label>
                {error && !title.trim() && <span className="font-mono text-[9px] text-red/80">Required</span>}
              </div>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                placeholder="Name this prompt…"
                className={cn(
                  "w-full h-8 px-3 font-sans text-[12px] text-white placeholder:text-dim",
                  "bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                )}
                style={{ border: !title.trim() && error ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>

            <FieldSelect
              label="PROVIDER"
              value={provider}
              onChange={(v) => setProvider(v as Provider)}
              options={PROVIDERS}
            />

            <TagInput tags={tags} onChange={setTags} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
              style={{ border: "var(--border-active)", background: "rgba(215,25,33,0.06)" }}>
              <AlertTriangle size={10} className="text-red/60" />
              <span className="font-mono text-[10px] text-red/80">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {raw.trim() && !analyzed && (
              <Button variant="ghost" size="sm" className="w-full justify-center" onClick={handleAnalyze}>
                Detect Parameters
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving || !raw.trim()}
              className="w-full justify-center"
            >
              <Upload size={11} />
              {saving ? "Importing…" : "Import to Library"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/library")}
              className="w-full justify-center"
            >
              Cancel
            </Button>
          </div>

          {/* Tip */}
          <div
            className="flex flex-col gap-2 p-3 rounded-card"
            style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
          >
            <span className="system-label text-[8px]">IMPORT TIPS</span>
            <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
              Paste the full prompt including any --flags. Framecraft will detect and extract Midjourney parameters automatically.
            </p>
            <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
              After import, edit the prompt to add ratings, avoidance notes, and tags.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
