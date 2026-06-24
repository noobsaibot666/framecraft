import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Copy, Edit2, Trash2, Star, AlertTriangle, CheckCircle, Plus, ImageOff, GitBranch, BookOpen,
  ListPlus,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Badge, ProviderBadge, RiskBadge } from "@/components/ui/Badge";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { ExtractRecipePanel } from "@/components/recipes/ExtractRecipePanel";
import { usePromptStore } from "@/stores/usePromptStore";
import { getResultsForPrompt, deleteResult, recomputePromptResultSummary } from "@/lib/db";
import { addToQueue } from "@/lib/queue";
import { formatDate, cn } from "@/lib/utils";
import type { Prompt, Result } from "@/types";

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-baseline gap-3">
      <span className="system-label w-28 shrink-0">{label}</span>
      <span className="font-mono text-[11px] text-soft-white">{value}</span>
    </div>
  );
}

function RatingDots({ rating, label }: { rating: number; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="system-label">{label}</span>}
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-precise ${i < rating ? "bg-white/70" : "bg-white/12"}`}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-dim">{rating}/5</span>
    </div>
  );
}

export function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, remove, update } = usePromptStore();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showExtractRecipe, setShowExtractRecipe] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (!id) return;
    getById(id).then((p) => {
      setPrompt(p);
      setLoading(false);
    });
    getResultsForPrompt(id).then(setResults);
  }, [id, getById]);

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async () => {
    if (!prompt) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await remove(prompt.id);
    navigate("/library");
  };

  const toggleWinner = async () => {
    if (!prompt) return;
    await update(prompt.id, { is_winner: !prompt.is_winner });
    setPrompt((p) => p ? { ...p, is_winner: !p.is_winner } : p);
  };

  const handleAddToQueue = async () => {
    if (!prompt) return;
    await addToQueue(prompt.id);
    setQueued(true);
    setTimeout(() => setQueued(false), 1500);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <span className="font-ndot text-[32px] text-dim/30 dot-blink">···</span>
        </div>
      </PageContainer>
    );
  }

  if (!prompt) {
    return (
      <PageContainer title="Not Found">
        <div className="flex flex-col items-center gap-4 py-20">
          <span className="font-mono text-[12px] text-dim">Prompt not found.</span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft size={11} /> Back to Library
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={prompt.title}
      subtitle={`VERSION ${prompt.version} · ${formatDate(prompt.created_at)}`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft size={11} /> Library
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleWinner}
            className={prompt.is_winner ? "text-white" : "text-dim"}
          >
            <Star size={11} />
            {prompt.is_winner ? "Winner" : "Mark Winner"}
          </Button>
          {prompt.is_winner && (
            <Button variant="ghost" size="sm" onClick={() => setShowExtractRecipe((v) => !v)}>
              <BookOpen size={11} /> Extract Recipe
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/craft/${prompt.id}`)}>
            <Edit2 size={11} /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/results/${prompt.id}`)}>
            <Plus size={11} /> Add Result
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAddToQueue}>
            <ListPlus size={11} /> {queued ? "Queued" : "Add to Queue"}
          </Button>
          <Button
            variant={confirmDelete ? "primary" : "ghost"}
            size="sm"
            onClick={handleDelete}
            className={confirmDelete ? "bg-red/20 border-red/60 text-red" : "text-dim"}
          >
            <Trash2 size={11} />
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </Button>
        </div>
      }
    >
      <div className="flex gap-8 min-w-0">
        {/* Main column */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          {showExtractRecipe && (
            <ExtractRecipePanel
              prompt={prompt}
              onCancel={() => setShowExtractRecipe(false)}
              onSaved={(recipeId) => navigate(`/library/${recipeId}`)}
            />
          )}

          {/* Prompt Text */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">PROMPT TEXT</span>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Copy size={10} />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div
              className="p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
            >
              <pre className="prompt-text whitespace-pre-wrap break-words select-text">
                {prompt.prompt_text}
              </pre>
            </div>
          </div>

          {/* Avoidance Notes */}
          {prompt.avoidance_text && (
            <div className="flex flex-col gap-3">
              <span className="system-label">AI-LOOK AVOIDANCE</span>
              <div
                className="p-4 rounded-card"
                style={{ border: "var(--border-dim)", background: "rgba(215,25,33,0.04)" }}
              >
                <pre className="font-mono text-[11px] text-muted/80 whitespace-pre-wrap break-words leading-relaxed select-text">
                  {prompt.avoidance_text}
                </pre>
              </div>
            </div>
          )}

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="system-label">TAGS</span>
              <div className="flex flex-wrap gap-1.5">
                {prompt.tags.map((tag) => (
                  <Badge key={tag} variant="tag">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reference Image */}
          {prompt.image_ref && (
            <div className="flex flex-col gap-3">
              <span className="system-label">REFERENCE FRAME</span>
              <div
                className="rounded-card overflow-hidden"
                style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
              >
                <img src={prompt.image_ref} alt="Reference frame" className="w-full max-h-80 object-contain bg-black/30" />
              </div>
            </div>
          )}

          {/* Notes */}
          {prompt.notes && (
            <div className="flex flex-col gap-2">
              <span className="system-label">NOTES</span>
              <p className="font-mono text-[11px] text-muted leading-relaxed">{prompt.notes}</p>
            </div>
          )}

          {/* Results Gallery */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">RESULTS ({results.length})</span>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/results/${prompt.id}`)}>
                <Plus size={10} /> Add Result
              </Button>
            </div>
            {results.length === 0 ? (
              <div
                className="flex items-center justify-center py-8 rounded-card cursor-pointer hover:bg-white/3 transition-precise"
                style={{ border: "2px dashed rgba(255,255,255,0.08)" }}
                onClick={() => navigate(`/results/${prompt.id}`)}
              >
                <span className="font-mono text-[10px] text-dim/50">No results yet — add your first output</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {results.map((r) => (
                  <div
                    key={r.id}
                    className="group flex flex-col gap-2 rounded-card overflow-hidden"
                    style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full aspect-video bg-black/30 flex items-center justify-center overflow-hidden relative">
                      {r.thumbnail_path ? (
                        <img src={r.thumbnail_path} alt="Result" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff size={16} className="text-dim/30" />
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteResult(r.id);
                          await recomputePromptResultSummary(prompt.id);
                          setResults((prev) => prev.filter((x) => x.id !== r.id));
                        }}
                        className="absolute top-1.5 right-1.5 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-precise text-dim/60 hover:text-red"
                        style={{ background: "rgba(0,0,0,0.6)" }}
                        title="Delete result"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                    {/* Meta */}
                    <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < r.score_overall ? "bg-white/60" : "bg-white/10")} />
                          ))}
                        </div>
                        {r.is_winner && <Star size={9} className="text-white/50" />}
                        {r.is_failed && <AlertTriangle size={9} className="text-red/50" />}
                      </div>
                      <span className="font-mono text-[8px] text-dim/50">{formatDate(r.created_at)}</span>
                      {r.artifacts && r.artifacts.length > 0 && (
                        <span className="font-mono text-[8px] text-red/50">{r.artifacts.length} artifact{r.artifacts.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5 w-64 shrink-0">

          {/* Status flags */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">STATUS</span>
            <div className="flex flex-col gap-2">
              {prompt.is_winner && (
                <div className="flex items-center gap-2">
                  <CheckCircle size={10} className="text-white/50" />
                  <span className="font-mono text-[10px] text-white/60">WINNER</span>
                </div>
              )}
              {prompt.is_failed && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={10} className="text-red/60" />
                  <span className="font-mono text-[10px] text-red/60">FAILED</span>
                </div>
              )}
              {prompt.is_recipe && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted">RECIPE</span>
                </div>
              )}
              {!prompt.is_winner && !prompt.is_failed && !prompt.is_recipe && (
                <span className="font-mono text-[10px] text-dim">No flags set</span>
              )}
            </div>
          </div>

          {/* Scores */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">SCORES</span>
            <RatingDots rating={prompt.rating} label="RATING" />
            <div className="flex items-center gap-2">
              <span className="system-label w-28">AI RISK</span>
              <RiskBadge score={prompt.ai_look_risk} />
            </div>
            <MetaRow label="REUSE" value={`${prompt.reuse_potential}/10`} />
          </div>

          {/* Parameters */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">PARAMETERS</span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <ProviderBadge provider={prompt.provider} />
              </div>
              <MetaRow label="CATEGORY" value={prompt.category} />
              <MetaRow label="USE CASE" value={prompt.use_case} />
              <MetaRow label="ASPECT" value={prompt.aspect_ratio} />
              <MetaRow label="MODEL" value={prompt.model_version} />
              <MetaRow label="CAMERA" value={prompt.camera} />
              <MetaRow label="LENS" value={prompt.lens} />
              <MetaRow label="LIGHTING" value={prompt.lighting} />
            </div>
          </div>

          {/* Version info */}
          <div
            className="flex flex-col gap-2 p-3 rounded-card"
            style={{ border: "var(--border-dim)", background: "var(--surface-base)" }}
          >
            <MetaRow label="VERSION" value={prompt.version} />
            <MetaRow label="CREATED" value={formatDate(prompt.created_at)} />
            <MetaRow label="UPDATED" value={formatDate(prompt.updated_at)} />
            {prompt.parent_id && (
              <button
                className="text-left font-mono text-[9px] text-dim hover:text-white transition-precise mt-1"
                onClick={() => navigate(`/library/${prompt.parent_id}`)}
              >
                ↑ View parent version
              </button>
            )}
            <button
              className="flex items-center gap-1.5 font-mono text-[9px] text-dim hover:text-white transition-precise mt-1"
              onClick={() => navigate(`/lineage/${prompt.id}`)}
            >
              <GitBranch size={9} /> Version history
            </button>
          </div>

          {/* Recommendations */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <RecommendationPanel
              context={{
                provider: prompt.provider,
                category: prompt.category ?? undefined,
                excludePromptId: prompt.id,
              }}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
