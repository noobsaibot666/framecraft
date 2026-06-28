import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Braces, Copy, CopyPlus, Download, Edit2, ExternalLink, Trash2, Star, AlertTriangle, CheckCircle, Plus, ImageOff, GitBranch, BookOpen,
  Layers, ListPlus, Shuffle, X, FolderOpen,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Badge, ProviderBadge, RiskBadge } from "@/components/ui/Badge";
import { RecommendationPanel } from "@/components/ui/RecommendationPanel";
import { ExtractRecipePanel } from "@/components/recipes/ExtractRecipePanel";
import { usePromptStore } from "@/stores/usePromptStore";
import { getResultsForPrompt, deleteResult, updateResult, recomputePromptResultSummary, getChildPrompts } from "@/lib/db";
import { getProjectsForPrompt, addPromptToProject, removePromptFromProject, getProjects } from "@/lib/projects";
import { useImageDisplaySrc } from "@/lib/useImageDisplaySrc";
import { addToQueue } from "@/lib/queue";
import { getPromptVersions, type VersionNode } from "@/lib/lineage";
import { formatDate, cn } from "@/lib/utils";
import { formatPromptForProvider, getSupportedFormatterProviders } from "@/lib/promptFormatter";
import { toast } from "@/lib/toast";
import { useShortcut, registerShortcutLabel } from "@/lib/shortcuts";
import { generatePromptVariations, validatePromptForAnalysis } from "@/lib/analyzePrompt";
import type { Project } from "@/types";

registerShortcutLabel("e", "Edit prompt (Prompt Detail)");
registerShortcutLabel("q", "Add to queue (Prompt Detail)");
import type { Prompt, Result } from "@/types";

function providerUrl(provider: string): string {
  switch (provider) {
    case "midjourney": return "https://www.midjourney.com/imagine";
    case "dalle": return "https://chatgpt.com/";
    case "firefly": return "https://firefly.adobe.com/";
    case "ideogram": return "https://ideogram.ai/";
    case "flux": return "https://fal.ai/models/flux";
    case "nano_banana": return "https://chatgpt.com/";
    case "gpt_image": return "https://chatgpt.com/";
    case "seedance": return "https://www.volcengine.com/product/seedance";
    case "kling": return "https://klingai.com/";
    case "runway": return "https://runwayml.com/";
    case "higgsfield": return "https://higgsfield.ai/";
    default: return "";
  }
}

function MetaRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-baseline gap-3">
      <span className="system-label w-28 shrink-0">{label}</span>
      <span className="font-mono text-[11px] text-soft-white">{value}</span>
    </div>
  );
}


function ResultImage({ src }: { src?: string }) {
  const image = useImageDisplaySrc(src);
  if (!image.src) return <ImageOff size={16} className="text-dim/30" />;
  return <img src={image.src} alt="Result" className="w-full h-full object-cover" onError={image.onError} />;
}

export function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, remove, update, create, prompts: allPrompts } = usePromptStore();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showExtractRecipe, setShowExtractRecipe] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "versions">("results");
  const [versions, setVersions] = useState<VersionNode[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [editingFailureNotes, setEditingFailureNotes] = useState(false);
  const [failureNotesValue, setFailureNotesValue] = useState("");
  const [childPrompts, setChildPrompts] = useState<{ id: string; title: string; is_winner: boolean; rating: number }[]>([]);
  const [editingBestUse, setEditingBestUse] = useState(false);
  const [bestUseValue, setBestUseValue] = useState("");
  const [editingRiskNotes, setEditingRiskNotes] = useState(false);
  const [riskNotesValue, setRiskNotesValue] = useState("");
  const [linkedProjects, setLinkedProjects] = useState<{ id: string; title: string }[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showProjectLinker, setShowProjectLinker] = useState(false);

  useEffect(() => {
    if (!id) return;
    getById(id).then((p) => {
      setPrompt(p);
      setLoading(false);
    });
    getResultsForPrompt(id).then(setResults);
    getPromptVersions(id).then(setVersions).catch(() => {});
    getChildPrompts(id).then(setChildPrompts).catch(() => {});
    getProjectsForPrompt(id).then(setLinkedProjects).catch(() => {});
    getProjects({ excludeArchived: true }).then(setAllProjects).catch(() => {});
  }, [id, getById]);

  useShortcut("e", () => prompt && navigate(`/craft/${prompt.id}`), !!prompt);
  useShortcut("q", () => { if (prompt) handleAddToQueue(); }, !!prompt);

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyFormatted = async () => {
    if (!prompt) return;
    const { text } = formatPromptForProvider(prompt.prompt_text, prompt.provider);
    await navigator.clipboard.writeText(text);
    setCopiedFormatted(true);
    setTimeout(() => setCopiedFormatted(false), 1500);
  };

  const handleDelete = async () => {
    if (!prompt) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await remove(prompt.id);
      navigate("/library");
    } catch {
      toast.error("Failed to delete prompt");
      setConfirmDelete(false);
    }
  };

  const toggleWinner = async () => {
    if (!prompt) return;
    await update(prompt.id, { is_winner: !prompt.is_winner });
    setPrompt((p) => p ? { ...p, is_winner: !p.is_winner } : p);
  };

  const handlePromoteToRecipe = async () => {
    if (!prompt) return;
    await update(prompt.id, { is_recipe: true });
    setPrompt((p) => p ? { ...p, is_recipe: true } : p);
    toast.success("Promoted to recipe — opening editor");
    navigate(`/recipes/${prompt.id}/edit`);
  };

  const handleAddToQueue = async () => {
    if (!prompt) return;
    try {
      await addToQueue(prompt.id);
      toast.success("Added to queue");
    } catch {
      toast.error("Failed to add to queue");
    }
  };

  const handleEditFailureNotes = () => {
    setFailureNotesValue(prompt?.failure_notes ?? "");
    setEditingFailureNotes(true);
  };

  const handleSaveFailureNotes = async () => {
    if (!prompt) return;
    const trimmed = failureNotesValue.trim();
    try {
      await update(prompt.id, { failure_notes: trimmed || undefined });
      setPrompt((p) => p ? { ...p, failure_notes: trimmed || undefined } : p);
    } catch {
      toast.error("Failed to save failure notes");
    }
    setEditingFailureNotes(false);
  };

  const handleEditNotes = () => {
    setNotesValue(prompt?.notes ?? "");
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!prompt) return;
    const trimmed = notesValue.trim();
    try {
      await update(prompt.id, { notes: trimmed || undefined });
      setPrompt((p) => p ? { ...p, notes: trimmed || undefined } : p);
    } catch {
      toast.error("Failed to save notes");
    }
    setEditingNotes(false);
  };

  const handleSaveBestUse = async () => {
    if (!prompt) return;
    const trimmed = bestUseValue.trim();
    try {
      await update(prompt.id, { best_use: trimmed || undefined });
      setPrompt((p) => p ? { ...p, best_use: trimmed || undefined } : p);
    } catch {
      toast.error("Failed to save best use");
    }
    setEditingBestUse(false);
  };

  const handleSaveRiskNotes = async () => {
    if (!prompt) return;
    const trimmed = riskNotesValue.trim();
    try {
      await update(prompt.id, { risk_notes: trimmed || undefined });
      setPrompt((p) => p ? { ...p, risk_notes: trimmed || undefined } : p);
    } catch {
      toast.error("Failed to save risk notes");
    }
    setEditingRiskNotes(false);
  };

  const handleSetRating = async (newRating: number) => {
    if (!prompt) return;
    const next = newRating === prompt.rating ? 0 : newRating;
    try {
      await update(prompt.id, { rating: next });
      setPrompt((p) => p ? { ...p, rating: next } : p);
    } catch {
      toast.error("Failed to update rating");
    }
  };

  const handleLinkProject = async (projectId: string) => {
    if (!prompt || !projectId) return;
    try {
      await addPromptToProject(projectId, prompt.id);
      const refreshed = await getProjectsForPrompt(prompt.id);
      setLinkedProjects(refreshed);
      setShowProjectLinker(false);
    } catch {
      toast.error("Failed to link project");
    }
  };

  const handleUnlinkProject = async (projectId: string) => {
    if (!prompt) return;
    try {
      await removePromptFromProject(projectId, prompt.id);
      setLinkedProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      toast.error("Failed to unlink project");
    }
  };

  const handleDuplicate = async () => {
    if (!prompt) return;
    try {
      const newId = await create({
        title: `Copy of ${prompt.title}`,
        provider: prompt.provider,
        category: prompt.category,
        use_case: prompt.use_case,
        prompt_text: prompt.prompt_text,
        avoidance_text: prompt.avoidance_text,
        aspect_ratio: prompt.aspect_ratio,
        model_version: prompt.model_version,
        camera: prompt.camera,
        lens: prompt.lens,
        lighting: prompt.lighting,
        tags: prompt.tags,
        notes: prompt.notes,
        parent_id: prompt.id,
        version: prompt.version + 1,
      });
      toast.success("Prompt duplicated");
      navigate(`/library/${newId}`);
    } catch {
      toast.error("Failed to duplicate prompt");
    }
  };

  const handleExportResultsCSV = () => {
    if (!prompt || results.length === 0) return;
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["score_overall", "score_composition", "score_lighting", "score_realism", "score_brand_fit", "score_ai_risk", "is_winner", "is_failed", "notes", "created_at"];
    const rows = results.map((r) => [
      String(r.score_overall),
      String(r.score_composition),
      String(r.score_lighting),
      String(r.score_realism),
      String(r.score_brand_fit),
      String(r.score_ai_risk),
      r.is_winner ? "1" : "0",
      r.is_failed ? "1" : "0",
      esc(r.notes ?? ""),
      esc(r.created_at),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${prompt.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info(`${results.length} result${results.length !== 1 ? "s" : ""} exported`);
  };

  const handleCopyAsJson = async () => {
    if (!prompt) return;
    const data = {
      id: prompt.id,
      title: prompt.title,
      provider: prompt.provider,
      category: prompt.category,
      use_case: prompt.use_case,
      prompt_text: prompt.prompt_text,
      avoidance_text: prompt.avoidance_text,
      aspect_ratio: prompt.aspect_ratio,
      model_version: prompt.model_version,
      camera: prompt.camera,
      lens: prompt.lens,
      lighting: prompt.lighting,
      tags: prompt.tags,
      rating: prompt.rating,
      is_winner: prompt.is_winner,
      notes: prompt.notes,
      version: prompt.version,
      parent_id: prompt.parent_id,
      created_at: prompt.created_at,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.info("Copied as JSON");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleGenerateVariations = async () => {
    if (!prompt) return;
    const check = validatePromptForAnalysis(prompt.prompt_text);
    if (!check.valid) { toast.error(check.message ?? "Cannot generate variations"); return; }
    setShowVariations(true);
    setVariationsLoading(true);
    setVariations([]);
    try {
      const result = await generatePromptVariations({ promptText: prompt.prompt_text });
      setVariations(result.variations);
      if (result.variations.length === 0) toast.error("No variations returned — try a longer prompt");
    } catch {
      toast.error("Variation generation failed — check your Anthropic API key");
    } finally {
      setVariationsLoading(false);
    }
  };

  const handleSaveVariation = async (variationText: string) => {
    if (!prompt) return;
    try {
      const newId = await create({
        title: prompt.title,
        provider: prompt.provider,
        category: prompt.category,
        use_case: prompt.use_case,
        prompt_text: variationText,
        tags: prompt.tags,
        parent_id: prompt.id,
        version: prompt.version + 1,
      });
      toast.success("Variation saved as draft");
      navigate(`/library/${newId}`);
    } catch {
      toast.error("Failed to save variation");
    }
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
          <Button variant="ghost" size="sm" onClick={handleDuplicate}>
            <CopyPlus size={11} /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyAsJson}>
            <Braces size={11} /> JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={handleGenerateVariations} disabled={variationsLoading}>
            <Shuffle size={11} /> Variations
          </Button>
          {prompt.is_recipe ? (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/recipes/${prompt.id}/edit`)}>
              <Layers size={11} /> Edit Recipe
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handlePromoteToRecipe}>
              <Layers size={11} /> Save as Recipe
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/results/${prompt.id}`)}>
            <Plus size={11} /> Add Result
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAddToQueue}>
            <ListPlus size={11} /> Add to Queue
          </Button>
          {providerUrl(prompt.provider) && (
            <Button variant="ghost" size="sm" onClick={() => {
              navigator.clipboard.writeText(prompt.prompt_text);
              window.open(providerUrl(prompt.provider), "_blank");
              toast.info("Prompt copied — paste in the generator");
            }}>
              <ExternalLink size={11} /> Open in {prompt.provider.replace(/_/g, " ")}
            </Button>
          )}
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
              onSaved={(recipeId) => navigate(`/recipes/${recipeId}/edit`)}
            />
          )}

          {/* Variations Panel */}
          {showVariations && (
            <div className="flex flex-col gap-4 p-4 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shuffle size={10} className="text-dim/50" />
                  <span className="system-label">VARIATIONS</span>
                  {variationsLoading && <span className="font-ndot text-[16px] text-dim/30 leading-none">···</span>}
                </div>
                <button type="button" onClick={() => setShowVariations(false)} className="text-dim/40 hover:text-white transition-precise">
                  <X size={12} />
                </button>
              </div>
              {!variationsLoading && variations.length === 0 && (
                <span className="font-mono text-[11px] text-muted">Click "Variations" again to retry.</span>
              )}
              {variations.map((v, i) => (
                <div key={i} className="flex flex-col gap-2.5 p-3 rounded-sm" style={{ border: "var(--border-dim)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] text-dim/40 tracking-widest uppercase">Variation {i + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button"
                        onClick={() => navigator.clipboard.writeText(v)}
                        className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-dim hover:text-white px-2 py-1 rounded-sm transition-precise"
                        style={{ border: "var(--border-dim)" }}>
                        <Copy size={8} /> Copy
                      </button>
                      <button type="button"
                        onClick={() => handleSaveVariation(v)}
                        className="flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-cyan/70 hover:text-cyan px-2 py-1 rounded-sm transition-precise"
                        style={{ border: "1px solid rgba(0,229,255,0.2)" }}>
                        <Plus size={8} /> Save Draft
                      </button>
                    </div>
                  </div>
                  <pre className="font-mono text-[10px] text-soft-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">{v}</pre>
                </div>
              ))}
            </div>
          )}

          {/* Prompt Text */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="system-label">PROMPT TEXT</span>
              <div className="flex items-center gap-1.5">
                {getSupportedFormatterProviders().includes(prompt.provider) && (
                  <Button variant="ghost" size="sm" onClick={handleCopyFormatted}>
                    <Copy size={10} />
                    {copiedFormatted ? "Copied!" : `Copy for ${prompt.provider}`}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy size={10} />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <div
              className="p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-base)" }}
            >
              <pre className="prompt-text whitespace-pre-wrap wrap-break-word select-text">
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
                <pre className="font-mono text-[11px] text-muted/80 whitespace-pre-wrap wrap-break-word leading-relaxed select-text">
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="system-label">NOTES</span>
              {!editingNotes && (
                <button type="button" onClick={handleEditNotes}
                  className="font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-white px-2 py-1 rounded-sm transition-precise"
                  style={{ border: "var(--border-dim)" }}>
                  {prompt.notes ? "Edit" : "+ Add"}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveNotes(); if (e.key === "Escape") setEditingNotes(false); }}
                  rows={4}
                  className="w-full p-3 font-mono text-[11px] text-soft-white bg-transparent rounded-sm resize-none focus:outline-none leading-relaxed"
                  style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                  placeholder="Add notes about this prompt…"
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleSaveNotes}
                    className="font-mono text-[9px] tracking-widest uppercase text-white px-3 py-1.5 rounded-sm transition-precise"
                    style={{ border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingNotes(false)}
                    className="font-mono text-[9px] tracking-widest uppercase text-dim hover:text-white px-3 py-1.5 rounded-sm transition-precise"
                    style={{ border: "var(--border-dim)" }}>
                    Cancel
                  </button>
                  <span className="font-mono text-[9px] text-dim/30 ml-auto">⌘↩ to save · Esc to cancel</span>
                </div>
              </div>
            ) : prompt.notes ? (
              <p className="font-mono text-[11px] text-muted leading-relaxed cursor-pointer hover:text-readable transition-precise" onClick={handleEditNotes}>{prompt.notes}</p>
            ) : null}
          </div>

          {/* Results / Versions tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0">
                <button
                  onClick={() => setActiveTab("results")}
                  className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-precise ${activeTab === "results" ? "text-white bg-white/8" : "text-readable hover:text-white"}`}
                >
                  Results ({results.length})
                </button>
                {versions.length > 1 && (
                  <button
                    onClick={() => setActiveTab("versions")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm transition-precise ${activeTab === "versions" ? "text-white bg-white/8" : "text-readable hover:text-white"}`}
                  >
                    Versions ({versions.length})
                  </button>
                )}
              </div>
              {activeTab === "results" && (
                <div className="flex items-center gap-1.5">
                  {results.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleExportResultsCSV}>
                      <Download size={10} /> CSV
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/results/${prompt.id}`)}>
                    <Plus size={10} /> Add Result
                  </Button>
                </div>
              )}
              {activeTab === "versions" && (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/craft/${prompt.id}`)}>
                  <GitBranch size={10} /> Fork
                </Button>
              )}
            </div>

            {/* Version history panel */}
            {activeTab === "versions" && (
              <div className="flex flex-col gap-1">
                {versions.map((v) => (
                  <div key={v.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-sm cursor-pointer transition-precise ${v.id === prompt.id ? "bg-white/6" : "hover:bg-white/3"}`}
                    style={{ border: v.id === prompt.id ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent" }}
                    onClick={() => v.id !== prompt.id && navigate(`/library/${v.id}`)}>
                    <span className="font-mono text-[10px] text-readable shrink-0 w-8">v{v.version}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[11px] text-white truncate block">{v.title}</span>
                      <span className="font-mono text-[9px] text-muted">{formatDate(v.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.is_winner && <span className="font-mono text-[8px] text-white/50 uppercase tracking-wider">Winner</span>}
                      {v.result_count > 0 && <span className="font-mono text-[9px] text-readable">{v.result_count} result{v.result_count !== 1 ? "s" : ""}</span>}
                      {v.id === prompt.id && <span className="font-mono text-[8px] text-readable uppercase tracking-wider">current</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "results" && (results.length === 0 ? (
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
                      <ResultImage src={r.thumbnail_path} />
                      {/* Overlay actions */}
                      <div className="absolute inset-0 flex items-start justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-precise">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = !r.is_winner;
                            await updateResult(r.id, { is_winner: next, is_failed: next ? false : r.is_failed });
                            await recomputePromptResultSummary(prompt.id);
                            setResults((prev) => prev.map((x) => x.id === r.id ? { ...x, is_winner: next, is_failed: next ? false : x.is_failed } : x));
                          }}
                          className={cn("p-1 rounded-sm transition-precise", r.is_winner ? "text-amber" : "text-white/50 hover:text-amber")}
                          style={{ background: "rgba(0,0,0,0.6)" }}
                          title={r.is_winner ? "Remove winner" : "Mark winner"}
                        >
                          <Star size={10} className={r.is_winner ? "fill-amber/40" : ""} />
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/results/view/${r.id}`)}
                            className="p-1 rounded-sm text-white/50 hover:text-cyan transition-precise"
                            style={{ background: "rgba(0,0,0,0.6)" }}
                            title="Edit result"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteResult(r.id);
                              await recomputePromptResultSummary(prompt.id);
                              setResults((prev) => prev.filter((x) => x.id !== r.id));
                            }}
                            className="p-1 rounded-sm text-white/50 hover:text-red transition-precise"
                            style={{ background: "rgba(0,0,0,0.6)" }}
                            title="Delete result"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Meta */}
                    <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5" title="Click to score">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={async () => {
                                const next = i + 1 === r.score_overall ? 0 : i + 1;
                                await updateResult(r.id, { score_overall: next });
                                setResults((prev) => prev.map((x) => x.id === r.id ? { ...x, score_overall: next } : x));
                              }}
                              className={cn("w-1.5 h-1.5 rounded-full transition-precise hover:scale-125", i < r.score_overall ? "bg-white/60 hover:bg-amber/70" : "bg-white/10 hover:bg-white/30")}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          {r.is_winner && <Star size={9} className="text-amber fill-amber/40" />}
                          {r.is_failed && <AlertTriangle size={9} className="text-red/50" />}
                        </div>
                      </div>
                      <span className="font-mono text-[8px] text-dim/50">{formatDate(r.created_at)}</span>
                      {r.artifacts && r.artifacts.length > 0 && (
                        <span className="font-mono text-[8px] text-red/50">{r.artifacts.length} artifact{r.artifacts.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={10} className="text-red/60" />
                    <span className="font-mono text-[10px] text-red/60">FAILED</span>
                    {!editingFailureNotes && (
                      <button type="button" onClick={handleEditFailureNotes}
                        className="ml-auto font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-red/70 px-1.5 py-0.5 rounded-sm transition-precise"
                        style={{ border: "1px solid rgba(215,25,33,0.2)" }}>
                        {prompt.failure_notes ? "Edit" : "+ Why"}
                      </button>
                    )}
                  </div>
                  {editingFailureNotes ? (
                    <div className="flex flex-col gap-1.5">
                      <textarea
                        autoFocus
                        value={failureNotesValue}
                        onChange={(e) => setFailureNotesValue(e.target.value)}
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveFailureNotes(); if (e.key === "Escape") setEditingFailureNotes(false); }}
                        rows={3}
                        className="w-full p-2 font-mono text-[10px] text-soft-white bg-transparent rounded-sm resize-none focus:outline-none leading-relaxed"
                        style={{ border: "1px solid rgba(215,25,33,0.3)" }}
                        placeholder="Why did this fail?"
                      />
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={handleSaveFailureNotes}
                          className="font-mono text-[8px] tracking-widest uppercase text-red/70 hover:text-red px-2 py-1 rounded-sm transition-precise"
                          style={{ border: "1px solid rgba(215,25,33,0.3)" }}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingFailureNotes(false)}
                          className="font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white px-2 py-1 rounded-sm transition-precise"
                          style={{ border: "var(--border-dim)" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : prompt.failure_notes ? (
                    <p className="font-mono text-[10px] text-red/50 leading-relaxed cursor-pointer hover:text-red/70 transition-precise" onClick={handleEditFailureNotes}>{prompt.failure_notes}</p>
                  ) : null}
                </div>
              )}
              {prompt.is_recipe && (
                <div className="flex items-center gap-2">
                  <Layers size={10} className="text-cyan/60" />
                  <button
                    type="button"
                    onClick={() => navigate(`/recipes/${prompt.id}/edit`)}
                    className="font-mono text-[10px] text-cyan/70 hover:text-cyan transition-precise"
                  >
                    RECIPE — Edit template
                  </button>
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
            {/* Interactive rating */}
            <div className="flex items-center gap-2">
              <span className="system-label w-28">RATING</span>
              <div className="flex items-center gap-1" title="Click to rate">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSetRating(i + 1)}
                    className={cn("w-2 h-2 rounded-full transition-precise hover:scale-125", i < prompt.rating ? "bg-white/70 hover:bg-amber/70" : "bg-white/12 hover:bg-white/30")}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-dim">{prompt.rating}/5</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="system-label w-28">AI RISK</span>
              <RiskBadge score={prompt.ai_look_risk} />
            </div>
            {prompt.reuse_potential > 0 && (
              <MetaRow label="REUSE" value={`${prompt.reuse_potential}/10`} />
            )}
          </div>

          {/* Best Use + Risk Notes */}
          <div
            className="flex flex-col gap-4 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <span className="system-label">ANALYSIS</span>

            {/* Best Use */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="system-label">BEST USE</span>
                {!editingBestUse && (
                  <button type="button" onClick={() => { setBestUseValue(prompt.best_use ?? ""); setEditingBestUse(true); }}
                    className="font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-white px-2 py-1 rounded-sm transition-precise"
                    style={{ border: "var(--border-dim)" }}>
                    {prompt.best_use ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>
              {editingBestUse ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    autoFocus
                    value={bestUseValue}
                    onChange={(e) => setBestUseValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveBestUse(); if (e.key === "Escape") setEditingBestUse(false); }}
                    className="w-full h-8 px-2 font-mono text-[10px] text-soft-white bg-transparent rounded-sm focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                    placeholder="Hero banner, social ad…"
                  />
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={handleSaveBestUse}
                      className="font-mono text-[8px] tracking-widest uppercase text-white px-2 py-1 rounded-sm transition-precise"
                      style={{ border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingBestUse(false)}
                      className="font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white px-2 py-1 rounded-sm transition-precise"
                      style={{ border: "var(--border-dim)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : prompt.best_use ? (
                <p className="font-mono text-[10px] text-muted leading-relaxed cursor-pointer hover:text-readable transition-precise"
                  onClick={() => { setBestUseValue(prompt.best_use ?? ""); setEditingBestUse(true); }}>
                  {prompt.best_use}
                </p>
              ) : null}
            </div>

            {/* Risk Notes */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="system-label">RISK NOTES</span>
                {!editingRiskNotes && (
                  <button type="button" onClick={() => { setRiskNotesValue(prompt.risk_notes ?? ""); setEditingRiskNotes(true); }}
                    className="font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-white px-2 py-1 rounded-sm transition-precise"
                    style={{ border: "var(--border-dim)" }}>
                    {prompt.risk_notes ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>
              {editingRiskNotes ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    autoFocus
                    value={riskNotesValue}
                    onChange={(e) => setRiskNotesValue(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSaveRiskNotes(); if (e.key === "Escape") setEditingRiskNotes(false); }}
                    rows={3}
                    className="w-full p-2 font-mono text-[10px] text-soft-white bg-transparent rounded-sm resize-none focus:outline-none leading-relaxed"
                    style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                    placeholder="Brand, legal, or production constraints…"
                  />
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={handleSaveRiskNotes}
                      className="font-mono text-[8px] tracking-widest uppercase text-white px-2 py-1 rounded-sm transition-precise"
                      style={{ border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingRiskNotes(false)}
                      className="font-mono text-[8px] tracking-widest uppercase text-dim hover:text-white px-2 py-1 rounded-sm transition-precise"
                      style={{ border: "var(--border-dim)" }}>
                      Cancel
                    </button>
                    <span className="font-mono text-[8px] text-dim/30 ml-auto">⌘↩ save</span>
                  </div>
                </div>
              ) : prompt.risk_notes ? (
                <p className="font-mono text-[10px] text-muted leading-relaxed cursor-pointer hover:text-readable transition-precise"
                  onClick={() => { setRiskNotesValue(prompt.risk_notes ?? ""); setEditingRiskNotes(true); }}>
                  {prompt.risk_notes}
                </p>
              ) : null}
            </div>
          </div>

          {/* Linked Projects */}
          <div
            className="flex flex-col gap-3 p-4 rounded-card"
            style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <span className="system-label">PROJECTS</span>
              <button type="button" onClick={() => setShowProjectLinker((v) => !v)}
                className="font-mono text-[8px] tracking-widest uppercase text-dim/50 hover:text-white px-2 py-1 rounded-sm transition-precise"
                style={{ border: "var(--border-dim)" }}>
                + Link
              </button>
            </div>
            {showProjectLinker && (
              <div className="flex flex-col gap-1.5">
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) handleLinkProject(e.target.value); }}
                  className="w-full h-8 px-2 font-mono text-[10px] text-soft-white bg-dark rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                >
                  <option value="">Select project…</option>
                  {allProjects
                    .filter((p) => !linkedProjects.some((lp) => lp.id === p.id))
                    .map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            )}
            {linkedProjects.length > 0 ? (
              <div className="flex flex-col gap-1">
                {linkedProjects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-sm"
                    style={{ border: "var(--border-dim)" }}>
                    <FolderOpen size={9} className="text-dim/40 shrink-0" />
                    <button type="button" onClick={() => navigate(`/projects/${p.id}`)}
                      className="flex-1 font-mono text-[10px] text-soft-white/80 hover:text-white text-left truncate transition-precise">
                      {p.title}
                    </button>
                    <button type="button" onClick={() => handleUnlinkProject(p.id)}
                      className="text-dim/30 hover:text-red/70 transition-precise ml-auto">
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="font-mono text-[9px] text-dim/40">Not linked to any project</span>
            )}
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

          {/* Related by tags */}
          {(() => {
            if (!prompt.tags?.length) return null;
            const tagSet = new Set(prompt.tags);
            const related = allPrompts
              .filter((p) => p.id !== prompt.id && (p.tags ?? []).some((t) => tagSet.has(t)))
              .map((p) => ({ p, overlap: (p.tags ?? []).filter((t) => tagSet.has(t)).length }))
              .sort((a, b) => b.overlap - a.overlap)
              .slice(0, 3);
            if (!related.length) return null;
            return (
              <div className="flex flex-col gap-3 p-4 rounded-card"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <span className="system-label text-soft-white">RELATED</span>
                <div className="flex flex-col gap-1.5">
                  {related.map(({ p, overlap }) => (
                    <button key={p.id} type="button"
                      onClick={() => navigate(`/library/${p.id}`)}
                      className="flex items-start gap-2 text-left px-2 py-2 rounded-sm hover:bg-white/4 transition-precise group"
                      style={{ border: "var(--border-dim)" }}>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[10px] text-soft-white/80 truncate block">{p.title}</span>
                        <span className="font-mono text-[8px] text-dim/40">{overlap} shared tag{overlap !== 1 ? "s" : ""}</span>
                      </div>
                      {p.is_winner && <span className="font-mono text-[8px] text-amber shrink-0 mt-0.5">★</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Variations */}
          {childPrompts.length > 0 && (
            <div className="flex flex-col gap-3 p-4 rounded-card"
              style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <span className="system-label text-soft-white">VARIATIONS ({childPrompts.length})</span>
              <div className="flex flex-col gap-1.5">
                {childPrompts.map((child) => (
                  <button key={child.id} type="button"
                    onClick={() => navigate(`/library/${child.id}`)}
                    className="flex items-center gap-2 text-left px-2 py-2 rounded-sm hover:bg-white/4 transition-precise group"
                    style={{ border: "var(--border-dim)" }}>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[10px] text-soft-white/80 truncate block">{child.title}</span>
                      {child.rating > 0 && (
                        <span className="font-mono text-[8px] text-dim/40">{"★".repeat(child.rating)}</span>
                      )}
                    </div>
                    {child.is_winner && <span className="font-mono text-[8px] text-amber shrink-0">★</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

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
