import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Upload, AlertTriangle, ChevronDown, Layers, X, Check, Link } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { usePromptStore } from "@/stores/usePromptStore";
import { getSREFByCode, createSREF } from "@/lib/db";
import { getProjects, addPromptToProject } from "@/lib/projects";
import { validateImageFile } from "@/lib/imageUtils";
import { runManualBatchImport, type ManualBatchItem } from "@/lib/manualBatchImport";
import { toast } from "@/lib/toast";
import { findSimilarPrompts } from "@/lib/memoryEngine";
import {
  analyzeImportedPromptLearning,
  buildImportLearningNotes,
  type ImportLearningSignal,
} from "@/lib/importLearning";
import { cn } from "@/lib/utils";
import { fetchImageAsDataUrl, isDirectImageUrl, isMidjourneyUrl } from "@/lib/fetchImageUrl";

import { thumbnailFromDataUrl } from "@/lib/fileStore";
import type { Provider, Project } from "@/types";

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
  // --no: capture everything until next --param or end of string (allow hyphens inside words)
  const no  = m(/--no\s+(.*?)(?=\s--[a-zA-Z]|$)/s);         if (no)  dp.no            = no[1].trim();
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
    .replace(/--no\s+.*?(?=\s--[a-zA-Z]|$)/gs, "")
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

function uniqueTags(values: string[]): string[] | undefined {
  const tags = [...new Set(values.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  return tags.length ? tags : undefined;
}

function detectProvider(text: string): Provider {
  const lower = text.toLowerCase();
  if (text.includes("--v ") || text.includes("--sref") || text.includes("--stylize") || text.includes("--chaos")) return "midjourney";
  if (lower.includes("gemini-2.5-flash-image") || lower.includes("nano_banana") || lower.includes("nano-banana")) return "nano_banana";
  if (text.includes("--steps") || text.includes("--cfg")) return "stable_diffusion";
  if (lower.includes("adobe firefly")) return "firefly";
  if (lower.includes("ideogram")) return "ideogram";
  if (lower.includes("flux")) return "flux";
  if (lower.includes("gpt-image") || lower.includes("gpt image")) return "gpt_image";
  if (lower.includes("seedance")) return "seedance";
  if (lower.includes("kling")) return "kling";
  if (lower.includes("runway")) return "runway";
  if (lower.includes("higgsfield")) return "higgsfield";
  if (lower.includes("dall-e") || lower.includes("dalle")) return "dalle";
  if (text.includes("--ar")) return "midjourney";
  return "other";
}

// ─── Batch Import ─────────────────────────────────────────────

type BatchItem = ManualBatchItem;

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
          className="w-full appearance-none pr-7 h-8 px-3 font-mono text-[13px] text-white bg-dark rounded-sm focus:outline-none transition-precise cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
          {options.map((o) => <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
      </div>
    </div>
  );
}

export function parseMJSourceUrl(url: string): { cdnUrl: string; jobId: string; index: number } | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.endsWith("midjourney.com")) return null;

    // Direct CDN URL: cdn.midjourney.com/{uuid}/0_{n}.png
    if (u.hostname === "cdn.midjourney.com") {
      const cdn = u.pathname.match(/\/([0-9a-f-]{36})\/0_(\d+)/i);
      if (!cdn) return null;
      return { cdnUrl: url.trim(), jobId: cdn[1], index: parseInt(cdn[2], 10) };
    }

    // alpha.midjourney.com/jobs/{uuid}?index={n}
    const match = u.pathname.match(/\/jobs\/([0-9a-f-]{36})/i);
    if (!match) return null;
    const jobId = match[1];
    const index = parseInt(u.searchParams.get("index") ?? "0", 10);
    return { cdnUrl: `https://cdn.midjourney.com/${jobId}/0_${index}.png`, jobId, index };
  } catch {
    return null;
  }
}

function DualSourceInput({ sourceUrl, onSourceUrl, thumbnailData, onThumbnailData, onError }: {
  sourceUrl: string; onSourceUrl: (v: string) => void;
  thumbnailData: string; onThumbnailData: (v: string) => void;
  onError: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fetching, setFetching] = useState(false);
  const isUrl = sourceUrl.startsWith("http");
  // Debounce ref so typing / editing doesn't fire a fetch on every keystroke
  const urlCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // previewUrl: show the stored data URL (from file upload or native fetch), never the raw CDN URL
  const previewUrl = thumbnailData || null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sourceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // When the user finishes typing a URL, attempt to resolve it as an image via native Rust fetch
  const handleUrlCommit = (url: string) => {
    if (urlCommitTimer.current) clearTimeout(urlCommitTimer.current);
    urlCommitTimer.current = setTimeout(async () => {
      if (!url || thumbnailData) return; // don't overwrite an uploaded file
      if (!isDirectImageUrl(url) && !isMidjourneyUrl(url)) return;
      setFetching(true);
      try {
        const parsed = parseMJSourceUrl(url);
        const fetchUrl = parsed?.cdnUrl ?? url;
        const thumb = await fetchImageAsDataUrl(fetchUrl);
        onThumbnailData(thumb);
      } catch {
        // silently ignore — user can upload manually
      } finally {
        setFetching(false);
      }
    }, 300);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await validateImageFile(file);
    } catch (error) {
      onError(String(error));
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const thumb = await thumbnailFromDataUrl(dataUrl, 400);
      onThumbnailData(thumb);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input value={sourceUrl} onChange={(e) => onSourceUrl(e.target.value)}
          onBlur={(e) => handleUrlCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleUrlCommit(sourceUrl); }}
          placeholder="Paste URL or upload image…"
          className={cn(
            "w-full h-8 font-mono text-[12px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none transition-precise",
            isUrl ? "pl-3 pr-8" : "px-3"
          )}
          style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
        {isUrl && (
          <button type="button" onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-dim/40 hover:text-white transition-precise"
            title="Copy URL">
            {copied ? <Check size={10} className="text-white/60" /> : <Link size={10} />}
          </button>
        )}
      </div>
      
      {fetching && (
        <div className="flex items-center gap-2 p-2 rounded-sm mt-1" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          <div className="w-12 h-12 rounded-sm shrink-0 bg-white/5 animate-pulse" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <span className="font-mono text-[8px] uppercase tracking-widest text-dim/50">Fetching thumbnail…</span>
        </div>
      )}

      {!fetching && previewUrl && (
        <div className="flex items-center gap-2 p-2 rounded-sm mt-1" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-sm shrink-0" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[8px] uppercase tracking-widest text-dim/60">
              Thumbnail ready
            </span>
            <p className="font-mono text-[8px] text-dim/40 mt-0.5">Will be used as prompt thumbnail</p>
          </div>
          <button type="button" onClick={() => onThumbnailData("")} className="text-dim/40 hover:text-red transition-precise shrink-0" title="Remove thumbnail">
            <X size={10} />
          </button>
        </div>
      )}

      {!fetching && !previewUrl && isUrl && (
        <p className="font-mono text-[8px] text-dim/35 mt-0.5">
          {(isDirectImageUrl(sourceUrl) || isMidjourneyUrl(sourceUrl))
            ? "Thumbnail will be fetched automatically on save"
            : "Upload a custom thumbnail below or leave blank"}
        </p>
      )}

      <label className="flex items-center gap-1 cursor-pointer w-fit mt-0.5">
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <span className="font-mono text-[8px] uppercase tracking-widest text-dim/50 hover:text-cyan transition-precise">
          + Upload custom thumbnail
        </span>
      </label>
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

// ─── Constants ────────────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "midjourney", label: "Midjourney" },
  { value: "dalle", label: "DALL·E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
  { value: "firefly", label: "Firefly" },
  { value: "ideogram", label: "Ideogram" },
  { value: "flux", label: "Flux" },
  { value: "nano_banana", label: "Nano Banana" },
  { value: "gpt_image", label: "GPT Image" },
  { value: "seedance", label: "Seedance" },
  { value: "kling", label: "Kling" },
  { value: "runway", label: "Runway" },
  { value: "higgsfield", label: "Higgsfield" },
  { value: "other", label: "Other" },
];

// ─── Main Component ───────────────────────────────────────────

export function ManualImport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { create, prompts: allPrompts } = usePromptStore();

  // Mode — read ?batch=1 from URL on mount
  const [mode, setMode] = useState<"single" | "batch">(searchParams.get("batch") === "1" ? "batch" : "single");

  // Single import state
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [provider, setProvider] = useState<Provider>("midjourney");
  const [tags, setTags] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedParams>({});
  const [learning, setLearning] = useState<ImportLearningSignal | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<ReturnType<typeof findSimilarPrompts>>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bestUse, setBestUse] = useState("");
  const [riskNotes, setRiskNotes] = useState("");
  const [aiLookNotes, setAiLookNotes] = useState("");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [importType, setImportType] = useState<"text" | "nano_banana_json">("text");
  const [nbJson, setNbJson] = useState("");
  const [thumbnailData, setThumbnailData] = useState("");
  const [nbCamera, setNbCamera] = useState("");
  const [nbLens, setNbLens] = useState("");
  const [nbLighting, setNbLighting] = useState("");
  const [nbMood, setNbMood] = useState("");
  const [nbAvoidance, setNbAvoidance] = useState("");

  useEffect(() => { getProjects({ excludeArchived: true }).then(setAvailableProjects).catch(() => {}); }, []);

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
    const nextLearning = analyzeImportedPromptLearning(raw);
    setLearning(nextLearning);
    setProvider(autoProvider);
    setAnalyzed(true);
    const suggestions = nextLearning.tags.filter((t) => !tags.includes(t));
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
    const learned = learning ?? analyzeImportedPromptLearning(raw);
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
      const notes = buildImportLearningNotes(source, learned);
      const isNbMode = importType === "nano_banana_json";

      // Resolve thumbnail BEFORE inserting the prompt so it's stored atomically.
      // This eliminates the race condition where PromptLibrary re-fetches from DB
      // before the async thumbnail update completes.
      let resolvedThumb: string | undefined = thumbnailData || undefined;
      if (!resolvedThumb) {
        const mj = parseMJSourceUrl(source);
        const fetchUrl = mj?.cdnUrl ?? (isDirectImageUrl(source) || isMidjourneyUrl(source) ? source : null);
        if (fetchUrl) {
          resolvedThumb = await fetchImageAsDataUrl(fetchUrl).catch(() => undefined);
        }
      }

      const id = await create({
        title: title.trim(),
        provider,
        prompt_text: isNbMode ? raw : (clean || raw),
        aspect_ratio: isNbMode ? (detected.aspect_ratio || undefined) : params.aspect_ratio,
        model_version: isNbMode ? undefined : params.model_version,
        style_ref: isNbMode ? undefined : params.sref,
        camera: isNbMode ? (nbCamera || undefined) : undefined,
        lens: isNbMode ? (nbLens || undefined) : undefined,
        lighting: isNbMode ? (nbLighting || undefined) : undefined,
        avoidance_text: isNbMode ? (nbAvoidance || learned.avoidanceText) : learned.avoidanceText,
        parameters: Object.keys(extraParams).length ? extraParams : undefined,
        tags: uniqueTags([...tags, ...learned.tags]),
        notes,
        best_use: bestUse.trim() || undefined,
        risk_notes: riskNotes.trim() || undefined,
        failure_notes: aiLookNotes.trim() || undefined,
        is_recipe: asRecipe,
        source_url: source.trim() || undefined,
        // Thumbnail is now resolved before insert — no async update needed
        thumbnail_data: resolvedThumb,
      });
      if (linkedProjectId) {
        addPromptToProject(linkedProjectId, id).catch(() => {});
      }
      navigate(`/library/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
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
    setBatchError("");
    try {
      const result = await runManualBatchImport(batchParsed);
      setBatchDone(result.imported);
      toast.success(`Imported ${result.imported} of ${result.total} prompts.`);
      navigate("/library");
    } catch (error) {
      setBatchDone(0);
      setBatchError(`Batch import failed; no prompts were committed. ${String(error)}`);
    } finally {
      setBatchSaving(false);
    }
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

            {/* Import type toggle */}
            <div className="flex items-center gap-2">
              {(["text", "nano_banana_json"] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setImportType(t)}
                  className={cn("font-mono text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-sm transition-precise",
                    importType === t ? "text-white" : "text-readable hover:text-cyan")}
                  style={{ border: importType === t ? "var(--border-strong)" : "var(--border-dim)", background: importType === t ? "rgba(255,255,255,0.05)" : "transparent" }}>
                  {t === "text" ? "Prompt Text" : "Nano Banana JSON"}
                </button>
              ))}
            </div>

            {/* Paste area */}
            {importType === "text" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="system-label">PASTE PROMPT</span>
                  {raw.trim() && (
                    <Button variant="ghost" size="sm" onClick={handleAnalyze}>
                      {analyzed ? "Re-analyze" : "Detect Parameters"}
                    </Button>
                  )}
                </div>
                <Textarea value={raw} onChange={(e) => { setRaw(e.target.value); setAnalyzed(false); setDetected({}); setLearning(null); setSuggestedTags([]); setDuplicates([]); }}
                  placeholder="Paste your full prompt here, including any --parameters flags…"
                  rows={8} mono />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="system-label">PASTE NANO BANANA JSON</span>
                  <Button variant="ghost" size="sm" disabled={!nbJson.trim()} onClick={() => {
                    try {
                      const obj = JSON.parse(nbJson) as Record<string, unknown>;
                      const priority = obj.priority as Record<string, unknown> | undefined;
                      const technical = obj.technical as Record<string, unknown> | undefined;
                      const constraints = obj.constraints as Record<string, unknown> | undefined;
                      const style = obj.style as Record<string, unknown> | undefined;
                      const env = obj.environment as Record<string, unknown> | undefined;
                      const subject = obj.subject as Record<string, unknown> | undefined;

                      const promptText = (
                        (priority?.primary as string | undefined) ||
                        (obj.prompt as string | undefined) ||
                        (obj.prompt_text as string | undefined) ||
                        (obj.text as string | undefined) ||
                        (subject?.main ? `${String(subject.main)}${env?.setting ? ` in ${String(env.setting)}` : ""}` : "") ||
                        ""
                      );
                      const ar = (technical?.aspect_ratio ?? obj.aspect_ratio ?? obj.ar ?? "") as string;
                      const exclusions = constraints?.exclusions;
                      const avoidance = Array.isArray(exclusions)
                        ? exclusions.join(", ")
                        : typeof exclusions === "string" ? exclusions : "";
                      const cameraObj = style?.camera as Record<string, unknown> | undefined;
                      const camera = (cameraObj?.angle ?? "") as string;
                      const lens = (cameraObj?.lens ?? "") as string;
                      const lightingObj = env?.lighting as Record<string, unknown> | undefined;
                      const lighting = (lightingObj?.direction ?? "") as string;
                      const mood = (style?.mood ?? "") as string;

                      if (promptText) {
                        setRaw(promptText);
                        if (ar) setDetected((d) => ({ ...d, aspect_ratio: ar }));
                        setNbCamera(camera);
                        setNbLens(lens);
                        setNbLighting(lighting);
                        setNbMood(mood);
                        setNbAvoidance(avoidance);
                        setProvider("nano_banana");
                        setAnalyzed(true);
                      }
                    } catch { /* invalid JSON */ }
                  }}>
                    Extract Prompt
                  </Button>
                </div>
                <Textarea value={nbJson} onChange={(e) => setNbJson(e.target.value)}
                  placeholder={`{\n  "prompt": "your prompt here",\n  "aspect_ratio": "1:1",\n  "model": "nano-banana-v1"\n}`}
                  rows={8} mono />
                {raw.trim() && importType === "nano_banana_json" && (
                  <div className="flex flex-col gap-1 px-3 py-2 rounded-sm"
                    style={{ border: "1px solid rgba(246,173,85,0.2)", background: "rgba(246,173,85,0.04)" }}>
                    <span className="font-mono text-[8px] uppercase tracking-widest text-amber/60">Extracted prompt</span>
                    <span className="font-mono text-[10px] text-soft-white/80 line-clamp-3">{raw}</span>
                    {(detected.aspect_ratio || nbCamera || nbLens || nbLighting || nbMood || nbAvoidance) && (
                      <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(246,173,85,0.12)" }}>
                        {detected.aspect_ratio && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">ar</span> {detected.aspect_ratio}</span>}
                        {nbCamera && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">camera</span> {nbCamera}</span>}
                        {nbLens && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">lens</span> {nbLens}</span>}
                        {nbLighting && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">lighting</span> {nbLighting}</span>}
                        {nbMood && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">mood</span> {nbMood}</span>}
                        {nbAvoidance && <span className="font-mono text-[8px] text-amber/50"><span className="text-white/30">avoid</span> {nbAvoidance}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {/* Learning preview */}
            {analyzed && learning && (
              <div className="flex flex-col gap-3 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="system-label">LEARNING PREVIEW</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-cyan">
                    {learning.reusableTokens.length} reusable cues
                  </span>
                </div>
                {learning.tags.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-readable">Tags learned</span>
                    <div className="flex flex-wrap gap-1.5">
                      {learning.tags.map((tag) => <Badge key={tag} variant="tag">{tag}</Badge>)}
                    </div>
                  </div>
                )}
                {learning.reusableTokens.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-readable">Reusable cues</span>
                    <div className="flex flex-wrap gap-1.5">
                      {learning.reusableTokens.map((token) => (
                        <span key={token} className="font-mono text-[10.5px] text-soft-white px-2 py-1 rounded-sm"
                          style={{ border: "var(--border-default)", background: "rgba(255,255,255,0.04)" }}>
                          {token}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {learning.avoidanceText && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-red">Avoidance captured</span>
                    <span className="font-mono text-[12px] leading-relaxed text-readable">{learning.avoidanceText}</span>
                  </div>
                )}
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
                  <pre className="font-mono text-[12px] text-soft-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">
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
                  className={cn("w-full h-8 px-3 font-sans text-[13px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise")}
                  style={{ border: !title.trim() && error ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.10)" }} />
              </div>
              <FieldSelect label="PROVIDER" value={provider} onChange={(v) => setProvider(v as Provider)} options={PROVIDERS} />
              <div className="flex flex-col gap-1.5">
                <label className="system-label">SOURCE</label>
                <DualSourceInput sourceUrl={source} onSourceUrl={setSource} thumbnailData={thumbnailData} onThumbnailData={setThumbnailData} onError={setError} />
                {mjSource && !thumbnailData && (
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

              {/* Best use */}
              <div className="flex flex-col gap-1.5">
                <label className="system-label">BEST USE</label>
                <input value={bestUse} onChange={(e) => setBestUse(e.target.value)}
                  placeholder="Hero banner, social ad, product shot…"
                  className="w-full h-8 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
              </div>

              {/* Risk notes */}
              <div className="flex flex-col gap-1.5">
                <label className="system-label">RISK NOTES</label>
                <input value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)}
                  placeholder="Brand, legal, or production constraints…"
                  className="w-full h-8 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
              </div>

              {/* AI-look notes */}
              <div className="flex flex-col gap-1.5">
                <label className="system-label">AI-LOOK NOTES</label>
                <input value={aiLookNotes} onChange={(e) => setAiLookNotes(e.target.value)}
                  placeholder="Known AI-look issues with this prompt…"
                  className="w-full h-8 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
              </div>

              {/* Link to project */}
              {availableProjects.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="system-label">LINK TO PROJECT</label>
                  <select
                    value={linkedProjectId}
                    onChange={(e) => setLinkedProjectId(e.target.value)}
                    className="w-full h-8 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <option value="">None</option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <span className="system-label text-[10px]">IMPORT LEARNING</span>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
                Analyze before import to capture tags, reusable cues, avoidance text, and parameters.
              </p>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">
                Batch imports use the same learning pass and save the learned signals into notes.
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
                      <span className="font-sans text-[12px] text-white truncate flex-1">{item.title}</span>
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
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">Provider values: midjourney, dalle, stable_diffusion, firefly, ideogram, flux, nano_banana, gpt_image, seedance, kling, runway, higgsfield, other</p>
              <p className="font-mono text-[9px] text-dim/60 leading-relaxed">Learning pass: tags, avoidance text, parameters, and reusable cues are added to each imported prompt.</p>
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
