import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Copy, Check, AlertCircle, Zap } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Provider, Category, Token, Prompt } from "@/types";
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
        <label className="system-label">{label}</label>
        {hint && <span className="font-mono text-[8px] text-dim/60">{hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
        style={{ border: "1px solid rgba(255,255,255,0.10)" }}
      />
    </div>
  );
}

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="system-label">RATING</label>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
            className={cn(
              "w-4 h-4 rounded-full border transition-precise",
              i < value ? "bg-white/50 border-white/40" : "bg-transparent border-white/15 hover:border-white/30"
            )}
          />
        ))}
        <span className="font-mono text-[10px] text-dim ml-1">{value}/5</span>
      </div>
    </div>
  );
}

function RiskSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colorClass = value >= 8 ? "text-red" : value >= 6 ? "text-red/70" : value >= 4 ? "text-muted" : "text-dim";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="system-label">AI-LOOK RISK</label>
        <span className={cn("font-mono text-[10px]", colorClass)}>{value}/10</span>
      </div>
      <input
        type="range" min={0} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-px cursor-pointer accent-white/60"
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

function MidjourneyParams({ p, set }: { p: MJParams; set: (k: keyof MJParams, v: string | boolean) => void }) {
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
      <FieldInput label="SREF CODE" value={p.sref_code} onChange={(v) => set("sref_code", v)} placeholder="12345" />
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
        <span className="system-label text-[8px] text-dim/40">FLAGS</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
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
        <label className="system-label">NEGATIVE PROMPT</label>
        <textarea
          value={p.negative_prompt}
          onChange={(e) => set("negative_prompt", e.target.value)}
          placeholder="ugly, bad anatomy, blurry…"
          rows={3}
          className="w-full px-3 py-2 font-mono text-[10px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise resize-none"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
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

interface CraftPromptLocationState {
  prefillPromptText?: string;
  prefillTitle?: string;
  prefillRecipeId?: string;
}

// ─── Component ────────────────────────────────────────────────

export function CraftPrompt() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { create, update, getById, prompts: allPrompts } = usePromptStore();
  const prefillState = location.state as CraftPromptLocationState | null;

  const isEdit = Boolean(id);

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [mjParams, setMjParams] = useState<MJParams>(EMPTY_MJ);
  const [dalleParams, setDalleParams] = useState<DalleParams>(EMPTY_DALLE);
  const [sdParams, setSDParams] = useState<SDParams>(EMPTY_SD);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savingNewVersion, setSavingNewVersion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"builder" | "manual">("builder");
  const [originalVersion, setOriginalVersion] = useState(1);

  // Production Memory (Phase 06)
  const [duplicates, setDuplicates] = useState<SimilarPrompt[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [relatedPrompts, setRelatedPrompts] = useState<Prompt[]>([]);

  // For editable assembled output
  const [outputOverride, setOutputOverride] = useState<string | null>(null);
  const [includeAvoidance, setIncludeAvoidance] = useState(false);
  const [tokenSequence, setTokenSequence] = useState<Token[]>([]);
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, string>>({});

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

  const fullCopyText = includeAvoidance && fields.avoidance_text
    ? `${assembled}\n\n${fields.avoidance_text}`
    : assembled;

  const charCount = assembled.length;

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
    parent_id: !isEdit ? prefillState?.prefillRecipeId : undefined,
    notes: fields.notes || undefined,
  });

  const handleSave = async (asRecipe = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await update(id, buildData(asRecipe));
        navigate(`/library/${id}`);
      } else {
        const newId = await create(buildData(asRecipe));
        navigate(`/library/${newId}`);
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
      navigate(`/library/${newId}`);
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

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="system-label">{label}</span>
      <div className="flex-1 h-px bg-white/7" />
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
    <PageContainer
      title={isEdit ? "Edit Prompt" : "Craft Prompt"}
      subtitle={isEdit ? `EDITING VERSION ${originalVersion} — UPDATE OR FORK NEW VERSION` : "BUILD A PROVIDER-READY PROMPT"}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(isEdit && id ? `/library/${id}` : "/library")}>
            <ArrowLeft size={11} /> {isEdit ? "Cancel" : "Library"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!assembled}>
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Copied!" : "Copy"}
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
      <div className="flex gap-6 min-w-0">
        {/* ── Left: Main form ─────────────────────────────── */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">

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
                  <label className="system-label">TITLE</label>
                  {errors.title && <span className="font-mono text-[9px] text-red/80 flex items-center gap-1"><AlertCircle size={8} />{errors.title}</span>}
                </div>
                <input
                  value={fields.title}
                  onChange={(e) => setF("title", e.target.value)}
                  placeholder="Give this prompt a unique name…"
                  className="w-full h-8 px-3 font-sans text-[13px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                  style={{ border: errors.title ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
              <Input
                value={fields.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="Brief description of what this produces…"
              />
              <div className="grid grid-cols-2 gap-3">
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
                    "font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded transition-precise",
                    mode === m ? "text-white" : "text-dim hover:text-muted"
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
              <div className="grid grid-cols-2 gap-3">
                {builderFields.map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="system-label">{label}</label>
                    <input
                      value={fields[key] as string}
                      onChange={(e) => setF(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                    />
                  </div>
                ))}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="system-label">REALISM NOTES</label>
                  <input
                    value={fields.realism}
                    onChange={(e) => setF("realism", e.target.value)}
                    placeholder="authentic skin texture, real terrain imperfections…"
                    className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label">PROMPT TEXT</label>
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
                className="flex flex-col gap-4 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
              >
                {/* Sequence builder */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="system-label text-[8px]">SEQUENCE</span>
                    {tokenSequence.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setTokenSequence([]); setTokenOverrides({}); setOutputOverride(null); }}
                        className="font-mono text-[8px] text-dim/50 hover:text-red transition-precise"
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

                {/* Divider */}
                <div className="h-px bg-white/7" />

                {/* Token cloud */}
                <TokenCloud
                  selectedTexts={tokenTexts}
                  onToggle={handleTokenToggle}
                  providerFilter={fields.provider}
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
        <div className="flex flex-col gap-4 w-64 shrink-0">

          {/* Provider Parameters */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label">PARAMETERS</span>
              <span className="font-mono text-[9px] text-dim/60 uppercase tracking-widest">{fields.provider}</span>
            </div>
            {fields.provider === "midjourney" && <MidjourneyParams p={mjParams} set={setMJ} />}
            {fields.provider === "dalle" && <DalleParamsPanel p={dalleParams} set={setDalle} />}
            {fields.provider === "stable_diffusion" && <SDParamsPanel p={sdParams} set={setSD} />}
            {!["midjourney", "dalle", "stable_diffusion"].includes(fields.provider) && (
              <p className="font-mono text-[10px] text-dim leading-relaxed">No structured parameters for this provider. Add them manually in the prompt text.</p>
            )}
          </div>

          {/* Related Prompts */}
          {relatedPrompts.length > 0 && (
            <div
              className="flex flex-col gap-2 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
            >
              <div className="flex items-center gap-2">
                <Zap size={9} className="text-dim/50" />
                <span className="system-label">RELATED</span>
              </div>
              {relatedPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/library/${p.id}`)}
                  className="flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-sm hover:bg-white/5 transition-precise"
                  style={{ border: "var(--border-dim)" }}
                >
                  <span className="font-mono text-[10px] text-muted truncate">{p.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn("w-1 h-1 rounded-full", i < p.rating ? "bg-white/50" : "bg-white/10")} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <RecommendationPanel
              context={{ provider: fields.provider, category: fields.category || undefined, excludePromptId: id }}
            />
          </div>

          {/* Scoring */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">SCORING</span>
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
  );
}
