import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wand2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { usePromptStore } from "@/stores/usePromptStore";
import { extractSlots, reconstructPrompt, slotKey, type ExtractedRecipeSlot } from "@/lib/recipeExtract";
import { incrementRecipeUseCount } from "@/lib/db";
import type { Prompt } from "@/types";

export function RecipeApply() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById } = usePromptStore();
  const [recipe, setRecipe] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    getById(id).then((prompt) => {
      setRecipe(prompt);
      setLoading(false);
    });
  }, [id, getById]);

  const slots = useMemo<ExtractedRecipeSlot[]>(
    () => recipe ? extractSlots(recipe.prompt_text) : [],
    [recipe]
  );
  const preview = recipe ? reconstructPrompt(slots, values) : "";

  const setSlotValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleApply = () => {
    const nextErrors: Record<string, string> = {};
    for (const slot of slots) {
      const key = slotKey(slot);
      if (slot.required && !values[key]?.trim()) nextErrors[key] = "Required";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !recipe) return;

    incrementRecipeUseCount(recipe.id).catch(() => {});
    navigate("/craft", {
      state: {
        prefillPromptText: preview,
        prefillTitle: `${recipe.title} Draft`,
        prefillRecipeId: recipe.id,
      },
    });
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <span className="font-ndot text-[32px] text-dim/30">···</span>
        </div>
      </PageContainer>
    );
  }

  if (!recipe || !recipe.is_recipe) {
    return (
      <PageContainer title="Recipe Not Found">
        <Button variant="ghost" size="sm" onClick={() => navigate("/recipes")}>
          <ArrowLeft size={11} /> Recipes
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={recipe.title}
      subtitle="APPLY RECIPE"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/recipes")}>
          <ArrowLeft size={11} /> Recipes
        </Button>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-6">
        <div className="flex flex-col gap-3">
          <span className="system-label">SLOTS</span>
          {slots.length === 0 ? (
            <div className="p-4 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <span className="font-mono text-[10px] text-dim">This recipe has no editable slots.</span>
            </div>
          ) : (
            slots.map((slot) => {
              const key = slotKey(slot);
              return (
                <label key={`${slot.start}-${slot.token}`} className="flex flex-col gap-1.5">
                  <span className="system-label">
                    {slot.label}{slot.required ? "" : " / OPTIONAL"}
                  </span>
                  <input
                    value={values[key] ?? ""}
                    onChange={(e) => setSlotValue(key, e.target.value)}
                    placeholder={slot.placeholder}
                    className="h-9 px-3 font-mono text-[12px] text-soft-white bg-dark rounded-sm focus:outline-none focus:border-red/50"
                    style={{ border: errors[key] ? "1px solid rgba(215,25,33,0.8)" : "1px solid rgba(255,255,255,0.10)" }}
                  />
                  {errors[key] && <span className="font-mono text-[9px] text-red/80">{errors[key]}</span>}
                </label>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="system-label">PREVIEW</span>
          <pre
            className="min-h-40 p-4 rounded-card font-mono text-[11px] text-muted leading-relaxed whitespace-pre-wrap break-words"
            style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
          >
            {preview || recipe.prompt_text}
          </pre>
          <Button variant="primary" size="md" onClick={handleApply} disabled={!preview.trim()}>
            <Wand2 size={12} /> Apply
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
