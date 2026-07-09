import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckSquare, Square, Star, Upload, Bookmark, Check } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { usePromptStore } from "@/stores/usePromptStore";
import { createResult, recomputePromptResultSummary, updateTokenQualityFromResult } from "@/lib/db";
import { scoreToQualityDelta } from "@/lib/memoryEngine";
import { updateCoOccurrences } from "@/lib/tokenPatterns";
import { fileToDataUrl, fileToPreviewUrl, isVideoFile, validateMediaFile } from "@/lib/imageUtils";
import { importReferenceImage, importResultImage } from "@/lib/sharedImport";
import { addResultToProject, getProjectsForPrompt } from "@/lib/projects";
import { formatLibraryActionError } from "@/lib/librarySettings";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types";

// ─── AI Artifact Checklist ────────────────────────────────────

const ARTIFACTS = [
  "Plastic skin / waxy texture",
  "AI glow / uniform fake luminance",
  "Bad hands / fingers / joints",
  "Eye / pupil inconsistency",
  "Jewelry mismatch / floating accessories",
  "Gibberish text / fake signage",
  "Background melting / object merging",
  "Floating objects / ungrounded elements",
  "Texture blending / material merge",
  "Unreal reflections",
  "Fake depth of field",
  "Over-sharpened detail",
  "Perfect symmetry (unnatural)",
  "Generic luxury mood",
  "Fake cinematic sheen",
  "Impossible architecture",
];

// ─── Sub-components ───────────────────────────────────────────

function ScoreDots({
  label,
  hint,
  value,
  onChange,
  invert,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  invert?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5 w-28 shrink-0">
        <span className="system-label">{label}</span>
        {hint && <span className="font-mono text-[8px] text-dim/50">{hint}</span>}
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
            className={cn(
              "w-3 h-3 rounded-full border transition-precise",
              i < value
                ? invert ? "bg-red/50 border-red/40" : "bg-white/60 border-white/40"
                : "bg-transparent border-white/15 hover:border-white/30"
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-dim">{value}/5</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export function ResultReview() {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const { getById } = usePromptStore();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptNotFound, setPromptNotFound] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [scores, setScores] = useState({
    overall: 0,
    realism: 0,
    brand_fit: 0,
    composition: 0,
    lighting: 0,
    ai_risk: 0,
    reuse: 0,
  });
  const [isWinner, setIsWinner] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [checkedArtifacts, setCheckedArtifacts] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [savedAsRef, setSavedAsRef] = useState(false);
  const setScore = (k: keyof typeof scores, v: number) => setScores((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!promptId) return;
    getById(promptId).then((p) => {
      setPrompt(p);
      setPromptNotFound(!p);
    });
  }, [promptId, getById]);

  // Cleanup preview blob URLs
  useEffect(() => {
    return () => { if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFile = useCallback(async (f: File) => {
    try {
      await validateMediaFile(f);
      setUploadError("");
      setFile(f);
      setPreviewUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return fileToPreviewUrl(f);
      });
    } catch (error) {
      setUploadError(String(error));
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const toggleArtifact = (label: string) => {
    setCheckedArtifacts((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleSaveAsRef = async () => {
    if (!file || !prompt) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const refId = crypto.randomUUID().replace(/-/g, "");
      await importReferenceImage({
        referenceId: refId,
        dataUrl,
        originalName: file.name,
        reference: {
          title: `${prompt.title} — result`,
          kind: "result",
          provider: prompt.provider,
          category: prompt.category,
          tags: prompt.tags,
        },
      });
      setSavedAsRef(true);
    } catch (error) {
      setUploadError(formatLibraryActionError(error));
    }
  };

  const handleSave = async () => {
    if (!promptId) return;
    setSaving(true);
    setUploadError("");
    try {
      const resultId = crypto.randomUUID().replace(/-/g, "");
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        await importResultImage({
          resultId,
          promptId,
          dataUrl,
          originalName: file.name,
          result: {
            provider: prompt?.provider,
            score_overall: scores.overall,
            score_realism: scores.realism,
            score_brand_fit: scores.brand_fit,
            score_composition: scores.composition,
            score_lighting: scores.lighting,
            score_ai_risk: scores.ai_risk,
            reuse_potential: scores.reuse,
            is_winner: isWinner,
            is_failed: isFailed,
            artifacts: Array.from(checkedArtifacts),
            notes: notes || undefined,
          },
        });
      } else {
        await createResult({
          id: resultId,
          prompt_id: promptId,
          provider: prompt?.provider,
          score_overall: scores.overall,
          score_realism: scores.realism,
          score_brand_fit: scores.brand_fit,
          score_composition: scores.composition,
          score_lighting: scores.lighting,
          score_ai_risk: scores.ai_risk,
          reuse_potential: scores.reuse,
          is_winner: isWinner,
          is_failed: isFailed,
          artifacts: Array.from(checkedArtifacts),
          notes: notes || undefined,
        });
      }

      // Link the new result into every project that owns this prompt (audit
      // doc 05 §3/§11) — previously only the batch-import path and a manual
      // global result picker populated project_results, so a result added
      // here for a project-owned prompt never showed up in that project's
      // "Prompts & Results" panel or campaign result counts. No FK on
      // result_id in project_results, so this is safe even when queued.
      // Fire-and-forget: linking is a convenience, not a save precondition.
      getProjectsForPrompt(promptId)
        .then((owners) => Promise.all(owners.map((project) => addResultToProject(project.id, resultId))))
        .catch(() => {});

      // Update token quality scores and co-occurrence patterns (fire-and-forget — non-blocking)
      if (prompt?.prompt_text) {
        const delta = scoreToQualityDelta(scores.overall, isFailed);
        updateTokenQualityFromResult(prompt.prompt_text, delta).catch(() => {});
        updateCoOccurrences(prompt.prompt_text, scores.overall).catch(() => {});
      }

      // importResultImage applies queued (portable-library) jobs immediately on
      // a best-effort basis, so the summary may already reflect this result —
      // recomputing unconditionally is cheap and just re-reads current state.
      await recomputePromptResultSummary(promptId);

      navigate(`/library/${promptId}`, { state: { newResultId: resultId } });
    } catch (error) {
      setUploadError(formatLibraryActionError(error));
    } finally {
      setSaving(false);
    }
  };

  if (promptNotFound) {
    return (
      <PageContainer title="ADD RESULT" subtitle="PROMPT NOT FOUND">
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-readable" />
          <p className="font-mono text-[13px] text-readable">Prompt not found or has been deleted.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft size={11} /> Back to Library
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="ADD RESULT"
      subtitle={prompt ? `FOR: ${prompt.title.toUpperCase()}` : "CONNECT OUTPUT TO PROMPT"}
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate(`/library/${promptId}`)}>
          <ArrowLeft size={11} /> Back to Prompt
        </Button>
      }
    >
      <div className="flex gap-8 min-w-0">
        {/* ── Left: Image + Checklist + Notes ── */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">

          {/* Drop zone / Result preview */}
          <div className="flex flex-col gap-3">
            <span className="system-label">RESULT IMAGE OR VIDEO</span>
            {previewUrl ? (
              <div className="relative group">
                {file && isVideoFile(file) ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="w-full rounded-card max-h-[480px]"
                    style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Result preview"
                    className="w-full rounded-card object-contain max-h-[480px]"
                    style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreviewUrl(null); }}
                  className="absolute top-3 right-3 font-mono text-[9px] text-dim hover:text-white px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-precise"
                  style={{ border: "var(--border-default)", background: "rgba(0,0,0,0.7)" }}
                >
                  Replace
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 h-64 rounded-card cursor-pointer transition-precise",
                  dragging ? "border-cyan/60" : "border-white/25 hover:border-white/45"
                )}
                style={{ border: "2px dashed", background: dragging ? "rgba(56,183,200,0.06)" : "rgba(255,255,255,0.035)" }}
              >
                <Upload size={20} className="text-dim/40" />
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[12px] text-dim">Drop an image or video here, or click to browse</span>
                  <span className="font-mono text-[9px] text-dim/50">JPEG, PNG, WEBP up to 25 MiB — MP4, MOV, WEBM up to 300 MiB</span>
                </div>
                <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onInputChange} />
              </div>
            )}
            {uploadError && <p className="font-mono text-[10px] text-red/80">{uploadError}</p>}
          </div>

          {/* AI Artifact Checklist */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">AI ARTIFACT CHECKLIST</span>
              {checkedArtifacts.size > 0 && (
                <span className="font-mono text-[9px] text-red/70">{checkedArtifacts.size} artifact{checkedArtifacts.size !== 1 ? "s" : ""} found</span>
              )}
            </div>
            <div
              className="flex flex-col gap-0 rounded-card overflow-hidden"
              style={{ border: "var(--border-dim)" }}
            >
              {ARTIFACTS.map((label, i) => {
                const checked = checkedArtifacts.has(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleArtifact(label)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-left transition-precise",
                      i !== 0 && "border-t",
                      checked ? "bg-red/6" : "hover:bg-white/3"
                    )}
                    style={i !== 0 ? { borderColor: "rgba(255,255,255,0.06)" } : {}}
                  >
                    {checked
                      ? <CheckSquare size={12} className="text-red/70 shrink-0" />
                      : <Square size={12} className="text-dim/40 shrink-0" />
                    }
                    <span className={cn("font-mono text-[10px]", checked ? "text-red/80" : "text-dim/70")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <span className="system-label">NOTES</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? What failed? What to try next?"
              rows={4}
            />
          </div>
        </div>

        {/* ── Right: Scoring + Actions ── */}
        <div className="flex flex-col gap-4 w-72 shrink-0">

          {/* Quick rating */}
          <CollapsibleCard title="QUICK RATING">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore("overall", i + 1 === scores.overall ? 0 : i + 1)}
                  className="transition-precise"
                >
                  <Star
                    size={18}
                    className={cn(i < scores.overall ? "text-white fill-white/60" : "text-white/15")}
                  />
                </button>
              ))}
              <span className="font-mono text-[10px] text-dim ml-1">{scores.overall}/5</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWinner}
                  onChange={(e) => { setIsWinner(e.target.checked); if (e.target.checked) setIsFailed(false); }}
                  className="accent-white"
                />
                <span className="system-label">WINNER</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFailed}
                  onChange={(e) => { setIsFailed(e.target.checked); if (e.target.checked) setIsWinner(false); }}
                  className="accent-red"
                />
                <span className="system-label text-dim/60">FAILED</span>
              </label>
            </div>
          </CollapsibleCard>

          {/* Advanced scoring */}
          <CollapsibleCard title="ADVANCED SCORING">
            <ScoreDots label="REALISM" value={scores.realism} onChange={(v) => setScore("realism", v)} />
            <ScoreDots label="BRAND FIT" value={scores.brand_fit} onChange={(v) => setScore("brand_fit", v)} />
            <ScoreDots label="COMPOSITION" value={scores.composition} onChange={(v) => setScore("composition", v)} />
            <ScoreDots label="LIGHTING" value={scores.lighting} onChange={(v) => setScore("lighting", v)} />
            <ScoreDots
              label="AI-LOOK RISK"
              hint="lower = better"
              value={scores.ai_risk}
              onChange={(v) => setScore("ai_risk", v)}
              invert
            />
            <ScoreDots label="REUSE" value={scores.reuse} onChange={(v) => setScore("reuse", v)} />
          </CollapsibleCard>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving}
              className="w-full justify-center"
            >
              {saving ? "Saving…" : "Save Result"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/craft/${promptId}`)}
              className="w-full justify-center"
            >
              Use Prompt Again
            </Button>
            {savedAsRef ? (
              <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] text-white/40 py-1">
                <Check size={9} /> Saved as Reference
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveAsRef}
                disabled={!file}
                className="w-full justify-center text-dim"
              >
                <Bookmark size={10} /> Save as Reference
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/library/${promptId}`)}
              className="w-full justify-center text-dim"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
