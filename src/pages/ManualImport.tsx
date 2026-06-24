import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertTriangle, ChevronDown, Layers, X, Check } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { usePromptStore } from "@/stores/usePromptStore";
import { getSREFByCode, createSREF } from "@/lib/db";
import { findSimilarPrompts } from "@/lib/memoryEngine";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";

// ─── Parameter Detection ──────────────────────────────────────

interface DetectedParams {
  aspect_ratio?: string;
  model_version?: string;
  stylize?: string;
  chaos?: string;
  weird?: string;
  quality?: string;
  style?: string;
  sw?: string;
  sv?: string;
  seed?: string;
  zoom?: string;
  stop?: string;
  repeat?: string;
  sref?: string;
  profile?: string;
  no?: string;
  raw?: boolean;
  hd?: boolean;
  tile?: boolean;
  fast?: boolean;
  relax?: boolean;
  preview?: boolean;
  exp?: boolean;
}

// All params support both long and short MJ aliases:
//   --chaos / --c   --weird / --w   --stylize / --s   --quality / --q
//   --repeat / --r  --version / --v   --profile / --p
function detectMidjourneyParams(text: string): DetectedParams {
  const dp: DetectedParams = {};
  const m = (re: RegExp) => text.match(re);
  const ar  = m(/--ar\s+([\d:]+)/);                         if (ar)  dp.aspect_ratio  = ar[1];
  const v   = m(/--v(?:ersion)?\s+(\S+)/);                  if (v)   dp.model_version = v[1];
  const s   = m(/--s(?:tylize)?\s+(\d+)/);                  if (s)   dp.stylize       = s[1];
  const c   = m(/--c(?:haos)?\s+(\d+)/);                    if (c)   dp.chaos         = c[1];
  const w   = m(/--w(?:eird)?\s+(\d+)/);                    if (w)   dp.weird         = w[1];
  const q   = m(/--q(?:uality)?\s+(\S+)/);                  if (q)   dp.quality       = q[1];
  const st  = m(/--style\s+(\S+)/);                         if (st)  dp.style         = st[1];
  const sw  = m(/--sw\s+(\d+)/);                            if (sw)  dp.sw            = sw[1];
  const sv  = m(/--sv\s+(\d+)/);                            if (sv)  dp.sv            = sv[1];
  const sd  = m(/--seed\s+(\d+)/);                          if (sd)  dp.seed          = sd[1];
  const zo  = m(/--zoom\s+(\S+)/);                          if (zo)  dp.zoom          = zo[1];
  const sp  = m(/--stop\s+(\d+)/);                          if (sp)  dp.stop          = sp[1];
  const rp  = m(/--r(?:epeat)?\s+(\d+)/);                   if (rp)  dp.repeat        = rp[1];
  // --sref with optional value (bare --sref at end of string is valid)
  const sr  = m(/--sref(?:\s+([^\s-]\S*))?/);               if (sr)  dp.sref          = sr[1] ?? "";
  const pr  = m(/--profile\s+(\S+)|--p\s+(\S+)/);           if (pr)  dp.profile       = pr[1] ?? pr[2];
  const no  = m(/--no\s+([^-]+)/);                          if (no)  dp.no            = no[1].trim();
  // Boolean flags: \b doesn't work before -- (- is non-word char), use negative lookahead instead
  if (/--raw(?!\w)/.test(text))     dp.raw     = true;
  if (/--hd(?!\w)/.test(text))      dp.hd      = true;
  if (/--tile(?!\w)/.test(text))    dp.tile    = true;
  if (/--fast(?!\w)/.test(text))    dp.fast    = true;
  if (/--relax(?!\w)/.test(text))   dp.relax   = true;
  if (/--preview(?!\w)/.test(text)) dp.preview = true;
  if (/-{1,2}exp(?!\w)/.test(text)) dp.exp     = true;
  return dp;
}

function stripParams(text: string): string {
  return text
    .replace(/--ar\s+[\d:]+/g, "")
    .replace(/--v(?:ersion)?\s+\S+/g, "")
    .replace(/--s(?:tylize)?\s+\d+/g, "")
    .replace(/--c(?:haos)?\s+\d+/g, "")
    .replace(/--w(?:eird)?\s+\d+/g, "")
    .replace(/--q(?:uality)?\s+\S+/g, "")
    .replace(/--style\s+\S+/g, "")
    .replace(/--sw\s+\d+/g, "")
    .replace(/--sv\s+\d+/g, "")
    .replace(/--seed\s+\d+/g, "")
    .replace(/--zoom\s+\S+/g, "")
    .replace(/--stop\s+\d+/g, "")
    .replace(/--r(?:epeat)?\s+\d+/g, "")
    .replace(/--sref(?:\s+\S+)?/g, "")
    .replace(/--profile\s+\S+/g, "")
    .replace(/--p\s+\S+/g, "")
    .replace(/--no\s+[^-]+/g, "")
    .replace(/--raw(?!\w)/g, "")
    .replace(/--hd(?!\w)/g, "")
    .replace(/--tile(?!\w)/g, "")
    .replace(/--fast(?!\w)/g, "")
    .replace(/--relax(?!\w)/g, "")
    .replace(/--preview(?!\w)/g, "")
    .replace(/-{1,2}exp(?!\w)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detectProvider(text: string): Provider {
  if (text.includes("--v ") || text.includes("--sref") || text.includes("--ar")) return "midjourney";
  if (text.toLowerCase().includes("dall-e") || text.toLowerCase().includes("dalle")) return "dalle";
  return "midjourney";
}

// ─── Tag Suggestion ───────────────────────────────────────────

const TAG_KEYWORD_MAP: Record<string, string[]> = {
  portrait:     ["woman", "man", "person", "face", "portrait", "model", "skin", "eyes"],
  product:      ["product", "packshot", "still life", "bottle", "cosmetics", "object"],
  fashion:      ["fashion", "clothing", "outfit", "style", "garment", "luxury", "wear"],
  advertising:  ["ad", "campaign", "brand", "commercial", "hero", "banner"],
  automotive:   ["car", "vehicle", "automobile", "road", "speed", "driving"],
  architecture: ["building", "interior", "architecture", "facade", "room", "space"],
  editorial:    ["editorial", "magazine", "lifestyle", "story", "narrative"],
  cinematic:    ["cinematic", "film", "dramatic", "scene", "shot", "movie"],
};

function suggestTags(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(TAG_KEYWORD_MAP)
    .filter(([, words]) => words.some((w) => lower.includes(w)))
    .map(([tag]) => tag);
}

// ─── Batch Import ─────────────────────────────────────────────

interface BatchItem {
  title: string;
  prompt_text: string;
  provider?: Provider;
  tags?: string[];
  notes?: string;
}

function parseBatchJson(raw: string): { items: BatchItem[]; error?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { items: [], error: "JSON must be an array [ ... ]" };
    const items: BatchItem[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || !item.prompt_text) continue;
      items.push({
        title: item.title || `Imported prompt ${items.length + 1}`,
        prompt_text: item.prompt_text,
        provider: item.provider,
        tags: Array.isArray(item.tags) ? item.tags : [],
        notes: item.notes,
      });
    }
    if (!items.length) return { items: [], error: "No valid items found. Each item needs a prompt_text field." };
    return { items };
  } catch {
    return { items: [], error: "Invalid JSON. Check your formatting." };
  }
}

// ─── Param badge helpers ──────────────────────────────────────

function ParamBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-dim/70"
        style={{ border: "var(--border-dim)" }}>{label}</span>
      <span className="font-mono text-[10px] text-soft-white">{value}</span>
    </div>
  );
}
function FlagBadge({ label }: { label: string }) {
  return (
    <span className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-white/50"
      style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.04)" }}>{label}</span>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pr-7 h-8 px-3 font-mono text-[12px] text-white bg-dark rounded-sm focus:outline-none transition-precise cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
      </div>
    </div>
  );
}

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
      <div className="flex flex-wrap gap-1.5 p-2 rounded-sm min-h-9"
        style={{ border: "1px solid rgba(255,255,255,0.10)", background: "var(--color-dark)" }}>
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border border-white/10 text-dim">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-dim/50 hover:text-red leading-none">×</button>
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (input.trim()) commit(input); }
            else if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => { if (input.trim()) commit(input); }}
          placeholder={tags.length ? "" : "Type tag + Enter…"}
          className="flex-1 min-w-16 bg-transparent font-mono text-[10px] text-soft-white placeholder:text-dim/40 outline-none" />
      </div>
    </div>
  );
}

// ─── MJ Source URL Parser ─────────────────────────────────────

function parseMJSourceUrl(url: string): { cdnUrl: string; jobId: string; index: number } | null {
  try {
    const u = new URL(url.trim());
    // alpha.midjourney.com/jobs/{uuid}  or  midjourney.com/jobs/{uuid}
    if (!u.hostname.endsWith("midjourney.com")) return null;
    const match = u.pathname.match(/\/jobs\/([0-9a-f-]{36})/i);
    if (!match) return null;
    const jobId = match[1];
    const index = parseInt(u.searchParams.get("index") ?? "0", 10);
    return { cdnUrl: `https://cdn.midjourney.com/${jobId}/0_${index}.png`, jobId, index };
  } catch {
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "midjourney", label: "Midjourney" },
  { value: "dalle", label: "DALL·E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
  { value: "firefly", label: "Firefly" },
  { value: "ideogram", label: "Ideogram" },
  { value: "flux", label: "Flux" },
  { value: "other", label: "Other" },
];

// ─── Main Component ───────────────────────────────────────────

export function ManualImport() {
  const navigate = useNavigate();
  const { create, prompts: allPrompts } = usePromptStore();

  // Mode
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single import state
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [provider, setProvider] = useState<Provider>("midjourney");
  const [tags, setTags] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedParams>({});
  const [analyzed, setAnalyzed] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<ReturnType<typeof findSimilarPrompts>>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Source URL preview
  const mjSource = useMemo(() => parseMJSourceUrl(source), [source]);
  useEffect(() => {
    if (mjSource) setProvider("midjourney");
  }, [mjSource]);

  // Batch import state
  const [batchJson, setBatchJson] = useState("");
  const [batchParsed, setBatchParsed] = useState<BatchItem[]>([]);
  const [batchError, setBatchError] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchDone, setBatchDone] = useState(0);

  const handleAnalyze = useCallback(() => {
    if (!raw.trim()) return;
    const params = detectMidjourneyParams(raw);
    const autoProvider = detectProvider(raw);
    setDetected(params);
    setProvider(autoProvider);
    setAnalyzed(true);
    const suggestions = suggestTags(raw).filter((t) => !tags.includes(t));
    setSuggestedTags(suggestions);
    const dups = findSimilarPrompts(raw, allPrompts, 0.55);
    setDuplicates(dups);
    setDuplicatesDismissed(false);
  }, [raw, tags, allPrompts]);

  const handleSave = async (asRecipe = false) => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!raw.trim()) { setError("Prompt text is required"); return; }
    setError("");
    setSaving(true);
    const clean = stripParams(raw);
    const params = detectMidjourneyParams(raw);
    try {
      const extraParams: Record<string, string | boolean> = {};
      if (params.stylize) extraParams.stylize = params.stylize;
      if (params.chaos)   extraParams.chaos   = params.chaos;
      if (params.weird)   extraParams.weird   = params.weird;
      if (params.quality) extraParams.quality = params.quality;
      if (params.style)   extraParams.style   = params.style;
      if (params.sw)      extraParams.sw      = params.sw;
      if (params.sv)      extraParams.sv      = params.sv;
      if (params.seed)    extraParams.seed    = params.seed;
      if (params.zoom)    extraParams.zoom    = params.zoom;
      if (params.stop)    extraParams.stop    = params.stop;
      if (params.repeat)  extraParams.repeat  = params.repeat;
      if (params.profile) extraParams.profile = params.profile;
      if (params.no)      extraParams.no      = params.no;
      if (params.raw)     extraParams.raw     = true;
      if (params.hd)      extraParams.hd      = true;
      if (params.tile)    extraParams.tile    = true;
      if (params.fast)    extraParams.fast    = true;
      if (params.relax)   extraParams.relax   = true;
      if (params.preview) extraParams.preview = true;
      if (params.exp)     extraParams.exp     = true;
      // Auto-save SREF to library if a code was detected and doesn't already exist
      if (params.sref) {
        getSREFByCode(params.sref).then((existing) => {
          if (!existing) createSREF({ code: params.sref! }).catch(() => {});
        }).catch(() => {});
      }
      const notes = source ? `Source: ${source}` : undefined;
      const id = await create({
        title: title.trim(),
        provider,
        prompt_text: clean || raw,
        aspect_ratio: params.aspect_ratio,
        model_version: params.model_version,
        style_ref: params.sref,
        parameters: Object.keys(extraParams).length ? extraParams : undefined,
        tags: tags.length ? tags : undefined,
        notes,
        is_recipe: asRecipe,
      });
      navigate(`/library/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchParse = () => {
    const { items, error: err } = parseBatchJson(batchJson);
    setBatchParsed(items);
    setBatchError(err ?? "");
  };

  const handleBatchImport = async () => {
    if (!batchParsed.length) return;
    setBatchSaving(true);
    setBatchDone(0);
    let count = 0;
    for (const item of batchParsed) {
      await create({
        title: item.title,
        provider: item.provider ?? "midjourney",
        prompt_text: item.prompt_text,
        tags: item.tags?.length ? item.tags : undefined,
        notes: item.notes,
      });
      count++;
      setBatchDone(count);
    }
    setBatchSaving(false);
    navigate("/library");
  };

  const paramCount = Object.keys(detected).filter((k) => detected[k as keyof DetectedParams]).length;

  return (
    <PageContainer
      title="Import"
      subtitle="PASTE, DETECT & IMPORT PROMPTS"
      action={
        <div className="flex items-center gap-2">
          {(["single", "batch"] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => setMode(m)}
              className={cn("font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded-sm transition-precise",
                mode === m ? "text-white" : "text-dim hover:text-muted")}
              style={{ border: mode === m ? "var(--border-strong)" : "var(--border-dim)", background: mode === m ? "rgba(255,255,255,0.05)" : "transparent" }}>
              {m === "single" ? "Single" : "Batch"}
            </button>
          ))}
        </div>
      }
    >
      {mode === "single" ? (
        <div className="flex gap-6 min-w-0">
          {/* Left */}
          <div className="flex flex-col gap-5 flex-1 min-w-0">

            {/* Duplicate warning */}
            {duplicates.length > 0 && !duplicatesDismissed && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.3)", background: "rgba(215,25,33,0.05)" }}>
                <AlertTriangle size={11} className="text-red/70 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[9px] text-red/70 uppercase tracking-widest">Similar prompts already in library</span>
                  <div className="flex flex-col gap-1 mt-1.5">
                    {duplicates.map((d) => (
                      <div key={d.prompt.id} className="flex items-center gap-2">
                        <button type="button" onClick={() => navigate(`/library/${d.prompt.id}`)}
                          className="font-mono text-[10px] text-muted hover:text-white transition-precise truncate text-left">
                          {d.prompt.title}
                        </button>
                        <span className="font-mono text-[9px] text-dim/50 shrink-0">{Math.round(d.similarity * 100)}% match</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setDuplicatesDismissed(true)} className="text-dim/50 hover:text-white transition-precise">
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Paste area */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="system-label">PASTE PROMPT</span>
                {raw.trim() && (
                  <Button variant="ghost" size="sm" onClick={handleAnalyze}>
                    {analyzed ? "Re-analyze" : "Detect Parameters"}
                  </Button>
                )}
              </div>
              <Textarea value={raw} onChange={(e) => { setRaw(e.target.value); setAnalyzed(false); setDetected({}); setSuggestedTags([]); setDuplicates([]); }}
                placeholder="Paste your full prompt here, including any --parameters flags…"
                rows={8} mono />
            </div>

            {/* Detected parameters */}
            {analyzed && paramCount > 0 && (
              <div className="flex flex-col gap-3 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-base)" }}>
                <span className="system-label">DETECTED PARAMETERS</span>
                <div className="flex flex-wrap gap-2">
                  {detected.aspect_ratio  && <ParamBadge label="--ar"      value={detected.aspect_ratio} />}
                  {detected.model_version && <ParamBadge label="--v"       value={detected.model_version} />}
                  {detected.stylize       && <ParamBadge label="--s"       value={detected.stylize} />}
                  {detected.chaos         && <ParamBadge label="--c"       value={detected.chaos} />}
                  {detected.weird         && <ParamBadge label="--w"       value={detected.weird} />}
                  {detected.quality       && <ParamBadge label="--q"       value={detected.quality} />}
                  {detected.style         && <ParamBadge label="--style"   value={detected.style} />}
                  {detected.sw            && <ParamBadge label="--sw"      value={detected.sw} />}
                  {detected.sv            && <ParamBadge label="--sv"      value={detected.sv} />}
                  {detected.seed          && <ParamBadge label="--seed"    value={detected.seed} />}
                  {detected.zoom          && <ParamBadge label="--zoom"    value={detected.zoom} />}
                  {detected.stop          && <ParamBadge label="--stop"    value={detected.stop} />}
                  {detected.repeat        && <ParamBadge label="--repeat"  value={detected.repeat} />}
                  {detected.sref !== undefined && (
                    detected.sref
                      ? <ParamBadge label="--sref" value={detected.sref} />
                      : <FlagBadge label="--sref (no code)" />
                  )}
                  {detected.profile       && <ParamBadge label="--profile" value={detected.profile} />}
                  {detected.raw           && <FlagBadge label="--raw" />}
                  {detected.hd            && <FlagBadge label="--hd" />}
                  {detected.tile          && <FlagBadge label="--tile" />}
                  {detected.fast          && <FlagBadge label="--fast" />}
                  {detected.relax         && <FlagBadge label="--relax" />}
                  {detected.preview       && <FlagBadge label="--preview" />}
                  {detected.exp           && <FlagBadge label="-exp" />}
                </div>
                {detected.no && (
                  <div className="flex items-start gap-1.5">
                    <Badge variant="default" severity="medium">--no</Badge>
                    <span className="font-mono text-[10px] text-muted leading-relaxed">{detected.no}</span>
                  </div>
                )}
                <p className="font-mono text-[9px] text-dim/60">Parameters stored separately. Clean prompt text saved to library.</p>
              </div>
            )}

            {analyzed && paramCount === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}>
                <AlertTriangle size={10} className="text-dim" />
                <span className="font-mono text-[10px] text-dim">No Midjourney parameters detected. Prompt will be imported as-is.</span>
              </div>
            )}

            {/* Tag suggestions */}
            {suggestedTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="system-label text-[8px]">SUGGESTED TAGS</span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((tag) => (
                    <button key={tag} type="button"
                      onClick={() => { setTags((prev) => [...new Set([...prev, tag])]); setSuggestedTags((prev) => prev.filter((t) => t !== tag)); }}
                      className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white transition-precise"
                      style={{ border: "var(--border-dim)" }}>
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clean preview */}
            {analyzed && raw.trim() && (
              <div className="flex flex-col gap-2">
                <span className="system-label">CLEAN PROMPT PREVIEW</span>
                <div className="p-3 rounded-sm" style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}>
                  <pre className="font-mono text-[11px] text-soft-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">
                    {stripParams(raw) || raw}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Right: Metadata */}
          <div className="flex flex-col gap-4 w-64 shrink-0">
            <div className="flex flex-col gap-4 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <span className="system-label">METADATA</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label">TITLE</label>
                  {error && !title.trim() && <span className="font-mono text-[9px] text-red/80">Required</span>}
                </div>
                <input value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }}
                  placeholder="Name this prompt…"
                  className={cn("w-full h-8 px-3 font-sans text-[12px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise")}
                  style={{ border: !title.trim() && error ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.10)" }} />
              </div>
              <FieldSelect label="PROVIDER" value={provider} onChange={(v) => setProvider(v as Provider)} options={PROVIDERS} />
              <div className="flex flex-col gap-1.5">
                <label className="system-label">SOURCE</label>
                <input value={source} onChange={(e) => setSource(e.target.value)}
                  placeholder="Midjourney community, X, personal…"
                  className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none transition-precise"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
                {mjSource && (
                  <div className="flex items-start gap-3 p-2 rounded-sm" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <img
                      src={mjSource.cdnUrl}
                      alt="Source preview"
                      className="w-20 h-20 object-cover rounded-sm shrink-0"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="flex flex-col gap-1 min-w-0 pt-0.5">
                      <span className="font-mono text-[8px] tracking-widest uppercase text-dim/50">MIDJOURNEY SOURCE</span>
                      <span className="font-mono text-[9px] text-soft-white/60 break-all">{mjSource.jobId}</span>
                      <span className="font-mono text-[8px] text-dim/40">variant {mjSource.index + 1}</span>
                    </div>
                  </div>
                )}
              </div>
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
              <Button variant="primary" size="md" onClick={() => handleSave(false)}
                disabled={saving || !raw.trim()} className="w-full justify-center">
                <Upload size={11} />
                {saving ? "Importing…" : "Import to Library"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSave(true)}
                disabled={saving || !raw.trim()} className="w-full justify-center">
                Save as Recipe
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="w-full justify-center">
                Cancel
              </Button>
            </div>

            <div className="flex flex-col gap-2 p-3 rounded-card"
              style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}>
              <span className="system-label text-[8px]">IMPORT TIPS</span>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
                Paste the full prompt with --flags. Parameters are detected and stored separately.
              </p>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
                For multiple prompts at once, use Batch mode.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Batch Mode ── */
        <div className="flex gap-6 min-w-0">
          <div className="flex flex-col gap-5 flex-1 min-w-0">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="system-label">PASTE JSON ARRAY</span>
                <Button variant="ghost" size="sm" onClick={handleBatchParse} disabled={!batchJson.trim()}>
                  Parse
                </Button>
              </div>
              <Textarea value={batchJson} onChange={(e) => { setBatchJson(e.target.value); setBatchParsed([]); setBatchError(""); }}
                placeholder={`[\n  {\n    "title": "Prompt name",\n    "prompt_text": "your prompt here",\n    "provider": "midjourney",\n    "tags": ["portrait", "editorial"]\n  }\n]`}
                rows={12} mono />
            </div>

            {batchError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ border: "var(--border-active)", background: "rgba(215,25,33,0.06)" }}>
                <AlertTriangle size={10} className="text-red/60" />
                <span className="font-mono text-[10px] text-red/80">{batchError}</span>
              </div>
            )}

            {batchParsed.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="system-label">{batchParsed.length} PROMPTS READY TO IMPORT</span>
                <div className="flex flex-col rounded-card overflow-hidden" style={{ border: "var(--border-default)" }}>
                  {batchParsed.map((item, i) => (
                    <div key={i} className={cn("flex items-center gap-3 px-4 py-2.5", i !== 0 && "border-t")}
                      style={i !== 0 ? { borderColor: "rgba(255,255,255,0.06)" } : {}}>
                      {batchSaving && batchDone > i
                        ? <Check size={10} className="text-white/50 shrink-0" />
                        : <Layers size={10} className="text-dim/40 shrink-0" />
                      }
                      <span className="font-sans text-[11px] text-white truncate flex-1">{item.title}</span>
                      <span className="font-mono text-[9px] text-dim/50 shrink-0">{item.provider ?? "midjourney"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 w-64 shrink-0">
            <div className="flex flex-col gap-2 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <span className="system-label">BATCH FORMAT</span>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">Required: <span className="text-soft-white">prompt_text</span></p>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">Optional: <span className="text-soft-white">title, provider, tags, notes</span></p>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">Provider values: midjourney, dalle, stable_diffusion, firefly, ideogram, flux, other</p>
            </div>

            {batchSaving && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-sm"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <span className="font-mono text-[10px] text-dim">{batchDone} / {batchParsed.length} imported…</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button variant="ghost" size="sm" className="w-full justify-center" onClick={handleBatchParse} disabled={!batchJson.trim()}>
                Parse JSON
              </Button>
              <Button variant="primary" size="md" onClick={handleBatchImport}
                disabled={!batchParsed.length || batchSaving} className="w-full justify-center">
                <Upload size={11} />
                {batchSaving ? `Importing ${batchDone}/${batchParsed.length}…` : `Import ${batchParsed.length || ""} Prompts`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="w-full justify-center">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
