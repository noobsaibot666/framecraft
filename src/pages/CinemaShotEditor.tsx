import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Clapperboard, Copy, Film, History, Plus, Sparkles, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import { CreativeHintsPanel } from "@/components/cinema/CreativeHintsPanel";
import { ScriptPreviewPanel } from "@/components/cinema/ScriptPreviewPanel";
import { getCinemaProjectById } from "@/lib/cinemaProjects";
import { getCinemaSceneById, getScenesForProject } from "@/lib/cinemaScenes";
import {
  createCinemaShot,
  deleteCinemaShot,
  getShotsForScene,
  reorderShots,
  updateCinemaShot,
} from "@/lib/cinemaShots";
import { getAssetsForProject } from "@/lib/cinemaAssets";
import { generateShotPrompt, suggestTransitions, type TimelinePosition, type TransitionSuggestion } from "@/lib/cinemaShotGeneration";
import { copyToClipboard } from "@/lib/cinemaExport";
import { createShotPromptVersion, getShotPromptVersions } from "@/lib/cinemaShotPromptVersions";
import { AI_MODELS, pickAvailableModel, resolveModelPreference, type AIQuality } from "@/lib/aiConfig";
import { getPreferences } from "@/lib/userPreferences";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { QualitySelector } from "@/components/ui/QualitySelector";
import { useToastStore } from "@/stores/useToastStore";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { CinemaAsset, CinemaProject, CinemaScene, CinemaShot, CinemaShotPromptVersion, CinemaShotType } from "@/types";

const SHOT_TYPE_OPTIONS: { value: CinemaShotType; label: string }[] = [
  { value: "establishing", label: "Establishing" },
  { value: "wide", label: "Wide" },
  { value: "medium", label: "Medium" },
  { value: "close_up", label: "Close-up" },
  { value: "detail", label: "Detail" },
  { value: "cutaway", label: "Cutaway" },
  { value: "hero", label: "Hero" },
  { value: "product", label: "Product" },
  { value: "b_roll", label: "B-Roll" },
];

type NoteFieldKey = "description" | "director_notes" | "dop_notes" | "camera_notes" | "lighting_notes" | "sound_notes";

const NOTE_FIELDS: { key: NoteFieldKey; label: string; placeholder: string }[] = [
  { key: "description", label: "DESCRIPTION", placeholder: "What happens in this shot…" },
  { key: "director_notes", label: "DIRECTOR NOTES", placeholder: "Performance, blocking, pacing intent…" },
  { key: "dop_notes", label: "DOP NOTES", placeholder: "Framing, composition, lens character…" },
  { key: "camera_notes", label: "CAMERA", placeholder: "Movement, speed, handheld amplitude…" },
  { key: "lighting_notes", label: "LIGHTING", placeholder: "Source, quality, motivation…" },
  { key: "sound_notes", label: "SOUND / DIALOGUE", placeholder: "Ambience, score, dialogue lines…" },
];

export function CinemaShotEditor() {
  const { id, sceneId } = useParams<{ id: string; sceneId: string }>();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [project, setProject] = useState<CinemaProject | null>(null);
  const [scene, setScene] = useState<CinemaScene | null>(null);
  const [shots, setShots] = useState<CinemaShot[]>([]);
  const [assets, setAssets] = useState<CinemaAsset[]>([]);
  const [allScenes, setAllScenes] = useState<CinemaScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [suggestingTransitions, setSuggestingTransitions] = useState(false);
  const [transitionSuggestions, setTransitionSuggestions] = useState<TransitionSuggestion[]>([]);
  const [promptVersions, setPromptVersions] = useState<CinemaShotPromptVersion[]>([]);
  const [modelId, setModelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const [quality, setQuality] = useState<AIQuality>(() => getPreferences().defaultAiQuality);
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];

  const load = () => {
    if (!id || !sceneId) return;
    setLoading(true);
    Promise.all([getCinemaProjectById(id), getCinemaSceneById(sceneId), getShotsForScene(sceneId), getAssetsForProject(id), getScenesForProject(id)])
      .then(([p, s, sh, a, allS]) => {
        if (!p || !s) { toast("Not found", "error"); navigate(`/cinema-studio/${id}/scenes`); return; }
        setProject(p);
        setScene(s);
        setShots(sh);
        setAssets(a);
        setAllScenes(allS);
      })
      .catch(() => toast("Failed to load scene", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id, sceneId]);

  // Apply the project's saved default AI model once, on first load.
  useEffect(() => {
    if (project) {
      const preferred = resolveModelPreference(project.script_model);
      if (preferred) setModelId(preferred.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const reloadShots = () => {
    if (!sceneId) return;
    getShotsForScene(sceneId).then(setShots).catch(() => {});
  };

  const selectedShot = shots.find((s) => s.id === selectedShotId);

  useEffect(() => {
    if (!selectedShotId) { setPromptVersions([]); return; }
    getShotPromptVersions(selectedShotId).then(setPromptVersions).catch(() => {});
  }, [selectedShotId]);

  const handleAddShot = async (isBroll: boolean) => {
    if (!id || !sceneId) return;
    try {
      const shotId = await createCinemaShot({
        scene_id: sceneId,
        project_id: id,
        sort_order: shots.length,
        label: isBroll ? `B-Roll ${shots.filter((s) => s.is_broll).length + 1}` : `Shot ${shots.length + 1}`,
        shot_type: isBroll ? "b_roll" : "hero",
        is_broll: isBroll,
      });
      reloadShots();
      setSelectedShotId(shotId);
    } catch {
      toast("Failed to add shot", "error");
    }
  };

  const handleDeleteShot = async (shotId: string) => {
    if (!window.confirm("Delete this shot?")) return;
    try {
      await deleteCinemaShot(shotId);
      if (selectedShotId === shotId) setSelectedShotId(undefined);
      reloadShots();
      toast("Shot deleted", "info");
    } catch {
      toast("Failed to delete shot", "error");
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!sceneId) return;
    const target = index + direction;
    if (target < 0 || target >= shots.length) return;
    const reordered = [...shots];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderShots(sceneId, reordered.map((s) => s.id));
      reloadShots();
    } catch {
      toast("Failed to reorder shots", "error");
    }
  };

  // Optimistically patches local state so every note-field keystroke reflects
  // instantly without waiting on a DB round trip, then persists in the
  // background — avoids a full getShotsForScene() re-fetch per keystroke,
  // which the previous write-then-reload version relied on just to keep the
  // controlled textareas in sync.
  const handleUpdateSelected = (data: Partial<CinemaShot>) => {
    if (!selectedShot) return;
    const shotId = selectedShot.id;
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, ...data } : s)));
    updateCinemaShot(shotId, data).catch(() => toast("Failed to update shot", "error"));
  };

  const toggleLinkedAsset = (assetId: string) => {
    if (!selectedShot) return;
    const current = selectedShot.linked_asset_ids ?? [];
    const next = current.includes(assetId) ? current.filter((a) => a !== assetId) : [...current, assetId];
    handleUpdateSelected({ linked_asset_ids: next });
  };

  const scenePosition: TimelinePosition = (() => {
    if (!scene || allScenes.length === 0) return "middle";
    const index = allScenes.findIndex((s) => s.id === scene.id);
    if (index <= 0) return "first";
    if (index >= allScenes.length - 1) return "last";
    return "middle";
  })();

  const handleGeneratePrompt = async () => {
    if (!selectedShot || !scene || !project?.video_provider) {
      toast("Choose a video model for this project in the New Project setup first", "error");
      return;
    }
    setGenerating(true);
    try {
      const linkedAssetTags = assets.filter((a) => (selectedShot.linked_asset_ids ?? []).includes(a.id)).map((a) => a.tag);
      const prompt = await generateShotPrompt({
        shot: selectedShot,
        scene,
        linkedAssetTags,
        videoProvider: project.video_provider,
        projectTitle: project.title,
      }, model, quality);
      await updateCinemaShot(selectedShot.id, { generated_prompt: prompt });
      reloadShots();
      toast("Shot prompt generated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate prompt", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestTransitions = async () => {
    if (!scene) return;
    setSuggestingTransitions(true);
    try {
      setTransitionSuggestions(await suggestTransitions(scene, scenePosition, model, quality));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to suggest transitions", "error");
    } finally {
      setSuggestingTransitions(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!selectedShot?.generated_prompt?.trim()) { toast("Nothing to copy yet", "error"); return; }
    try {
      await copyToClipboard(selectedShot.generated_prompt);
      toast("Prompt copied to clipboard", "success");
    } catch {
      toast("Failed to copy — your browser may block clipboard access here", "error");
    }
  };

  const handleSavePromptVersion = async () => {
    if (!selectedShot?.generated_prompt?.trim()) { toast("Nothing to save yet — generate or write a prompt first", "error"); return; }
    try {
      await createShotPromptVersion(selectedShot.id, selectedShot.generated_prompt, `${promptVersions.length + 1} versions saved`);
      setPromptVersions(await getShotPromptVersions(selectedShot.id));
      toast("Prompt version saved", "success");
    } catch {
      toast("Failed to save version", "error");
    }
  };

  const handleRestorePromptVersion = (version: CinemaShotPromptVersion) => {
    handleUpdateSelected({ generated_prompt: version.content });
    toast("Version restored", "success");
  };

  if (loading || !project || !scene || !id) {
    return (
      <PageContainer title="Cinema Studio">
        <div className="flex items-center gap-3 h-40 justify-center">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading scene…</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={scene.title}
      subtitle={`${project.title} / SHOT EDITOR`}
      action={
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="xs" onClick={() => navigate(`/cinema-studio/${id}/scenes`)}>
            <ArrowLeft size={11} /> Back to Timeline
          </Button>
          <ProTipPanel stage="scenes" provider={project.video_provider} />
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left: shot list */}
        <div className="flex flex-col gap-3 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Button variant="primary" size="xs" onClick={() => handleAddShot(false)}>
              <Plus size={10} /> Shot
            </Button>
            <Button variant="ghost" size="xs" onClick={() => handleAddShot(true)}>
              <Film size={10} /> B-Roll
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            {shots.map((shot, index) => (
              <div
                key={shot.id}
                onClick={() => setSelectedShotId(shot.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm border cursor-pointer transition-precise",
                  selectedShotId === shot.id ? "border-cyan/55 bg-cyan/10" : "border-white/12 hover:border-white/30"
                )}
              >
                <span className="font-mono text-[10px] text-muted w-4 shrink-0">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-sans text-[12.5px] text-white truncate block">{shot.label}</span>
                  <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{shot.shot_type}{shot.is_broll ? " · B-ROLL" : ""}</span>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleMove(index, -1); }} disabled={index === 0} className="text-muted hover:text-cyan disabled:opacity-20 transition-precise">
                  <ArrowUp size={11} />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleMove(index, 1); }} disabled={index === shots.length - 1} className="text-muted hover:text-cyan disabled:opacity-20 transition-precise">
                  <ArrowDown size={11} />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteShot(shot.id); }} className="text-muted hover:text-red transition-precise">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {shots.length === 0 && (
              <span className="font-mono text-[11px] text-muted">No shots yet — add one above.</span>
            )}
          </div>
        </div>

        {/* Center: shot detail */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {selectedShot ? (
            <div className="flex flex-col gap-4 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
              <div className="flex items-center gap-3">
                <input
                  value={selectedShot.label}
                  onChange={(e) => handleUpdateSelected({ label: e.target.value })}
                  className="flex-1 h-9 px-3 font-sans text-[14px] font-semibold text-white bg-transparent rounded-sm focus:outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                />
                <select
                  value={selectedShot.shot_type}
                  onChange={(e) => handleUpdateSelected({ shot_type: e.target.value as CinemaShotType })}
                  className="h-9 px-2 font-mono text-[11px] text-white bg-dark rounded-sm focus:outline-none shrink-0"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                >
                  {SHOT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select
                  value={selectedShot.status}
                  onChange={(e) => handleUpdateSelected({ status: e.target.value as CinemaShot["status"] })}
                  className="h-9 px-2 font-mono text-[10px] tracking-widest uppercase text-white bg-dark rounded-sm focus:outline-none shrink-0"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="exported">Exported</option>
                </select>
              </div>

              {NOTE_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="system-label">{field.label}</label>
                  <textarea
                    value={selectedShot[field.key] ?? ""}
                    onChange={(e) => handleUpdateSelected({ [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={2}
                    className="px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
                    style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="system-label">LINKED ASSETS</label>
                {assets.length === 0 ? (
                  <span className="font-mono text-[11px] text-muted">No assets in this project yet — build some in the Assets stage.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assets.map((a) => {
                      const linked = (selectedShot.linked_asset_ids ?? []).includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleLinkedAsset(a.id)}
                          className={cn(
                            "h-7 px-2.5 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise border",
                            linked ? "text-cyan border-cyan/55 bg-cyan/10" : "text-readable border-white/16 hover:text-white hover:border-white/30"
                          )}
                        >
                          {a.tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="system-label">GENERATED PROMPT</label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="xs" onClick={handleCopyPrompt} disabled={!selectedShot.generated_prompt?.trim()}>
                      <Copy size={11} /> Copy
                    </Button>
                    <Button variant="ghost" size="xs" onClick={handleSavePromptVersion} disabled={!selectedShot.generated_prompt?.trim()}>
                      <History size={11} /> Save Version
                    </Button>
                    <Button variant="primary" size="xs" onClick={handleGeneratePrompt} disabled={generating}>
                      <Sparkles size={11} /> {generating ? "Writing…" : "Generate Prompt"}
                    </Button>
                    <ModelSelector value={modelId} onChange={setModelId} />
                    <QualitySelector value={quality} onChange={setQuality} />
                  </div>
                </div>
                <textarea
                  value={selectedShot.generated_prompt ?? ""}
                  onChange={(e) => handleUpdateSelected({ generated_prompt: e.target.value })}
                  placeholder="The full director's-brief prompt, ready to paste into your video generator."
                  rows={7}
                  className="px-3 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                />
                {promptVersions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] text-muted tracking-widest uppercase">Prompt version history</span>
                    {promptVersions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleRestorePromptVersion(v)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-sm border border-white/10 hover:border-cyan/40 hover:bg-cyan/5 transition-precise text-left"
                      >
                        <span className="font-mono text-[10.5px] text-readable">{v.label ?? "Version"}</span>
                        <span className="font-mono text-[9.5px] text-muted">{formatDate(v.created_at)} {formatTime(v.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="system-label">TRANSITIONS</label>
                  <Button variant="ghost" size="xs" onClick={handleSuggestTransitions} disabled={suggestingTransitions}>
                    <Sparkles size={10} /> {suggestingTransitions ? "Thinking…" : "Suggest"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-muted tracking-widest uppercase">IN</span>
                    <input
                      value={selectedShot.transition_in ?? ""}
                      onChange={(e) => handleUpdateSelected({ transition_in: e.target.value })}
                      placeholder="e.g. hard cut"
                      className="h-8 px-2 font-mono text-[11px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-muted tracking-widest uppercase">OUT</span>
                    <input
                      value={selectedShot.transition_out ?? ""}
                      onChange={(e) => handleUpdateSelected({ transition_out: e.target.value })}
                      placeholder="e.g. whip pan"
                      className="h-8 px-2 font-mono text-[11px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                    />
                  </div>
                </div>
                {transitionSuggestions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {transitionSuggestions.map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm border border-white/10">
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-cyan">{t.option}</span>
                          <p className="font-mono text-[10px] text-muted leading-relaxed">{t.rationale}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => handleUpdateSelected({ transition_in: t.option })} className="font-mono text-[9px] text-readable hover:text-cyan tracking-widest uppercase transition-precise">→IN</button>
                          <button type="button" onClick={() => handleUpdateSelected({ transition_out: t.option })} className="font-mono text-[9px] text-readable hover:text-cyan tracking-widest uppercase transition-precise">→OUT</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div
                className="flex flex-col items-center gap-3 p-8 rounded-card max-w-md w-full"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
              >
                <Clapperboard size={28} className="text-white/25" />
                <span className="system-label">SELECT OR ADD A SHOT</span>
                <span className="font-mono text-[13px] text-readable text-center leading-relaxed">
                  Build the shot list for this scene — description, director/DOP/camera/lighting/sound
                  notes, and which assets each shot needs.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: script excerpt + creative hints */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <ScriptPreviewPanel scriptContent={scene.script_excerpt} title="SCENE SCRIPT EXCERPT" defaultExpanded={false} />
          <CreativeHintsPanel mood={scene.mood} />
        </div>
      </div>
    </PageContainer>
  );
}
