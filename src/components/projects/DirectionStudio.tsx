import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
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
  improveCreativeDirections,
} from "@/lib/creativeDirectionGeneration";
import {
  addVisualReference,
  buildVisualReferenceContext,
  getVisualReferences,
  MAX_VISUAL_REFERENCE_NOTE,
  MAX_VISUAL_REFERENCES,
  removeVisualReference,
  updateVisualReferenceNote,
  type VisualReference,
} from "@/lib/visualReferences";
import { updateProject } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { cn } from "@/lib/utils";
import type { CreativeDirection, Project } from "@/types";

interface DirectionStudioProps {
  project: Project;
  onApplied: (fields: { visual_direction?: string; creative_goals?: string; constraints?: string }) => void;
}

const MAX_DIRECTIONS = 3;

// Result fields sized slightly taller (V2 §3) while every card keeps the same
// row counts, so the three cards stay visually aligned.
const DIRECTION_FIELDS: { key: keyof CreativeDirection; label: string; rows: number }[] = [
  { key: "campaign_idea", label: "Campaign idea", rows: 4 },
  { key: "rationale", label: "Rationale", rows: 4 },
  { key: "visual_aesthetic", label: "Visual aesthetic", rows: 5 },
  { key: "brand_connection", label: "Brand connection", rows: 4 },
  { key: "product_message", label: "Product message", rows: 3 },
  { key: "tone", label: "Tone", rows: 2 },
  { key: "prompt_direction", label: "Prompt direction", rows: 5 },
];

function VisualRefThumb({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src ?? "");
  if (!image.src) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
        <span className="font-mono text-[8px] text-dim/40">REF</span>
      </div>
    );
  }
  return <img src={image.src} onError={image.onError} className="w-full h-full object-cover" />;
}

function VisualReferenceCard({
  refItem,
  onNoteSaved,
  onRemove,
}: {
  refItem: VisualReference;
  onNoteSaved: (id: string, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(refItem.note);

  return (
    <div className="flex gap-2.5 p-2 rounded-sm" style={{ border: "var(--border-dim)", background: "rgba(255,255,255,0.02)" }}>
      <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0" style={{ border: "var(--border-dim)" }}>
        <VisualRefThumb src={refItem.thumbnail_data} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-1">
          <span className="font-mono text-[10px] text-soft-white/80 truncate">{refItem.title}</span>
          <button
            type="button"
            onClick={() => onRemove(refItem.id)}
            className="text-dim/50 hover:text-red transition-precise shrink-0"
            title="Remove visual reference"
          >
            <X size={11} />
          </button>
        </div>
        <input
          value={note}
          maxLength={MAX_VISUAL_REFERENCE_NOTE}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => { if (note !== refItem.note) onNoteSaved(refItem.id, note); }}
          placeholder="What is this a reference for? (e.g. clothing reference)"
          className="w-full h-7 px-2 rounded-sm bg-black/25 font-mono text-[10px] text-soft-white placeholder:text-dim focus:outline-none"
          style={{ border: "var(--border-dim)" }}
        />
        <span className="font-mono text-[8px] text-dim/50 self-end">{note.length}/{MAX_VISUAL_REFERENCE_NOTE}</span>
      </div>
    </div>
  );
}

export function DirectionStudio({ project, onApplied }: DirectionStudioProps) {
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [modelId, setModelId] = useState(() => {
    return AI_MODELS.find((model) => Boolean(getApiKey(model.provider)))?.id ?? AI_MODELS[0].id;
  });
  const [generating, setGenerating] = useState(false);
  const [improving, setImproving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [userContext, setUserContext] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visualRefs, setVisualRefs] = useState<VisualReference[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const model = useMemo(
    () => AI_MODELS.find((candidate) => candidate.id === modelId) ?? AI_MODELS[0],
    [modelId]
  );

  const reload = useCallback(async () => {
    setDirections(await getCreativeDirections(project.id));
  }, [project.id]);

  const reloadVisualRefs = useCallback(async () => {
    try {
      setVisualRefs(await getVisualReferences(project.id));
    } catch {
      setVisualRefs([]);
    }
  }, [project.id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadVisualRefs(); }, [reloadVisualRefs]);

  const atCap = directions.length >= MAX_DIRECTIONS;
  const visualRefContext = useMemo(() => buildVisualReferenceContext(visualRefs), [visualRefs]);

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

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingRef(true);
    setError("");
    try {
      const slots = MAX_VISUAL_REFERENCES - visualRefs.length;
      for (const file of Array.from(files).slice(0, slots)) {
        await addVisualReference(project.id, file);
      }
      await reloadVisualRefs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleNoteSaved = async (id: string, note: string) => {
    try {
      await updateVisualReferenceNote(id, note);
      setVisualRefs((current) => current.map((ref) => ref.id === id ? { ...ref, note } : ref));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleRemoveRef = async (id: string) => {
    try {
      await removeVisualReference(project.id, id);
      setVisualRefs((current) => current.filter((ref) => ref.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        {/* ── Left: directions ─────────────────────────────── */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Controls row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userContext}
              onChange={(event) => setUserContext(event.target.value)}
              placeholder={directions.length ? "Add input to improve the directions…" : "Add focus or constraints before generating…"}
              className="flex-1 h-9 px-3 rounded-sm bg-black/20 font-mono text-[12px] text-soft-white placeholder:text-dim focus:outline-none"
              style={{ border: "var(--border-default)" }}
            />
            <select
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              className="h-9 px-3 rounded-sm bg-dark font-mono text-[12px] text-soft-white focus:outline-none shrink-0"
              style={{ border: "var(--border-default)" }}
              aria-label="Creative Director model"
            >
              {AI_MODELS.map((candidate) => (
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
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-5 items-start">
              {directions.slice(0, MAX_DIRECTIONS).map((direction) => (
                <article key={direction.id}
                  className={cn(
                    "flex flex-col gap-4 p-5 rounded-card min-w-0 transition-colors duration-500",
                    direction.is_selected && "ring-1 ring-cyan/50",
                    appliedId === direction.id && "bg-cyan/5"
                  )}
                  style={{ border: direction.is_selected ? "1px solid rgba(56,183,200,0.55)" : "var(--border-default)", background: appliedId === direction.id ? "rgba(56,183,200,0.06)" : "var(--surface-card)" }}>
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
                        className="w-full px-3 py-2.5 rounded-sm bg-black/20 font-mono text-[12px] leading-relaxed text-soft-white resize-y focus:outline-none"
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
                        {applyingId === direction.id ? "Applying…" : appliedId === direction.id ? "Applied ✓" : "Apply to Project"}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Visual Reference board (V2 §4) ────────── */}
        <aside className="flex flex-col gap-3 p-4 rounded-card"
          style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
          <div className="flex items-center justify-between">
            <span className="system-label text-soft-white">VISUAL REFERENCE</span>
            <span className="font-mono text-[9px] text-muted">{visualRefs.length}/{MAX_VISUAL_REFERENCES}</span>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-readable">
            Up to {MAX_VISUAL_REFERENCES} images that guide the directions — aesthetics, mood, clothing, product, lighting. The note tells the Director what each image is a reference for. Applied directions carry these to the Prompt Craft reference board without changing prompt text.
          </p>

          {visualRefs.map((refItem) => (
            <VisualReferenceCard
              key={refItem.id}
              refItem={refItem}
              onNoteSaved={handleNoteSaved}
              onRemove={handleRemoveRef}
            />
          ))}

          {visualRefs.length < MAX_VISUAL_REFERENCES && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleUploadFiles(event.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingRef}
                className="flex items-center justify-center gap-2 min-h-12 rounded-sm border border-dashed border-cyan/30 font-mono text-[10px] tracking-widest uppercase text-readable hover:text-cyan hover:bg-cyan/5 transition-precise disabled:opacity-50"
              >
                <ImagePlus size={12} />
                {uploadingRef ? "Uploading…" : "Add reference image"}
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
