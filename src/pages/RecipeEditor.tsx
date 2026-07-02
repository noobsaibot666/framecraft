import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Layers, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { extractSlots, type ExtractedRecipeSlot } from "@/lib/recipeExtract";
import { createPrompt, updatePrompt } from "@/lib/db";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Category, Provider } from "@/types";

// ─── Constants ─────────────────────────────────────────────────

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

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "No category" },
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

// ─── Sub-components ────────────────────────────────────────────

function FieldSelect({
  label, value, onChange, options,
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
          className="w-full appearance-none pr-7 h-9 px-3 font-mono text-[13px] text-white bg-dark rounded-sm focus:outline-none focus:border-cyan/55 transition-precise cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel text-white">{o.label}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
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
      <label className="system-label text-[12px] text-muted">TAGS</label>
      <div
        className="flex flex-wrap gap-1.5 p-2.5 rounded-sm min-h-9"
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

// ─── Slot chip in detection panel ─────────────────────────────

function SlotChip({
  slot,
  onToggleRequired,
  onRemove,
}: {
  slot: ExtractedRecipeSlot;
  onToggleRequired: (slot: ExtractedRecipeSlot) => void;
  onRemove: (slot: ExtractedRecipeSlot) => void;
}) {
  const isParam = slot.kind === "parameter";
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm"
      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
    >
      <span
        className={cn(
          "font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm shrink-0",
          isParam
            ? "text-cyan/70 bg-cyan/8 border border-cyan/20"
            : slot.required
            ? "text-white/60 bg-white/8 border border-white/16"
            : "text-amber/70 bg-amber/8 border border-amber/20"
        )}
      >
        {isParam ? slot.flag ?? "PARAM" : slot.required ? "REQ" : "OPT"}
      </span>
      <span className="font-mono text-[12px] text-soft-white flex-1 min-w-0 truncate">{slot.label}</span>
      <span className="font-mono text-[9px] text-dim/40 shrink-0 font-light italic truncate max-w-24">{slot.token}</span>
      {!isParam && (
        <button
          type="button"
          onClick={() => onToggleRequired(slot)}
          className="font-mono text-[8px] text-dim/50 hover:text-white transition-precise shrink-0"
          title={slot.required ? "Make optional" : "Make required"}
        >
          {slot.required ? "opt?" : "req!"}
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(slot)}
        className="text-dim/40 hover:text-red/70 transition-precise shrink-0"
      >
        <X size={9} />
      </button>
    </div>
  );
}

// ─── Insert Slot Panel ─────────────────────────────────────────

function InsertSlotPanel({
  onInsert,
  onClose,
}: {
  onInsert: (name: string, required: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [required, setRequired] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commit = () => {
    if (name.trim()) onInsert(name.trim(), required);
  };

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-sm"
      style={{ border: "1px solid rgba(72,229,232,0.25)", background: "rgba(72,229,232,0.04)" }}
    >
      <div className="flex items-center justify-between">
        <span className="system-label text-[10px] text-cyan/70">INSERT SLOT</span>
        <button type="button" onClick={onClose} className="text-dim/50 hover:text-white transition-precise"><X size={11} /></button>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }}
          placeholder="Slot name (e.g. Subject)"
          className="flex-1 h-8 px-2.5 font-mono text-[13px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
        <button
          type="button"
          onClick={() => setRequired((r) => !r)}
          className={cn(
            "h-8 px-3 font-mono text-[9px] tracking-widest uppercase rounded-sm transition-precise shrink-0",
            required ? "text-white/70 border-white/25" : "text-amber/70 border-amber/30"
          )}
          style={{ border: "1px solid" }}
        >
          {required ? "Required" : "Optional"}
        </button>
        <Button variant="primary" size="sm" onClick={commit} disabled={!name.trim()}>
          Insert
        </Button>
      </div>
      <p className="font-mono text-[9px] text-dim/50 leading-relaxed">
        Inserts <code className="text-cyan/60">[{name.trim() || "LABEL"}{required ? "" : "?"}]</code> at cursor. Use <span className="text-white/40">[LABEL?]</span> for optional slots.
      </p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────

export function RecipeEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { getById } = usePromptStore();
  const isNew = !id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<Provider>("midjourney");
  const [category, setCategory] = useState("");
  const [promptText, setPromptText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [fieldError, setFieldError] = useState("");
  const [showSlotForm, setShowSlotForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getById(id).then((p) => {
      if (!p || !p.is_recipe) { navigate("/recipes"); return; }
      setTitle(p.title);
      setDescription(p.description ?? "");
      setProvider(p.provider);
      setCategory(p.category ?? "");
      setPromptText(p.prompt_text);
      setTags(p.tags ?? []);
      setNotes(p.notes ?? "");
    }).finally(() => setLoading(false));
  }, [id, getById, navigate]);

  const detectedSlots = extractSlots(promptText);

  const insertSlot = (name: string, required: boolean) => {
    const token = required ? `[${name}]` : `[${name}?]`;
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? promptText.length;
      const end = ta.selectionEnd ?? promptText.length;
      const before = promptText.slice(0, start);
      const after = promptText.slice(end);
      const separator = before.length > 0 && !before.endsWith(" ") ? " " : "";
      const newText = before + separator + token + after;
      setPromptText(newText);
      const newPos = before.length + separator.length + token.length;
      setTimeout(() => {
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
        ta.focus();
      }, 0);
    } else {
      setPromptText(promptText + " " + token);
    }
    setShowSlotForm(false);
  };

  const removeSlot = (slot: ExtractedRecipeSlot) => {
    const before = promptText.slice(0, slot.start);
    const after = promptText.slice(slot.end);
    setPromptText((before + after).replace(/  +/g, " ").trim());
  };

  const toggleSlotRequired = (slot: ExtractedRecipeSlot) => {
    if (slot.kind !== "placeholder") return;
    const newToken = slot.required ? `[${slot.label}?]` : `[${slot.label}]`;
    setPromptText(
      promptText.slice(0, slot.start) + newToken + promptText.slice(slot.end)
    );
  };

  const handleSave = async () => {
    if (!title.trim()) { setFieldError("Title is required"); return; }
    if (!promptText.trim()) { setFieldError("Prompt text is required"); return; }
    setFieldError("");
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description || undefined,
        provider,
        category: (category as Category) || undefined,
        prompt_text: promptText,
        tags: tags.length ? tags : undefined,
        notes: notes || undefined,
        is_recipe: true as const,
      };
      if (isNew) {
        const newId = await createPrompt(data);
        toast.success("Recipe created");
        navigate(`/recipes/${newId}/edit`);
      } else {
        await updatePrompt(id!, data);
        toast.success("Recipe updated");
      }
    } catch {
      toast.error("Failed to save recipe");
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="system-label text-[13px] text-soft-white">{label}</span>
      <div className="flex-1 h-px bg-white/16" />
    </div>
  );

  if (loading) {
    return (
      <PageContainer title="Recipe Editor" subtitle="LOADING">
        <div className="flex items-center justify-center py-20">
          <span className="font-ndot text-[28px] text-dim/30">···</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={isNew ? "New Recipe" : "Edit Recipe"}
      subtitle={isNew ? "CREATE A REUSABLE PROMPT TEMPLATE" : "RECIPE TEMPLATE EDITOR"}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/recipes")}>
            <ArrowLeft size={11} /> Recipes
          </Button>
          {!isNew && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/recipes/${id}/apply`)}>
              <Wand2 size={10} /> Apply
            </Button>
          )}
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
            <Save size={11} />
            {saving ? "Saving…" : isNew ? "Create Recipe" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-8 min-w-0">

        {/* ── Left: Form ──────────────────────────────── */}
        <div className="flex flex-col gap-8 min-w-0">

          {/* Identity */}
          <div>
            <SectionHeader label="IDENTITY" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <label className="system-label text-[12px] text-muted">TITLE</label>
                  {fieldError.includes("Title") && (
                    <span className="font-mono text-[9px] text-red/80">{fieldError}</span>
                  )}
                </div>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setFieldError(""); }}
                  placeholder="Give this recipe a name…"
                  className="w-full h-10 px-3 font-sans text-[15px] text-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                  style={{ border: fieldError.includes("Title") ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.16)" }}
                />
              </div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this recipe produces…"
                className="w-full h-9 px-3 font-mono text-[13px] text-soft-white placeholder:text-dim bg-dark rounded-sm focus:outline-none transition-precise"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FieldSelect label="PROVIDER" value={provider} onChange={(v) => setProvider(v as Provider)} options={PROVIDERS} />
                <FieldSelect label="CATEGORY" value={category} onChange={setCategory} options={CATEGORIES} />
              </div>
            </div>
          </div>

          {/* Template */}
          <div>
            <SectionHeader label="PROMPT TEMPLATE" />
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <label className="system-label text-[12px] text-muted">TEMPLATE TEXT</label>
                {fieldError.includes("Prompt") && (
                  <span className="font-mono text-[9px] text-red/80">{fieldError}</span>
                )}
              </div>
              <p className="font-mono text-[10px] text-dim/60 leading-relaxed">
                Use <span className="text-white/50">[Slot Name]</span> for required slots and <span className="text-white/50">[Slot Name?]</span> for optional. Midjourney parameters like <span className="text-white/50">--ar [Aspect Ratio]</span> are auto-detected.
              </p>
              <textarea
                ref={textareaRef}
                value={promptText}
                onChange={(e) => { setPromptText(e.target.value); setFieldError(""); }}
                placeholder="Write your template here. Use [Subject], [Mood?], --ar [Aspect Ratio] to define slots…"
                rows={10}
                className="w-full px-3 py-3 font-mono text-[13px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none resize-y leading-relaxed"
                style={{ border: fieldError.includes("Prompt") ? "1px solid rgba(215,25,33,0.6)" : "1px solid rgba(255,255,255,0.16)" }}
              />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-dim/50 flex-1">{promptText.length} chars</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSlotForm((v) => !v)}
                >
                  <Plus size={10} />
                  Insert Slot
                </Button>
              </div>
              {showSlotForm && (
                <InsertSlotPanel
                  onInsert={insertSlot}
                  onClose={() => setShowSlotForm(false)}
                />
              )}
            </div>
          </div>

          {/* Meta */}
          <div>
            <SectionHeader label="META" />
            <div className="flex flex-col gap-3">
              <TagInput tags={tags} onChange={setTags} />
              <div className="flex flex-col gap-1.5">
                <label className="system-label text-[12px] text-muted">NOTES</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Usage notes, when to apply this recipe…"
                  rows={2}
                  className="w-full px-3 py-2.5 font-mono text-[13px] text-soft-white placeholder:text-dim/40 bg-dark rounded-sm focus:outline-none resize-none"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Slot Detection + Actions ─────────── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Detected Slots */}
          <div
            className="flex flex-col gap-4 p-5 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={11} className="text-cyan/60" />
                <span className="system-label text-soft-white">DETECTED SLOTS</span>
              </div>
              <span className="font-mono text-[10px] text-dim/40">{detectedSlots.length}</span>
            </div>

            {detectedSlots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <span className="font-mono text-[10px] text-dim/40 text-center leading-relaxed">
                  No slots detected yet.<br />Add <span className="text-white/40">[Slot Name]</span> markers to your template.
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowSlotForm(true)}>
                  <Plus size={9} /> Insert First Slot
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {detectedSlots.map((slot, i) => (
                  <SlotChip
                    key={`${slot.token}-${i}`}
                    slot={slot}
                    onToggleRequired={toggleSlotRequired}
                    onRemove={removeSlot}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quick guide */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label text-soft-white">SLOT SYNTAX</span>
            <div className="flex flex-col gap-2">
              {[
                { token: "[Subject]", desc: "Required placeholder" },
                { token: "[Mood?]", desc: "Optional placeholder" },
                { token: "--ar [Aspect Ratio]", desc: "Required MJ parameter" },
                { token: "--v [Version?]", desc: "Optional MJ parameter" },
                { token: "--sref [Style Ref?]", desc: "Optional style ref" },
              ].map(({ token, desc }) => (
                <div key={token} className="flex items-start gap-2">
                  <code className="font-mono text-[9px] text-cyan/70 shrink-0">{token}</code>
                  <span className="font-mono text-[9px] text-dim/50">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving}
              className="w-full justify-center"
            >
              <Save size={11} />
              {saving ? "Saving…" : isNew ? "Create Recipe" : "Save Changes"}
            </Button>
            {!isNew && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/recipes/${id}/apply`)}
                className="w-full justify-center"
              >
                <Wand2 size={10} /> Apply this Recipe
              </Button>
            )}
            <button
              type="button"
              onClick={() => navigate("/recipes")}
              className="font-mono text-[10px] text-dim/50 hover:text-white transition-precise text-center"
            >
              ← Back to Recipes
            </button>
          </div>

          {/* Danger zone — only on edit */}
          {!isNew && (
            <div
              className="flex flex-col gap-3 p-4 rounded-card"
              style={{ border: "1px solid rgba(215,25,33,0.15)", background: "rgba(215,25,33,0.03)" }}
            >
              <span className="system-label text-[10px] text-red/60">DANGER</span>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Delete this recipe? This cannot be undone.")) return;
                  try {
                    const { remove } = await import("@/stores/usePromptStore").then(
                      (m) => ({ remove: m.usePromptStore.getState().remove })
                    );
                    await remove(id!);
                    toast.success("Recipe deleted");
                    navigate("/recipes");
                  } catch {
                    toast.error("Failed to delete recipe");
                  }
                }}
                className="flex items-center gap-2 font-mono text-[12px] text-red/60 hover:text-red transition-precise"
              >
                <Trash2 size={11} /> Delete Recipe
              </button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
