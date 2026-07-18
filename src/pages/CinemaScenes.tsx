import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CinemaStageTabs } from "@/components/cinema/CinemaStageTabs";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import { SceneTimeline } from "@/components/cinema/SceneTimeline";
import { getCinemaProjectById, nextCinemaProjectStatus, updateCinemaProject } from "@/lib/cinemaProjects";
import {
  createCinemaScene,
  deleteCinemaScene,
  getScenesForProject,
  reorderScenes,
  updateCinemaScene,
} from "@/lib/cinemaScenes";
import { splitScriptIntoScenes } from "@/lib/cinemaSceneSplit";
import { accentIndexForSortOrder } from "@/lib/storytelling";
import { AI_MODELS, pickAvailableModel, resolveModelPreference } from "@/lib/aiConfig";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { useToastStore } from "@/stores/useToastStore";
import type { CinemaProject, CinemaScene } from "@/types";

export function CinemaScenes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [project, setProject] = useState<CinemaProject | null>(null);
  const [scenes, setScenes] = useState<CinemaScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [splitting, setSplitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [modelId, setModelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([getCinemaProjectById(id), getScenesForProject(id)])
      .then(([p, s]) => {
        if (!p) { toast("Project not found", "error"); navigate("/cinema-studio"); return; }
        setProject(p);
        setScenes(s);
      })
      .catch(() => toast("Failed to load project", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  // Apply the project's saved default AI model once, on first load.
  useEffect(() => {
    if (project) {
      const preferred = resolveModelPreference(project.script_model);
      if (preferred) setModelId(preferred.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const reload = () => {
    if (!id) return;
    getScenesForProject(id).then(setScenes).catch(() => {});
  };

  // First scene created for a project means it's genuinely into the Scene Generation stage —
  // bump status forward (never backward: nextCinemaProjectStatus is a no-op if already further
  // along, e.g. re-splitting a script into more scenes on an already-"scenes" project).
  const bumpToScenesStatus = async () => {
    if (!id || !project) return;
    const status = nextCinemaProjectStatus(project.status, "scenes");
    if (status === project.status) return;
    await updateCinemaProject(id, { status });
    setProject((prev) => (prev ? { ...prev, status } : prev));
  };

  const handleToggleComplete = async () => {
    if (!id || !project) return;
    const status = project.status === "complete" ? "scenes" : "complete";
    try {
      await updateCinemaProject(id, { status });
      setProject((prev) => (prev ? { ...prev, status } : prev));
      toast(status === "complete" ? "Project marked complete" : "Project reopened", "success");
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const handleSplit = async () => {
    if (!id || !project?.script_content?.trim()) { toast("Approve a script first", "error"); return; }
    setSplitting(true);
    try {
      const found = await splitScriptIntoScenes(project.script_content, model);
      // Each scene insert is independent (distinct sort_order/accent_index computed up front),
      // so create them concurrently instead of one round trip at a time.
      await Promise.all(found.map((scene, i) => createCinemaScene({
        project_id: id,
        sort_order: scenes.length + i,
        title: scene.title,
        script_excerpt: scene.script_excerpt,
        summary: scene.summary,
        mood: scene.mood,
        accent_index: accentIndexForSortOrder(scenes.length + i),
      })));
      reload();
      bumpToScenesStatus();
      toast(`${found.length} scene${found.length !== 1 ? "s" : ""} created from script`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to split script", "error");
    } finally {
      setSplitting(false);
    }
  };

  const handleAddScene = async () => {
    if (!id || !newTitle.trim()) return;
    try {
      await createCinemaScene({
        project_id: id,
        title: newTitle.trim(),
        sort_order: scenes.length,
        accent_index: accentIndexForSortOrder(scenes.length),
      });
      setNewTitle("");
      reload();
      bumpToScenesStatus();
      toast("Scene added", "success");
    } catch {
      toast("Failed to add scene", "error");
    }
  };

  const handleDelete = async (sceneId: string) => {
    if (!window.confirm("Delete this scene and all its shots?")) return;
    try {
      await deleteCinemaScene(sceneId);
      reload();
      toast("Scene deleted", "info");
    } catch {
      toast("Failed to delete scene", "error");
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!id) return;
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    const reordered = [...scenes];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderScenes(id, reordered.map((s) => s.id));
      reload();
    } catch {
      toast("Failed to reorder scenes", "error");
    }
  };

  // Optimistic local patch (same pattern as CinemaShotEditor/CinemaAssets) — avoids a full
  // getScenesForProject() re-fetch on every mood-input keystroke.
  const handleMoodChange = (sceneId: string, mood: string) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, mood } : s)));
    updateCinemaScene(sceneId, { mood }).catch(() => toast("Failed to update mood", "error"));
  };

  if (loading || !project || !id) {
    return (
      <PageContainer title="Cinema Studio">
        <div className="flex items-center gap-3 h-40 justify-center">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading scenes…</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={project.title}
      subtitle="SCENE GENERATION"
      action={
        <div className="flex items-center gap-3">
          <Button variant={project.status === "complete" ? "muted" : "accent"} size="xs" onClick={handleToggleComplete}>
            <CheckCircle2 size={11} /> {project.status === "complete" ? "Reopen" : "Mark Complete"}
          </Button>
          <CinemaStageTabs projectId={id} active="scenes" />
          <ProTipPanel stage="scenes" provider={project.video_provider} />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Button variant="accent" size="xs" onClick={handleSplit} disabled={splitting}>
              <Sparkles size={11} /> {splitting ? "Reading script…" : "Split Script into Scenes"}
            </Button>
            <ModelSelector value={modelId} onChange={setModelId} />
            <div className="flex-1" />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New scene title…"
              className="h-9 w-56 px-3 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
              style={{ border: "1px solid rgba(255,255,255,0.16)" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddScene(); }}
            />
            <Button variant="ghost" size="xs" onClick={handleAddScene} disabled={!newTitle.trim()}>
              <Plus size={10} /> Add Scene
            </Button>
          </div>

          <div className="p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <SceneTimeline projectId={id} scenes={scenes} />
          </div>

          {scenes.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="system-label text-[11px]">MANAGE SCENES</span>
              <div className="flex flex-col gap-1.5">
                {scenes.map((scene, index) => (
                  <div key={scene.id} className="flex items-center gap-2 px-3 py-2 rounded-sm border border-white/10">
                    <span className="font-mono text-[11px] text-muted w-6 shrink-0">{index + 1}</span>
                    <span className="font-sans text-[13px] text-white flex-1 truncate">{scene.title}</span>
                    <input
                      value={scene.mood ?? ""}
                      onChange={(e) => handleMoodChange(scene.id, e.target.value)}
                      placeholder="mood"
                      className="h-7 w-28 px-2 font-mono text-[10px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                    />
                    <button type="button" onClick={() => handleMove(index, -1)} disabled={index === 0} className="text-muted hover:text-cyan disabled:opacity-30 transition-precise">
                      <ArrowUp size={12} />
                    </button>
                    <button type="button" onClick={() => handleMove(index, 1)} disabled={index === scenes.length - 1} className="text-muted hover:text-cyan disabled:opacity-30 transition-precise">
                      <ArrowDown size={12} />
                    </button>
                    <button type="button" onClick={() => handleDelete(scene.id)} className="text-muted hover:text-red transition-precise">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </PageContainer>
  );
}
