import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Copy, History, Sparkles, Wand2, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CinemaStageTabs } from "@/components/cinema/CinemaStageTabs";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { QualitySelector } from "@/components/ui/QualitySelector";
import { getCinemaProjectById, nextCinemaProjectStatus, updateCinemaProject } from "@/lib/cinemaProjects";
import { createScriptVersion, getScriptVersions } from "@/lib/cinemaScriptVersions";
import { generateScriptDraft, refineScript, SCRIPT_QUESTIONS } from "@/lib/cinemaScriptGeneration";
import { analyzeScript } from "@/lib/scriptIntelligence";
import { createCinemaFolder, getFoldersForProject, getOrCreateMasterFolder, MASTER_FOLDER_NAMES } from "@/lib/cinemaFolders";
import type { SuggestedFolder } from "@/lib/cinemaFolderSuggestions";
import { ACCENT_COLORS } from "@/lib/storytelling";
import { copyToClipboard } from "@/lib/cinemaExport";
import { AI_MODELS, pickAvailableModel, resolveModelPreference, type AIQuality } from "@/lib/aiConfig";
import { getPreferences } from "@/lib/userPreferences";
import { useToastStore } from "@/stores/useToastStore";
import { formatDate, formatTime } from "@/lib/utils";
import type { CinemaFolderKind, CinemaProject, CinemaScriptVersion } from "@/types";

/** User-facing label for what a detected asset folder becomes — surfaces the
 * "character sheet" / "environment" language from the user's request without
 * introducing new CinemaFolderKind values. */
const FOLDER_KIND_DESTINATION: Record<CinemaFolderKind, string> = {
  character: "Character Sheet",
  location: "Environment",
  product: "Product",
  prop: "Prop",
  other: "Reference",
};

export function CinemaScript() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [project, setProject] = useState<CinemaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<CinemaScriptVersion[]>([]);

  const [idea, setIdea] = useState("");
  const [runtime, setRuntime] = useState("");
  const [setting, setSetting] = useState("");
  const [tone, setTone] = useState("");
  const [plotTwist, setPlotTwist] = useState("");
  const [content, setContent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [modelId, setModelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const [quality, setQuality] = useState<AIQuality>(() => getPreferences().defaultAiQuality);
  const [folderSuggestions, setFolderSuggestions] = useState<SuggestedFolder[]>([]);
  const [scenesCreated, setScenesCreated] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [acceptingSuggestion, setAcceptingSuggestion] = useState(false);
  const [approving, setApproving] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([getCinemaProjectById(id), getScriptVersions(id)])
      .then(([p, v]) => {
        if (!p) { toast("Project not found", "error"); navigate("/cinema-studio"); return; }
        setProject(p);
        setIdea(p.script_idea ?? "");
        setRuntime(p.script_runtime_target ?? "");
        setSetting(p.script_setting ?? "");
        setTone(p.script_tone ?? "");
        setContent(p.script_content ?? "");
        setVersions(v);
      })
      .catch(() => toast("Failed to load project", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  // Apply the project's saved default AI model once, on first load — not on every
  // project state update (autosave, etc), so a manual mid-session model switch sticks.
  useEffect(() => {
    if (project) {
      const preferred = resolveModelPreference(project.script_model);
      if (preferred) setModelId(preferred.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const status = content.trim() && project ? nextCinemaProjectStatus(project.status, "scripting") : project?.status;
      await updateCinemaProject(id, {
        script_idea: idea.trim() || undefined,
        script_runtime_target: runtime.trim() || undefined,
        script_setting: setting.trim() || undefined,
        script_tone: tone.trim() || undefined,
        script_content: content.trim() || undefined,
        status,
      });
      // Update the local project snapshot too — not just `status` — so the "Saved" indicator
      // (which reads project.script_content) reflects the save immediately instead of only
      // after the next full load().
      setProject((prev) => (prev ? {
        ...prev,
        script_idea: idea.trim() || undefined,
        script_runtime_target: runtime.trim() || undefined,
        script_setting: setting.trim() || undefined,
        script_tone: tone.trim() || undefined,
        script_content: content.trim() || undefined,
        ...(status ? { status } : {}),
      } : prev));
      toast("Script saved", "success");
    } catch {
      toast("Failed to save script", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!idea.trim()) { toast("Add an idea or logline first", "error"); return; }
    setDrafting(true);
    try {
      const draft = await generateScriptDraft({ idea, runtimeTarget: runtime, setting, tone, plotTwist }, model, quality);
      setContent(draft);
      toast("Draft generated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate draft", "error");
    } finally {
      setDrafting(false);
    }
  };

  const handleRefine = async () => {
    if (!instruction.trim()) return;
    setRefining(true);
    try {
      const revised = await refineScript(content, instruction, model, quality);
      setContent(revised);
      setInstruction("");
      toast("Script refined", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to refine script", "error");
    } finally {
      setRefining(false);
    }
  };

  const handleQuestionAnswer = (key: (typeof SCRIPT_QUESTIONS)[number]["key"], value: string) => {
    if (key === "runtime") setRuntime(value);
    else if (key === "setting") setSetting(value);
    else if (key === "tone") setTone(value);
    else setPlotTwist(value);
  };

  const handleSaveVersion = async () => {
    if (!id || !content.trim()) return;
    try {
      await createScriptVersion(id, content, `Version ${versions.length + 1}`);
      setVersions(await getScriptVersions(id));
      toast("Version saved", "success");
    } catch {
      toast("Failed to save version", "error");
    }
  };

  const handleRestoreVersion = (version: CinemaScriptVersion) => {
    setContent(version.content);
    toast(`${version.label ?? "Version"} restored into the editor — Save Script to keep it`, "info");
  };

  const handleCopyScript = async () => {
    if (!content.trim()) { toast("Nothing to copy yet", "error"); return; }
    try {
      await copyToClipboard(content);
      toast("Script copied to clipboard", "success");
    } catch {
      toast("Failed to copy — your browser may block clipboard access here", "error");
    }
  };

  const handleReloadSaved = () => {
    if (!project?.script_content) return;
    if (content !== project.script_content && !window.confirm("Discard your unsaved edits and reload the saved script?")) return;
    setContent(project.script_content);
    toast("Reloaded the saved script", "info");
  };

  // Shared by the manual "Analyze Script" button and the auto-run fired right
  // after approval — one entry point so the two paths can't drift apart.
  // Guarded against re-entrancy: without this, a fast double-click on either
  // trigger (or clicking Analyze right as auto-run fires post-approval) would
  // let two calls both read the same pre-run scene/folder state and both
  // create from it, producing duplicate scenes — the dedupe in analyzeScript
  // only protects *sequential* re-runs, not concurrent ones.
  const runAnalysis = async () => {
    if (!id || !content.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const result = await analyzeScript(id, content, project?.status ?? "draft", model, quality);
      setScenesCreated((prev) => (prev ?? 0) + result.scenesCreated);
      setFolderSuggestions((prev) => {
        const seen = new Set(prev.map((f) => f.name.toLowerCase()));
        return [...prev, ...result.suggestedFolders.filter((f) => !seen.has(f.name.toLowerCase()))];
      });
      const parts = [`${result.scenesCreated} scene${result.scenesCreated === 1 ? "" : "s"} created`];
      if (result.suggestedFolders.length) parts.push(`${result.suggestedFolders.length} asset folder${result.suggestedFolders.length === 1 ? "" : "s"} suggested`);
      toast(`Script analyzed — ${parts.join(", ")}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Script analysis failed — you can retry with Analyze Script", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeScript = () => { void runAnalysis(); };

  const handleAcceptFolderSuggestion = async (suggestion: SuggestedFolder) => {
    if (!id || acceptingSuggestion) return;
    setAcceptingSuggestion(true);
    try {
      const masterId = await getOrCreateMasterFolder(id, suggestion.kind);
      const folders = await getFoldersForProject(id);
      await createCinemaFolder({
        project_id: id,
        parent_id: masterId,
        name: suggestion.name,
        kind: suggestion.kind,
        accent_color: ACCENT_COLORS[folders.length % ACCENT_COLORS.length],
      });
      setFolderSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
      toast(`"${suggestion.name}" created under ${MASTER_FOLDER_NAMES[suggestion.kind]}`, "success");
    } catch {
      toast("Failed to create folder", "error");
    } finally {
      setAcceptingSuggestion(false);
    }
  };

  const handleDismissFolderSuggestion = (suggestion: SuggestedFolder) => {
    setFolderSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
  };

  const handleApprove = async () => {
    if (!id || approving || project?.script_status === "approved") return;
    setApproving(true);
    try {
      // Approving must persist whatever is currently in the editor first — otherwise an
      // unsaved edit is silently discarded by the reload below, while the success toast
      // already told the user their script was approved.
      await updateCinemaProject(id, {
        script_idea: idea.trim() || undefined,
        script_runtime_target: runtime.trim() || undefined,
        script_setting: setting.trim() || undefined,
        script_tone: tone.trim() || undefined,
        script_content: content.trim() || undefined,
        script_status: "approved",
        status: nextCinemaProjectStatus(project?.status ?? "draft", "assets"),
      });
      toast("Script approved — Assets stage unlocked", "success");
      load();
      // Auto-run scene/asset detection right after approval. Wrapped separately so a
      // failed analysis never contradicts the approval success toast shown above —
      // the user can always retry via the manual Analyze Script button.
      void runAnalysis();
    } catch {
      toast("Failed to approve script", "error");
    } finally {
      setApproving(false);
    }
  };

  if (loading || !project || !id) {
    return (
      <PageContainer title="Cinema Studio">
        <div className="flex items-center gap-3 h-40 justify-center">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading script…</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={project.title}
      subtitle="SCRIPT STUDIO"
      action={
        <div className="flex items-center gap-3">
          <CinemaStageTabs projectId={id} active="script" nextStage={project.script_status === "approved" ? "assets" : undefined} />
          <ProTipPanel stage="script" />
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left column: idea + Q&A + model */}
        <div className="flex flex-col gap-4 xl:col-span-1">
          <div className="flex flex-col gap-1.5">
            <label className="system-label">IDEA / LOGLINE</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A one-line premise to start from…"
              rows={4}
              className="px-3 py-2 font-mono text-[13px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
              style={{ border: "1px solid rgba(255,255,255,0.16)" }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="system-label">SCRIPT QUESTIONS</label>
            {SCRIPT_QUESTIONS.map((q) => (
              <div key={q.key} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-muted tracking-widest uppercase">{q.label}</span>
                <input
                  value={q.key === "runtime" ? runtime : q.key === "setting" ? setting : q.key === "tone" ? tone : plotTwist}
                  onChange={(e) => handleQuestionAnswer(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className="h-8 px-2.5 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="system-label">MODEL & QUALITY</label>
            <div className="flex items-center gap-2">
              <ModelSelector value={modelId} onChange={setModelId} className="flex-1 min-w-0 h-9" />
              <QualitySelector value={quality} onChange={setQuality} className="h-9" />
            </div>
          </div>

          <Button variant="primary" size="xs" onClick={handleGenerateDraft} disabled={drafting || !idea.trim()}>
            <Sparkles size={11} /> {drafting ? "Drafting…" : "Generate Draft"}
          </Button>

          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "var(--border-dim)" }}>
            <label className="system-label">SCRIPT INTELLIGENCE</label>
            <p className="font-mono text-[10.5px] text-dim/60 leading-relaxed -mt-0.5">
              Detects scenes and asset needs (characters, locations, products, props) straight from
              the script. Runs automatically once you approve the script — or re-run it manually here.
            </p>
            <Button variant="ghost" size="xs" onClick={handleAnalyzeScript} disabled={analyzing || !content.trim()}>
              <Sparkles size={11} /> {analyzing ? "Analyzing…" : "Analyze Script"}
            </Button>
            {scenesCreated !== null && (
              <Link
                to={`/cinema-studio/${id}/scenes`}
                className="font-mono text-[10.5px] text-cyan hover:text-white tracking-widest uppercase transition-precise"
              >
                {scenesCreated} scene{scenesCreated === 1 ? "" : "s"} detected — View Scenes →
              </Link>
            )}
            {folderSuggestions.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="font-mono text-[10px] text-muted tracking-widest uppercase">Asset Folders Detected</span>
                {folderSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.name}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm"
                    style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[11px] text-readable truncate">{suggestion.name}</span>
                      <span className="font-mono text-[9.5px] text-muted tracking-widest uppercase">
                        → {FOLDER_KIND_DESTINATION[suggestion.kind]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAcceptFolderSuggestion(suggestion)}
                        disabled={acceptingSuggestion}
                        title="Create this asset folder"
                        className="flex items-center justify-center h-6 w-6 rounded-sm text-cyan hover:bg-cyan/12 transition-precise disabled:opacity-40"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissFolderSuggestion(suggestion)}
                        title="Dismiss"
                        className="flex items-center justify-center h-6 w-6 rounded-sm text-muted hover:text-white hover:bg-white/8 transition-precise"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: script editor + refine + versions + actions */}
        <div className="flex flex-col gap-3 xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <label className="system-label">SCRIPT</label>
            <div className="flex items-center gap-2">
              {project.script_content?.trim() && (
                <button
                  type="button"
                  onClick={handleReloadSaved}
                  title="Reload the saved script (discards unsaved edits)"
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-sm border border-cyan/35 bg-cyan/8 text-cyan font-mono text-[10px] tracking-widest uppercase hover:bg-cyan/14 transition-precise"
                >
                  <CheckCircle2 size={11} /> Saved — {project.title}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyScript}
                disabled={!content.trim()}
                title="Copy script text"
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-sm font-mono text-[10px] tracking-widest uppercase text-readable hover:text-white disabled:opacity-40 transition-precise"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              >
                <Copy size={11} /> Copy
              </button>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Full script text… or generate a draft from the idea on the left."
            rows={30}
            className="px-3 py-2 font-mono text-[13px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          />

          <div className="flex items-center gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ask the AI to refine the script — e.g. make the ending more dramatic…"
              className="flex-1 h-9 px-3 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleRefine(); }}
            />
            <Button variant="ghost" size="xs" onClick={handleRefine} disabled={refining || !instruction.trim()}>
              <Wand2 size={11} /> {refining ? "Refining…" : "Refine"}
            </Button>
          </div>

          {versions.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <label className="system-label">VERSION HISTORY</label>
              <div className="flex flex-col gap-1.5">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleRestoreVersion(v)}
                    title="Reopen this version for editing"
                    className="flex items-center justify-between px-3 py-2 rounded-sm border border-white/10 hover:border-cyan/40 hover:bg-cyan/5 transition-precise text-left"
                  >
                    <span className="font-mono text-[11px] text-readable">{v.label ?? "Version"}</span>
                    <span className="font-mono text-[10px] text-muted">{formatDate(v.created_at)} {formatTime(v.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom action bar — right-aligned, anchored at the end of the page. */}
          <div className="flex items-center justify-end gap-2 pt-4 mt-2" style={{ borderTop: "var(--border-default)" }}>
            <Button variant="ghost" size="xs" onClick={handleSaveVersion} disabled={!content.trim()}>
              <History size={11} /> Save Version
            </Button>
            <Button variant="primary" size="xs" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Script"}
            </Button>
            <Button
              variant={project.script_status === "approved" ? "muted" : "accent"}
              size="xs"
              onClick={handleApprove}
              disabled={!content.trim() || project.script_status === "approved" || approving}
            >
              <CheckCircle2 size={11} />
              {project.script_status === "approved" ? "Script Approved" : approving ? "Approving…" : "Approve Script"}
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
