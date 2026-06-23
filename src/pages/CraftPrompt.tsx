import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Copy } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { usePromptStore } from "@/stores/usePromptStore";
import { cn } from "@/lib/utils";
import type { Provider, Category } from "@/types";
import type { CreatePromptInput } from "@/lib/db";

// ─── Field Select ─────────────────────────────────────────────

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
          className={cn(
            "w-full appearance-none pr-7 h-8 px-3",
            "font-mono text-[12px] text-white",
            "bg-dark rounded-sm",
            "focus:outline-none focus:border-red/50 transition-precise",
            "cursor-pointer"
          )}
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={10}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
        />
      </div>
    </div>
  );
}

// ─── Rating Picker ────────────────────────────────────────────

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
              i < value
                ? "bg-white/50 border-white/40"
                : "bg-transparent border-white/15 hover:border-white/30"
            )}
          />
        ))}
        <span className="font-mono text-[10px] text-dim ml-1">{value}/5</span>
      </div>
    </div>
  );
}

// ─── Risk Slider ──────────────────────────────────────────────

function RiskSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colorClass = value >= 8 ? "text-red" : value >= 6 ? "text-red/70" : value >= 4 ? "text-muted" : "text-dim";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="system-label">AI-LOOK RISK</label>
        <span className={cn("font-mono text-[10px]", colorClass)}>{value}/10</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-px cursor-pointer accent-white/60"
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.4) ${value * 10}%, rgba(255,255,255,0.08) ${value * 10}%)`,
        }}
      />
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
          <span
            key={tag}
            className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border border-white/10 text-dim"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-dim/50 hover:text-red transition-precise leading-none"
            >
              ×
            </button>
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

// ─── Assemble prompt from builder fields ──────────────────────

function assemblePrompt(f: {
  subject: string; environment: string; camera: string; lens: string;
  lighting: string; mood: string; realism: string;
  provider: string; aspect_ratio: string; model_version: string;
  stylize: string; sref_code: string;
}): string {
  const parts = [f.subject, f.environment, f.camera, f.lens, f.lighting, f.mood, f.realism]
    .map((s) => s.trim()).filter(Boolean);
  let out = parts.join(", ");
  if (f.provider === "midjourney") {
    if (f.aspect_ratio) out += ` --ar ${f.aspect_ratio}`;
    if (f.model_version) out += ` --v ${f.model_version}`;
    if (f.stylize) out += ` --s ${f.stylize}`;
    if (f.sref_code) out += ` --sref ${f.sref_code}`;
  }
  return out;
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

const ASPECT_RATIOS: { value: string; label: string }[] = [
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

// ─── Form state ───────────────────────────────────────────────

interface Fields {
  title: string; description: string; provider: Provider;
  category: string; use_case: string;
  prompt_text: string; avoidance_text: string;
  subject: string; environment: string; camera: string; lens: string;
  lighting: string; mood: string; realism: string;
  aspect_ratio: string; model_version: string; stylize: string; sref_code: string;
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
  aspect_ratio: "", model_version: "", stylize: "", sref_code: "",
  rating: 0, ai_look_risk: 0,
  tags: [], notes: "",
  is_winner: false, is_failed: false,
};

// ─── Component ────────────────────────────────────────────────

export function CraftPrompt() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { create, update, getById } = usePromptStore();

  const isEdit = Boolean(id);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"builder" | "manual">("builder");

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
        aspect_ratio: p.aspect_ratio ?? "", model_version: p.model_version ?? "",
        sref_code: p.style_ref ?? "",
        rating: p.rating, ai_look_risk: p.ai_look_risk,
        tags: p.tags ?? [], notes: p.notes ?? "",
        is_winner: p.is_winner, is_failed: p.is_failed,
      });
      setMode("manual");
    });
  }, [id, getById]);

  const set = <K extends keyof Fields>(key: K, val: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const assembled =
    mode === "builder"
      ? assemblePrompt(fields)
      : fields.prompt_text;

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!fields.title.trim()) errs.title = "Required";
    if (!assembled.trim()) errs.prompt_text = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (asRecipe = false) => {
    if (!validate()) return;
    setSaving(true);
    const data: CreatePromptInput = {
      title: fields.title.trim(),
      description: fields.description || undefined,
      provider: fields.provider,
      category: (fields.category as Category) || undefined,
      use_case: fields.use_case || undefined,
      prompt_text: assembled,
      avoidance_text: fields.avoidance_text || undefined,
      aspect_ratio: fields.aspect_ratio || undefined,
      model_version: fields.model_version || undefined,
      camera: fields.camera || undefined,
      lens: fields.lens || undefined,
      lighting: fields.lighting || undefined,
      tags: fields.tags.length ? fields.tags : undefined,
      rating: fields.rating,
      ai_look_risk: fields.ai_look_risk,
      is_winner: fields.is_winner,
      is_failed: fields.is_failed,
      notes: fields.notes || undefined,
    };
    try {
      if (isEdit && id) {
        await update(id, data);
        navigate(`/library/${id}`);
      } else {
        const newId = await create({ ...data, is_recipe: asRecipe });
        navigate(`/library/${newId}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!assembled) return;
    await navigator.clipboard.writeText(assembled);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="system-label">{label}</span>
      <div className="flex-1 h-px bg-white/7" />
    </div>
  );

  return (
    <PageContainer
      title={isEdit ? "Edit Prompt" : "Craft Prompt"}
      subtitle={isEdit ? "UPDATE EXISTING PROMPT" : "BUILD A PROVIDER-READY PROMPT"}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isEdit && id ? `/library/${id}` : "/library")}
          >
            <ArrowLeft size={11} /> {isEdit ? "Cancel" : "Library"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!assembled}>
            <Copy size={10} />
            {copied ? "Copied!" : "Copy"}
          </Button>
          {!isEdit && (
            <Button variant="ghost" size="sm" onClick={() => handleSave(true)} disabled={saving}>
              Save as Recipe
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => handleSave(false)} disabled={saving}>
            <Save size={11} />
            {saving ? "Saving…" : isEdit ? "Update" : "Save to Library"}
          </Button>
        </div>
      }
    >
      <div className="flex gap-6 min-w-0">
        {/* ── Left: Main form ─────────────────────── */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">

          {/* Identity */}
          <div>
            <SectionHeader label="IDENTITY" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label">TITLE</label>
                  {errors.title && <span className="font-mono text-[9px] text-red/80">{errors.title}</span>}
                </div>
                <input
                  value={fields.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Give this prompt a unique name…"
                  className={cn(
                    "w-full h-8 px-3 font-sans text-[13px] text-white placeholder:text-dim",
                    "bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise",
                    errors.title ? "border-red/60" : ""
                  )}
                  style={{ border: errors.title ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.10)" }}
                />
              </div>
              <Input
                value={fields.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of what this produces…"
              />
              <div className="grid grid-cols-2 gap-3">
                <FieldSelect
                  label="PROVIDER"
                  value={fields.provider}
                  onChange={(v) => set("provider", v as Provider)}
                  options={PROVIDERS}
                />
                <FieldSelect
                  label="CATEGORY"
                  value={fields.category}
                  onChange={(v) => set("category", v)}
                  options={CATEGORIES}
                />
              </div>
              <Input
                value={fields.use_case}
                onChange={(e) => set("use_case", e.target.value)}
                placeholder="Use case: hero banner, product page, social…"
              />
            </div>
          </div>

          {/* Prompt Builder */}
          <div>
            <SectionHeader label="PROMPT" />
            <div className="flex items-center gap-2 mb-4">
              {(["builder", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "font-mono text-[9px] tracking-widest uppercase px-3 py-1.5 rounded transition-precise",
                    mode === m ? "text-white" : "text-dim hover:text-muted"
                  )}
                  style={{
                    border: mode === m ? "var(--border-strong)" : "var(--border-dim)",
                    background: mode === m ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  {m === "builder" ? "Builder Mode" : "Manual Mode"}
                </button>
              ))}
            </div>

            {mode === "builder" ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "subject" as const, label: "SUBJECT / ACTION", placeholder: "woman running through field" },
                  { key: "environment" as const, label: "ENVIRONMENT", placeholder: "golden hour forest" },
                  { key: "camera" as const, label: "CAMERA", placeholder: "low angle tracking shot" },
                  { key: "lens" as const, label: "LENS", placeholder: "14mm ultra-wide" },
                  { key: "lighting" as const, label: "LIGHTING", placeholder: "natural morning sunlight" },
                  { key: "mood" as const, label: "MOOD / BRAND TONE", placeholder: "documentary realism" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="system-label">{label}</label>
                    <input
                      value={fields[key]}
                      onChange={(e) => set(key, e.target.value)}
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
                    onChange={(e) => set("realism", e.target.value)}
                    placeholder="authentic skin texture, real terrain imperfections, wind-affected clothing"
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
                  onChange={(e) => set("prompt_text", e.target.value)}
                  placeholder="Paste or type your full prompt here…"
                  rows={6}
                  mono
                />
              </div>
            )}
          </div>

          {/* Avoidance */}
          <div>
            <SectionHeader label="AI-LOOK AVOIDANCE" />
            <div className="flex flex-col gap-1.5">
              <label className="system-label">AVOIDANCE CORRECTIONS</label>
              <Textarea
                value={fields.avoidance_text}
                onChange={(e) => set("avoidance_text", e.target.value)}
                placeholder="Add avoidance corrections here. These will be appended to your prompt."
                rows={3}
                mono
              />
            </div>
          </div>

          {/* Meta */}
          <div>
            <SectionHeader label="META" />
            <div className="flex flex-col gap-3">
              <TagInput tags={fields.tags} onChange={(t) => set("tags", t)} />
              <div className="flex flex-col gap-1.5">
                <label className="system-label">NOTES</label>
                <Textarea
                  value={fields.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Production notes, context, intended usage…"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Parameters + Preview ─────────── */}
        <div className="flex flex-col gap-4 w-64 shrink-0">

          {/* Parameters */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">PARAMETERS</span>
            <FieldSelect
              label="ASPECT RATIO"
              value={fields.aspect_ratio}
              onChange={(v) => set("aspect_ratio", v)}
              options={ASPECT_RATIOS}
            />
            {fields.provider === "midjourney" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="system-label">MODEL VERSION</label>
                  <input
                    value={fields.model_version}
                    onChange={(e) => set("model_version", e.target.value)}
                    placeholder="7"
                    className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="system-label">STYLIZE</label>
                  <input
                    value={fields.stylize}
                    onChange={(e) => set("stylize", e.target.value)}
                    placeholder="400"
                    className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="system-label">SREF CODE</label>
                  <input
                    value={fields.sref_code}
                    onChange={(e) => set("sref_code", e.target.value)}
                    placeholder="--sref 12345"
                    className="w-full h-8 px-3 font-mono text-[11px] text-soft-white placeholder:text-dim/50 bg-dark rounded-sm focus:outline-none focus:border-red/50 transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Scoring */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">SCORING</span>
            <RatingPicker value={fields.rating} onChange={(n) => set("rating", n)} />
            <RiskSlider value={fields.ai_look_risk} onChange={(n) => set("ai_look_risk", n)} />
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.is_winner}
                  onChange={(e) => set("is_winner", e.target.checked)}
                  className="accent-white"
                />
                <span className="system-label">WINNER</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.is_failed}
                  onChange={(e) => set("is_failed", e.target.checked)}
                  className="accent-red"
                />
                <span className="system-label text-dim/60">FAILED</span>
              </label>
            </div>
          </div>

          {/* Prompt Output */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label">PROMPT OUTPUT</span>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!assembled}
                className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-dim hover:text-white transition-precise disabled:opacity-30"
              >
                <Copy size={9} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div
              className="p-3 rounded-sm min-h-24"
              style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
            >
              {assembled ? (
                <pre className="font-mono text-[10px] text-soft-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">
                  {assembled}
                </pre>
              ) : (
                <p className="font-mono text-[10px] text-dim/50 italic leading-relaxed">
                  Assembled prompt will appear here as you fill the fields above.
                </p>
              )}
            </div>
          </div>

          {/* Save actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full justify-center"
            >
              <Save size={11} />
              {saving ? "Saving…" : isEdit ? "Update Prompt" : "Save to Library"}
            </Button>
            {!isEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full justify-center"
              >
                Save as Recipe
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
