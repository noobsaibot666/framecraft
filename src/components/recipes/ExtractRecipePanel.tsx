import { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createRecipe } from "@/lib/db";
import { extractSlots, reconstructPrompt, slotKey, type ExtractedRecipeSlot } from "@/lib/recipeExtract";
import type { Prompt } from "@/types";

interface ExtractRecipePanelProps {
  prompt: Prompt;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

function templateValue(slot: ExtractedRecipeSlot): string {
  const key = slotKey(slot);
  return `[${slot.required ? key : `${key}?`}]`;
}

export function ExtractRecipePanel({ prompt, onSaved, onCancel }: ExtractRecipePanelProps) {
  const initialSlots = useMemo(() => extractSlots(prompt.prompt_text), [prompt.prompt_text]);
  const [title, setTitle] = useState(`${prompt.title} Recipe`);
  const [slots, setSlots] = useState<ExtractedRecipeSlot[]>(initialSlots);
  const [saving, setSaving] = useState(false);

  const previewValues = Object.fromEntries(slots.map((slot) => [slotKey(slot), templateValue(slot)]));
  const preview = reconstructPrompt(slots, previewValues);
  const canSave = title.trim().length > 0 && slots.length > 0 && preview.trim().length > 0;

  const updateSlot = (index: number, patch: Partial<ExtractedRecipeSlot>) => {
    setSlots((current) => current.map((slot, i) => i === index ? { ...slot, ...patch } : slot));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = await createRecipe({
        title: title.trim(),
        description: `Extracted from winner: ${prompt.title}`,
        provider: prompt.provider,
        category: prompt.category,
        use_case: prompt.use_case,
        prompt_text: preview,
        avoidance_text: prompt.avoidance_text,
        aspect_ratio: prompt.aspect_ratio,
        model_version: prompt.model_version,
        style_ref: prompt.style_ref,
        tags: [...new Set([...(prompt.tags ?? []), "recipe"])],
        rating: prompt.rating,
        ai_look_risk: prompt.ai_look_risk,
        parent_id: prompt.id,
        notes: prompt.notes,
      });
      onSaved(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="system-label">EXTRACT RECIPE</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 px-3 font-sans text-[14px] text-white bg-dark rounded-sm focus:outline-none focus:border-red/50"
            style={{ border: "1px solid rgba(255,255,255,0.10)" }}
          />
        </div>
        <Button variant="muted" size="sm" onClick={onCancel} aria-label="Close recipe extraction">
          <X size={11} />
        </Button>
      </div>

      {slots.length === 0 ? (
        <span className="font-mono text-[10px] text-dim">
          No bracketed placeholders or supported Midjourney flags found.
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          {slots.map((slot, index) => (
            <div key={`${slot.start}-${slot.token}`} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <input
                value={slot.label}
                onChange={(e) => updateSlot(index, { label: e.target.value })}
                className="h-8 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none focus:border-red/50"
                style={{ border: "1px solid rgba(255,255,255,0.10)" }}
              />
              <label className="flex items-center gap-2 h-8 px-2 rounded-sm cursor-pointer" style={{ border: "var(--border-dim)" }}>
                <input
                  type="checkbox"
                  checked={slot.required}
                  onChange={(e) => updateSlot(index, { required: e.target.checked })}
                  className="accent-white/70"
                />
                <span className="font-mono text-[8px] tracking-widest uppercase text-dim">Required</span>
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="system-label">TEMPLATE PREVIEW</span>
        <pre className="font-mono text-[10px] text-muted leading-relaxed whitespace-pre-wrap break-words p-3 rounded-sm bg-black/20">
          {preview || prompt.prompt_text}
        </pre>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave || saving}>
          <Save size={11} />
          {saving ? "Saving" : "Save Recipe"}
        </Button>
      </div>
    </div>
  );
}
