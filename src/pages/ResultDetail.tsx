import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckSquare, Square, Star, Trash2, Check, AlertTriangle, Layers, Briefcase, Folder } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { getResultById, updateResult, deleteResult, recomputePromptResultSummary, getPromptById, setPromptThumbnail } from "@/lib/db";
import { getProjectsForPrompt } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { isVideoPath } from "@/lib/fileStore";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Prompt, Result } from "@/types";

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

function ResultImage({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src);
  if (!image.src) return (
    <div className="w-full aspect-video rounded-card bg-black/30 flex items-center justify-center"
      style={{ border: "var(--border-default)" }}>
      <span className="font-mono text-[12px] text-dim/40">No image stored</span>
    </div>
  );
  if (isVideoPath(src)) {
    return (
      <video
        src={image.src}
        controls
        playsInline
        className="w-full rounded-card max-h-[480px]"
        style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
      />
    );
  }
  return (
    <img
      src={image.src}
      alt="Result"
      onError={image.onError}
      className="w-full rounded-card object-contain max-h-[480px]"
      style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────

export function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<Result | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [owningProjects, setOwningProjects] = useState<{ id: string; title: string; campaign_id?: string; campaign_title?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingThumbnail, setSettingThumbnail] = useState(false);

  const [scores, setScores] = useState({
    overall: 0, realism: 0, brand_fit: 0,
    composition: 0, lighting: 0, ai_risk: 0, reuse: 0,
  });
  const [isWinner, setIsWinner] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [checkedArtifacts, setCheckedArtifacts] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const setScore = (k: keyof typeof scores, v: number) =>
    setScores((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!id) return;
    getResultById(id).then((r) => {
      if (!r) { navigate("/results"); return; }
      setResult(r);
      setScores({
        overall: r.score_overall,
        realism: r.score_realism,
        brand_fit: r.score_brand_fit,
        composition: r.score_composition,
        lighting: r.score_lighting,
        ai_risk: r.score_ai_risk,
        reuse: r.reuse_potential,
      });
      setIsWinner(r.is_winner);
      setIsFailed(r.is_failed);
      setCheckedArtifacts(new Set(r.artifacts ?? []));
      setNotes(r.notes ?? "");
      setLoading(false);
      getPromptById(r.prompt_id).then(setPrompt).catch(() => {});
      getProjectsForPrompt(r.prompt_id).then(setOwningProjects).catch(() => {});
    });
  }, [id, navigate]);

  const handleSetThumbnail = async () => {
    if (!id || !result?.prompt_id) return;
    setSettingThumbnail(true);
    try {
      await setPromptThumbnail(result.prompt_id, id);
      toast.success("Set as prompt thumbnail");
    } catch {
      toast.error("Failed to set thumbnail");
    } finally {
      setSettingThumbnail(false);
    }
  };

  const handleSave = async () => {
    if (!id || !result) return;
    setSaving(true);
    try {
      await updateResult(id, {
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
      await recomputePromptResultSummary(result.prompt_id);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      toast.error("Failed to save result");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !result) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteResult(id);
    await recomputePromptResultSummary(result.prompt_id);
    toast.success("Result deleted");
    navigate(`/library/${result.prompt_id}`);
  };

  const toggleArtifact = (label: string) => {
    setCheckedArtifacts((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  if (loading) {
    return (
      <PageContainer title="Result" subtitle="LOADING…">
        <div className="flex items-center justify-center h-40">
          <span className="font-ndot text-[28px] text-dim/30">···</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Result"
      subtitle={prompt ? `FROM "${prompt.title}" — V${prompt.version}` : result ? `PROMPT ${result.prompt_id.slice(0, 8).toUpperCase()}` : "RESULT DETAIL"}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-sm transition-precise",
              confirmDelete ? "text-red border-red/50" : "text-muted hover:text-red"
            )}
            style={{ border: confirmDelete ? "1px solid" : "var(--border-dim)" }}
          >
            <Trash2 size={9} className="inline mr-1" />
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
          <Button variant="ghost" size="md" onClick={() => navigate(`/library/${result?.prompt_id}`)}>
            <ArrowLeft size={11} /> Back to Prompt
          </Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? <><Check size={11} /> Saved</> : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="flex gap-8 min-w-0">
        {/* ── Left: Image + Checklist + Notes ── */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          <ResultImage src={result?.thumbnail_path ?? result?.file_path} />

          {/* AI Artifact Checklist */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">AI ARTIFACT CHECKLIST</span>
              {checkedArtifacts.size > 0 && (
                <span className="font-mono text-[9px] text-red/70">
                  {checkedArtifacts.size} artifact{checkedArtifacts.size !== 1 ? "s" : ""} found
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0 rounded-card overflow-hidden" style={{ border: "var(--border-dim)" }}>
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

        {/* ── Right: Scoring ── */}
        <div className="flex flex-col gap-4 w-72 shrink-0">

          {/* Quick rating */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">OVERALL RATING</span>
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
            {checkedArtifacts.size > 0 && (
              <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <AlertTriangle size={10} className="text-red/60 shrink-0" />
                <span className="font-mono text-[9px] text-red/70">{checkedArtifacts.size} artifact{checkedArtifacts.size !== 1 ? "s" : ""} flagged</span>
              </div>
            )}
          </div>

          {/* Advanced scoring */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">ADVANCED SCORING</span>
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
          </div>

          {/* Ownership context: prompt / version / project / campaign / provider */}
          <div
            className="flex flex-col gap-2.5 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">CONTEXT</span>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <Layers size={11} className="text-readable shrink-0" />
              <span className="text-dim/50 shrink-0">Prompt</span>
              <button
                type="button"
                onClick={() => navigate(`/library/${result?.prompt_id}`)}
                className="text-soft-white hover:text-white truncate text-left"
              >
                {prompt?.title ?? "—"}{prompt ? ` (v${prompt.version})` : ""}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="w-2.75 shrink-0" />
              <span className="text-dim/50 shrink-0">Provider</span>
              <span className="text-soft-white truncate">{result?.provider ?? prompt?.provider ?? "—"}</span>
            </div>
            {owningProjects.length > 0 ? owningProjects.map((proj) => (
              <div key={proj.id} className="flex flex-col gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <Folder size={11} className="text-readable shrink-0" />
                  <span className="text-dim/50 shrink-0">Project</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${proj.id}`)}
                    className="text-soft-white hover:text-white truncate text-left"
                  >
                    {proj.title}
                  </button>
                </div>
                {proj.campaign_id && (
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <Briefcase size={11} className="text-readable shrink-0" />
                    <span className="text-dim/50 shrink-0">Campaign</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/campaigns/${proj.campaign_id}`)}
                      className="text-soft-white hover:text-white truncate text-left"
                    >
                      {proj.campaign_title}
                    </button>
                  </div>
                )}
              </div>
            )) : (
              <div className="flex items-center gap-2 text-[11px] font-mono" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}>
                <Folder size={11} className="text-dim/30 shrink-0" />
                <span className="text-dim/40">Not attached to a project</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSetThumbnail}
              disabled={settingThumbnail || prompt?.thumbnail_result_id === id}
              className="w-full justify-center mt-1"
            >
              {prompt?.thumbnail_result_id === id ? "Current Prompt Thumbnail" : settingThumbnail ? "Setting…" : "Set as Prompt Thumbnail"}
            </Button>
          </div>

          {/* Go to prompt */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/craft/${result?.prompt_id}`)}
            className="w-full justify-center"
          >
            Use Prompt Again
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
