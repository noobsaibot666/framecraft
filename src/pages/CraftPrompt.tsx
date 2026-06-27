import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Copy, Check, AlertCircle, Zap, Plus, Wand2 } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { TokenCloud } from "@/components/ui/TokenCloud";
import { SequenceBuilder } from "@/components/ui/SequenceBuilder";
import { AvoidancePanel } from "@/components/ui/AvoidancePanel";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { usePromptStore } from "@/stores/usePromptStore";
import { findSimilarPrompts, findRelatedPrompts, type SimilarPrompt } from "@/lib/memoryEngine";
import { addPromptToProject, getProjectById } from "@/lib/projects";
import { buildProjectTokenSuggestions, buildSuppressionText } from "@/lib/craftContext";
import { buildRecipeDraft, getRecipeSuggestions, type RecipeSuggestion } from "@/lib/craftRecipe";
import { getPreferences } from "@/lib/userPreferences";
import { getProvenCombos, type ProvenCombo } from "@/lib/tokenPatterns";
import { SREFPickerModal } from "@/components/ui/SREFPickerModal";
import { analyzePromptDraft, validatePromptForAnalysis, EMPTY_ADVICE, type PromptAdvice } from "@/lib/analyzePrompt";
import { getHighImpactReferences, type ImpactReference } from "@/lib/referenceImpact";
import { formatPromptForProvider, getProviderHints } from "@/lib/promptFormatter";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import type { Provider, Category, Token, Prompt, Project, SREF } from "@/types";
import type { CreatePromptInput } from "@/lib/db";

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
      <label className="system-label text-[11px] text-muted">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pr-7 h-10 px-3 font-mono text-[12px] text-white bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise cursor-pointer"
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
        <label className="system-label text-[11px] text-muted">{label}</label>
        {hint && <span className="font-mono text-[10px] text-readable">{hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      />
    </div>
  );
}

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label text-[11px] text-muted">RATING</label>
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
        <span className="font-mono text-[11px] text-readable ml-1">{value}/5</span>
      </div>
    </div>
  );
}

function RiskSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colorClass = value >= 8 ? "text-red" : value >= 6 ? "text-red/80" : value >= 4 ? "text-amber" : "text-readable";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="system-label text-[11px] text-muted">AI-LOOK RISK</label>
        <span className={cn("font-mono text-[11px]", colorClass)}>{value}/10</span>
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
      <label className="system-label text-[11px] text-muted">TAGS</label>
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
          className="flex-1 min-w-16 bg-transparent font-mono text-[11px] text-soft-white placeholder:text-dim outline-none"
        />
      </div>
    </div>
  );
}

// ─── Provider Parameter Panels ────────────────────────────────

interface MJParams {
  aspect_ratio: string; model_version: string; quality: string;
  stylize: string; chaos: string; weird: string; stop: string; repeat: string;
  seed: string; zoom: string; style: string; sw: string; sv: string;
  sref_code: string; profile: string; no_prompt: string;
  raw: boolean; hd: boolean; tile: boolean; fast: boolean; relax: boolean; exp: boolean;
}
interface DalleParams { size: string; quality: string; style: string; }
interface SDParams { steps: string; cfg_scale: string; sampler: string; negative_prompt: string; seed: string; }

const MJ_ASPECT_RATIOS = [
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

function MidjourneyParams({ p, set, selectedSrefTitle, onBrowseSref, onClearSref }: {
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
      <FieldSelect label="ASPECT RATIO" value={p.aspect_ratio} onChange={(v) => set("aspect_ratio", v)} options={MJ_ASPECT_RATIOS} />
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
      <FieldInput label="SEED --seed" value={p.seed} onChange={(v) => set("seed", v)} placeholder="e.g. 4294967295" />
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
}

function DalleParamsPanel({ p, set }: { p: DalleParams; set: (k: keyof DalleParams, v: string) => void }) {
  return (
    <>
      <FieldSelect label="SIZE" value={p.size} onChange={(v) => set("size", v)} options={DALLE_SIZES} />
      <FieldSelect label="QUALITY" value={p.quality} onChange={(v) => set("quality", v)} options={DALLE_QUALITY_OPTS} />
      <FieldSelect label="STYLE" value={p.style} onChange={(v) => set("style", v)} options={DALLE_STYLE_OPTS} />
    </>
  );
}

function SDParamsPanel({ p, set }: { p: SDParams; set: (k: keyof SDParams, v: string) => void }) {
  return (
    <>
      <FieldInput label="STEPS" value={p.steps} onChange={(v) => set("steps", v)} placeholder="30" hint="20–60" />
      <FieldInput label="CFG SCALE" value={p.cfg_scale} onChange={(v) => set("cfg_scale", v)} placeholder="7" hint="1–20" />
      <FieldSelect label="SAMPLER" value={p.sampler} onChange={(v) => set("sampler", v)} options={SD_SAMPLERS} />
      <FieldInput label="SEED" value={p.seed} onChange={(v) => set("seed", v)} placeholder="-1 (random)" />
      <div className="flex flex-col gap-1.5">
        <label className="system-label text-[11px] text-muted">NEGATIVE PROMPT</label>
        <textarea
          value={p.negative_prompt}
          onChange={(e) => set("negative_prompt", e.target.value)}
          placeholder="ugly, bad anatomy, blurry…"
          rows={3}
          className="w-full px-3 py-2.5 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
      </div>
    </>
  );
}

// ─── Prompt assembly ──────────────────────────────────────────

function assembleMJ(f: Fields, mj: MJParams): string {
  const parts = [f.subject, f.environment, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  let out = parts.join(", ");
  if (mj.aspect_ratio)  out += ` --ar ${mj.aspect_ratio}`;
  if (mj.model_version) out += ` --v ${mj.model_version}`;
  if (mj.quality)       out += ` --q ${mj.quality}`;
  if (mj.stylize)       out += ` --s ${mj.stylize}`;
  if (mj.chaos)         out += ` --c ${mj.chaos}`;
  if (mj.weird)         out += ` --w ${mj.weird}`;
  if (mj.style)         out += ` --style ${mj.style}`;
  if (mj.sw)            out += ` --sw ${mj.sw}`;
  if (mj.sv)            out += ` --sv ${mj.sv}`;
  if (mj.seed)          out += ` --seed ${mj.seed}`;
  if (mj.zoom)          out += ` --zoom ${mj.zoom}`;
  if (mj.stop)          out += ` --stop ${mj.stop}`;
  if (mj.repeat)        out += ` --repeat ${mj.repeat}`;
  if (mj.sref_code)     out += ` --sref ${mj.sref_code}`;
  if (mj.profile)       out += ` --profile ${mj.profile}`;
  if (mj.raw)           out += ` --raw`;
  if (mj.hd)            out += ` --hd`;
  if (mj.tile)          out += ` --tile`;
  if (mj.fast)          out += ` --fast`;
  if (mj.relax)         out += ` --relax`;
  if (mj.exp)           out += ` -exp`;
  if (mj.no_prompt)     out += ` --no ${mj.no_prompt}`;
  return out;
}

function assembleDalle(f: Fields, dalle: DalleParams): string {
  const parts = [f.subject, f.environment, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  let out = parts.join(", ");
  if (dalle.size) out += ` [size: ${dalle.size}]`;
  if (dalle.quality) out += ` [quality: ${dalle.quality}]`;
  if (dalle.style) out += ` [style: ${dalle.style}]`;
  return out;
}

function assembleSD(f: Fields, _sd: SDParams): string {
  const parts = [f.subject, f.environment, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  return parts.join(", ");
}

function assembleGeneric(f: Fields): string {
  return [f.subject, f.environment, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean).join(", ");
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
  category: string; use_case: string;
  prompt_text: string; avoidance_text: string;
  subject: string; environment: string; camera: string; lens: string;
  lighting: string; mood: string; realism: string;
  rating: number; ai_look_risk: number;
  tags: string[]; notes: string;
  is_winner: boolean; is_failed: boolean;
}

const EMPTY: Fields = {
  title: "", description: "", provider: "midjourney",
  category: "", use_case: "",
  prompt_text: "", avoidance_text: "",
  subject: "", environment: "", camera: "", lens: "",
  lighting: "", mood: "", realism: "",
  rating: 0, ai_look_risk: 0,
  tags: [], notes: "",
  is_winner: false, is_failed: false,
};

const EMPTY_MJ: MJParams = {
  aspect_ratio: "", model_version: "", quality: "",
  stylize: "", chaos: "", weird: "", stop: "", repeat: "",
  seed: "", zoom: "", style: "", sw: "", sv: "",
  sref_code: "", profile: "", no_prompt: "",
  raw: false, hd: false, tile: false, fast: false, relax: false, exp: false,
};
const EMPTY_DALLE: DalleParams = { size: "", quality: "", style: "" };
const EMPTY_SD: SDParams = { steps: "", cfg_scale: "", sampler: "", negative_prompt: "", seed: "" };

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

function ImpactRefRow({ ref_ }: { ref_: ImpactReference }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(`/references/${ref_.id}`)}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-white/3 transition-precise text-left w-full group">
      <ImpactRefThumb src={ref_.thumbnail_data} />
      <div className="flex-1 min-w-0">
        <span className="font-sans text-[12px] text-soft-white truncate block">{ref_.title}</span>
        <span className="font-mono text-[9px] text-readable tracking-widest uppercase">{ref_.kind}</span>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="font-mono text-[10px] text-amber">{ref_.winner_count}★</span>
        <span className="font-mono text-[8px] text-muted">{ref_.project_count} proj</span>
      </div>
    </button>
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
    };
  });
  const [mjParams, setMjParams] = useState<MJParams>(() => {
    const prefs = getPreferences();
    return { ...EMPTY_MJ, aspect_ratio: prefs.defaultAspectRatio || EMPTY_MJ.aspect_ratio };
  });
  const [dalleParams, setDalleParams] = useState<DalleParams>(EMPTY_DALLE);
  const [sdParams, setSDParams] = useState<SDParams>(EMPTY_SD);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savingNewVersion, setSavingNewVersion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"builder" | "manual">("builder");
  const [originalVersion, setOriginalVersion] = useState(1);
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
  const [provenCombos, setProvenCombos] = useState<ProvenCombo[]>([]);
  const [lowQualityDismissed, setLowQualityDismissed] = useState(false);
  const [srefPickerOpen, setSrefPickerOpen] = useState(false);
  const [selectedSref, setSelectedSref] = useState<Pick<SREF, "code" | "title"> | null>(null);
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeSuggestion[]>([]);
  const [advice, setAdvice] = useState<PromptAdvice>(EMPTY_ADVICE);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceDismissed, setAdviceDismissed] = useState(false);
  const [impactRefs, setImpactRefs] = useState<ImpactReference[]>([]);

  useEffect(() => {
    if (!id) return;
    getById(id).then((p) => {
      if (!p) return;
      setFields({
        ...EMPTY,
        title: p.title, description: p.description ?? "",
        provider: p.provider, category: p.category ?? "",
        use_case: p.use_case ?? "", prompt_text: p.prompt_text,
        avoidance_text: p.avoidance_text ?? "",
        camera: p.camera ?? "", lens: p.lens ?? "", lighting: p.lighting ?? "",
        rating: p.rating, ai_look_risk: p.ai_look_risk,
        tags: p.tags ?? [], notes: p.notes ?? "",
        is_winner: p.is_winner, is_failed: p.is_failed,
      });
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
      setOriginalVersion(p.version ?? 1);
      setMode("manual");
    });
  }, [id, getById]);

  useEffect(() => {
    if (!projectId) {
      setProjectContext(null);
      return;
    }
    getProjectById(projectId).then((project) => setProjectContext(project));
    getHighImpactReferences(4, projectId).then(setImpactRefs).catch(() => {});
  }, [projectId]);

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
    setMjParams((current) => ({
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

  const setMJ = (k: keyof MJParams, v: string | boolean) => { setMjParams((p) => ({ ...p, [k]: v })); setOutputOverride(null); };
  const setDalle = (k: keyof DalleParams, v: string) => { setDalleParams((p) => ({ ...p, [k]: v })); setOutputOverride(null); };
  const setSD = (k: keyof SDParams, v: string) => { setSDParams((p) => ({ ...p, [k]: v })); setOutputOverride(null); };

  const handleTokenToggle = (token: Token) => {
    setTokenSequence((prev) => {
      const exists = prev.some((t) => t.id === token.id);
      return exists ? prev.filter((t) => t.id !== token.id) : [...prev, token];
    });
    setOutputOverride(null);
  };

  const handleTokenReorder = (reordered: Token[]) => {
    setTokenSequence(reordered);
    setOutputOverride(null);
  };

  const handleTokenRemove = (tokenId: string) => {
    setTokenSequence((prev) => prev.filter((t) => t.id !== tokenId));
    setTokenOverrides((prev) => { const next = { ...prev }; delete next[tokenId]; return next; });
    setOutputOverride(null);
  };

  const handleTokenEditCommit = (tokenId: string, text: string) => {
    setTokenOverrides((prev) => ({ ...prev, [tokenId]: text }));
    setOutputOverride(null);
  };

  const tokenTexts = tokenSequence.map((t) => tokenOverrides[t.id] ?? t.text);

  const builtAssembled = (() => {
    if (mode === "manual") return fields.prompt_text;
    const extras = tokenTexts.length ? `, ${tokenTexts.join(", ")}` : "";
    switch (fields.provider) {
      case "midjourney": return assembleMJ(fields, mjParams) + extras;
      case "dalle": return assembleDalle(fields, dalleParams) + extras;
      case "stable_diffusion": return assembleSD(fields, sdParams) + extras;
      default: return assembleGeneric(fields) + extras;
    }
  })();

  const assembled = outputOverride ?? builtAssembled;
  const projectTokenSuggestions = buildProjectTokenSuggestions(projectContext, {
    selectedTexts: tokenTexts,
    promptText: assembled,
  });
  const suppressedTokenText = buildSuppressionText(projectContext, fields.avoidance_text);

  // Proven combo detection + recipe suggestions + low-quality reset
  useEffect(() => {
    if (tokenSequence.length < 2) { setProvenCombos([]); setRecipeSuggestions([]); return; }
    getProvenCombos(tokenSequence.map((t) => t.id)).then(setProvenCombos).catch(() => {});
    getRecipeSuggestions(tokenSequence.map((t) => t.text), 2).then(setRecipeSuggestions).catch(() => {});
    setLowQualityDismissed(false);
  }, [tokenSequence]);

  // Debounced duplicate + related prompts detection (Phase 06)
  useEffect(() => {
    if (!allPrompts.length) return;
    const timer = setTimeout(() => {
      if (assembled.trim().length > 30) {
        setDuplicates(findSimilarPrompts(assembled, allPrompts, 0.55, id));
        setDuplicatesDismissed(false);
      } else {
        setDuplicates([]);
      }
      setRelatedPrompts(findRelatedPrompts(fields.category, fields.provider, id, allPrompts));
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembled, fields.category, fields.provider, allPrompts.length]);

  // Auto-analyze when preference is enabled and draft is long enough
  useEffect(() => {
    if (!getPreferences().autoAnalyzeDraft) return;
    if (!validatePromptForAnalysis(assembled).valid) return;
    const timer = setTimeout(async () => {
      setAdviceLoading(true);
      setAdviceDismissed(false);
      try {
        const result = await analyzePromptDraft({ promptText: assembled });
        setAdvice(result);
      } finally {
        setAdviceLoading(false);
      }
    }, 1800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembled]);

  const fullCopyText = includeAvoidance && fields.avoidance_text
    ? `${assembled}\n\n${fields.avoidance_text}`
    : assembled;

  const charCount = assembled.length;

  // Tokens in the current sequence with a negative quality history (not overridden by user)
  const lowQualityTokens = tokenSequence.filter(
    (t) => !tokenOverrides[t.id] && t.quality_score < -0.1
  );
  const availableRecipes = allPrompts
    .filter((prompt) => prompt.is_recipe && prompt.id !== id)
    .filter((recipe) => !fields.category || !recipe.category || recipe.category === fields.category)
    .slice(0, 5);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!fields.title.trim()) errs.title = "Required";
    if (!assembled.trim()) errs.prompt_text = "Required";
    setErrors(errs);
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
    aspect_ratio:  mjParams.aspect_ratio  || undefined,
    model_version: mjParams.model_version || undefined,
    style_ref:     mjParams.sref_code     || undefined,
    parameters: fields.provider === "midjourney" ? (() => {
      const pp: Record<string, string | boolean> = {};
      if (mjParams.profile)  pp.profile  = mjParams.profile;
      if (mjParams.stylize)  pp.stylize  = mjParams.stylize;
      if (mjParams.chaos)    pp.chaos    = mjParams.chaos;
      if (mjParams.weird)    pp.weird    = mjParams.weird;
      if (mjParams.quality)  pp.quality  = mjParams.quality;
      if (mjParams.style)    pp.style    = mjParams.style;
      if (mjParams.sw)       pp.sw       = mjParams.sw;
      if (mjParams.sv)       pp.sv       = mjParams.sv;
      if (mjParams.seed)     pp.seed     = mjParams.seed;
      if (mjParams.zoom)     pp.zoom     = mjParams.zoom;
      if (mjParams.stop)     pp.stop     = mjParams.stop;
      if (mjParams.repeat)   pp.repeat   = mjParams.repeat;
      if (mjParams.no_prompt) pp.no      = mjParams.no_prompt;
      if (mjParams.raw)      pp.raw      = true;
      if (mjParams.hd)       pp.hd       = true;
      if (mjParams.tile)     pp.tile     = true;
      if (mjParams.fast)     pp.fast     = true;
      if (mjParams.relax)    pp.relax    = true;
      if (mjParams.exp)      pp.exp      = true;
      return Object.keys(pp).length ? pp : undefined;
    })() : undefined,
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

  const handleSave = async (asRecipe = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await update(id, buildData(asRecipe));
        navigate(`/library/${id}`);
      } else {
        const newId = await create(buildData(asRecipe));
        if (projectId) {
          await addPromptToProject(projectId, newId);
          navigate(`/projects/${projectId}`);
        } else {
          navigate(`/library/${newId}`);
        }
      }
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
      if (projectId) {
        await addPromptToProject(projectId, newId);
        navigate(`/projects/${projectId}`);
      } else {
        navigate(`/library/${newId}`);
      }
    } finally {
      setSavingNewVersion(false);
    }
  };

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

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="system-label text-[12px] text-soft-white">{label}</span>
      <div className="flex-1 h-px bg-white/16" />
    </div>
  );

  const builderFields: { key: keyof Fields; label: string; placeholder: string }[] = [
    { key: "subject", label: "SUBJECT / ACTION", placeholder: "woman running through field" },
    { key: "environment", label: "ENVIRONMENT", placeholder: "golden hour forest" },
    { key: "camera", label: "CAMERA", placeholder: "low angle tracking shot" },
    { key: "lens", label: "LENS", placeholder: "14mm ultra-wide" },
    { key: "lighting", label: "LIGHTING", placeholder: "natural morning sunlight" },
    { key: "mood", label: "MOOD / BRAND TONE", placeholder: "documentary realism" },
  ];

  return (
    <>
    <PageContainer
      title={isEdit ? "Edit Prompt" : "Craft Prompt"}
      subtitle={projectContext ? `PROJECT CRAFT - ${projectContext.title}` : isEdit ? `EDITING VERSION ${originalVersion} — UPDATE OR FORK NEW VERSION` : "BUILD A PROVIDER-READY PROMPT"}
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
            <Button variant="ghost" size="sm" onClick={() => handleSave(false)} disabled={saving || savingNewVersion}>
              <Save size={10} />
              {saving ? "Saving…" : "Update"}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={isEdit ? handleSaveNewVersion : () => handleSave(false)}
            disabled={saving || savingNewVersion}
          >
            <Save size={11} />
            {isEdit
              ? savingNewVersion ? "Saving…" : `New Version v${originalVersion + 1}`
              : saving ? "Saving…" : "Save to Library"
            }
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
                  <span className="font-sans text-[15px] text-white font-semibold truncate">{projectContext.title}</span>
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
              {(projectContext.visual_direction || projectContext.creative_goals) && (
                <p className="font-mono text-[12px] text-readable leading-relaxed">
                  {projectContext.visual_direction || projectContext.creative_goals}
                </p>
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
                  <label className="system-label text-[11px] text-muted">TITLE</label>
                  {errors.title && <span className="font-mono text-[9px] text-red/80 flex items-center gap-1"><AlertCircle size={8} />{errors.title}</span>}
                </div>
                <input
                  value={fields.title}
                  onChange={(e) => setF("title", e.target.value)}
                  placeholder="Give this prompt a unique name…"
                  className="w-full h-10 px-3 font-sans text-[14px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                  style={{ border: errors.title ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.16)" }}
                />
              </div>
              <Input
                value={fields.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="Brief description of what this produces…"
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FieldSelect
                  label="PROVIDER"
                  value={fields.provider}
                  onChange={(v) => { setF("provider", v as Provider); setOutputOverride(null); }}
                  options={PROVIDERS}
                />
                <FieldSelect label="CATEGORY" value={fields.category} onChange={(v) => setF("category", v)} options={CATEGORIES} />
              </div>
              <Input
                value={fields.use_case}
                onChange={(e) => setF("use_case", e.target.value)}
                placeholder="Use case: hero banner, product page, social…"
              />
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
                {builderFields.map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="system-label text-[11px] text-muted">{label}</label>
                    <input
                      value={fields[key] as string}
                      onChange={(e) => setF(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full h-10 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                      style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                    />
                  </div>
                ))}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="system-label text-[11px] text-muted">REALISM NOTES</label>
                  <input
                    value={fields.realism}
                    onChange={(e) => setF("realism", e.target.value)}
                    placeholder="authentic skin texture, real terrain imperfections…"
                    className="w-full h-10 px-3 font-mono text-[12px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label text-[11px] text-muted">PROMPT TEXT</label>
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
          </div>

          {/* Token Library — builder mode only */}
          {mode === "builder" && (
            <div>
              <SectionHeader label="TOKEN LIBRARY" />
              <div
                className="flex flex-col gap-5 p-5 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
              >
                {/* Sequence builder */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="system-label text-[10px] text-muted">SEQUENCE</span>
                    {tokenSequence.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setTokenSequence([]); setTokenOverrides({}); setOutputOverride(null); }}
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
          <div>
            <SectionHeader label="AI-LOOK AVOIDANCE" />
            <div className="flex flex-col gap-3">
              <AvoidancePanel
                promptText={assembled}
                category={fields.category}
                provider={fields.provider}
                onAddCorrection={(text) => {
                  setF("avoidance_text", fields.avoidance_text ? `${fields.avoidance_text}, ${text}` : text);
                }}
                onRiskScoreChange={(score) => setF("ai_look_risk", Math.round(score))}
              />
              <Textarea
                value={fields.avoidance_text}
                onChange={(e) => setF("avoidance_text", e.target.value)}
                placeholder="Avoidance corrections appear here. Edit freely — this is appended to your prompt on copy."
                rows={3}
                mono
              />
            </div>
          </div>

          {/* Meta */}
          <div>
            <SectionHeader label="META" />
            <div className="flex flex-col gap-3">
              <TagInput tags={fields.tags} onChange={(t) => setF("tags", t)} />
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
          <div
            className="flex flex-col gap-4 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label text-soft-white">PARAMETERS</span>
              <span className="font-mono text-[10px] text-readable uppercase tracking-widest">{fields.provider}</span>
            </div>
            {fields.provider === "midjourney" && (
              <MidjourneyParams
                p={mjParams}
                set={setMJ}
                selectedSrefTitle={selectedSref?.title ?? null}
                onBrowseSref={() => setSrefPickerOpen(true)}
                onClearSref={() => setSelectedSref(null)}
              />
            )}
            {fields.provider === "dalle" && <DalleParamsPanel p={dalleParams} set={setDalle} />}
            {fields.provider === "stable_diffusion" && <SDParamsPanel p={sdParams} set={setSD} />}
            {!["midjourney", "dalle", "stable_diffusion"].includes(fields.provider) && (
              <p className="font-mono text-[11px] text-readable leading-relaxed">No structured parameters for this provider. Add them manually in the prompt text.</p>
            )}
          </div>

          {/* Related Prompts */}
          {relatedPrompts.length > 0 && (
            <div
              className="flex flex-col gap-3 p-5 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
            >
              <div className="flex items-center gap-2">
                <Zap size={11} className="text-cyan" />
                <span className="system-label text-soft-white">RELATED</span>
              </div>
              {relatedPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/library/${p.id}`)}
                  className="flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-sm hover:bg-white/5 transition-precise"
                  style={{ border: "var(--border-dim)" }}
                >
                  <span className="font-mono text-[11px] text-readable truncate">{p.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < p.rating ? "bg-amber/80" : "bg-white/14")} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recipes */}
          {availableRecipes.length > 0 && (
            <div
              className="flex flex-col gap-3 p-5 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
            >
              <div className="flex items-center gap-2">
                <Wand2 size={11} className="text-cyan" />
                <span className="system-label text-soft-white">RECIPES</span>
              </div>
              {availableRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleApplyRecipe(recipe)}
                  className="flex items-start justify-between gap-3 text-left px-2.5 py-2 rounded-sm hover:bg-white/5 transition-precise"
                  style={{ border: appliedRecipeId === recipe.id ? "1px solid rgba(72,229,232,0.35)" : "var(--border-dim)" }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[11px] text-readable truncate">{recipe.title}</span>
                    <span className="font-mono text-[9px] text-muted truncate">{recipe.provider}</span>
                  </div>
                  <span className="font-mono text-[9px] text-cyan shrink-0">Use</span>
                </button>
              ))}
            </div>
          )}

          {/* High-impact references */}
          {impactRefs.length > 0 && (
            <div className="flex flex-col gap-3 p-5 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex items-center justify-between">
                <span className="system-label text-soft-white">IMPACT REFS</span>
                <span className="font-mono text-[9px] text-muted">linked to winners</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {impactRefs.map((ref) => (
                  <ImpactRefRow key={ref.id} ref_={ref} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div
            className="flex flex-col gap-4 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <RecommendationPanel
              context={{
                provider: fields.provider,
                category: fields.category || undefined,
                excludePromptId: id,
                projectId: projectId ?? undefined,
                promptText: assembled,
              }}
            />
          </div>

          {/* Scoring */}
          <div
            className="flex flex-col gap-5 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label text-soft-white">SCORING</span>
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
          </div>

          {/* Prompt Output — editable */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label">PROMPT OUTPUT</span>
              <span className={cn("font-mono text-[9px]", charCount > 1500 ? "text-red/70" : "text-dim/60")}>
                {charCount} chars
              </span>
            </div>

            {/* Provider formatting hints */}
            {(() => {
              const hints = getProviderHints(fields.provider);
              if (!hints.length) return null;
              return (
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-dim/50">{fields.provider} tips</span>
                  {hints.map((h) => (
                    <span key={h} className="font-mono text-[9px] text-dim/60">· {h}</span>
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
              className="w-full px-3 py-2 font-mono text-[10px] text-soft-white/90 placeholder:text-dim/40 bg-black/30 rounded-sm focus:outline-none focus:border-red/40 transition-precise resize-none leading-relaxed"
              style={{ border: "var(--border-dim)" }}
            />

            {outputOverride !== null && (
              <button
                type="button"
                onClick={() => setOutputOverride(null)}
                className="font-mono text-[9px] text-dim/60 hover:text-white transition-precise text-left"
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
                  <span className="font-mono text-[8px] uppercase tracking-widest text-cyan/70">Formatted</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {formatChanges.map((c) => (
                      <li key={c} className="font-mono text-[9px] text-soft-white/70">· {c}</li>
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
                <span className="system-label text-[8px]">INCLUDE AVOIDANCE ON COPY</span>
              </label>
            )}

            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!assembled} className="w-full justify-center">
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied!" : includeAvoidance ? "Copy with Avoidance" : "Copy Prompt"}
            </Button>
          </div>

          {/* Low-quality token advisory */}
          {lowQualityTokens.length > 0 && !lowQualityDismissed && (
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm"
              style={{ border: "1px solid rgba(215,25,33,0.25)", background: "rgba(215,25,33,0.04)" }}
            >
              <AlertCircle size={11} className="text-red/60 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[8px] uppercase tracking-widest text-red/60">Low-performing tokens</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lowQualityTokens.map((t) => (
                    <span key={t.id} className="font-mono text-[9px] text-muted/80">{t.text}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLowQualityDismissed(true)}
                className="font-mono text-[9px] text-dim/40 hover:text-white shrink-0 transition-precise"
              >
                ×
              </button>
            </div>
          )}

          {/* AI Prompt Advisor */}
          {(() => {
            const canAnalyze = validatePromptForAnalysis(fields.prompt_text).valid;
            const hasAdvice = (advice.suggestions.length > 0 || advice.risks.length > 0) && !adviceDismissed;
            return (
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canAnalyze || adviceLoading}
                  title={!canAnalyze ? validatePromptForAnalysis(fields.prompt_text).message : "Analyze with Claude Haiku"}
                  onClick={async () => {
                    setAdviceLoading(true);
                    setAdviceDismissed(false);
                    try {
                      const result = await analyzePromptDraft({
                        promptText: fields.prompt_text,
                        brief: projectContext?.brief_text,
                        provenTokens: tokenSequence.filter(t => t.quality_score > 0.3).map(t => t.text).slice(0, 5),
                      });
                      setAdvice(result);
                    } catch {
                      /* silently ignore API errors */
                    } finally {
                      setAdviceLoading(false);
                    }
                  }}
                  className="w-full justify-center"
                >
                  <Wand2 size={10} />
                  {adviceLoading ? "Analyzing…" : "Analyze Draft"}
                </Button>
                {hasAdvice && (
                  <div className="flex flex-col gap-2 px-3 py-2.5 rounded-sm"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-readable">AI Advice</span>
                      <button onClick={() => setAdviceDismissed(true)} className="text-readable hover:text-white text-[10px]">×</button>
                    </div>
                    {advice.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 font-mono text-[8px] text-white/40">→</span>
                        <span className="font-mono text-[9px] text-white/70 leading-relaxed">{s}</span>
                      </div>
                    ))}
                    {advice.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 font-mono text-[8px] text-red/50">!</span>
                        <span className="font-mono text-[9px] text-red/60 leading-relaxed">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  {saving ? "Saving…" : "Overwrite Current"}
                </Button>
                <p className="font-mono text-[8px] text-dim/40 text-center leading-relaxed">
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
