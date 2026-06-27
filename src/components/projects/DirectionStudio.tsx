import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import { getSessions } from "@/lib/comparisons";
import {
  createCreativeDirection,
  deleteCreativeDirection,
  getCreativeDirections,
  selectCreativeDirection,
  updateCreativeDirection,
} from "@/lib/creativeDirections";
import {
  buildDirectionProjectFields,
  generateCreativeDirections,
} from "@/lib/creativeDirectionGeneration";
import { updateProject } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { CreativeDirection, Project } from "@/types";

interface DirectionStudioProps {
  project: Project;
  onApplied: (fields: { visual_direction?: string; creative_goals?: string }) => void;
}

const DIRECTION_FIELDS: { key: keyof CreativeDirection; label: string; rows: number }[] = [
  { key: "campaign_idea", label: "Campaign idea", rows: 3 },
  { key: "rationale", label: "Rationale", rows: 3 },
  { key: "visual_aesthetic", label: "Visual aesthetic", rows: 4 },
  { key: "brand_connection", label: "Brand connection", rows: 3 },
  { key: "product_message", label: "Product message", rows: 2 },
  { key: "tone", label: "Tone", rows: 2 },
  { key: "prompt_direction", label: "Prompt direction", rows: 4 },
];

export function DirectionStudio({ project, onApplied }: DirectionStudioProps) {
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [modelId, setModelId] = useState(() => {
    return AI_MODELS.find((model) => Boolean(getApiKey(model.provider)))?.id ?? AI_MODELS[0].id;
  });
  const [generating, setGenerating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const model = useMemo(
    () => AI_MODELS.find((candidate) => candidate.id === modelId) ?? AI_MODELS[0],
    [modelId]
  );

  const reload = useCallback(async () => {
    setDirections(await getCreativeDirections(project.id));
  }, [project.id]);

  useEffect(() => { reload(); }, [reload]);

  const updateLocal = (id: string, field: keyof CreativeDirection, value: string) => {
    setDirections((current) => current.map((direction) => (
      direction.id === id ? { ...direction, [field]: value } : direction
    )));
  };

  const persistField = async (id: string, field: keyof CreativeDirection, value: string) => {
    await updateCreativeDirection(id, { [field]: value });
  };

  const handleNew = async () => {
    setError("");
    await createCreativeDirection({ project_id: project.id, title: "New Direction" });
    await reload();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const sessions = await getSessions(project.id);
      const outcomes = sessions
        .map((session) => session.outcome_summary?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 5);
      const generated = await generateCreativeDirections(project, model, outcomes);
      for (const direction of generated) {
        await createCreativeDirection({ project_id: project.id, ...direction });
      }
      await reload();
      setNotice("Three direction alternatives added.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate creative directions.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelect = async (id: string) => {
    setError("");
    await selectCreativeDirection(project.id, id);
    await reload();
  };

  const handleApply = async (direction: CreativeDirection) => {
    setApplyingId(direction.id);
    setError("");
    setNotice("");
    try {
      const fields = buildDirectionProjectFields(direction);
      await updateProject(project.id, fields);
      await selectCreativeDirection(project.id, direction.id);
      onApplied(fields);
      await reload();
      setNotice(`${direction.title} applied to Project Craft.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to apply creative direction.");
    } finally {
      setApplyingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    await deleteCreativeDirection(id);
    await reload();
  };

  return (
    <section className="flex flex-col gap-5 py-6 border-y border-white/10">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex flex-col gap-1 max-w-2xl">
          <span className="system-label text-cyan">DIRECTION STUDIO</span>
          <h2 className="font-sans text-[20px] font-semibold text-white">Creative direction alternatives</h2>
          <p className="font-mono text-[11px] leading-relaxed text-readable">
            Develop distinct campaign directions, select one, then apply it to the project context used by Craft.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="h-9 px-3 rounded-sm bg-dark font-mono text-[11px] text-soft-white focus:outline-none"
            style={{ border: "var(--border-default)" }}
            aria-label="Creative Director model"
          >
            {AI_MODELS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating || !project.title.trim()}>
            <Sparkles size={11} /> {generating ? "Developing..." : "Generate 3"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNew}>
            <Plus size={11} /> New Direction
          </Button>
        </div>
      </div>

      {error && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(error)}
          className="w-full px-4 py-3 text-left rounded-sm font-mono text-[11px] leading-relaxed text-red hover:bg-red/5"
          style={{ border: "1px solid rgba(215,25,33,0.30)" }}
          title="Click to copy error"
        >
          {error}
        </button>
      )}
      {notice && <span className="font-mono text-[11px] text-cyan">{notice}</span>}

      {directions.length === 0 ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex flex-col items-center justify-center gap-2 min-h-40 border border-dashed border-cyan/30 hover:bg-cyan/5 transition-precise disabled:opacity-50"
        >
          <Sparkles size={18} className="text-cyan" />
          <span className="font-sans text-[14px] font-semibold text-soft-white">Develop the first three directions</span>
          <span className="font-mono text-[10px] text-readable">Uses the current project brief, goals, constraints, and review decisions.</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-5 items-start">
          {directions.slice(0, 6).map((direction) => (
            <article key={direction.id}
              className={cn("flex flex-col gap-4 p-5 rounded-card min-w-0", direction.is_selected && "ring-1 ring-cyan/50")}
              style={{ border: direction.is_selected ? "1px solid rgba(56,183,200,0.55)" : "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex items-start gap-3">
                <input
                  value={direction.title}
                  onChange={(event) => updateLocal(direction.id, "title", event.target.value)}
                  onBlur={(event) => persistField(direction.id, "title", event.target.value)}
                  className="flex-1 min-w-0 bg-transparent font-sans text-[17px] font-semibold text-white focus:outline-none"
                  aria-label="Direction title"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(direction.id)}
                  className="p-1.5 text-muted hover:text-red transition-precise"
                  title="Delete direction"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {DIRECTION_FIELDS.map((field) => (
                <label key={field.key} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-readable">{field.label}</span>
                  <textarea
                    value={String(direction[field.key] ?? "")}
                    onChange={(event) => updateLocal(direction.id, field.key, event.target.value)}
                    onBlur={(event) => persistField(direction.id, field.key, event.target.value)}
                    rows={field.rows}
                    className="w-full px-3 py-2.5 rounded-sm bg-black/20 font-mono text-[11px] leading-relaxed text-soft-white resize-y focus:outline-none"
                    style={{ border: "var(--border-default)" }}
                  />
                </label>
              ))}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant={direction.is_selected ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => handleSelect(direction.id)}
                >
                  <Check size={10} /> {direction.is_selected ? "Selected" : "Select"}
                </Button>
                {direction.is_selected && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApply(direction)}
                    disabled={
                      applyingId === direction.id ||
                      !direction.title.trim() ||
                      DIRECTION_FIELDS.some((field) => !String(direction[field.key] ?? "").trim())
                    }
                  >
                    {applyingId === direction.id ? "Applying..." : "Apply to Project"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
