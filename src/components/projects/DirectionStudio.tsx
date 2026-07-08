import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AI_MODELS, getConnectedModels, pickAvailableModel } from "@/lib/aiConfig";
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
  improveCreativeDirections,
} from "@/lib/creativeDirectionGeneration";
import { updateProject } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { CreativeDirection, Project } from "@/types";
import { StorytellingPanel } from "./StorytellingPanel";

interface DirectionStudioProps {
  project: Project;
  onApplied: (fields: { visual_direction?: string; creative_goals?: string; constraints?: string }) => void;
  /** Built from the project's Visual Reference board (rendered elsewhere on the page) — feeds generation/improve. */
  visualRefContext?: string;
}

const MAX_DIRECTIONS = 3;

// Fields grouped into a readable sequence — strategy first, then aesthetic/voice,
// then the execution brief that actually drives Prompt Craft.
const DIRECTION_SECTIONS: { label: string; fields: { key: keyof CreativeDirection; label: string; rows: number }[] }[] = [
  {
    label: "Strategy",
    fields: [
      { key: "campaign_idea", label: "Campaign idea", rows: 3 },
      { key: "rationale", label: "Rationale", rows: 3 },
    ],
  },
  {
    label: "Aesthetic & voice",
    fields: [
      { key: "visual_aesthetic", label: "Visual aesthetic", rows: 4 },
      { key: "brand_connection", label: "Brand connection", rows: 3 },
      { key: "product_message", label: "Product message", rows: 2 },
      { key: "tone", label: "Tone", rows: 1 },
    ],
  },
  {
    label: "Execution",
    fields: [
      { key: "prompt_direction", label: "Prompt direction", rows: 4 },
    ],
  },
];

const ALL_DIRECTION_FIELDS = DIRECTION_SECTIONS.flatMap((section) => section.fields);

export function DirectionStudio({ project, onApplied, visualRefContext = "" }: DirectionStudioProps) {
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [modelId, setModelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const [generating, setGenerating] = useState(false);
  const [improving, setImproving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState("");
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

  const atCap = directions.length >= MAX_DIRECTIONS;

  const updateLocal = (id: string, field: keyof CreativeDirection, value: string) => {
    setDirections((current) => current.map((direction) => (
      direction.id === id ? { ...direction, [field]: value } : direction
    )));
  };

  const persistField = async (id: string, field: keyof CreativeDirection, value: string) => {
    await updateCreativeDirection(id, { [field]: value });
  };

  const handleNew = async () => {
    if (atCap) return;
    setError("");
    await createCreativeDirection({ project_id: project.id, title: "New Direction" });
    await reload();
  };

  const handleGenerate = async () => {
    if (atCap) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const sessions = await getSessions(project.id);
      const outcomes = sessions
        .map((session) => session.outcome_summary?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 5);
      const generated = await generateCreativeDirections(
        project, model, outcomes, userContext || undefined, visualRefContext || undefined
      );
      // Never exceed the 3-direction cap — fill remaining slots only.
      const slots = MAX_DIRECTIONS - directions.length;
      for (const direction of generated.slice(0, slots)) {
        await createCreativeDirection({ project_id: project.id, ...direction });
      }
      await reload();
      setNotice(slots >= 3 ? "Three direction alternatives added." : `${Math.min(slots, generated.length)} direction alternative${slots === 1 ? "" : "s"} added.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate creative directions.");
    } finally {
      setGenerating(false);
    }
  };

  const handleImprove = async () => {
    if (!directions.length) return;
    setImproving(true);
    setError("");
    setNotice("");
    try {
      const improved = await improveCreativeDirections(
        project,
        model,
        directions.map((d) => ({
          title: d.title,
          campaign_idea: d.campaign_idea,
          rationale: d.rationale,
          visual_aesthetic: d.visual_aesthetic,
          brand_connection: d.brand_connection,
          product_message: d.product_message,
          tone: d.tone,
          prompt_direction: d.prompt_direction,
        })),
        userContext || undefined,
        visualRefContext || undefined
      );
      for (let index = 0; index < directions.length; index += 1) {
        await updateCreativeDirection(directions[index].id, improved[index]);
      }
      await reload();
      setNotice("Directions improved with your input.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to improve directions.");
    } finally {
      setImproving(false);
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
      setNotice(`${direction.title} applied to Pre-Craft.`);
      setAppliedId(direction.id);
      setTimeout(() => setAppliedId(null), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
    <section className="flex flex-col gap-4 py-6 border-y border-white/10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="system-label text-cyan">DIRECTION STUDIO</span>
        <h2 className="font-sans text-[20px] font-semibold text-white">Creative direction alternatives</h2>
        <p className="font-mono text-[12px] leading-relaxed text-readable">
          Develop distinct campaign directions, select one, then apply it to the Pre-Craft context.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={userContext}
          onChange={(event) => setUserContext(event.target.value)}
          placeholder={directions.length ? "Add input to improve the directions…" : "Add focus or constraints before generating…"}
          className="flex-1 min-w-40 h-9 px-3 rounded-sm bg-black/20 font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none"
          style={{ border: "var(--border-default)" }}
        />
        <select
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          className="h-9 px-3 rounded-sm bg-dark font-mono text-[12px] text-soft-white focus:outline-none shrink-0"
          style={{ border: "var(--border-default)" }}
          aria-label="Creative Director model"
        >
          {getConnectedModels().map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
          ))}
        </select>
        {directions.length === 0 ? (
          <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating || !project.title.trim()} className="shrink-0">
            <Sparkles size={11} /> {generating ? "Developing…" : "Generate 3"}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleImprove} disabled={improving || generating} className="shrink-0"
            title="Rework the existing directions using your input">
            <Wand2 size={11} /> {improving ? "Improving…" : "Improve"}
          </Button>
        )}
        {directions.length > 0 && !atCap && (
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating || improving} className="shrink-0"
            title={`Fill the remaining ${MAX_DIRECTIONS - directions.length} slot${MAX_DIRECTIONS - directions.length === 1 ? "" : "s"}`}>
            <Sparkles size={11} /> {generating ? "Developing…" : "Fill"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNew}
          disabled={atCap}
          className="shrink-0"
          title={atCap ? "Maximum 3 directions — delete one to add a new direction" : "Add an empty direction"}
        >
          <Plus size={11} /> New Direction
        </Button>
      </div>

      {error && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(error)}
          className="w-full px-4 py-3 text-left rounded-sm font-mono text-[12px] leading-relaxed text-red hover:bg-red/5"
          style={{ border: "1px solid rgba(215,25,33,0.30)" }}
          title="Click to copy error"
        >
          {error}
        </button>
      )}
      {notice && <span className="font-mono text-[12px] text-cyan">{notice}</span>}

      {directions.length === 0 ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex flex-col items-center justify-center gap-2 min-h-40 border border-dashed border-cyan/30 hover:bg-cyan/5 transition-precise disabled:opacity-50"
        >
          <Sparkles size={18} className="text-cyan" />
          <span className="font-sans text-[15px] font-semibold text-soft-white">Develop the first three directions</span>
          <span className="font-mono text-[10px] text-readable">Uses the current project brief, goals, constraints, visual references, and review decisions.</span>
        </button>
      ) : (
        <div className="flex flex-wrap gap-5 items-start">
          {directions.slice(0, MAX_DIRECTIONS).map((direction, index) => (
            <article key={direction.id}
              className={cn(
                "flex flex-col gap-5 p-6 rounded-card min-w-0 flex-1 basis-85 transition-colors duration-500",
                direction.is_selected && "ring-1 ring-cyan/50",
                appliedId === direction.id && "bg-cyan/5"
              )}
              style={{ border: direction.is_selected ? "1px solid rgba(56,183,200,0.55)" : "var(--border-default)", background: appliedId === direction.id ? "rgba(56,183,200,0.06)" : "var(--surface-card)" }}>

              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="font-mono text-[10px] text-dim/50 shrink-0 pt-1.5">{String(index + 1).padStart(2, "0")}</span>
                <input
                  value={direction.title}
                  onChange={(event) => updateLocal(direction.id, "title", event.target.value)}
                  onBlur={(event) => persistField(direction.id, "title", event.target.value)}
                  className="flex-1 min-w-0 bg-transparent font-sans text-[18px] font-semibold text-white focus:outline-none"
                  aria-label="Direction title"
                />
                {direction.is_selected && (
                  <span className="font-mono text-[8px] tracking-widest uppercase text-cyan px-2 py-1 rounded-sm border border-cyan/30 bg-cyan/8 shrink-0">
                    Selected
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(direction.id)}
                  className="p-1.5 text-muted hover:text-red transition-precise shrink-0"
                  title="Delete direction"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Field sections — strategy → aesthetic/voice → execution */}
              {DIRECTION_SECTIONS.map((section, sectionIndex) => (
                <div key={section.label} className={cn("flex flex-col gap-3", sectionIndex > 0 && "pt-5 border-t border-white/8")}>
                  <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-cyan/60">{section.label}</span>
                  {section.fields.map((field) => (
                    <label key={field.key} className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-readable">{field.label}</span>
                      <textarea
                        value={String(direction[field.key] ?? "")}
                        onChange={(event) => updateLocal(direction.id, field.key, event.target.value)}
                        onBlur={(event) => persistField(direction.id, field.key, event.target.value)}
                        rows={field.rows}
                        className="w-full px-3 py-2.5 rounded-sm bg-black/20 font-mono text-[12px] leading-relaxed text-soft-white resize-y focus:outline-none focus:border-cyan/45 transition-precise"
                        style={{ border: "var(--border-default)" }}
                      />
                    </label>
                  ))}
                </div>
              ))}

              {/* Actionable sequence — select, then apply */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/8">
                <Button
                  variant={direction.is_selected ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => handleSelect(direction.id)}
                >
                  <Check size={10} /> {direction.is_selected ? "Selected" : "1 · Select"}
                </Button>
                {direction.is_selected && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApply(direction)}
                    disabled={
                      applyingId === direction.id ||
                      !direction.title.trim() ||
                      ALL_DIRECTION_FIELDS.some((field) => !String(direction[field.key] ?? "").trim())
                    }
                  >
                    {applyingId === direction.id ? "Applying…" : appliedId === direction.id ? "Applied ✓" : "2 · Apply to Project"}
                  </Button>
                )}
              </div>

              {direction.is_selected && (
                <StorytellingPanel project={project} direction={direction} visualRefContext={visualRefContext || undefined} />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
