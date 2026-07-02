import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ExternalLink, Film, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
  SHOT_COUNT_PRESETS,
  accentColorForIndex,
  applyStoryboardShot,
  clampShotCount,
  clearStoryboard,
  generateStoryboard,
  getStoryboard,
  saveStoryboard,
  toggleShotApproval,
} from "@/lib/storytelling";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import { cn } from "@/lib/utils";
import type { CreativeDirection, DirectionStoryboard, Project } from "@/types";

interface StorytellingPanelProps {
  project: Project;
  direction: CreativeDirection;
  visualRefContext?: string;
}

export function StorytellingPanel({ project, direction, visualRefContext }: StorytellingPanelProps) {
  const navigate = useNavigate();
  const [shots, setShots] = useState<DirectionStoryboard[]>([]);
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const model = AI_MODELS.find((candidate) => Boolean(getApiKey(candidate.provider))) ?? AI_MODELS[0];

  const reload = useCallback(async () => {
    setShots(await getStoryboard(direction.id));
  }, [direction.id]);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const generated = await generateStoryboard(project, direction, model, count, visualRefContext);
      await saveStoryboard(direction.id, project.id, generated);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to develop the storyboard.");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (id: string) => {
    setShots((current) => current.map((s) => (s.id === id ? { ...s, is_approved: !s.is_approved } : s)));
    await toggleShotApproval(id);
  };

  const handleClear = async () => {
    setError("");
    await clearStoryboard(direction.id);
    await reload();
  };

  const approvedUnconverted = shots.filter((s) => s.is_approved && !s.prompt_id);

  const handleApply = async () => {
    if (!approvedUnconverted.length) return;
    setApplying(true);
    setError("");
    try {
      for (const shot of approvedUnconverted) {
        await applyStoryboardShot(shot, direction, project);
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to apply the storyboard.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-4 mt-1" style={{ borderTop: "var(--border-dim)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Film size={12} className="text-cyan" />
          <span className="system-label text-cyan">STORYTELLING</span>
        </div>
        {shots.length > 0 && (
          <button type="button" onClick={handleClear}
            className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-dim/60 hover:text-red transition-precise">
            <RotateCcw size={9} /> Clear
          </button>
        )}
      </div>

      {shots.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-sm overflow-hidden shrink-0" style={{ border: "var(--border-dim)" }}>
            {SHOT_COUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCount(preset)}
                className={cn(
                  "h-8 px-3 font-mono text-[11px] transition-precise",
                  count === preset ? "bg-cyan/12 text-cyan" : "text-dim hover:text-soft-white"
                )}
              >
                {preset}
              </button>
            ))}
            <input
              type="number"
              min={MIN_SHOT_COUNT}
              max={MAX_SHOT_COUNT}
              value={count}
              onChange={(event) => setCount(clampShotCount(Number(event.target.value)))}
              className="h-8 w-14 px-2 bg-black/20 font-mono text-[11px] text-soft-white text-center focus:outline-none"
              aria-label="Custom shot count"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating} className="shrink-0">
            <Sparkles size={11} /> {generating ? "Developing…" : "Develop storyboard"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 rounded-sm transition-precise",
                  shot.is_approved ? "opacity-100" : "opacity-45"
                )}
                style={{ background: "rgba(255,255,255,0.03)", border: "var(--border-dim)" }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                  style={{ background: accentColorForIndex(shot.accent_index) }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] text-soft-white">{shot.shot_label}</span>
                  <p className="font-mono text-[10px] leading-relaxed text-readable mt-0.5">{shot.description}</p>
                  {shot.prompt_id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/library/${shot.prompt_id}`)}
                      className="flex items-center gap-1 font-mono text-[9px] text-cyan hover:text-white transition-precise mt-1"
                    >
                      <ExternalLink size={9} /> Open prompt
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(shot.id)}
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-sm flex items-center justify-center transition-precise",
                    shot.is_approved ? "bg-cyan/20 text-cyan" : "text-dim/50 hover:text-soft-white"
                  )}
                  style={{ border: shot.is_approved ? "1px solid rgba(56,183,200,0.55)" : "var(--border-dim)" }}
                  title={shot.is_approved ? "Approved — click to reject" : "Approve this shot"}
                >
                  <Check size={11} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={applying || approvedUnconverted.length === 0}
            >
              {applying ? "Applying…" : `Apply to Project (${approvedUnconverted.length})`}
            </Button>
            <span className="font-mono text-[9px] text-muted">
              {shots.filter((s) => s.is_approved).length}/{shots.length} approved
            </span>
          </div>
        </>
      )}

      {error && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(error)}
          className="w-full px-3 py-2 text-left rounded-sm font-mono text-[11px] leading-relaxed text-red hover:bg-red/5"
          style={{ border: "1px solid rgba(215,25,33,0.30)" }}
          title="Click to copy error"
        >
          {error}
        </button>
      )}
    </div>
  );
}
