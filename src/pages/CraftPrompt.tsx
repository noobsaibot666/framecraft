import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Save, Copy, Check, AlertCircle, Zap, Plus, Wand2, FileCode, Film, RotateCcw, Upload, ScanEye, Settings as SettingsIcon, Lightbulb } from "lucide-react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { TokenCloud } from "@/components/ui/TokenCloud";
import { SequenceBuilder } from "@/components/ui/SequenceBuilder";
import { AvoidancePanel } from "@/components/ui/AvoidancePanel";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { usePromptStore } from "@/stores/usePromptStore";
import { findSimilarPrompts, findRelatedPrompts, type SimilarPrompt } from "@/lib/memoryEngine";
import { addPromptToProject, getProjectById, getReferencesForProject } from "@/lib/projects";
import { buildProjectTokenSuggestions, buildSuppressionText } from "@/lib/craftContext";
import { buildRecipeDraft, getRecipeSuggestions, type RecipeSuggestion } from "@/lib/craftRecipe";
import { getPreferences } from "@/lib/userPreferences";
import { getProvenCombos, type ProvenCombo } from "@/lib/tokenPatterns";
import { SREFPickerModal } from "@/components/ui/SREFPickerModal";
import { analyzePromptDraft, generateTagSuggestions, validatePromptForAnalysis, EMPTY_ADVICE, type PromptAdvice } from "@/lib/analyzePrompt";
import { FormulaBar } from "@/components/ui/FormulaBar";
import { ShotListEditor, formatShotsForAssembly, type Shot } from "@/components/ui/ShotListEditor";
import { formatFormulaForAI, getFormulaForProvider, getNarrativeArc, NARRATIVE_FORMATS } from "@/lib/promptFormula";
import { formatStrategyForContext, readStoredStrategy } from "@/lib/creativeDirectorMode";
import { CONSISTENCY_FACTOR_PRESETS, buildConsistencySuffix, suggestConsistencyFactors } from "@/lib/consistencyFactors";
import { getHighImpactReferences, type ImpactReference } from "@/lib/referenceImpact";
import { getTokenById } from "@/lib/tokenDetail";
import { AIImproveButton } from "@/components/ui/AIImproveButton";
import { formatPromptForProvider, getProviderHints } from "@/lib/promptFormatter";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import { createLatestRequestGuard } from "@/lib/latestRequest";
import { detectConsistencyIssues, detectProviderMismatch, findConflictingTexts, type ConsistencyMatch, type ProviderMismatch } from "@/lib/tokenConsistency";
import { isVideoProvider } from "@/lib/providerCapabilities";
import { recordConsistencyEvent, getAllConsistencyRuleCounts } from "@/lib/inconsistencyIntelligence";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";
import { toast } from "@/lib/toast";
import { AI_MODELS, getApiKey, pickVisionModel, type AIModel } from "@/lib/aiConfig";
import { describeImageForFormula } from "@/lib/analyzeImage";
import type { DescribeElements } from "@/lib/aiResultParsers";
import { buildFormulaRows, formatFormulaRows, FORMULA_STEP_NOT_INFERABLE, type FormulaRow } from "@/lib/describeFormula";
import { PROVIDER_GUIDANCE } from "@/lib/promptFormula";
import { fileToDataUrl, computeAspectRatioLabel } from "@/lib/imageUtils";
import { thumbnailFromDataUrl } from "@/lib/fileStore";
import { fetchImageAsDataUrl } from "@/lib/fetchImageUrl";
import type { Provider, Category, Token, Prompt, Project, SREF } from "@/types";
import type { CreatePromptInput } from "@/lib/db";

// cmd+s label registered in ProjectWorkspace (shared context)
registerShortcutLabel("cmd+shift+r", "Reset prompt fields");

// ─── Shared sub-components ────────────────────────────────────

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
      <label className="system-label text-[12px] text-muted">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pr-7 h-10 px-3 font-mono text-[13px] text-white bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="system-label text-[12px] text-muted">{label}</label>
        {hint && <span className="font-mono text-[10px] text-readable">{hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      />
    </div>
  );
}

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label text-[13px] text-muted">RATING</label>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
            className={cn(
              "w-4 h-4 rounded-full border transition-precise",
              i < value ? "bg-amber/70 border-amber/60" : "bg-transparent border-white/18 hover:border-amber/55"
            )}
          />
        ))}
        <span className="font-mono text-[12px] text-readable ml-1">{value}/5</span>
      </div>
    </div>
  );
}

function RiskSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colorClass = value >= 8 ? "text-red" : value >= 6 ? "text-red/80" : value >= 4 ? "text-amber" : "text-readable";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="system-label text-[13px] text-muted">AI-LOOK RISK</label>
        <span className={cn("font-mono text-[13px]", colorClass)}>{value}/10</span>
      </div>
      <input
        type="range" min={0} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-px cursor-pointer accent-amber"
        style={{ background: `linear-gradient(to right, rgba(255,255,255,0.4) ${value * 10}%, rgba(255,255,255,0.08) ${value * 10}%)` }}
      />
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
      <label className="system-label text-[12px] text-muted">TAGS</label>
      <div
        className="flex flex-wrap gap-1.5 p-2.5 rounded-sm min-h-10"
        style={{ border: "1px solid rgba(255,255,255,0.16)", background: "var(--color-dark)" }}
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded border border-white/16 text-readable">
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
          className="flex-1 min-w-16 bg-transparent font-mono text-[12px] text-soft-white placeholder:text-dim outline-none"
        />
      </div>
    </div>
  );
}

// ─── Provider Parameter Panels ────────────────────────────────

export interface MJParams {
  aspect_ratio: string; model_version: string; quality: string;
  stylize: string; chaos: string; weird: string; stop: string; repeat: string;
  seed: string; zoom: string; style: string; sw: string; sv: string;
  sref_code: string; profile: string; no_prompt: string;
  raw: boolean; hd: boolean; tile: boolean; fast: boolean; relax: boolean; exp: boolean;
}
export interface DalleParams { size: string; quality: string; style: string; }
export interface SDParams { steps: string; cfg_scale: string; sampler: string; negative_prompt: string; seed: string; }

/**
 * Build the `parameters` DB column for the given provider (audit doc 05 §1).
 * Pure — previously this logic only handled Midjourney inline in buildData(),
 * so DALL-E/SD params were never written to the DB at all.
 */
export function buildProviderParameters(
  provider: Provider,
  mj: MJParams,
  dalle: DalleParams,
  sd: SDParams
): Record<string, string | boolean> | undefined {
  if (provider === "midjourney") {
    const pp: Record<string, string | boolean> = {};
    if (mj.profile)   pp.profile  = mj.profile;
    if (mj.stylize)   pp.stylize  = mj.stylize;
    if (mj.chaos)     pp.chaos    = mj.chaos;
    if (mj.weird)     pp.weird    = mj.weird;
    if (mj.quality)   pp.quality  = mj.quality;
    if (mj.style)     pp.style    = mj.style;
    if (mj.sw)        pp.sw       = mj.sw;
    if (mj.sv)        pp.sv       = mj.sv;
    if (mj.seed)      pp.seed     = mj.seed;
    if (mj.zoom)      pp.zoom     = mj.zoom;
    if (mj.stop)      pp.stop     = mj.stop;
    if (mj.repeat)    pp.repeat   = mj.repeat;
    if (mj.no_prompt) pp.no       = mj.no_prompt;
    if (mj.raw)       pp.raw      = true;
    if (mj.hd)        pp.hd       = true;
    if (mj.tile)      pp.tile     = true;
    if (mj.fast)      pp.fast     = true;
    if (mj.relax)     pp.relax    = true;
    if (mj.exp)       pp.exp      = true;
    return Object.keys(pp).length ? pp : undefined;
  }
  if (provider === "dalle") {
    const pp: Record<string, string | boolean> = {};
    if (dalle.size)    pp.size    = dalle.size;
    if (dalle.quality) pp.quality = dalle.quality;
    if (dalle.style)   pp.style   = dalle.style;
    return Object.keys(pp).length ? pp : undefined;
  }
  if (provider === "stable_diffusion") {
    const pp: Record<string, string | boolean> = {};
    if (sd.steps)           pp.steps           = sd.steps;
    if (sd.cfg_scale)       pp.cfg_scale       = sd.cfg_scale;
    if (sd.sampler)         pp.sampler         = sd.sampler;
    if (sd.seed)            pp.seed            = sd.seed;
    if (sd.negative_prompt) pp.negative_prompt = sd.negative_prompt;
    return Object.keys(pp).length ? pp : undefined;
  }
  return undefined;
}

/** Restore DalleParams/SDParams from a loaded prompt's `parameters` column. Pure. */
export function restoreDalleParams(pp: Record<string, unknown>): DalleParams {
  return {
    size:    String(pp.size    ?? ""),
    quality: String(pp.quality ?? ""),
    style:   String(pp.style   ?? ""),
  };
}
export function restoreSDParams(pp: Record<string, unknown>): SDParams {
  return {
    steps:           String(pp.steps           ?? ""),
    cfg_scale:       String(pp.cfg_scale        ?? ""),
    sampler:         String(pp.sampler          ?? ""),
    seed:            String(pp.seed             ?? ""),
    negative_prompt: String(pp.negative_prompt  ?? ""),
  };
}

const ASPECT_RATIOS = [
  { value: "", label: "Select ratio…" },
  { value: "1:1", label: "1:1 — Square" },
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "9:16", label: "9:16 — Portrait" },
  { value: "4:3", label: "4:3 — Standard" },
  { value: "3:2", label: "3:2 — Photo" },
  { value: "2:3", label: "2:3 — Vertical" },
  { value: "21:9", label: "21:9 — Ultra-wide" },
  { value: "4:5", label: "4:5 — Instagram" },
];

const MJ_VERSIONS = [
  { value: "", label: "Default" },
  { value: "8.1", label: "v8.1 (latest)" },
  { value: "8", label: "v8" },
  { value: "7", label: "v7" },
  { value: "6.1", label: "v6.1" },
  { value: "6", label: "v6" },
  { value: "5.2", label: "v5.2" },
  { value: "niji 7", label: "Niji 7" },
  { value: "niji 6", label: "Niji 6" },
];

const MJ_QUALITY = [
  { value: "", label: "Default (1)" },
  { value: "1", label: "1 — Standard" },
  { value: ".5", label: ".5 — Half" },
  { value: ".25", label: ".25 — Quarter" },
  { value: "2", label: "2 — Double (v5 only)" },
];

const MJ_STYLE = [
  { value: "", label: "Default" },
  { value: "raw", label: "raw" },
  { value: "cute", label: "cute (Niji)" },
  { value: "expressive", label: "expressive (Niji)" },
  { value: "original", label: "original (Niji)" },
  { value: "scenic", label: "scenic (Niji)" },
];

const DALLE_SIZES = [
  { value: "", label: "Default" },
  { value: "1024x1024", label: "1024×1024 — Square" },
  { value: "1792x1024", label: "1792×1024 — Landscape" },
  { value: "1024x1792", label: "1024×1792 — Portrait" },
];

const DALLE_QUALITY_OPTS = [
  { value: "", label: "Standard" },
  { value: "hd", label: "HD" },
];

const DALLE_STYLE_OPTS = [
  { value: "", label: "Vivid" },
  { value: "natural", label: "Natural" },
];

const SD_SAMPLERS = [
  { value: "", label: "Default" },
  { value: "Euler a", label: "Euler a" },
  { value: "DPM++ 2M Karras", label: "DPM++ 2M Karras" },
  { value: "DDIM", label: "DDIM" },
  { value: "UniPC", label: "UniPC" },
  { value: "LMS", label: "LMS" },
];

const MidjourneyParams = memo(function MidjourneyParams({ p, set, selectedSrefTitle, onBrowseSref, onClearSref }: {
  p: MJParams;
  set: (k: keyof MJParams, v: string | boolean) => void;
  selectedSrefTitle?: string | null;
  onBrowseSref: () => void;
  onClearSref: () => void;
}) {
  const flag = (k: keyof MJParams, label: string) => (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={p[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="accent-white w-3 h-3" />
      <span className="system-label">{label}</span>
    </label>
  );
  return (
    <>
      {/* Core */}
      <FieldSelect label="VERSION --v" value={p.model_version} onChange={(v) => set("model_version", v)} options={MJ_VERSIONS} />
      <FieldSelect label="QUALITY --q" value={p.quality} onChange={(v) => set("quality", v)} options={MJ_QUALITY} />
      <FieldInput label="STYLIZE --s" value={p.stylize} onChange={(v) => set("stylize", v)} placeholder="400" hint="0–1000" />
      <FieldInput label="CHAOS --c" value={p.chaos} onChange={(v) => set("chaos", v)} placeholder="0" hint="0–100" />
      <FieldInput label="WEIRD --w" value={p.weird} onChange={(v) => set("weird", v)} placeholder="0" hint="0–3000" />
      {/* Style */}
      <FieldSelect label="STYLE --style" value={p.style} onChange={(v) => set("style", v)} options={MJ_STYLE} />
      <FieldInput label="STYLE WEIGHT --sw" value={p.sw} onChange={(v) => set("sw", v)} placeholder="100" hint="0–1000" />
      <FieldInput label="STYLE VERSION --sv" value={p.sv} onChange={(v) => set("sv", v)} placeholder="4" hint="1–4" />
      {/* Reference */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="system-label text-[10px] text-muted">SREF CODE</span>
          <button
            onClick={onBrowseSref}
            className="font-mono text-[9px] text-readable hover:text-white uppercase tracking-widest transition-precise"
          >
            Browse library
          </button>
        </div>
        {selectedSrefTitle && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill font-mono text-[10px] text-white"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {selectedSrefTitle}
              <button onClick={() => { onClearSref(); set("sref_code", ""); }}
                className="text-readable hover:text-white">×</button>
            </span>
          </div>
        )}
        <FieldInput label="" value={p.sref_code} onChange={(v) => { set("sref_code", v); if (!v) onClearSref(); }} placeholder="12345" />
      </div>
      <FieldInput label="PROFILE --profile" value={p.profile} onChange={(v) => set("profile", v)} placeholder="e.g. og9pmia" />
      {/* Output tuning */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="system-label text-[10px] text-muted">SEED --seed</span>
          <button
            type="button"
            onClick={() => set("seed", String(Math.floor(Math.random() * 4294967296)))}
            className="font-mono text-[9px] text-readable hover:text-white uppercase tracking-widest transition-precise"
          >
            Randomize
          </button>
        </div>
        <FieldInput label="" value={p.seed} onChange={(v) => set("seed", v)} placeholder="e.g. 4294967295" />
        {p.seed && (
          <span className="font-mono text-[8px] text-cyan/60 leading-relaxed">
            Locked — Duplicate/Create Variation now carry this seed forward, so reuse it to keep the same look across a sequence.
          </span>
        )}
      </div>
      <FieldInput label="ZOOM --zoom" value={p.zoom} onChange={(v) => set("zoom", v)} placeholder="1.5" hint="1–2" />
      <FieldInput label="STOP --stop" value={p.stop} onChange={(v) => set("stop", v)} placeholder="80" hint="10–100" />
      <FieldInput label="REPEAT --repeat" value={p.repeat} onChange={(v) => set("repeat", v)} placeholder="4" hint="1–40" />
      {/* Negative */}
      <FieldInput label="NEGATIVE --no" value={p.no_prompt} onChange={(v) => set("no_prompt", v)} placeholder="text in frame, blur" />
      {/* Flags */}
      <div className="flex flex-col gap-1 pt-1">
        <span className="system-label text-[10px] text-muted">FLAGS</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {flag("raw",   "--raw")}
          {flag("hd",    "--hd")}
          {flag("tile",  "--tile")}
          {flag("fast",  "--fast")}
          {flag("relax", "--relax")}
          {flag("exp",   "-exp")}
        </div>
      </div>
    </>
  );
});

const DalleParamsPanel = memo(function DalleParamsPanel({ p, set }: { p: DalleParams; set: (k: keyof DalleParams, v: string) => void }) {
  return (
    <>
      <FieldSelect label="SIZE" value={p.size} onChange={(v) => set("size", v)} options={DALLE_SIZES} />
      <FieldSelect label="QUALITY" value={p.quality} onChange={(v) => set("quality", v)} options={DALLE_QUALITY_OPTS} />
      <FieldSelect label="STYLE" value={p.style} onChange={(v) => set("style", v)} options={DALLE_STYLE_OPTS} />
    </>
  );
});

const SDParamsPanel = memo(function SDParamsPanel({ p, set }: { p: SDParams; set: (k: keyof SDParams, v: string) => void }) {
  return (
    <>
      <FieldInput label="STEPS" value={p.steps} onChange={(v) => set("steps", v)} placeholder="30" hint="20–60" />
      <FieldInput label="CFG SCALE" value={p.cfg_scale} onChange={(v) => set("cfg_scale", v)} placeholder="7" hint="1–20" />
      <FieldSelect label="SAMPLER" value={p.sampler} onChange={(v) => set("sampler", v)} options={SD_SAMPLERS} />
      <FieldInput label="SEED" value={p.seed} onChange={(v) => set("seed", v)} placeholder="-1 (random)" />
      <div className="flex flex-col gap-1.5">
        <label className="system-label text-[12px] text-muted">NEGATIVE PROMPT</label>
        <textarea
          value={p.negative_prompt}
          onChange={(e) => set("negative_prompt", e.target.value)}
          placeholder="ugly, bad anatomy, blurry…"
          rows={3}
          className="w-full px-3 py-2.5 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
      </div>
    </>
  );
});

// ─── Prompt assembly ──────────────────────────────────────────

// Guards param-appending against duplicating a flag the base text already
// carries (e.g. a manual-mode prompt the user hand-typed "--seed 12345"
// into) — used by both builder-mode assembly and manual-mode copy/export,
// since manual mode's base text can legitimately already contain any flag.
function hasFlag(text: string, flag: string): boolean {
  return new RegExp(`--${flag}\\b`, "i").test(text);
}

function appendMJParams(base: string, f: Pick<Fields, "aspect_ratio">, mj: MJParams): string {
  let out = base;
  if (f.aspect_ratio && !hasFlag(base, "ar"))      out += ` --ar ${f.aspect_ratio}`;
  if (mj.model_version && !hasFlag(base, "v"))     out += ` --v ${mj.model_version}`;
  if (mj.quality && !hasFlag(base, "q"))           out += ` --q ${mj.quality}`;
  if (mj.stylize && !hasFlag(base, "s"))           out += ` --s ${mj.stylize}`;
  if (mj.chaos && !hasFlag(base, "c"))             out += ` --c ${mj.chaos}`;
  if (mj.weird && !hasFlag(base, "w"))             out += ` --w ${mj.weird}`;
  if (mj.style && !hasFlag(base, "style"))         out += ` --style ${mj.style}`;
  if (mj.sw && !hasFlag(base, "sw"))               out += ` --sw ${mj.sw}`;
  if (mj.sv && !hasFlag(base, "sv"))               out += ` --sv ${mj.sv}`;
  if (mj.seed && !hasFlag(base, "seed"))           out += ` --seed ${mj.seed}`;
  if (mj.zoom && !hasFlag(base, "zoom"))           out += ` --zoom ${mj.zoom}`;
  if (mj.stop && !hasFlag(base, "stop"))           out += ` --stop ${mj.stop}`;
  if (mj.repeat && !hasFlag(base, "repeat"))       out += ` --repeat ${mj.repeat}`;
  if (mj.sref_code && !hasFlag(base, "sref"))      out += ` --sref ${mj.sref_code}`;
  if (mj.profile && !hasFlag(base, "profile"))     out += ` --profile ${mj.profile}`;
  if (mj.raw && !hasFlag(base, "raw"))             out += ` --raw`;
  if (mj.hd && !hasFlag(base, "hd"))               out += ` --hd`;
  if (mj.tile && !hasFlag(base, "tile"))           out += ` --tile`;
  if (mj.fast && !hasFlag(base, "fast"))           out += ` --fast`;
  if (mj.relax && !hasFlag(base, "relax"))         out += ` --relax`;
  if (mj.exp && !/-{1,2}exp\b/i.test(base))        out += ` -exp`;
  if (mj.no_prompt && !hasFlag(base, "no"))        out += ` --no ${mj.no_prompt}`;
  return out;
}

function assembleMJ(f: Fields, mj: MJParams): string {
  const parts = [f.subject, f.character, f.environment, f.composition, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  return appendMJParams(parts.join(", "), f, mj);
}

function appendDalleParams(base: string, dalle: DalleParams): string {
  let out = base;
  if (dalle.size && !/\[size:/i.test(base))       out += ` [size: ${dalle.size}]`;
  if (dalle.quality && !/\[quality:/i.test(base)) out += ` [quality: ${dalle.quality}]`;
  if (dalle.style && !/\[style:/i.test(base))     out += ` [style: ${dalle.style}]`;
  return out;
}

function assembleDalle(f: Fields, dalle: DalleParams): string {
  const parts = [f.subject, f.character, f.environment, f.composition, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  return appendDalleParams(parts.join(", "), dalle);
}

function assembleSD(f: Fields, _sd: SDParams): string {
  const parts = [f.subject, f.character, f.environment, f.composition, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  return parts.join(", ");
}

function assembleGeneric(f: Fields, shots: Shot[] = []): string {
  const parts = [f.subject, f.character, f.environment, f.composition, f.camera, f.lens, f.lighting, f.mood, f.realism];
  if (f.provider === "nano_banana") {
    parts.push(
      f.text_graphics ? `text: ${f.text_graphics}` : "",
      f.reference_role ? `references: ${f.reference_role}` : ""
    );
  }
  if (isVideoProvider(f.provider)) {
    const arc = getNarrativeArc(f.narrative_format);
    // Kling's "scene world / spatial logic" and the shared continuity notes
    // (audit doc 05 §12/§13) fold into assembly like the other video fields.
    parts.push(
      arc ? `narrative arc: ${arc}` : "",
      f.provider === "kling" && f.scene_world ? `scene world: ${f.scene_world}` : "",
      f.motion,
      formatShotsForAssembly(shots),
      f.transitions ? `transitions: ${f.transitions}` : "",
      f.continuity_notes ? `${f.provider === "kling" ? "continuity lock" : "continuity"}: ${f.continuity_notes}` : "",
      f.audio ? `audio: ${f.audio}` : "",
      f.duration ? `${f.duration} duration` : ""
    );
  }
  return parts.map((s) => s.trim()).filter(Boolean).join(", ");
}

// ─── Nano Banana ───────────────────────────────────────────────

function buildNanaBananaJson(f: Fields, assembled: string, aspectRatio: string): string {
  const exclusions = f.avoidance_text
    ? f.avoidance_text.split(",").map((s) => s.trim()).filter(Boolean)
    : ["text", "logos", "watermarks", "filters", "heavy retouching"];
  return JSON.stringify({
    model: "gemini-2.5-flash-image",
    task_type: "generation",
    priority: {
      primary: assembled || f.subject || "",
      secondary: [f.environment, f.camera, f.lighting].filter(Boolean).join(", ") || "Capture realistic texture and natural detail",
    },
    task: "generate_image",
    subject: {
      main: [f.subject, f.character].filter(Boolean).join(", ") || assembled || "",
      attributes: {
        physical: f.realism || f.subject || assembled || "",
        pose: "natural state",
        expression: "neutral, calm",
      },
    },
    environment: {
      setting: f.environment || "macro photography studio",
      time: "controlled lighting session",
      weather: "not applicable",
      lighting: {
        type: "artificial",
        direction: f.lighting || "side and slightly top",
        quality: "soft, diffused lighting that reveals texture without harsh shadows",
      },
    },
    style: {
      artistic: "photorealistic",
      camera: {
        angle: f.camera || "extreme close-up",
        lens: f.lens || "macro",
        aperture: "shallow depth of field",
      },
      mood: f.mood || "clean, intimate, clinical realism",
      color_palette: "natural tones",
    },
    technical: {
      resolution: "high",
      aspect_ratio: aspectRatio || "9:16",
      quality: "maximum",
    },
    constraints: {
      framing: "extreme macro crop filling most of the frame",
      focus: "sharp focus on primary subject with gentle falloff toward edges",
      exclusions,
    },
    context_awareness: {
      real_world_logic: true,
      physics_accurate: true,
    },
    output_specs: {
      use_case: f.use_case || "realism study, editorial macro detail",
      success_criteria: "clearly visible natural texture with realistic lighting",
    },
    ...(f.text_graphics.trim() ? { text_render: { content: f.text_graphics.trim(), must_render_exactly: true } } : {}),
    ...(f.reference_role.trim() ? { reference_usage: { instruction: f.reference_role.trim() } } : {}),
    ...(f.variation.trim() ? { sequence_delta: { instruction: f.variation.trim(), base_consistent: true } } : {}),
  }, null, 2);
}

interface NanaBananaTemplate {
  id: string;
  label: string;
  subject: string;
  environment: string;
  camera: string;
  lens: string;
  lighting: string;
  mood: string;
  avoidance_text: string;
  keyElements: string[];
}

const NANO_BANANA_TEMPLATES: NanaBananaTemplate[] = [
  {
    id: "skin",
    label: "SKIN",
    subject: "human skin with visible pores, fine lines, and natural texture",
    environment: "macro photography studio",
    camera: "extreme close-up",
    lens: "macro",
    lighting: "soft, diffused from side and slightly top",
    mood: "clean, intimate, clinical realism",
    avoidance_text: "heavy makeup, foundation, skin smoothing, retouching, filters, text, logos, watermarks",
    keyElements: ["visible pores + fine lines", "diffused side-top lighting", "no retouching"],
  },
  {
    id: "eye",
    label: "EYE",
    subject: "human eye with complex iris radial patterns, dark pupil, visible sclera veins, eye open looking straight toward camera",
    environment: "macro photography studio",
    camera: "eye-level extreme close-up",
    lens: "macro",
    lighting: "soft, even from front and slightly top with subtle catchlight reflection in the pupil",
    mood: "clean, intimate, highly realistic",
    avoidance_text: "heavy makeup, eyeliner, mascara clumps, retouching, text, logos, watermarks",
    keyElements: ["iris radial patterns", "catchlight in pupil", "sclera veins visible"],
  },
  {
    id: "lip",
    label: "LIPS",
    subject: "slightly parted woman lips with visible fine lines, pores, and subtle dryness texture",
    environment: "studio macro photography",
    camera: "extreme close-up",
    lens: "macro",
    lighting: "soft but directional from side and top, emphasizing texture depth",
    mood: "intimate, raw, organic",
    avoidance_text: "eyes, full nose, full face, makeup, lipstick, gloss, filters, text, logos, watermarks",
    keyElements: ["fine lines + pores", "slight teeth reveal", "raw organic mood"],
  },
  {
    id: "tongue",
    label: "TONGUE",
    subject: "human tongue with pinkish surface, clearly visible taste buds, granular texture, natural moisture, tongue extended forward slightly curved",
    environment: "macro photography studio",
    camera: "extreme close-up",
    lens: "macro",
    lighting: "soft but directional from side and top, highlighting surface texture",
    mood: "clinical, organic, highly detailed",
    avoidance_text: "lips, teeth, full face, makeup, piercings, food, text, logos, watermarks",
    keyElements: ["visible papillae", "natural moisture", "clinical documentary"],
  },
];

function NanaBananaParamsPanel({ onUseTemplate }: { onUseTemplate: (t: NanaBananaTemplate) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[11px] text-readable leading-relaxed">
        Structured JSON for Gemini realism generation. Fill the fields above, then copy the generated JSON from the output panel.
      </p>
      <span className="font-mono text-[9px] uppercase tracking-widest text-amber/50">Realism Formula References</span>
      <div className="grid grid-cols-2 gap-2">
        {NANO_BANANA_TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-2 p-3 rounded-[6px]"
            style={{ border: "1px solid rgba(246,173,85,0.18)", background: "rgba(246,173,85,0.03)" }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(246,173,85,0.7)" }}>{t.label}</span>
              <button
                type="button"
                onClick={() => onUseTemplate(t)}
                className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm transition-precise"
                style={{ border: "1px solid rgba(246,173,85,0.25)", color: "rgba(246,173,85,0.6)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(246,173,85,0.9)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(246,173,85,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(246,173,85,0.6)"; (e.currentTarget as HTMLButtonElement).style.background = ""; }}
              >
                Use
              </button>
            </div>
            <ul className="flex flex-col gap-0.5">
              {t.keyElements.map((el) => (
                <li key={el} className="flex items-start gap-1">
                  <span className="mt-px shrink-0" style={{ color: "rgba(246,173,85,0.35)" }}>·</span>
                  <span className="font-mono text-[10px] text-muted leading-tight">{el}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
  { value: "nano_banana", label: "Nano Banana Pro" },
  { value: "gpt_image", label: "GPT Image 2" },
  { value: "seedance", label: "Seedance" },
  { value: "kling", label: "Kling" },
  { value: "runway", label: "Runway" },
  { value: "higgsfield", label: "Higgsfield" },
  { value: "other", label: "Other" },
];

// Image Description AI (right column, under Prompt Output) — only vision-capable
// providers (DeepSeek has no vision endpoint, matches pickVisionModel's set).
const VISION_MODELS: AIModel[] = AI_MODELS.filter((m) => m.provider === "anthropic" || m.provider === "openai");

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "Select category…" },
  { value: "advertising", label: "Advertising" },
  { value: "editorial", label: "Editorial" },
  { value: "product", label: "Product" },
  { value: "fashion", label: "Fashion" },
  { value: "automotive", label: "Automotive" },
  { value: "architecture", label: "Architecture" },
  { value: "portrait", label: "Portrait" },
  { value: "cinematic", label: "Cinematic" },
  { value: "abstract", label: "Abstract" },
  { value: "other", label: "Other" },
];

// ─── Form state ───────────────────────────────────────────────

interface Fields {
  title: string; description: string; provider: Provider;
  category: string; use_case: string; aspect_ratio: string;
  prompt_text: string; avoidance_text: string;
  subject: string; character: string; environment: string; composition: string;
  camera: string; lens: string;
  lighting: string; mood: string; realism: string;
  rating: number; ai_look_risk: number;
  tags: string[]; notes: string;
  is_winner: boolean; is_failed: boolean;
  variation: string;
  motion: string; duration: string;
  narrative_format: string; transitions: string; audio: string;
  text_graphics: string; reference_role: string;
  // Audit doc 05 §12/§13 — shared "what must stay stable across shots" field,
  // labeled CONTINUITY RULES for Seedance / CONTINUITY LOCK for Kling; scene
  // world/spatial logic is Kling-only, distinct from generic Environment.
  continuity_notes: string; scene_world: string;
  thumbnail_data: string; source_url: string;
}

const EMPTY: Fields = {
  title: "", description: "", provider: "midjourney",
  category: "", use_case: "", aspect_ratio: "",
  prompt_text: "", avoidance_text: "",
  subject: "", character: "", environment: "", composition: "",
  camera: "", lens: "",
  lighting: "", mood: "", realism: "",
  rating: 0, ai_look_risk: 0,
  tags: [], notes: "",
  is_winner: false, is_failed: false,
  variation: "",
  motion: "", duration: "",
  narrative_format: "", transitions: "", audio: "",
  text_graphics: "", reference_role: "",
  continuity_notes: "", scene_world: "",
  thumbnail_data: "", source_url: "",
};

// Token category → builder field routing (V2 §7). Categories without a
// matching field (material, color, parameters) stay sequence-only.
const CATEGORY_FIELD_MAP: Partial<Record<string, keyof Fields>> = {
  subject: "subject",
  action: "subject",
  environment: "environment",
  composition: "composition",
  camera: "camera",
  lens: "lens",
  lighting: "lighting",
  mood: "mood",
  brand_tone: "mood",
  realism: "realism",
  avoidance: "avoidance_text",
  motion: "motion",
};

/** Remove one clause (case-insensitive exact match) from a comma-separated field value. */
function removeClauseFromField(current: string, clause: string): string {
  const parts = current.split(",").map((s) => s.trim()).filter(Boolean);
  const index = parts.findIndex((p) => p.toLowerCase() === clause.trim().toLowerCase());
  if (index >= 0) parts.splice(index, 1);
  return parts.join(", ");
}

const EMPTY_MJ: MJParams = {
  aspect_ratio: "", model_version: "", quality: "",
  stylize: "", chaos: "", weird: "", stop: "", repeat: "",
  seed: "", zoom: "", style: "", sw: "", sv: "",
  sref_code: "", profile: "", no_prompt: "",
  raw: false, hd: false, tile: false, fast: false, relax: false, exp: false,
};
const EMPTY_DALLE: DalleParams = { size: "", quality: "", style: "" };
const EMPTY_SD: SDParams = { steps: "", cfg_scale: "", sampler: "", negative_prompt: "", seed: "" };

// ─── In-progress draft persistence ─────────────────────────────
// Keeps whatever the user has typed on a *new* (unsaved) prompt when they
// navigate away to check another page and come back — cleared only on an
// explicit Reset or once the prompt is actually saved to the library.

const CRAFT_DRAFT_KEY = "fc_craft_draft";

interface CraftDraftPayload {
  fields: Fields;
  mjParams: MJParams;
  dalleParams: DalleParams;
  sdParams: SDParams;
  shots: Shot[];
  mode: "builder" | "manual";
  tokenSequence: Token[];
  tokenOverrides: Record<string, string>;
  fieldTokenIds: Record<string, keyof Fields>;
  consistencyFactors: string[];
  formulaSteps: string[];
  formulaCustomized: boolean;
  outputOverride: string | null;
  includeAvoidance: boolean;
}

function draftStorageKey(projectId: string | null): string {
  return `${CRAFT_DRAFT_KEY}:${projectId ?? "none"}`;
}

function loadCraftDraft(projectId: string | null): CraftDraftPayload | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(projectId));
    return raw ? (JSON.parse(raw) as CraftDraftPayload) : null;
  } catch {
    return null;
  }
}

function saveCraftDraft(projectId: string | null, payload: CraftDraftPayload): void {
  try {
    localStorage.setItem(draftStorageKey(projectId), JSON.stringify(payload));
  } catch { /* storage unavailable/full — draft persistence is best-effort */ }
}

function clearCraftDraft(projectId: string | null): void {
  try { localStorage.removeItem(draftStorageKey(projectId)); } catch { /* ignore */ }
}

/** True when the draft holds nothing worth restoring (fresh/reset form). */
function isEmptyDraftState(fields: Fields, tokenSequence: Token[], shots: Shot[]): boolean {
  const meaningfulFieldsEmpty = (Object.keys(fields) as (keyof Fields)[]).every((key) => {
    if (key === "provider" || key === "category" || key === "aspect_ratio") return true; // preference defaults, not draft content
    const value = fields[key];
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "number") return value === 0;
    if (typeof value === "boolean") return value === false;
    return !String(value).trim();
  });
  return meaningfulFieldsEmpty && tokenSequence.length === 0 && shots.length === 0;
}

const VARIATION_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "rot90",   label: "Rotate 90°",  value: "composition rotated 90° clockwise" },
  { id: "mirror",  label: "Mirror",      value: "horizontally mirrored composition" },
  { id: "above",   label: "From Above",  value: "camera from above, bird's eye view" },
  { id: "below",   label: "From Below",  value: "camera from below, worm's eye view" },
  { id: "left",    label: "Cam Left",    value: "camera positioned to the left side" },
  { id: "right",   label: "Cam Right",   value: "camera positioned to the right side" },
  { id: "behind",  label: "From Behind", value: "viewed from behind the subject" },
  { id: "night",   label: "Night",       value: "night version, artificial ambient lighting" },
  { id: "golden",  label: "Golden Hour", value: "golden hour, warm amber and orange tones" },
  { id: "bw",      label: "B&W",         value: "black and white, high contrast monochrome" },
  { id: "rain",    label: "Rain",        value: "heavy rain, wet reflective surfaces" },
  { id: "closeup", label: "Close-Up",    value: "extreme close-up crop on the primary subject" },
  { id: "wide",    label: "Wide Shot",   value: "wide establishing shot, full environment visible" },
];

function projectProviderToPromptProvider(provider?: string): Provider | null {
  const normalized = provider?.toLowerCase().replace(/\s+/g, "_");
  if (
    normalized === "midjourney" ||
    normalized === "dalle" ||
    normalized === "stable_diffusion" ||
    normalized === "firefly" ||
    normalized === "ideogram" ||
    normalized === "flux" ||
    normalized === "nano_banana" ||
    normalized === "gpt_image" ||
    normalized === "seedance" ||
    normalized === "kling" ||
    normalized === "runway" ||
    normalized === "higgsfield" ||
    normalized === "other"
  ) {
    return normalized;
  }
  return null;
}

interface CraftPromptLocationState {
  prefillPromptText?: string;
  prefillTitle?: string;
  prefillRecipeId?: string;
}

// ─── Impact Ref Row ───────────────────────────────────────────

function ImpactRefThumb({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src ?? "");
  if (!image.src) return (
    <div className="w-9 h-9 rounded-sm shrink-0 flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.05)", border: "var(--border-dim)" }}>
      <span className="font-mono text-[8px] text-dim/40">REF</span>
    </div>
  );
  return <img src={image.src} onError={image.onError} className="w-9 h-9 rounded-sm object-cover shrink-0" />;
}

function InspirationThumb({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src ?? "");
  if (!image.src) return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.05)" }}>
      <span className="font-mono text-[8px] text-dim/40">REF</span>
    </div>
  );
  return <img src={image.src} onError={image.onError} className="w-full h-full object-cover" />;
}

function ImpactRefRow({ ref_ }: { ref_: ImpactReference }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/references/${ref_.id}`)}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-white/3 transition-precise text-left w-full group">
      <ImpactRefThumb src={ref_.thumbnail_data} />
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[13px] text-soft-white truncate block">{ref_.title}</span>
        <span className="font-mono text-[10px] text-readable tracking-widest uppercase">{ref_.kind}</span>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="font-mono text-[11px] text-amber">{ref_.result_win_count + ref_.project_winner_count}★</span>
        <span className="font-mono text-[9px] text-muted">{ref_.project_count} proj</span>
      </div>
    </button>
  );
}

// ─── Provider Format Block ────────────────────────────────────

function ProviderFormatBlock({ label, icon, color, borderColor, bgColor, content }: {
  label: string; icon: React.ReactNode; color: string;
  borderColor: string; bgColor: string; content: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-3 p-4 rounded-card" style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest transition-precise" style={{ color }}>
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {icon} {label}
        </button>
        <button type="button" onClick={handleCopy}
          className="font-mono text-[10px] uppercase tracking-widest transition-precise"
          style={{ color: copied ? "#fff" : color }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {open && (
        <pre className="selectable font-mono text-[11.5px] text-soft-white/80 whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {content}
        </pre>
      )}
    </div>
  );
}

// ─── Collapsible right-column card ─────────────────────────────
// Every card from PARAMETERS down to the AI Prompt Advisor shares this
// fold/unfold chrome so the whole right column can be scanned or tucked
// away section by section — mirrors the fold pattern RecommendationPanel's
// own internal Section component already uses (ChevronUp/ChevronDown).

function CollapsibleCard({
  title,
  icon,
  headerExtra,
  defaultOpen = true,
  gap = "gap-4",
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  defaultOpen?: boolean;
  gap?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("flex flex-col p-5 rounded-card", gap)} style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full group text-left">
        <span className="flex items-center gap-2 system-label text-soft-white">
          {icon}
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          {open
            ? <ChevronUp size={11} className="text-readable group-hover:text-cyan transition-precise" />
            : <ChevronDown size={11} className="text-readable group-hover:text-cyan transition-precise" />}
        </div>
      </button>
      {open && children}
    </div>
  );
}

// ─── Prompt thumbnail / source field ───────────────────────────
// Lets a prompt's cover image (the same one shown on its Library card and
// PromptDetail's hero) be set or replaced directly from the edit form — not
// just at import time. Previously this was only settable by importing with a
// source image attached, or by picking an existing saved result after the
// fact; skipping it during import left no way to add one later.

function PromptThumbnailField({
  thumbnailData,
  sourceUrl,
  onThumbnailChange,
  onSourceUrlChange,
}: {
  thumbnailData: string;
  sourceUrl: string;
  onThumbnailChange: (dataUrl: string) => void;
  onSourceUrlChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const image = useImageDisplaySrc(thumbnailData || undefined);

  const processFile = async (file: File) => {
    const full = await fileToDataUrl(file);
    const thumb = await thumbnailFromDataUrl(full, 480);
    onThumbnailChange(thumb);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) processFile(file);
  };

  const handleFetchFromUrl = async () => {
    if (!sourceUrl.trim() || thumbnailData || fetching) return;
    setFetching(true);
    setFetchError(false);
    try {
      const full = await fetchImageAsDataUrl(sourceUrl.trim());
      const thumb = await thumbnailFromDataUrl(full, 480);
      onThumbnailChange(thumb);
    } catch {
      setFetchError(true);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1.5 aspect-video rounded-card cursor-pointer transition-precise overflow-hidden text-center px-2",
          dragging ? "border-cyan/60" : "border-white/28 hover:border-white/45"
        )}
        style={{ border: "2px dashed", background: dragging ? "rgba(56,183,200,0.06)" : "rgba(255,255,255,0.035)" }}
      >
        {image.src ? (
          <img src={image.src} alt="Prompt thumbnail" className="w-full h-full object-cover" onError={image.onError} />
        ) : (
          <>
            <Upload size={16} className="text-dim/40" />
            <span className="font-mono text-[9px] text-dim tracking-widest uppercase leading-tight">
              {fetching ? "Fetching…" : "Drop or click"}
            </span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      </div>
      {thumbnailData ? (
        <button type="button" onClick={() => onThumbnailChange("")}
          className="font-mono text-[9px] text-dim/50 hover:text-red transition-precise text-left">
          × Remove thumbnail
        </button>
      ) : (
        <input
          value={sourceUrl}
          onChange={(e) => { setFetchError(false); onSourceUrlChange(e.target.value); }}
          onBlur={handleFetchFromUrl}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchFromUrl(); } }}
          placeholder="or paste source URL…"
          className="w-full h-7 px-2 font-mono text-[9px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none"
          style={{ border: fetchError ? "1px solid rgba(215,25,33,0.5)" : "1px solid rgba(255,255,255,0.10)" }}
        />
      )}
      {fetchError && <span className="font-mono text-[8px] text-red/70 leading-relaxed">Couldn't fetch that URL.</span>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export function CraftPrompt() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { create, update, getById, prompts: allPrompts } = usePromptStore();
  const prefillState = location.state as CraftPromptLocationState | null;
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get("projectId") ?? searchParams.get("project");

  const isEdit = Boolean(id);

  const [fields, setFields] = useState<Fields>(() => {
    const prefs = getPreferences();
    return {
      ...EMPTY,
      provider: (prefs.defaultProvider as Provider) || EMPTY.provider,
      category: prefs.defaultCategory || EMPTY.category,
      aspect_ratio: prefs.defaultAspectRatio || EMPTY.aspect_ratio,
    };
  });
  const [mjParams, setMjParams] = useState<MJParams>(() => {
    return { ...EMPTY_MJ };
  });
  const [dalleParams, setDalleParams] = useState<DalleParams>(EMPTY_DALLE);
  const [sdParams, setSDParams] = useState<SDParams>(EMPTY_SD);
  // Real shot-by-shot editor state (audit doc 05 §12/§13) — shared by
  // Seedance and Kling, previously "shot-by-shot" existed only as a
  // formula-step label with no actual input anywhere.
  const [shots, setShots] = useState<Shot[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingNewVersion, setSavingNewVersion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"builder" | "manual">("builder");
  const [originalVersion, setOriginalVersion] = useState(1);
  const [parentId, setParentId] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<Project | null>(null);
  const [appliedRecipeId, setAppliedRecipeId] = useState<string | undefined>(prefillState?.prefillRecipeId);

  // Production Memory (Phase 06)
  const [duplicates, setDuplicates] = useState<SimilarPrompt[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [relatedPrompts, setRelatedPrompts] = useState<Prompt[]>([]);

  // For editable assembled output
  const [outputOverride, setOutputOverride] = useState<string | null>(null);
  const [includeAvoidance, setIncludeAvoidance] = useState(false);
  const [tokenSequence, setTokenSequence] = useState<Token[]>([]);
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, string>>({});
  // Tokens routed into a matching builder field (V2 §7) — excluded from the
  // sequence extras join so their text isn't duplicated in the output.
  const [fieldTokenIds, setFieldTokenIds] = useState<Record<string, keyof Fields>>({});
  // Consistency factors (V2 §2) — elements held stable across variations.
  const [consistencyFactors, setConsistencyFactors] = useState<string[]>([]);
  const [factorInput, setFactorInput] = useState("");
  // Provider success formula (V2 §11) — per-prompt copy, editable + reorderable.
  const [formulaSteps, setFormulaSteps] = useState<string[]>(() => {
    const prefs = getPreferences();
    return getFormulaForProvider((prefs.defaultProvider as Provider) || EMPTY.provider);
  });
  const [formulaCustomized, setFormulaCustomized] = useState(false);
  const [usedAvoidanceIds, setUsedAvoidanceIds] = useState<Set<string>>(new Set());
  const [consistencyMatches, setConsistencyMatches] = useState<ConsistencyMatch[]>([]);
  const [providerMismatch, setProviderMismatch] = useState<ProviderMismatch | null>(null);
  const [consistencyDismissed, setConsistencyDismissed] = useState(false);
  const [consistencyRuleCounts, setConsistencyRuleCounts] = useState<Record<string, number>>({});
  const warnedRuleIdsRef = useRef<Set<string>>(new Set());
  const [provenCombos, setProvenCombos] = useState<ProvenCombo[]>([]);
  const [lowQualityDismissed, setLowQualityDismissed] = useState(false);
  const [srefPickerOpen, setSrefPickerOpen] = useState(false);
  const [selectedSref, setSelectedSref] = useState<Pick<SREF, "code" | "title"> | null>(null);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [advice, setAdvice] = useState<PromptAdvice>(EMPTY_ADVICE);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceDismissed, setAdviceDismissed] = useState(false);
  const [adviceJustIn, setAdviceJustIn] = useState(false);
  const [analyzeDirection, setAnalyzeDirection] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [impactRefs, setImpactRefs] = useState<ImpactReference[]>([]);
  const [projectRefs, setProjectRefs] = useState<{ id: string; title: string; kind: string; thumbnail_data?: string; rating: number }[]>([]);
  const [insightsReady, setInsightsReady] = useState(false);
  const promptLoadGuard = useRef(createLatestRequestGuard());
  const projectLoadGuard = useRef(createLatestRequestGuard());
  const impactLoadGuard = useRef(createLatestRequestGuard());
  const analysisGuard = useRef(createLatestRequestGuard());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!id) {
      const draft = loadCraftDraft(projectId);
      if (draft) {
        setFields(draft.fields);
        setMjParams(draft.mjParams);
        setDalleParams(draft.dalleParams);
        setSDParams(draft.sdParams);
        setShots(draft.shots);
        setMode(draft.mode);
        setTokenSequence(draft.tokenSequence);
        setTokenOverrides(draft.tokenOverrides);
        setFieldTokenIds(draft.fieldTokenIds);
        setConsistencyFactors(draft.consistencyFactors);
        setFormulaSteps(draft.formulaSteps);
        setFormulaCustomized(draft.formulaCustomized);
        setOutputOverride(draft.outputOverride);
        setIncludeAvoidance(draft.includeAvoidance);
        // Defer the hydrated flag to the next tick so the draft-save effect
        // (below) doesn't see this render's still-empty `fields` closure and
        // wipe the draft we just asked React to restore.
        window.setTimeout(() => { hydratedRef.current = true; }, 0);
      } else {
        hydratedRef.current = true;
      }
      return;
    }
    hydratedRef.current = false;
    const token = promptLoadGuard.current.begin();
    getById(id).then((p) => {
      if (!promptLoadGuard.current.isCurrent(token) || !p) return;
      setFields({
        ...EMPTY,
        title: p.title, description: p.description ?? "",
        provider: p.provider, category: p.category ?? "",
        use_case: p.use_case ?? "", aspect_ratio: p.aspect_ratio ?? "",
        prompt_text: p.prompt_text,
        avoidance_text: p.avoidance_text ?? "",
        camera: p.camera ?? "", lens: p.lens ?? "", lighting: p.lighting ?? "",
        rating: p.rating, ai_look_risk: p.ai_look_risk,
        tags: p.tags ?? [], notes: p.notes ?? "",
        is_winner: p.is_winner, is_failed: p.is_failed,
        thumbnail_data: p.thumbnail_data ?? "", source_url: p.source_url ?? "",
      });
      setParentId(p.parent_id ?? null);
      const pp = p.parameters ?? {};
      setMjParams((prev) => ({
        ...prev,
        aspect_ratio:  p.aspect_ratio    ?? "",
        model_version: p.model_version   ?? "",
        sref_code:     p.style_ref       ?? "",
        profile:       String(pp.profile  ?? ""),
        stylize:       String(pp.stylize  ?? ""),
        chaos:         String(pp.chaos    ?? ""),
        weird:         String(pp.weird    ?? ""),
        quality:       String(pp.quality  ?? ""),
        style:         String(pp.style    ?? ""),
        sw:            String(pp.sw       ?? ""),
        sv:            String(pp.sv       ?? ""),
        seed:          String(pp.seed     ?? ""),
        zoom:          String(pp.zoom     ?? ""),
        stop:          String(pp.stop     ?? ""),
        repeat:        String(pp.repeat   ?? ""),
        no_prompt:     String(pp.no       ?? ""),
        raw:   Boolean(pp.raw),
        hd:    Boolean(pp.hd),
        tile:  Boolean(pp.tile),
        fast:  Boolean(pp.fast),
        relax: Boolean(pp.relax),
        exp:   Boolean(pp.exp),
      }));
      // Restore DALL-E/SD params too (audit doc 05 §1) — previously only
      // Midjourney params were restored, so reopening a DALL-E prompt reset
      // its params to empty and the next autosave silently stripped the
      // [size: ...] etc. suffixes baked into prompt_text by assembleDalle().
      setDalleParams((prev) => ({ ...prev, ...restoreDalleParams(pp) }));
      setSDParams((prev) => ({ ...prev, ...restoreSDParams(pp) }));
      setOriginalVersion(p.version ?? 1);
      // Restore builder state if available
      if (p.builder_state) {
        try {
          const bs = JSON.parse(p.builder_state) as {
            mode?: "builder" | "manual";
            tokens?: { id: string; text: string; quality_score: number }[];
            overrides?: Record<string, string>;
            subject?: string; character?: string; environment?: string; composition?: string;
            mood?: string; realism?: string; variation?: string;
            motion?: string; duration?: string;
            narrative_format?: string; transitions?: string; audio?: string;
            text_graphics?: string; reference_role?: string;
            continuity_notes?: string; scene_world?: string; shots?: Shot[];
            usedAvoidanceIds?: string[];
            fieldTokenIds?: Record<string, keyof Fields>;
            consistencyFactors?: string[];
            formula?: string[];
            formulaCustomized?: boolean;
          };
          if (bs.mode) setMode(bs.mode);
          if (bs.tokens?.length) {
            setTokenSequence(bs.tokens.map((t) => ({
              id: t.id, text: t.text, quality_score: t.quality_score ?? 0,
              category_id: "", use_count: 0, is_builtin: false, is_favorite: false,
            })));
          }
          if (bs.overrides && Object.keys(bs.overrides).length) {
            setTokenOverrides(bs.overrides);
          }
          if (bs.usedAvoidanceIds?.length) {
            setUsedAvoidanceIds(new Set(bs.usedAvoidanceIds));
          }
          if (bs.fieldTokenIds && Object.keys(bs.fieldTokenIds).length) {
            setFieldTokenIds(bs.fieldTokenIds);
          }
          if (bs.consistencyFactors?.length) {
            setConsistencyFactors(bs.consistencyFactors);
          }
          setShots(bs.shots?.length ? bs.shots : []);
          // The formula is always saved with the prompt (doc 03 §1); only a
          // user-customized one overrides the provider default on reload, so
          // uncustomized prompts keep following improved provider defaults.
          // Older records saved formula only when customized — treat a saved
          // formula without the flag as customized.
          if (bs.formula?.length && (bs.formulaCustomized ?? true)) {
            setFormulaSteps(bs.formula);
            setFormulaCustomized(true);
          } else {
            setFormulaSteps(getFormulaForProvider(p.provider));
          }
          setFields((f) => ({
            ...f,
            subject: bs.subject ?? "",
            character: bs.character ?? "",
            environment: bs.environment ?? "",
            composition: bs.composition ?? "",
            mood: bs.mood ?? "",
            realism: bs.realism ?? "",
            variation: bs.variation ?? "",
            motion: bs.motion ?? "",
            duration: bs.duration ?? "",
            narrative_format: bs.narrative_format ?? "",
            transitions: bs.transitions ?? "",
            audio: bs.audio ?? "",
            text_graphics: bs.text_graphics ?? "",
            reference_role: bs.reference_role ?? "",
            continuity_notes: bs.continuity_notes ?? "",
            scene_world: bs.scene_world ?? "",
          }));
        } catch { /* ignore corrupt builder state */ }
      } else {
        setMode("manual");
        setFormulaSteps(getFormulaForProvider(p.provider));
        setShots([]);
      }
      hydratedRef.current = true;
    });
    return () => promptLoadGuard.current.invalidate();
  }, [id, getById, projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setInsightsReady(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    getAllConsistencyRuleCounts().then(setConsistencyRuleCounts).catch(() => {});
  }, []);

  useEffect(() => {
    projectLoadGuard.current.invalidate();
    if (!projectId) {
      setProjectContext(null);
      setImpactRefs([]);
      setProjectRefs([]);
      return;
    }
    const token = projectLoadGuard.current.begin();
    getProjectById(projectId).then((project) => {
      if (projectLoadGuard.current.isCurrent(token)) setProjectContext(project);
    });
    getReferencesForProject(projectId).then((refs) => {
      if (projectLoadGuard.current.isCurrent(token)) setProjectRefs(refs);
    }).catch(() => {});
    return () => projectLoadGuard.current.invalidate();
  }, [projectId]);

  // Pre-seed token from ?tokenId= when navigating from Token Library
  useEffect(() => {
    const tokenId = searchParams.get("tokenId");
    if (!tokenId || isEdit) return;
    getTokenById(tokenId).then((token) => {
      if (token) setTokenSequence((prev) => prev.some((t) => t.id === token.id) ? prev : [token, ...prev]);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    impactLoadGuard.current.invalidate();
    if (!projectId || !insightsReady) return;
    const timer = window.setTimeout(() => {
      const token = impactLoadGuard.current.begin();
      getHighImpactReferences(4, projectId).then((references) => {
        if (impactLoadGuard.current.isCurrent(token)) setImpactRefs(references);
      }).catch(() => {});
    }, 120);

    return () => {
      window.clearTimeout(timer);
      impactLoadGuard.current.invalidate();
    };
  }, [insightsReady, projectId]);

  useEffect(() => {
    if (id || !projectContext) return;
    setFields((current) => {
      const provider = projectProviderToPromptProvider(projectContext.provider_targets?.[0]);
      return {
        ...current,
        provider: current.provider === EMPTY.provider && provider ? provider : current.provider,
        category: current.category || projectContext.category || "",
        use_case: current.use_case || projectContext.intended_output || projectContext.production_goal || "",
        mood: current.mood || projectContext.visual_direction || "",
        notes: current.notes || [
          projectContext.creative_goals,
          projectContext.constraints ? `Constraints: ${projectContext.constraints}` : "",
        ].filter(Boolean).join("\n"),
        tags: current.tags.length ? current.tags : projectContext.tags ?? [],
      };
    });
    setFields((current) => ({
      ...current,
      aspect_ratio: current.aspect_ratio || projectContext.aspect_ratios?.[0] || "",
    }));
  }, [id, projectContext]);

  useEffect(() => {
    if (id || !prefillState?.prefillPromptText) return;
    setFields({
      ...EMPTY,
      title: prefillState.prefillTitle ?? "",
      prompt_text: prefillState.prefillPromptText,
      tags: prefillState.prefillRecipeId ? ["recipe-applied"] : [],
    });
    setMode("manual");
  }, [id, prefillState?.prefillPromptText, prefillState?.prefillTitle, prefillState?.prefillRecipeId]);

  const setF = <K extends keyof Fields>(key: K, val: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setOutputOverride(null);
  };

  // Stable callbacks — memo on the provider panels only bails out if these are stable.
  const setMJ = useCallback((k: keyof MJParams, v: string | boolean) => {
    setMjParams((p) => ({ ...p, [k]: v }));
    setOutputOverride(null);
  }, []);
  const setDalle = useCallback((k: keyof DalleParams, v: string) => {
    setDalleParams((p) => ({ ...p, [k]: v }));
    setOutputOverride(null);
  }, []);
  const setSD = useCallback((k: keyof SDParams, v: string) => {
    setSDParams((p) => ({ ...p, [k]: v }));
    setOutputOverride(null);
  }, []);
  const handleOpenSrefPicker = useCallback(() => setSrefPickerOpen(true), []);
  const handleClearSref = useCallback(() => setSelectedSref(null), []);

  // Formula follows the selected provider until the user customizes it (V2 §11).
  useEffect(() => {
    if (!formulaCustomized) setFormulaSteps(getFormulaForProvider(fields.provider));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.provider]);

  /** Undo a field-routed token: strip its text from the field it filled. */
  const unrouteToken = (token: Token) => {
    const fieldKey = fieldTokenIds[token.id];
    if (!fieldKey) return;
    const text = tokenOverrides[token.id] ?? token.text;
    setFields((f) => ({ ...f, [fieldKey]: removeClauseFromField(String(f[fieldKey] ?? ""), text) }));
    setFieldTokenIds((prev) => { const next = { ...prev }; delete next[token.id]; return next; });
  };

  const handleTokenToggle = (token: Token, categoryName?: string) => {
    const exists = tokenSequence.some((t) => t.id === token.id);
    if (exists) {
      unrouteToken(token);
      setTokenSequence((prev) => prev.filter((t) => t.id !== token.id));
    } else {
      // Route the token into its matching prompt field (V2 §7); it also joins
      // the sequence with a distinct accent, but is excluded from the extras
      // join so its text appears only once in the output.
      const fieldKey = categoryName ? CATEGORY_FIELD_MAP[categoryName] : undefined;
      if (fieldKey && mode === "builder") {
        setFields((f) => {
          const current = String(f[fieldKey] ?? "").trim();
          return { ...f, [fieldKey]: current ? `${current}, ${token.text}` : token.text };
        });
        setFieldTokenIds((prev) => ({ ...prev, [token.id]: fieldKey }));
      }
      setTokenSequence((prev) => [...prev, token]);
    }
    setOutputOverride(null);
  };

  const handleTokenReorder = (reordered: Token[]) => {
    setTokenSequence(reordered);
    setOutputOverride(null);
  };

  const handleTokenRemove = (tokenId: string) => {
    const token = tokenSequence.find((t) => t.id === tokenId);
    if (token) unrouteToken(token);
    setTokenSequence((prev) => prev.filter((t) => t.id !== tokenId));
    setTokenOverrides((prev) => { const next = { ...prev }; delete next[tokenId]; return next; });
    setOutputOverride(null);
  };

  const handleTokenEditCommit = (tokenId: string, text: string) => {
    setTokenOverrides((prev) => ({ ...prev, [tokenId]: text }));
    setOutputOverride(null);
  };

  const tokenTexts = useMemo(
    () => tokenSequence.map((t) => tokenOverrides[t.id] ?? t.text),
    [tokenSequence, tokenOverrides]
  );

  // Field-routed tokens already live inside their builder field — joining them
  // again as sequence extras would duplicate their text in the output.
  const extraTokenTexts = useMemo(
    () => tokenSequence.filter((t) => !fieldTokenIds[t.id]).map((t) => tokenOverrides[t.id] ?? t.text),
    [tokenSequence, tokenOverrides, fieldTokenIds]
  );

  const builtAssembled = (() => {
    if (mode === "manual") {
      // Manual mode's prompt_text is free text, not builder fields — but it
      // still needs the provider parameters (--ar, --seed, --sref, --no, …)
      // appended so Copy Prompt produces something actually paste-ready,
      // instead of silently dropping every parameter the user set (or that
      // import detected) whenever the prompt isn't in builder mode, which is
      // the case for every prompt brought in through Import.
      switch (fields.provider) {
        case "midjourney": return appendMJParams(fields.prompt_text, fields, mjParams);
        case "dalle": return appendDalleParams(fields.prompt_text, dalleParams);
        default: return fields.prompt_text;
      }
    }
    const extras = extraTokenTexts.length ? `, ${extraTokenTexts.join(", ")}` : "";
    switch (fields.provider) {
      case "midjourney": return assembleMJ(fields, mjParams) + extras;
      case "dalle": return assembleDalle(fields, dalleParams) + extras;
      case "stable_diffusion": return assembleSD(fields, sdParams) + extras;
      default: return assembleGeneric(fields, shots) + extras;
    }
  })();

  const assembled = outputOverride ?? builtAssembled;

  // Creative Director strategy (doc 04 §4) — shown in the Pre-Craft panel and
  // folded into the analysis brief so advice stays strategy-aligned.
  const projectStrategy = useMemo(
    () => readStoredStrategy(projectContext?.creative_strategy),
    [projectContext]
  );
  const projectStrategyContext = useMemo(
    () => (projectStrategy ? formatStrategyForContext(projectStrategy) : ""),
    [projectStrategy]
  );

  const deferredAssembled = useDeferredValue(assembled);
  const deferredProvider = useDeferredValue(fields.provider);
  const deferredCategory = useDeferredValue(fields.category);
  const projectTokenSuggestions = useMemo(
    () => buildProjectTokenSuggestions(projectContext, { selectedTexts: tokenTexts, promptText: assembled }),
    [projectContext, tokenTexts, assembled]
  );
  const suppressedTokenText = useMemo(
    () => buildSuppressionText(projectContext, fields.avoidance_text),
    [projectContext, fields.avoidance_text]
  );

  // Proven combo detection + recipe suggestions + low-quality reset
  useEffect(() => {
    if (tokenSequence.length < 2) { setProvenCombos([]); setRecipeSuggestions([]); return; }
    getProvenCombos(tokenSequence.map((t) => t.id)).then(setProvenCombos).catch(() => {});
    getRecipeSuggestions(tokenSequence.map((t) => t.text), 2, fields.provider).then(setRecipeSuggestions).catch(() => {});
    setLowQualityDismissed(false);
  }, [tokenSequence, fields.provider]);

  // Debounced duplicate + related prompts detection (Phase 06)
  useEffect(() => {
    if (!allPrompts.length) return;
    const timer = setTimeout(() => {
      if (deferredAssembled.trim().length > 30) {
        setDuplicates(findSimilarPrompts(deferredAssembled, allPrompts, 0.55, id));
        setDuplicatesDismissed(false);
      } else {
        setDuplicates([]);
      }
      setRelatedPrompts(findRelatedPrompts(deferredCategory, deferredProvider, id, allPrompts));
    }, 600);
    return () => clearTimeout(timer);
  }, [deferredAssembled, deferredCategory, deferredProvider, allPrompts.length, id]);

  // Rule-based inconsistency detection — conflicting camera/lighting/style/subject
  // instructions and image-vs-video provider mismatches (App Intelligence)
  useEffect(() => {
    const timer = setTimeout(() => {
      const matches = detectConsistencyIssues(deferredAssembled);
      const mismatch = detectProviderMismatch(deferredAssembled, deferredProvider);
      setConsistencyMatches(matches);
      setProviderMismatch(mismatch);
      setConsistencyDismissed(false);

      // Record each newly-appeared conflict once per editing session (not every
      // debounce tick while it stays active) so recurring conflicts accumulate
      // real frequency data instead of session noise.
      for (const m of matches) {
        if (!warnedRuleIdsRef.current.has(m.rule.id)) {
          warnedRuleIdsRef.current.add(m.rule.id);
          recordConsistencyEvent({
            rule_id: m.rule.id, rule_label: m.rule.label, suggestion: m.rule.suggestion,
            prompt_id: id, provider: deferredProvider, action: "warned",
          }).then(() => getAllConsistencyRuleCounts()).then(setConsistencyRuleCounts).catch(() => {});
        }
      }
      if (mismatch && !warnedRuleIdsRef.current.has("provider-mismatch")) {
        warnedRuleIdsRef.current.add("provider-mismatch");
        recordConsistencyEvent({
          rule_id: "provider-mismatch", rule_label: mismatch.label, suggestion: mismatch.suggestion,
          prompt_id: id, provider: deferredProvider, action: "warned",
        }).then(() => getAllConsistencyRuleCounts()).then(setConsistencyRuleCounts).catch(() => {});
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [deferredAssembled, deferredProvider, id]);

  const handleDismissConsistencyWarning = () => {
    setConsistencyDismissed(true);
    for (const m of consistencyMatches) {
      recordConsistencyEvent({
        rule_id: m.rule.id, rule_label: m.rule.label, suggestion: m.rule.suggestion,
        prompt_id: id, provider: fields.provider, action: "dismissed",
      }).catch(() => {});
    }
    if (providerMismatch) {
      recordConsistencyEvent({
        rule_id: "provider-mismatch", rule_label: providerMismatch.label, suggestion: providerMismatch.suggestion,
        prompt_id: id, provider: fields.provider, action: "dismissed",
      }).catch(() => {});
    }
  };

  const conflictingTokenIds = useMemo(() => {
    if (consistencyMatches.length === 0) return new Set<string>();
    const conflictingTexts = findConflictingTexts(tokenTexts, consistencyMatches);
    return new Set(
      tokenSequence
        .filter((t) => conflictingTexts.has(tokenOverrides[t.id] ?? t.text))
        .map((t) => t.id)
    );
  }, [consistencyMatches, tokenTexts, tokenSequence, tokenOverrides]);

  // Auto-analyze when preference is enabled and draft is long enough
  useEffect(() => {
    const request = analysisGuard.current.begin();
    if (!insightsReady || !getPreferences().autoAnalyzeDraft) {
      setAdviceLoading(false);
      return;
    }
    if (!validatePromptForAnalysis(deferredAssembled).valid) {
      setAdviceLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setAdviceLoading(true);
      setAdviceDismissed(false);
      try {
        const result = await analyzePromptDraft({
          promptText: deferredAssembled,
          formulaContext: formatFormulaForAI(formulaSteps, fields.provider),
          consistencyFactors: consistencyFactors.length ? consistencyFactors : undefined,
        });
        if (analysisGuard.current.isCurrent(request)) setAdvice(result);
      } catch {
        if (analysisGuard.current.isCurrent(request)) setAdvice(EMPTY_ADVICE);
      } finally {
        if (analysisGuard.current.isCurrent(request)) setAdviceLoading(false);
      }
    }, 1800);
    return () => {
      clearTimeout(timer);
      analysisGuard.current.invalidate();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredAssembled, insightsReady]);

  const handleSuggestTags = async () => {
    const check = validatePromptForAnalysis(assembled);
    if (!check.valid) { toast.error(check.message ?? "Prompt too short to suggest tags"); return; }
    setSuggestingTags(true);
    setTagSuggestions([]);
    try {
      const result = await generateTagSuggestions({ promptText: assembled, existingTags: fields.tags });
      setTagSuggestions(result.tags);
      if (!result.tags.length) toast.error("No new tags to suggest — try a longer prompt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tag suggestion failed — check your API key in Settings");
    } finally {
      setSuggestingTags(false);
    }
  };

  const handleAnalyzeDraft = async (focusDirection?: string) => {
    const check = validatePromptForAnalysis(assembled);
    if (!check.valid) { toast.error(check.message ?? "Add more to the prompt before analyzing"); return; }
    const request = analysisGuard.current.begin();
    setAdviceLoading(true);
    setAdviceDismissed(false);
    try {
      const result = await analyzePromptDraft({
        promptText: assembled,
        // Brief context includes the project's saved Creative Director strategy
        // (doc 04 §4), the relevant image/video needs (audit doc 05 §7), and
        // the shot-by-shot list as read-only context (audit doc 05 §12/§13) —
        // shots are an ordered list, not a single field, so they inform advice
        // rather than being an individually-improvable target field.
        brief: [
          projectContext?.brief_text,
          isVideoProvider(fields.provider) ? projectContext?.video_needs : projectContext?.image_needs,
          isVideoProvider(fields.provider) && shots.length ? `Shot list: ${formatShotsForAssembly(shots)}` : "",
          projectStrategyContext,
        ].filter(Boolean).join("\n\n") || undefined,
        provenTokens: tokenSequence.filter((t) => t.quality_score > 0.3).map((t) => t.text).slice(0, 5),
        fields: mode === "builder" ? {
          subject: fields.subject || undefined,
          character: fields.character || undefined,
          environment: fields.environment || undefined,
          composition: fields.composition || undefined,
          camera: fields.camera || undefined,
          lens: fields.lens || undefined,
          lighting: fields.lighting || undefined,
          mood: fields.mood || undefined,
          realism: fields.realism || undefined,
          ...(fields.provider === "nano_banana" ? {
            text_graphics: fields.text_graphics || undefined,
            reference_role: fields.reference_role || undefined,
          } : {}),
          ...(isVideoProvider(fields.provider) ? {
            motion: fields.motion || undefined,
            transitions: fields.transitions || undefined,
            audio: fields.audio || undefined,
            continuity_notes: fields.continuity_notes || undefined,
          } : {}),
          ...(fields.provider === "kling" ? {
            scene_world: fields.scene_world || undefined,
          } : {}),
        } : undefined,
        userDirection: focusDirection ?? (analyzeDirection || undefined),
        formulaContext: formatFormulaForAI(formulaSteps, fields.provider),
        consistencyFactors: consistencyFactors.length ? consistencyFactors : undefined,
      });
      if (!analysisGuard.current.isCurrent(request)) return;
      setAdvice(result);
      const total = result.suggestions.length + result.risks.length + result.improvements.length;
      if (total > 0) {
        setAdviceJustIn(true);
        setTimeout(() => setAdviceJustIn(false), 2000);
        toast.success(`Analysis found ${total} point${total !== 1 ? "s" : ""} to review`);
      } else {
        toast.success("Analysis complete — no issues found");
      }
    } catch (err) {
      if (analysisGuard.current.isCurrent(request)) {
        toast.error(err instanceof Error ? err.message : "Analysis failed — check your API key in Settings");
      }
    } finally {
      if (analysisGuard.current.isCurrent(request)) setAdviceLoading(false);
    }
  };

  const varSuffix = fields.variation.trim() ? `, ${fields.variation.trim()}` : "";
  // Consistency factors ride along on copy so variations hold them stable (V2 §2).
  const consistencySuffix = buildConsistencySuffix(consistencyFactors);
  const consistencyBlock = consistencySuffix ? `\n${consistencySuffix}` : "";
  const fullCopyText = includeAvoidance && fields.avoidance_text
    ? `${assembled}${varSuffix}${consistencyBlock}\n\n${fields.avoidance_text}`
    : `${assembled}${varSuffix}${consistencyBlock}`;

  const charCount = assembled.length;

  const lowQualityTokens = useMemo(
    () => tokenSequence.filter((t) => !tokenOverrides[t.id] && t.quality_score < -0.1),
    [tokenSequence, tokenOverrides]
  );
  const availableRecipes = useMemo(
    () =>
      allPrompts
        .filter((p) => p.is_recipe && p.id !== id)
        .filter((r) => r.provider === fields.provider)
        .filter((r) => !fields.category || !r.category || r.category === fields.category)
        .slice(0, 5),
    [allPrompts, id, fields.category, fields.provider]
  );

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!fields.title.trim()) errs.title = "Required";
    if (!assembled.trim()) errs.prompt_text = "Required";
    setErrors(errs);
    // Previously this only set inline field errors with no toast — clicking
    // Save with a missing title or empty prompt did nothing visible at all,
    // reading exactly like a broken button. Surface it loudly instead.
    if (errs.title && errs.prompt_text) {
      toast.error("Add a title and write a prompt before saving.");
    } else if (errs.title) {
      toast.error("Add a title before saving.");
    } else if (errs.prompt_text) {
      toast.error("Nothing to save yet — fill in the prompt fields or write a prompt.");
    }
    return Object.keys(errs).length === 0;
  };

  const buildData = (asRecipe = false): CreatePromptInput => ({
    title: fields.title.trim(),
    description: fields.description || undefined,
    provider: fields.provider,
    category: (fields.category as Category) || undefined,
    use_case: fields.use_case || undefined,
    prompt_text: assembled,
    avoidance_text: fields.avoidance_text || undefined,
    aspect_ratio:  fields.aspect_ratio    || undefined,
    model_version: mjParams.model_version || undefined,
    style_ref:     mjParams.sref_code     || undefined,
    // Persist provider-specific params for DALL-E and Stable Diffusion too
    // (audit doc 05 §1) — previously only Midjourney params were ever
    // written to the DB, so reopening any other provider's prompt lost its
    // params entirely, and for DALL-E the next autosave then stripped the
    // param suffixes already baked into prompt_text by assembleDalle().
    parameters: buildProviderParameters(fields.provider, mjParams, dalleParams, sdParams),
    camera: fields.camera || undefined,
    lens: fields.lens || undefined,
    lighting: fields.lighting || undefined,
    tags: fields.tags.length ? fields.tags : undefined,
    rating: fields.rating,
    ai_look_risk: fields.ai_look_risk,
    is_winner: fields.is_winner,
    is_failed: fields.is_failed,
    is_recipe: asRecipe,
    parent_id: !isEdit ? appliedRecipeId ?? prefillState?.prefillRecipeId : undefined,
    notes: fields.notes || undefined,
    thumbnail_data: fields.thumbnail_data || undefined,
    source_url: fields.source_url || undefined,
    builder_state: JSON.stringify({
      mode,
      tokens: tokenSequence.map((t) => ({ id: t.id, text: tokenOverrides[t.id] ?? t.text, quality_score: t.quality_score })),
      overrides: tokenOverrides,
      subject: fields.subject,
      character: fields.character,
      environment: fields.environment,
      composition: fields.composition,
      mood: fields.mood,
      realism: fields.realism,
      variation: fields.variation,
      motion: fields.motion,
      duration: fields.duration,
      narrative_format: fields.narrative_format,
      transitions: fields.transitions,
      audio: fields.audio,
      text_graphics: fields.text_graphics,
      reference_role: fields.reference_role,
      continuity_notes: fields.continuity_notes,
      scene_world: fields.scene_world,
      shots,
      usedAvoidanceIds: Array.from(usedAvoidanceIds),
      fieldTokenIds,
      consistencyFactors,
      formula: formulaSteps,
      formulaCustomized,
    }),
  });

  const handleApplyRecipe = (recipe: Prompt) => {
    const draft = buildRecipeDraft(recipe);
    setFields((current) => ({
      ...current,
      title: draft.title,
      provider: draft.provider,
      category: draft.category,
      prompt_text: draft.promptText,
      tags: draft.tags,
    }));
    setAppliedRecipeId(draft.parentId);
    setMode("manual");
    setOutputOverride(null);
  };

  const handleReset = useCallback(() => {
    const prefs = getPreferences();
    setFields({
      ...EMPTY,
      provider: (prefs.defaultProvider as Provider) || EMPTY.provider,
      category: prefs.defaultCategory || EMPTY.category,
      aspect_ratio: prefs.defaultAspectRatio || EMPTY.aspect_ratio,
    });
    setMjParams({ ...EMPTY_MJ });
    setDalleParams(EMPTY_DALLE);
    setSDParams(EMPTY_SD);
    setShots([]);
    setErrors({});
    setMode("builder");
    setOutputOverride(null);
    setAdvice(EMPTY_ADVICE);
    setAdviceDismissed(false);
    setLowQualityDismissed(false);
    setTagSuggestions([]);
    setFormatChanges([]);
    setTokenSequence([]);
    setTokenOverrides({});
    setFieldTokenIds({});
    setConsistencyFactors([]);
    setFactorInput("");
    setFormulaCustomized(false);
    setFormulaSteps(getFormulaForProvider((getPreferences().defaultProvider as Provider) || EMPTY.provider));
    clearCraftDraft(projectId);
  }, [projectId]);

  const handleSave = async (asRecipe = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await update(id, buildData(asRecipe));
        toast.success("Prompt updated");
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      } else {
        const newId = await create(buildData(asRecipe));
        toast.success(asRecipe ? "Recipe saved" : "Prompt saved");
        clearCraftDraft(projectId);
        if (projectId) {
          try {
            await addPromptToProject(projectId, newId);
          } catch (linkErr) {
            toast.error(
              `Prompt saved, but could not attach it to the project: ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`
            );
          }
          navigate(`/projects/${projectId}`);
        } else {
          navigate(`/library/${newId}`);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewVersion = async () => {
    if (!validate()) return;
    setSavingNewVersion(true);
    try {
      const newId = await create({
        ...buildData(false),
        parent_id: id,
        version: originalVersion + 1,
      });
      toast.success("New version saved");
      if (projectId) {
        try {
          await addPromptToProject(projectId, newId);
        } catch (linkErr) {
          toast.error(
            `Version saved, but could not attach it to the project: ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`
          );
        }
        navigate(`/projects/${projectId}`);
      } else {
        navigate(`/library/${newId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingNewVersion(false);
    }
  };

  // Silent autosave for existing prompts — mirrors ProjectWorkspace's debounced pattern.
  useEffect(() => {
    if (!isEdit || !id || !hydratedRef.current || !fields.title.trim() || !assembled.trim()) return;
    const timer = window.setTimeout(() => {
      setSaving(true);
      update(id, buildData(false))
        .then(() => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1200);
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : String(err) || "Autosave failed");
        })
        .finally(() => setSaving(false));
    }, 800);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id, isEdit, fields, mjParams, dalleParams, sdParams, mode,
    tokenSequence, tokenOverrides, assembled,
    fieldTokenIds, consistencyFactors, formulaSteps,
  ]);

  // Draft persistence for *new* (unsaved) prompts — lets the user browse to
  // another page (Tokens, Library, …) and come back without losing what
  // they've typed. Cleared explicitly by Reset or once the prompt is saved.
  useEffect(() => {
    if (isEdit || !hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (isEmptyDraftState(fields, tokenSequence, shots)) {
        clearCraftDraft(projectId);
        return;
      }
      saveCraftDraft(projectId, {
        fields, mjParams, dalleParams, sdParams, shots, mode,
        tokenSequence, tokenOverrides, fieldTokenIds, consistencyFactors,
        formulaSteps, formulaCustomized, outputOverride, includeAvoidance,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEdit, projectId, fields, mjParams, dalleParams, sdParams, shots, mode,
    tokenSequence, tokenOverrides, fieldTokenIds, consistencyFactors,
    formulaSteps, formulaCustomized, outputOverride, includeAvoidance,
  ]);

  const handleCopy = async () => {
    if (!fullCopyText) return;
    await navigator.clipboard.writeText(fullCopyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const [formatChanges, setFormatChanges] = useState<string[]>([]);
  const handleFormatPrompt = () => {
    if (!assembled) return;
    const { text, changes } = formatPromptForProvider(assembled, fields.provider);
    if (text !== assembled) {
      setOutputOverride(text);
      setFormatChanges(changes);
      setTimeout(() => setFormatChanges([]), 4000);
    }
  };

  // ── Image Description AI (right column, under Prompt Output) ──
  const [describeModel, setDescribeModel] = useState<AIModel>(() => pickVisionModel() ?? VISION_MODELS[0]);
  const [describeImageFile, setDescribeImageFile] = useState<File | null>(null);
  const [describeImageUrl, setDescribeImageUrl] = useState("");
  const [describeAspectRatio, setDescribeAspectRatio] = useState("");
  const [describeQuestion, setDescribeQuestion] = useState("");
  const [describing, setDescribing] = useState(false);
  const [describeResult, setDescribeResult] = useState("");
  const [describeElements, setDescribeElements] = useState<DescribeElements | null>(null);
  const [describeError, setDescribeError] = useState("");
  const [describeCopied, setDescribeCopied] = useState(false);
  const [formulaCopied, setFormulaCopied] = useState(false);
  const describeApiKey = getApiKey(describeModel.provider);

  // Recomputed purely client-side from the last analysis whenever the builder's
  // provider changes — no extra vision call needed to re-target the formula.
  const formulaRows: FormulaRow[] = useMemo(
    () => (describeElements ? buildFormulaRows(describeElements, fields.provider, describeAspectRatio) : []),
    [describeElements, fields.provider, describeAspectRatio]
  );
  const formulaText = useMemo(() => formatFormulaRows(formulaRows), [formulaRows]);

  useEffect(() => () => { if (describeImageUrl) URL.revokeObjectURL(describeImageUrl); }, [describeImageUrl]);

  const handleDescribeFile = useCallback((file: File) => {
    setDescribeImageFile(file);
    setDescribeImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setDescribeResult("");
    setDescribeElements(null);
    setDescribeError("");
    setDescribeAspectRatio("");
    // Exact ratio from the real pixels — more reliable than asking the vision
    // model to guess, and feeds the formula's Midjourney-style Parameters step.
    const probeUrl = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setDescribeAspectRatio(computeAspectRatioLabel(probe.naturalWidth, probe.naturalHeight));
      URL.revokeObjectURL(probeUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(probeUrl);
    probe.src = probeUrl;
  }, []);

  const handleDescribeDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (file) handleDescribeFile(file);
  }, [handleDescribeFile]);

  const {
    getRootProps: getDescribeRootProps,
    getInputProps: getDescribeInputProps,
    isDragActive: describeDragActive,
  } = useDropzone({
    onDrop: handleDescribeDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    multiple: false,
  });

  const handleDescribeAnalyze = async () => {
    if (!describeImageFile) return;
    setDescribing(true);
    setDescribeError("");
    setDescribeResult("");
    setDescribeElements(null);
    try {
      const dataUrl = await fileToDataUrl(describeImageFile);
      const [header, base64] = dataUrl.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      const { description, elements } = await describeImageForFormula(base64, mimeType, describeModel, describeQuestion);
      setDescribeResult(description);
      setDescribeElements(elements);
    } catch (e) {
      setDescribeError(e instanceof Error ? e.message : "Description failed. Check your API key in Settings.");
    } finally {
      setDescribing(false);
    }
  };

  const handleDescribeCopy = async () => {
    if (!describeResult) return;
    await navigator.clipboard.writeText(describeResult);
    setDescribeCopied(true);
    setTimeout(() => setDescribeCopied(false), 1500);
  };

  const handleFormulaCopy = async () => {
    if (!formulaText) return;
    await navigator.clipboard.writeText(formulaText);
    setFormulaCopied(true);
    setTimeout(() => setFormulaCopied(false), 1500);
  };

  useShortcut("cmd+s", () => { if (!saving && !savingNewVersion) handleSave(false); });
  useShortcut("cmd+shift+r", handleReset);

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="system-label text-[13px] text-soft-white">{label}</span>
      <div className="flex-1 h-px bg-white/16" />
    </div>
  );

  const builderFields: { key: keyof Fields; label: string; placeholder: string }[] = [
    { key: "character", label: "CHARACTER", placeholder: "identity, role, appearance, continuity details" },
    { key: "environment", label: "ENVIRONMENT", placeholder: "golden hour forest" },
    { key: "composition", label: "COMPOSITION", placeholder: "rule of thirds, negative space" },
    { key: "camera", label: "CAMERA", placeholder: "low angle tracking shot" },
    { key: "lens", label: "LENS", placeholder: "14mm ultra-wide" },
    { key: "lighting", label: "LIGHTING", placeholder: "natural morning sunlight" },
    { key: "mood", label: "MOOD / BRAND TONE", placeholder: "documentary realism" },
  ];

  // Audit doc 05 §6 — the subtitle used to read "PROJECT CRAFT - {title}"
  // before the Section 6 Pre-Craft rename mechanically turned it into
  // "PRE-CRAFT", mislabeling this page with the *other* section's name.
  return (
    <>
    <PageContainer
      title={isEdit ? "Edit Prompt" : "Prompt Craft"}
      subtitle={projectContext ? `PROMPT CRAFT - ${projectContext.title}` : isEdit ? `EDITING VERSION ${originalVersion} — UPDATE OR FORK NEW VERSION` : "BUILD A PROVIDER-READY PROMPT"}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(projectId ? `/projects/${projectId}` : isEdit && id ? `/library/${id}` : "/library")}>
            <ArrowLeft size={11} /> {projectId ? "Project" : isEdit ? "Cancel" : "Library"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!assembled}>
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFormatPrompt} disabled={!assembled}>
            Format
          </Button>
          {!isEdit && (
            <Button variant="ghost" size="sm" onClick={() => handleSave(true)} disabled={saving}>
              Save as Recipe
            </Button>
          )}
          {isEdit && (
            // min-w keeps the label swap (Update/Saving…/Saved) from shifting the row during autosave
            <Button variant="ghost" size="sm" onClick={() => handleSave(false)} disabled={saving || savingNewVersion} className="min-w-20 justify-center">
              <Save size={10} />
              {saving ? "Saving…" : saved ? "Saved" : "Update"}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={isEdit ? handleSaveNewVersion : () => handleSave(false)}
            disabled={saving || savingNewVersion}
            className="min-w-36 justify-center"
          >
            <Save size={11} />
            {isEdit
              ? savingNewVersion ? "Saving…" : `New Version v${originalVersion + 1}`
              : saving ? "Saving…" : "Save to Library"
            }
          </Button>
          {/* Reset stays last in the action sequence (V2 §9) */}
          <Button variant="ghost" size="sm" onClick={handleReset} title="Reset all fields">
            <RotateCcw size={11} />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 min-w-0">
        {/* ── Left: Main form ─────────────────────────────── */}
        <div className="flex flex-col gap-8 min-w-0">
          {projectContext && (
            <div className="flex flex-col gap-3 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="system-label text-soft-white">PROJECT CONTEXT</span>
                  <span className="font-sans text-[16px] text-white font-semibold truncate">{projectContext.title}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectContext.id}`)}>
                  <ArrowLeft size={10} /> Back to Project
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {projectContext.provider_targets?.map((provider) => (
                  <span key={provider} className="font-mono text-[10px] tracking-widest uppercase text-cyan px-2 py-1 rounded-sm"
                    style={{ border: "1px solid rgba(72, 229, 232, 0.28)", background: "rgba(72, 229, 232, 0.06)" }}>
                    {provider}
                  </span>
                ))}
                {projectContext.aspect_ratios?.map((ratio) => (
                  <span key={ratio} className="font-mono text-[10px] tracking-widest uppercase text-readable px-2 py-1 rounded-sm"
                    style={{ border: "var(--border-dim)" }}>
                    {ratio}
                  </span>
                ))}
              </div>
              {projectContext.brief_text && (
                <div className="flex flex-col gap-1">
                  <span className="system-label text-[10px] text-muted">BRIEF</span>
                  <p className="font-mono text-[13px] text-readable leading-relaxed">
                    {projectContext.brief_text}
                  </p>
                </div>
              )}
              {(projectContext.visual_direction || projectContext.creative_goals) && (
                <div className="flex flex-col gap-1">
                  <span className="system-label text-[10px] text-muted">DIRECTION</span>
                  <p className="font-mono text-[13px] text-readable leading-relaxed">
                    {projectContext.visual_direction || projectContext.creative_goals}
                  </p>
                </div>
              )}
              {/* Audit doc 05 §7 — image_needs/video_needs from Pre-Craft
                  previously never reached Prompt Craft at all. Gated by
                  provider type, matching the isVideoProvider pattern already
                  used for builder fields. */}
              {!isVideoProvider(fields.provider) && projectContext.image_needs && (
                <div className="flex flex-col gap-1">
                  <span className="system-label text-[10px] text-muted">IMAGE NEEDS</span>
                  <p className="font-mono text-[13px] text-readable leading-relaxed">
                    {projectContext.image_needs}
                  </p>
                </div>
              )}
              {isVideoProvider(fields.provider) && projectContext.video_needs && (
                <div className="flex flex-col gap-1">
                  <span className="system-label text-[10px] text-muted">VIDEO NEEDS</span>
                  <p className="font-mono text-[13px] text-readable leading-relaxed">
                    {projectContext.video_needs}
                  </p>
                </div>
              )}
              {projectStrategy?.campaign_idea && (
                <div className="flex flex-col gap-1">
                  <span className="system-label text-[10px] text-cyan/60">STRATEGY</span>
                  <p className="font-mono text-[13px] text-readable leading-relaxed">
                    {projectStrategy.campaign_idea}
                    {projectStrategy.product_message ? ` — ${projectStrategy.product_message}` : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Duplicate warning */}
          {duplicates.length > 0 && !duplicatesDismissed && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.3)", background: "rgba(215,25,33,0.05)" }}
            >
              <AlertCircle size={12} className="text-red/70 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[9px] text-red/70 uppercase tracking-widest">Similar prompts found</span>
                <div className="flex flex-col gap-1 mt-1.5">
                  {duplicates.map((d) => (
                    <div key={d.prompt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/library/${d.prompt.id}`)}
                        className="font-mono text-[10px] text-muted hover:text-white transition-precise truncate text-left"
                      >
                        {d.prompt.title}
                      </button>
                      <span className="font-mono text-[9px] text-dim/50 shrink-0">{Math.round(d.similarity * 100)}% match</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicatesDismissed(true)}
                className="font-mono text-[9px] text-dim/50 hover:text-white shrink-0 transition-precise"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Identity */}
          <div>
            <SectionHeader label="IDENTITY" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label text-[12px] text-muted">TITLE</label>
                  {errors.title && <span className="font-mono text-[9px] text-red/80 flex items-center gap-1"><AlertCircle size={8} />{errors.title}</span>}
                </div>
                <input
                  value={fields.title}
                  onChange={(e) => setF("title", e.target.value)}
                  placeholder="Give this prompt a unique name…"
                  className="w-full h-10 px-3 font-sans text-[15px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                  style={{ border: errors.title ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.16)" }}
                />
              </div>
              <Input
                value={fields.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="Brief description of what this produces…"
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <FieldSelect
                  label="PROVIDER"
                  value={fields.provider}
                  onChange={(v) => { setF("provider", v as Provider); setOutputOverride(null); }}
                  options={PROVIDERS}
                />
                <FieldSelect label="CATEGORY" value={fields.category} onChange={(v) => setF("category", v)} options={CATEGORIES} />
                <FieldSelect label="ASPECT RATIO" value={fields.aspect_ratio} onChange={(v) => setF("aspect_ratio", v)} options={ASPECT_RATIOS} />
              </div>
              <Input
                value={fields.use_case}
                onChange={(e) => setF("use_case", e.target.value)}
                placeholder="Use case: hero banner, product page, social…"
              />
              {/* Provider success formula (V2 §11) */}
              <div className="p-3 rounded-sm" style={{ border: "1px solid rgba(72,229,232,0.18)", background: "rgba(72,229,232,0.025)" }}>
                <FormulaBar
                  steps={formulaSteps}
                  provider={fields.provider}
                  onChange={(steps) => { setFormulaSteps(steps); setFormulaCustomized(true); }}
                  onResetToDefault={() => { setFormulaSteps(getFormulaForProvider(fields.provider)); setFormulaCustomized(false); }}
                />
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div>
            <SectionHeader label="PROMPT" />
            <div className="flex items-center gap-2 mb-4">
              {(["builder", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setOutputOverride(null); }}
                  className={cn(
                    "font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded transition-precise",
                    mode === m ? "text-white" : "text-readable hover:text-cyan"
                  )}
                  style={{
                    border: mode === m ? "var(--border-strong)" : "var(--border-dim)",
                    background: mode === m ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  {m === "builder" ? "Builder" : "Manual"}
                </button>
              ))}
            </div>

            {mode === "builder" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Subject / Action — full width, taller, one line (V2 §9) */}
                <div className="col-span-full flex flex-col gap-1.5">
                  <label className="system-label text-[12px] text-muted">SUBJECT / ACTION</label>
                  <input
                    value={fields.subject}
                    onChange={(e) => setF("subject", e.target.value)}
                    placeholder="woman running through field"
                    className="w-full h-13 px-3 font-mono text-[14px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                  />
                </div>
                {builderFields.map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="system-label text-[12px] text-muted">{label}</label>
                    <input
                      value={fields[key] as string}
                      onChange={(e) => setF(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                      style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                    />
                  </div>
                ))}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="system-label text-[12px] text-muted">REALISM NOTES</label>
                  <input
                    value={fields.realism}
                    onChange={(e) => setF("realism", e.target.value)}
                    placeholder="authentic skin texture, real terrain imperfections…"
                    className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                  />
                </div>
                {/* Nano Banana brief fields — in-image text + reference roles (doc 03 §3) */}
                {fields.provider === "nano_banana" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">TEXT / TYPOGRAPHY</label>
                      <input
                        value={fields.text_graphics}
                        onChange={(e) => setF("text_graphics", e.target.value)}
                        placeholder='headline "SUMMER" in bold grotesk, top third'
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">REFERENCE ROLE</label>
                      <input
                        value={fields.reference_role}
                        onChange={(e) => setF("reference_role", e.target.value)}
                        placeholder="match lighting from ref 1, product from ref 2"
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                  </>
                )}
                {/* Video-only fields — hidden entirely for image-only providers (doc 03 §4–5) */}
                {isVideoProvider(fields.provider) && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">NARRATIVE FORMAT</label>
                      <select
                        value={fields.narrative_format}
                        onChange={(e) => setF("narrative_format", e.target.value)}
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      >
                        <option value="">No narrative arc</option>
                        {NARRATIVE_FORMATS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label} — {f.arc}</option>
                        ))}
                      </select>
                    </div>
                    {/* Kling-only — distinct from generic Environment (audit doc 05 §13) */}
                    {fields.provider === "kling" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="system-label text-[12px] text-muted">SCENE WORLD / SPATIAL LOGIC</label>
                        <input
                          value={fields.scene_world}
                          onChange={(e) => setF("scene_world", e.target.value)}
                          placeholder="cramped subway car, single overhead light source, tight blocking"
                          className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">MOTION / CAMERA MOVEMENT</label>
                      <input
                        value={fields.motion}
                        onChange={(e) => setF("motion", e.target.value)}
                        placeholder="slow dolly in, handheld sway"
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                    {/* Real shot-by-shot editor, shared by Seedance and Kling (audit doc 05 §12/§13) */}
                    <ShotListEditor shots={shots} onChange={setShots} />
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">TRANSITIONS</label>
                      <input
                        value={fields.transitions}
                        onChange={(e) => setF("transitions", e.target.value)}
                        placeholder="match cut on hands, dissolve to wide"
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">{fields.provider === "kling" ? "CONTINUITY LOCK" : "CONTINUITY RULES"}</label>
                      <input
                        value={fields.continuity_notes}
                        onChange={(e) => setF("continuity_notes", e.target.value)}
                        placeholder={fields.provider === "kling" ? "same character face, same outfit, same lighting" : "consistent character identity and wardrobe across shots"}
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">{fields.provider === "kling" ? "AUDIO / DIALOGUE" : "AUDIO / RHYTHM"}</label>
                      <input
                        value={fields.audio}
                        onChange={(e) => setF("audio", e.target.value)}
                        placeholder={fields.provider === "kling" ? 'she whispers "ready?", low ambient hum' : "slow pulse building to silence"}
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="system-label text-[12px] text-muted">DURATION</label>
                      <input
                        value={fields.duration}
                        onChange={(e) => setF("duration", e.target.value)}
                        placeholder="5s, 10s…"
                        className="w-full h-10 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label text-[12px] text-muted">PROMPT TEXT</label>
                  {errors.prompt_text && <span className="font-mono text-[9px] text-red/80">{errors.prompt_text}</span>}
                </div>
                <Textarea
                  value={fields.prompt_text}
                  onChange={(e) => setF("prompt_text", e.target.value)}
                  placeholder="Paste or type your full prompt here…"
                  rows={6}
                  mono
                />
              </div>
            )}

            {/* Inconsistency warnings — conflicting instructions + provider mismatch, both modes */}
            {!consistencyDismissed && (consistencyMatches.length > 0 || providerMismatch) && (
              <div className="flex flex-col gap-2 px-3 py-2.5 mt-4 rounded-sm"
                style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.04)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-amber/80">
                    <AlertCircle size={10} /> Inconsistency check
                  </span>
                  <button type="button" onClick={handleDismissConsistencyWarning} className="text-amber/60 hover:text-white text-[10px]">×</button>
                </div>
                {consistencyMatches.map((m) => (
                  <div key={m.rule.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9.5px] text-amber/90 leading-relaxed">{m.rule.label}</span>
                      {consistencyRuleCounts[m.rule.id] > 1 && (
                        <span className="font-mono text-[8px] text-amber/50">· seen {consistencyRuleCounts[m.rule.id]}×</span>
                      )}
                    </div>
                    <span className="font-mono text-[9px] text-white/50 leading-relaxed">{m.rule.suggestion}</span>
                  </div>
                ))}
                {providerMismatch && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9.5px] text-amber/90 leading-relaxed">{providerMismatch.label}</span>
                      {consistencyRuleCounts["provider-mismatch"] > 1 && (
                        <span className="font-mono text-[8px] text-amber/50">· seen {consistencyRuleCounts["provider-mismatch"]}×</span>
                      )}
                    </div>
                    <span className="font-mono text-[9px] text-white/50 leading-relaxed">{providerMismatch.suggestion}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Token Library — builder mode only */}
          {mode === "builder" && (
            <div>
              <SectionHeader label="TOKEN LIBRARY" />
              <div
                className="flex flex-col gap-7 p-5 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
              >
                {/* Sequence builder */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="system-label text-[10px] text-muted">SEQUENCE</span>
                    {tokenSequence.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          tokenSequence.forEach(unrouteToken);
                          setTokenSequence([]); setTokenOverrides({}); setOutputOverride(null);
                        }}
                        className="font-mono text-[10px] text-muted hover:text-red transition-precise"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <SequenceBuilder
                    tokens={tokenSequence}
                    overrides={tokenOverrides}
                    onReorder={handleTokenReorder}
                    onRemove={handleTokenRemove}
                    onEditCommit={handleTokenEditCommit}
                    conflictingIds={conflictingTokenIds}
                    fieldRoutedIds={new Set(Object.keys(fieldTokenIds))}
                  />
                </div>

                {/* Proven combinations — shown when selected tokens have a co-occurrence history */}
                {provenCombos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="system-label text-[10px] text-muted">PROVEN COMBINATIONS</span>
                    <div className="flex flex-col gap-1">
                      {provenCombos.slice(0, 3).map((combo) => (
                        <div
                          key={`${combo.token_a_id}|${combo.token_b_id}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm"
                          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}
                        >
                          <span className="font-mono text-[9px] text-white/60 truncate">
                            {combo.token_a_text} + {combo.token_b_text}
                          </span>
                          <span className="font-mono text-[8px] text-white/35 shrink-0 tabular-nums">
                            {combo.avg_rating.toFixed(1)}/5 · {combo.co_occurrence_count}×
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recipeSuggestions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="system-label text-[10px] text-muted">RECIPE SUGGESTIONS</span>
                    <div className="flex flex-col gap-1">
                      {recipeSuggestions.map((s) => (
                        <div key={s.recipe.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm"
                          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-mono text-[9px] text-white/70 truncate">{s.recipe.title}</span>
                            <span className="font-mono text-[8px] text-white/35">{s.matchedCount} token{s.matchedCount !== 1 ? "s" : ""} match · {s.matchPercent}%</span>
                          </div>
                          <button
                            onClick={() => {
                              const draft = buildRecipeDraft(s.recipe);
                              setFields((f) => ({ ...f, prompt_text: draft.promptText }));
                            }}
                            className="shrink-0 font-mono text-[8px] text-readable hover:text-white uppercase tracking-widest transition-precise px-2 py-1 rounded-sm"
                            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {projectTokenSuggestions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="system-label text-[10px] text-muted">PROJECT TOKENS</span>
                    <div className="flex flex-wrap gap-1.5">
                      {projectTokenSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.token.id}
                          type="button"
                          onClick={() => handleTokenToggle(suggestion.token)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-[10px] text-cyan hover:text-white transition-precise"
                          style={{ border: "1px solid rgba(72,229,232,0.28)", background: "rgba(72,229,232,0.055)" }}
                          title={suggestion.reason}
                        >
                          <Plus size={8} /> {suggestion.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-white/16" />

                {/* Token cloud */}
                <TokenCloud
                  selectedTexts={tokenTexts}
                  onToggle={handleTokenToggle}
                  providerFilter={fields.provider}
                  suppressedText={suppressedTokenText}
                />
              </div>
            </div>
          )}

          {/* Avoidance */}
          <CollapsibleCard
            title="AI-LOOK AVOIDANCE"
            defaultOpen={!!fields.avoidance_text.trim()}
            headerExtra={
              <span onClick={(e) => e.stopPropagation()}>
                <AIImproveButton
                  value={fields.avoidance_text}
                  fieldName="AI-look avoidance list"
                  projectTitle={fields.title || "this prompt"}
                  projectContext={assembled}
                  disabled={!assembled.trim()}
                  fallbackValue="No avoidance text yet — generate a comprehensive list"
                  onImproved={(v) => setF("avoidance_text", v)}
                />
              </span>
            }
          >
            <div className="flex flex-col gap-3">
              <AvoidancePanel
                promptText={deferredAssembled}
                category={deferredCategory}
                provider={deferredProvider}
                onAddCorrection={(text) => {
                  setF("avoidance_text", fields.avoidance_text ? `${fields.avoidance_text}, ${text}` : text);
                }}
                onRiskScoreChange={(score) => setF("ai_look_risk", Math.round(score))}
                usedPatternIds={usedAvoidanceIds}
                onMarkUsed={(patternId) => setUsedAvoidanceIds((prev) => new Set(prev).add(patternId))}
              />
              <Textarea
                value={fields.avoidance_text}
                onChange={(e) => setF("avoidance_text", e.target.value)}
                placeholder="Avoidance corrections appear here. Edit freely — this is appended to your prompt on copy."
                rows={3}
                mono
              />
            </div>
          </CollapsibleCard>

          {/* Consistency Factor (V2 §2) — elements held stable across variations */}
          <div>
            <SectionHeader label="CONSISTENCY FACTOR" />
            <div className="flex flex-col gap-3">
              <p className="font-mono text-[10px] leading-relaxed text-readable">
                Elements that must stay stable across prompt variations — appended on copy and enforced by the AI assistant.
              </p>
              {/* Active factors */}
              <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
                {consistencyFactors.length === 0 && (
                  <span className="font-mono text-[10px] text-dim">No consistency factors yet — add one below or pick a suggestion.</span>
                )}
                {consistencyFactors.map((factor) => (
                  <span key={factor}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-[10px] text-cyan"
                    style={{ border: "1px solid rgba(72,229,232,0.4)", background: "rgba(72,229,232,0.07)" }}>
                    {factor}
                    <button type="button"
                      onClick={() => setConsistencyFactors((prev) => prev.filter((f) => f !== factor))}
                      className="text-cyan/50 hover:text-red transition-precise leading-none">×</button>
                  </span>
                ))}
              </div>
              {/* Suggestions + presets */}
              {(() => {
                const suggestions = suggestConsistencyFactors({
                  promptText: deferredAssembled,
                  projectDirection: projectContext?.visual_direction,
                  provider: fields.provider,
                  existing: consistencyFactors,
                });
                const remainingPresets = CONSISTENCY_FACTOR_PRESETS.filter(
                  (preset) => !consistencyFactors.includes(preset) && !suggestions.includes(preset)
                );
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {suggestions.length > 0 && (
                      <span className="font-mono text-[8px] uppercase tracking-widest text-cyan/50 mr-1">Suggested</span>
                    )}
                    {suggestions.map((factor) => (
                      <button key={factor} type="button"
                        onClick={() => setConsistencyFactors((prev) => [...prev, factor])}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-[9px] text-cyan/80 hover:text-cyan transition-precise"
                        style={{ border: "1px solid rgba(72,229,232,0.25)" }}>
                        <Plus size={8} /> {factor}
                      </button>
                    ))}
                    {remainingPresets.map((preset) => (
                      <button key={preset} type="button"
                        onClick={() => setConsistencyFactors((prev) => [...prev, preset])}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-[9px] text-dim hover:text-soft-white transition-precise"
                        style={{ border: "var(--border-dim)" }}>
                        <Plus size={8} /> {preset}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {/* Custom factor input */}
              <input
                type="text"
                value={factorInput}
                onChange={(e) => setFactorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = factorInput.trim();
                    if (trimmed && !consistencyFactors.includes(trimmed)) {
                      setConsistencyFactors((prev) => [...prev, trimmed]);
                    }
                    setFactorInput("");
                  }
                }}
                placeholder="Custom factor + Enter… (e.g. clothing: red silk jacket)"
                className="w-full h-9 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                style={{ border: "var(--border-default)" }}
              />
            </div>
          </div>

          {/* Variation Axis */}
          <div>
            <SectionHeader label="SEQUENCE VARIATION" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {VARIATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setF("variation", fields.variation === preset.value ? "" : preset.value)}
                    className={cn(
                      "font-mono text-[8.5px] tracking-widest uppercase px-2 py-1 rounded-sm transition-precise",
                      fields.variation === preset.value ? "text-cyan" : "text-dim hover:text-soft-white"
                    )}
                    style={{ border: fields.variation === preset.value ? "1px solid rgba(0,229,255,0.35)" : "var(--border-dim)" }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={fields.variation}
                  onChange={(e) => setF("variation", e.target.value)}
                  placeholder="Single controlled change… (rotate 90°, night version, camera from above)"
                  className="w-full h-9 px-3 pr-8 font-mono text-[12px] text-soft-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                  style={{ border: "var(--border-default)" }}
                />
                {fields.variation && (
                  <button
                    type="button"
                    onClick={() => setF("variation", "")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim/60 hover:text-red transition-precise text-[13px] leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div>
            <SectionHeader label="META" />
            <div className="flex flex-col gap-3">
              <TagInput tags={fields.tags} onChange={(t) => { setF("tags", t); setTagSuggestions([]); }} />
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button"
                  onClick={handleSuggestTags}
                  disabled={suggestingTags || assembled.trim().length < 20}
                  className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-dim hover:text-white disabled:opacity-30 transition-precise"
                  style={{ border: "var(--border-dim)" }}>
                  <Wand2 size={8} />{suggestingTags ? "Suggesting…" : "Suggest Tags"}
                </button>
                {tagSuggestions.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded-sm text-cyan/80 transition-precise"
                    style={{ border: "1px solid rgba(0,229,255,0.25)" }}>
                    <button type="button" onClick={() => { setF("tags", [...fields.tags, tag]); setTagSuggestions((p) => p.filter((t) => t !== tag)); }}
                      className="hover:text-cyan" title="Accept tag">+</button>
                    {tag}
                    <button type="button" onClick={() => setTagSuggestions((p) => p.filter((t) => t !== tag))}
                      className="text-dim/40 hover:text-red" title="Dismiss">×</button>
                  </span>
                ))}
              </div>
              <Textarea
                value={fields.notes}
                onChange={(e) => setF("notes", e.target.value)}
                placeholder="Production notes, context, intended usage…"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* ── Right: Parameters + Preview ─────────────────── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Provider Parameters */}
          <CollapsibleCard
            title="PARAMETERS"
            headerExtra={<span className="font-mono text-[11px] text-readable uppercase tracking-widest">{fields.provider}</span>}
          >
            {fields.provider === "midjourney" && (
              <MidjourneyParams
                p={mjParams}
                set={setMJ}
                selectedSrefTitle={selectedSref?.title ?? null}
                onBrowseSref={handleOpenSrefPicker}
                onClearSref={handleClearSref}
              />
            )}
            {fields.provider === "dalle" && <DalleParamsPanel p={dalleParams} set={setDalle} />}
            {fields.provider === "stable_diffusion" && <SDParamsPanel p={sdParams} set={setSD} />}
            {fields.provider === "nano_banana" && (
              <NanaBananaParamsPanel
                onUseTemplate={(t) => {
                  setF("subject", t.subject);
                  setF("environment", t.environment);
                  setF("camera", t.camera);
                  setF("lens", t.lens);
                  setF("lighting", t.lighting);
                  setF("mood", t.mood);
                  setF("avoidance_text", t.avoidance_text);
                }}
              />
            )}
            {!["midjourney", "dalle", "stable_diffusion", "nano_banana"].includes(fields.provider) && (
              <p className="font-mono text-[13px] text-readable leading-relaxed">No structured parameters for this provider. Add them manually in the prompt text.</p>
            )}
          </CollapsibleCard>

          {/* Thumbnail & Version */}
          <CollapsibleCard title="THUMBNAIL & VERSION">
            <div className="flex flex-col gap-3">
              <PromptThumbnailField
                thumbnailData={fields.thumbnail_data}
                sourceUrl={fields.source_url}
                onThumbnailChange={(v) => setF("thumbnail_data", v)}
                onSourceUrlChange={(v) => setF("source_url", v)}
              />
              {isEdit ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-soft-white">Version {originalVersion}</span>
                    {parentId && (
                      <button type="button" onClick={() => navigate(`/craft/${parentId}`)}
                        className="font-mono text-[9px] text-dim/50 hover:text-cyan transition-precise">
                        ↑ view the version this was forked from
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-dim/50 leading-relaxed">
                    Testing a change? Save it as a new version to keep this one intact and compare results side by side.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveNewVersion}
                    disabled={saving || savingNewVersion}
                    className="w-fit"
                  >
                    <Save size={10} /> {savingNewVersion ? "Saving…" : `+ Add Version v${originalVersion + 1}`}
                  </Button>
                </>
              ) : (
                <p className="font-mono text-[10px] text-dim/50 leading-relaxed">
                  Version history and the "Add Version" fork become available once this prompt is saved.
                </p>
              )}
            </div>
          </CollapsibleCard>

          {/* Related Prompts */}
          {relatedPrompts.length > 0 && (
            <CollapsibleCard title="RELATED" icon={<Zap size={11} className="text-cyan" />} gap="gap-3">
              {relatedPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/library/${p.id}`)}
                  className="flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-sm hover:bg-white/5 transition-precise"
                  style={{ border: "var(--border-dim)" }}
                >
                  <span className="font-mono text-[13px] text-readable truncate">{p.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < p.rating ? "bg-amber/80" : "bg-white/14")} />
                    ))}
                  </div>
                </button>
              ))}
            </CollapsibleCard>
          )}

          {/* Recipes */}
          {availableRecipes.length > 0 && (
            <CollapsibleCard title="RECIPES" icon={<Wand2 size={11} className="text-cyan" />} gap="gap-3">
              {availableRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleApplyRecipe(recipe)}
                  className="flex items-start justify-between gap-3 text-left px-2.5 py-2 rounded-sm hover:bg-white/5 transition-precise"
                  style={{ border: appliedRecipeId === recipe.id ? "1px solid rgba(72,229,232,0.35)" : "var(--border-dim)" }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[13px] text-readable truncate">{recipe.title}</span>
                    <span className="font-mono text-[10px] text-muted truncate">{recipe.provider}</span>
                  </div>
                  <span className="font-mono text-[10px] text-cyan shrink-0">Use</span>
                </button>
              ))}
            </CollapsibleCard>
          )}

          {/* Project inspirations — full visual reference board */}
          {projectRefs.length > 0 && (
            <CollapsibleCard
              title="INSPIRATIONS"
              gap="gap-3"
              headerExtra={<span className="font-mono text-[10px] text-muted">{projectRefs.length} project ref{projectRefs.length !== 1 ? "s" : ""}</span>}
            >
              <div className="grid grid-cols-4 gap-2">
                {projectRefs.map((ref) => (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() => navigate(`/references/${ref.id}`)}
                    className="group relative aspect-square rounded-sm overflow-hidden"
                    style={{ border: "var(--border-dim)" }}
                    title={ref.title}
                  >
                    <InspirationThumb src={ref.thumbnail_data} />
                    <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 font-mono text-[9px] text-white/80 truncate opacity-0 group-hover:opacity-100 transition-precise"
                      style={{ background: "rgba(0,0,0,0.75)" }}>
                      {ref.title}
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* High-impact references */}
          {insightsReady && impactRefs.length > 0 && (
            <CollapsibleCard
              title="IMPACT REFS"
              gap="gap-3"
              headerExtra={<span className="font-mono text-[10px] text-muted">linked to winners</span>}
            >
              <div className="flex flex-col gap-1.5">
                {impactRefs.map((ref) => (
                  <ImpactRefRow key={ref.id} ref_={ref} />
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Recommendations — hideHeader since the panel would otherwise
              render its own second "RECOMMENDATIONS" label right below
              this card's fold header. */}
          <CollapsibleCard title="RECOMMENDATIONS" icon={<Lightbulb size={11} className="text-cyan" />}>
            {insightsReady ? (
              <RecommendationPanel
                hideHeader
                context={{
                  provider: deferredProvider,
                  category: deferredCategory || undefined,
                  excludePromptId: id,
                  projectId: projectId ?? undefined,
                  promptText: deferredAssembled,
                  tags: fields.tags,
                }}
              />
            ) : (
              <div className="flex items-center justify-center py-6">
                <span className="font-mono text-[11px] text-muted">Loading recommendations…</span>
              </div>
            )}
          </CollapsibleCard>

          {/* Scoring */}
          <CollapsibleCard title="SCORING" gap="gap-5">
            <RatingPicker value={fields.rating} onChange={(n) => setF("rating", n)} />
            <RiskSlider value={fields.ai_look_risk} onChange={(n) => setF("ai_look_risk", n)} />
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fields.is_winner} onChange={(e) => setF("is_winner", e.target.checked)} className="accent-white" />
                <span className="system-label">WINNER</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fields.is_failed} onChange={(e) => setF("is_failed", e.target.checked)} className="accent-red" />
                <span className="system-label text-dim/60">FAILED</span>
              </label>
            </div>
          </CollapsibleCard>

          {/* Prompt Output — editable */}
          <CollapsibleCard
            title="PROMPT OUTPUT"
            gap="gap-3"
            headerExtra={
              <span className={cn("font-mono text-[10px]", charCount > 1500 ? "text-red/70" : "text-dim/60")}>
                {charCount} chars
              </span>
            }
          >
            {/* Provider formatting hints */}
            {(() => {
              const hints = getProviderHints(fields.provider);
              if (!hints.length) return null;
              return (
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-dim/50">{fields.provider} tips</span>
                  {hints.map((h) => (
                    <span key={h} className="font-mono text-[10px] text-dim/60">· {h}</span>
                  ))}
                </div>
              );
            })()}

            {/* Editable textarea */}
            <textarea
              value={assembled}
              onChange={(e) => setOutputOverride(e.target.value)}
              placeholder="Assembled prompt will appear here…"
              rows={7}
              className="w-full px-3 py-2 font-mono text-[11px] text-soft-white/90 placeholder:text-dim/40 bg-black/30 rounded-sm focus:outline-none focus:border-red/40 transition-precise resize-none leading-relaxed"
              style={{ border: "var(--border-dim)" }}
            />

            {outputOverride !== null && (
              <button
                type="button"
                onClick={() => setOutputOverride(null)}
                className="font-mono text-[10px] text-dim/60 hover:text-white transition-precise text-left"
              >
                ↺ Reset to assembled
              </button>
            )}

            {formatChanges.length > 0 && (
              <div
                className="flex items-start gap-2 px-2.5 py-2 rounded-sm"
                style={{ background: "rgba(0,255,200,0.05)", border: "1px solid rgba(0,255,200,0.15)" }}
              >
                <Check size={9} className="text-cyan shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/70">Formatted</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {formatChanges.map((c) => (
                      <li key={c} className="font-mono text-[10px] text-soft-white/70">· {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Avoidance toggle */}
            {fields.avoidance_text && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAvoidance}
                  onChange={(e) => setIncludeAvoidance(e.target.checked)}
                  className="accent-white/60"
                />
                <span className="system-label text-[9px]">INCLUDE AVOIDANCE ON COPY</span>
              </label>
            )}

            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!assembled} className="w-full justify-center">
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied!" : fields.variation ? "Copy with Variation" : includeAvoidance ? "Copy with Avoidance" : "Copy Prompt"}
            </Button>
          </CollapsibleCard>

          {/* Image Description AI — upload a reference image, ask the AI to
              describe it, and copy the description back into the prompt. */}
          <CollapsibleCard title="IMAGE DESCRIPTION AI" icon={<ScanEye size={11} className="text-cyan" />} gap="gap-3">
            <div
              {...getDescribeRootProps()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-sm cursor-pointer transition-precise",
                describeImageUrl ? "h-36" : "h-20",
                describeDragActive ? "border-cyan/50 bg-cyan/8" : "hover:border-cyan/40 hover:bg-white/3"
              )}
              style={{ border: describeDragActive ? "1px solid rgba(0,229,255,0.4)" : "var(--border-dim)" }}
            >
              <input {...getDescribeInputProps()} />
              {describeImageUrl ? (
                <img src={describeImageUrl} alt="Selected for description" className="w-full h-full object-contain rounded-sm" />
              ) : (
                <>
                  <Upload size={14} className="text-cyan" />
                  <span className="font-mono text-[11px] text-readable">
                    {describeDragActive ? "Drop image here" : "Click or drop image here"}
                  </span>
                </>
              )}
            </div>

            <input
              type="text"
              value={describeQuestion}
              onChange={(e) => setDescribeQuestion(e.target.value)}
              placeholder="Ask for something specific… (optional)"
              className="h-9 px-2.5 rounded-sm bg-transparent font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            />

            <div className="relative">
              <select
                value={describeModel.id}
                onChange={(e) => {
                  const m = VISION_MODELS.find((mm) => mm.id === e.target.value);
                  if (m) setDescribeModel(m);
                }}
                className="w-full appearance-none pr-7 h-9 px-2.5 font-mono text-[12px] text-white bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise cursor-pointer"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              >
                {VISION_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-panel text-white">{m.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {!describeApiKey && (
              <button type="button" onClick={() => navigate("/settings")}
                className="flex items-center gap-1.5 font-mono text-[11px] text-red/70 hover:text-red transition-precise text-left">
                <SettingsIcon size={10} /> No API key configured — open Settings
              </button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDescribeAnalyze}
              disabled={!describeImageFile || !describeApiKey || describing}
              className="w-full justify-center"
            >
              <ScanEye size={10} />
              {describing ? "Analyzing…" : "Describe Image"}
            </Button>

            {describeError && (
              <span className="font-mono text-[11px] text-red/70">{describeError}</span>
            )}

            {describeResult && (
              <div className="flex flex-col gap-2 p-3 rounded-sm" style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-dim/60">Description (reverse-engineered)</span>
                  <button type="button" onClick={handleDescribeCopy}
                    className="flex items-center gap-1 font-mono text-[10px] text-readable hover:text-cyan transition-precise">
                    {describeCopied ? <Check size={9} /> : <Copy size={9} />}
                    {describeCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                {/* selectable: body text/results are exempted from the app-wide
                    user-select:none reset (styles/globals.css) so the user can
                    manually select and copy any part of it, not just the whole
                    block via the Copy button. */}
                <p className="selectable font-mono text-[12px] text-soft-white leading-relaxed whitespace-pre-wrap">{describeResult}</p>
              </div>
            )}

            {/* Formula — the same description reformatted into the ordered
                success formula for whichever provider is selected above in
                PARAMETERS; changing that provider re-renders this instantly. */}
            {formulaRows.length > 0 && (
              <div className="selectable flex flex-col gap-2 p-3 rounded-sm" style={{ border: "1px solid rgba(0,229,255,0.18)", background: "rgba(0,229,255,0.03)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/70">
                    Formula — {fields.provider}
                  </span>
                  <button type="button" onClick={handleFormulaCopy}
                    className="flex items-center gap-1 font-mono text-[10px] text-readable hover:text-cyan transition-precise">
                    {formulaCopied ? <Check size={9} /> : <Copy size={9} />}
                    {formulaCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {formulaRows.map((row) => (
                    <div key={row.step} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/50">{row.step}</span>
                      <span
                        className={cn(
                          "font-mono text-[12px] leading-snug",
                          row.value === FORMULA_STEP_NOT_INFERABLE ? "text-dim/40 italic" : "text-soft-white"
                        )}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-dim/50 leading-relaxed pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {PROVIDER_GUIDANCE[fields.provider]}
                </span>
              </div>
            )}
          </CollapsibleCard>

          {/* Provider-specific formatted output */}
          {fields.provider === "nano_banana" && assembled && (
            <ProviderFormatBlock
              label="NANO BANANA JSON"
              icon={<FileCode size={11} />}
              color="rgba(246,173,85,0.7)"
              borderColor="rgba(246,173,85,0.2)"
              bgColor="rgba(246,173,85,0.04)"
              content={buildNanaBananaJson(fields, assembled, fields.aspect_ratio)}
            />
          )}
          {(["seedance", "kling", "runway", "higgsfield"] as const).includes(fields.provider as "seedance" | "kling" | "runway" | "higgsfield") && assembled && (
            <ProviderFormatBlock
              label={`${fields.provider.toUpperCase()} MOTION PROMPT`}
              icon={<Film size={11} />}
              color="rgba(183,148,244,0.7)"
              borderColor="rgba(183,148,244,0.2)"
              bgColor="rgba(183,148,244,0.04)"
              content={[
                `SCENE: ${assembled}`,
                fields.aspect_ratio ? `RATIO: ${fields.aspect_ratio}` : "",
                fields.mood ? `TONE: ${fields.mood}` : "",
                fields.avoidance_text ? `AVOID: ${fields.avoidance_text}` : "",
              ].filter(Boolean).join("\n")}
            />
          )}

          {/* Low-quality token advisory */}
          {lowQualityTokens.length > 0 && !lowQualityDismissed && (
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}
            >
              <AlertCircle size={11} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[9px] uppercase tracking-widest text-red/60">Low-performing tokens</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lowQualityTokens.map((t) => (
                    <span key={t.id} className="font-mono text-[10px] text-muted/80">{t.text}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLowQualityDismissed(true)}
                className="font-mono text-[10px] text-dim/40 hover:text-white shrink-0 transition-precise"
              >
                ×
              </button>
            </div>
          )}

          {/* AI Prompt Advisor */}
          {(() => {
            const analyzeCheck = validatePromptForAnalysis(assembled);
            const canAnalyze = analyzeCheck.valid;
            const hasAdvice = (advice.suggestions.length > 0 || advice.risks.length > 0 || advice.improvements.length > 0) && !adviceDismissed;
            return (
              <CollapsibleCard title="AI PROMPT ADVISOR" icon={<Wand2 size={11} className="text-cyan" />} gap="gap-2">
                <input
                  type="text"
                  value={analyzeDirection}
                  onChange={(e) => setAnalyzeDirection(e.target.value)}
                  placeholder="Direction: make it shorter, add lighting…"
                  className="h-8 px-2.5 rounded-sm bg-transparent font-mono text-[11px] text-soft-white placeholder:text-dim focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canAnalyze || adviceLoading}
                    title={!canAnalyze ? analyzeCheck.message : "Analyze with Claude Haiku"}
                    onClick={() => handleAnalyzeDraft()}
                    className="flex-1 justify-center"
                  >
                    <Wand2 size={10} />
                    {adviceLoading ? "Analyzing…" : "Analyze Draft"}
                  </Button>
                  <button
                    type="button"
                    disabled={!canAnalyze || adviceLoading}
                    title="Magic Wand — refines hierarchy, visual logic, and reduces prompt overload"
                    aria-label="Magic Wand — refines hierarchy, visual logic, and reduces prompt overload"
                    onClick={() => handleAnalyzeDraft("Focus only on visual hierarchy, visual logic, and reducing prompt overload (too many competing ideas). Ignore other categories.")}
                    className="flex items-center justify-center w-8 h-8 shrink-0 rounded-sm text-cyan border border-cyan/30 hover:bg-cyan/10 disabled:opacity-40 transition-precise"
                  >
                    <Wand2 size={12} />
                  </button>
                </div>
                {hasAdvice && (
                  <div className={cn(
                    "selectable flex flex-col gap-2 px-3 py-2.5 rounded-sm transition-precise",
                    adviceJustIn && "ring-1 ring-cyan/50"
                  )}
                    style={{ border: "1px solid rgba(255,255,255,0.1)", background: adviceJustIn ? "rgba(72,229,232,0.06)" : "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-readable">AI Advice</span>
                      <button onClick={() => setAdviceDismissed(true)} className="text-readable hover:text-white text-[11px]">×</button>
                    </div>
                    {advice.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 font-mono text-[9px] text-white/40">→</span>
                        <span className="font-mono text-[10px] text-white/70 leading-relaxed">{s}</span>
                      </div>
                    ))}
                    {advice.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 font-mono text-[9px] text-red/50">!</span>
                        <span className="font-mono text-[10px] text-red/60 leading-relaxed">{r}</span>
                      </div>
                    ))}
                    {advice.improvements.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/50">Apply improvements</span>
                        {advice.improvements.map((imp, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="font-mono text-[8.5px] uppercase tracking-widest text-white/35 shrink-0 w-14 truncate">{imp.label}</span>
                            <span className="font-mono text-[10px] text-white/55 flex-1 min-w-0 truncate">{imp.value}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFields((f) => ({ ...f, [imp.field]: imp.value }));
                                if (mode !== "builder") setMode("builder");
                              }}
                              className="font-mono text-[8.5px] uppercase tracking-widest text-cyan/60 hover:text-cyan transition-precise shrink-0 px-1.5 py-0.5 rounded-sm"
                              style={{ border: "1px solid rgba(0,229,255,0.2)" }}
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleCard>
            );
          })()}

          {/* Save */}
          <div className="flex flex-col gap-2">
            {isEdit ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveNewVersion}
                  disabled={saving || savingNewVersion}
                  className="w-full justify-center"
                >
                  <Save size={11} />
                  {savingNewVersion ? "Saving…" : `New Version v${originalVersion + 1}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={saving || savingNewVersion}
                  className="w-full justify-center"
                >
                  {saving ? "Saving…" : saved ? "Saved" : "Overwrite Current"}
                </Button>
                <p className="font-mono text-[9px] text-dim/40 text-center leading-relaxed">
                  New Version saves a copy linked to v{originalVersion}
                </p>
              </>
            ) : (
              <>
                <Button variant="primary" size="md" onClick={() => handleSave(false)} disabled={saving} className="w-full justify-center">
                  <Save size={11} />
                  {saving ? "Saving…" : "Save to Library"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleSave(true)} disabled={saving} className="w-full justify-center">
                  Save as Recipe
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
    {srefPickerOpen && (
      <SREFPickerModal
        onSelect={(sref) => {
          setSelectedSref({ code: sref.code, title: sref.title });
          setMjParams((p) => ({ ...p, sref_code: sref.code }));
          setSrefPickerOpen(false);
        }}
        onClose={() => setSrefPickerOpen(false)}
      />
    )}
    </>
  );
}
