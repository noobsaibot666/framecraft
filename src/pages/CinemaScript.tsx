import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, History, Sparkles, Wand2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CinemaStageTabs } from "@/components/cinema/CinemaStageTabs";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import { getCinemaProjectById, nextCinemaProjectStatus, updateCinemaProject } from "@/lib/cinemaProjects";
import { createScriptVersion, getScriptVersions } from "@/lib/cinemaScriptVersions";
import { generateScriptDraft, refineScript, SCRIPT_QUESTIONS } from "@/lib/cinemaScriptGeneration";
import { AI_MODELS, getConnectedModels, pickAvailableModel } from "@/lib/aiConfig";
import { useToastStore } from "@/stores/useToastStore";
import { formatDate, formatTime } from "@/lib/utils";
import type { CinemaProject, CinemaScriptVersion } from "@/types";

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

  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [refining, setRefining] = useState(false);

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
      if (status) setProject((prev) => (prev ? { ...prev, status } : prev));
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
      const draft = await generateScriptDraft({ idea, runtimeTarget: runtime, setting, tone, plotTwist }, model);
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
      const revised = await refineScript(content, instruction, model);
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
      await createScriptVersion(id, content, `${versions.length + 1} versions saved`);
      setVersions(await getScriptVersions(id));
      toast("Version saved", "success");
    } catch {
      toast("Failed to save version", "error");
    }
  };

  const handleRestoreVersion = (version: CinemaScriptVersion) => {
    setContent(version.content);
    toast("Version restored into the editor — Save Script to keep it", "info");
  };

  const handleApprove = async () => {
    if (!id) return;
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
    } catch {
      toast("Failed to approve script", "error");
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
      action={<CinemaStageTabs projectId={id} active="script" />}
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left column: idea + Q&A + model + pro tips */}
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
            <label className="system-label">MODEL</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="h-9 px-3 rounded-sm bg-dark font-mono text-[12px] text-soft-white focus:outline-none"
              style={{ border: "var(--border-default)" }}
            >
              {getConnectedModels().length === 0 ? (
                <option value={modelId}>No connected models — add a key in Settings</option>
              ) : (
                getConnectedModels().map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))
              )}
            </select>
          </div>

          <Button variant="primary" size="sm" onClick={handleGenerateDraft} disabled={drafting || !idea.trim()}>
            <Sparkles size={11} /> {drafting ? "Drafting…" : "Generate Draft"}
          </Button>

          <ProTipPanel stage="script" />
        </div>

        {/* Center: script editor + refine + versions */}
        <div className="flex flex-col gap-3 xl:col-span-3">
          <label className="system-label">SCRIPT</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Full script text… or generate a draft from the idea on the left."
            rows={18}
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
            <Button variant="ghost" size="sm" onClick={handleRefine} disabled={refining || !instruction.trim()}>
              <Wand2 size={11} /> {refining ? "Refining…" : "Refine"}
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Script"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSaveVersion} disabled={!content.trim()}>
              <History size={11} /> Save Version
            </Button>
            <div className="flex-1" />
            <Button
              variant={project.script_status === "approved" ? "muted" : "accent"}
              size="sm"
              onClick={handleApprove}
              disabled={!content.trim() || project.script_status === "approved"}
            >
              <CheckCircle2 size={11} />
              {project.script_status === "approved" ? "Script Approved" : "Approve Script"}
            </Button>
          </div>

          {versions.length > 0 && (
            <div className="flex flex-col gap-2 pt-4">
              <label className="system-label">VERSION HISTORY</label>
              <div className="flex flex-col gap-1.5">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleRestoreVersion(v)}
                    className="flex items-center justify-between px-3 py-2 rounded-sm border border-white/10 hover:border-cyan/40 hover:bg-cyan/5 transition-precise text-left"
                  >
                    <span className="font-mono text-[11px] text-readable">{v.label ?? "Version"}</span>
                    <span className="font-mono text-[10px] text-muted">{formatDate(v.created_at)} {formatTime(v.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
