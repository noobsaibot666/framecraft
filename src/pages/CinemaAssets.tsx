import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, FolderTree as FolderTreeIcon, LayoutGrid, Layers, Plus, Sparkles, SquareStack, Star } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { CinemaStageTabs } from "@/components/cinema/CinemaStageTabs";
import { ProTipPanel } from "@/components/cinema/ProTipPanel";
import { ScriptPreviewPanel } from "@/components/cinema/ScriptPreviewPanel";
import { FolderTree } from "@/components/cinema/FolderTree";
import { AssetPromptComposer } from "@/components/cinema/AssetPromptComposer";
import { MoodboardCanvas } from "@/components/cinema/MoodboardCanvas";
import { MergeAssetsModal } from "@/components/cinema/MergeAssetsModal";
import { MIN_MERGE_SOURCES } from "@/lib/assetMerge";
import { exportAssetsWithNaming } from "@/lib/cinemaExport";
import { getCinemaProjectById } from "@/lib/cinemaProjects";
import { createCinemaFolder, deleteCinemaFolder, getFoldersForProject, getOrCreateMasterFolder, MASTER_FOLDER_NAMES, updateCinemaFolder } from "@/lib/cinemaFolders";
import { suggestFoldersFromScript, type SuggestedFolder } from "@/lib/cinemaFolderSuggestions";
import { computeGridPosition, createCinemaAsset, getAssetsForFolder, getAssetsForProject, suggestAssetTag, updateCinemaAsset } from "@/lib/cinemaAssets";
import { ACCENT_COLORS } from "@/lib/storytelling";
import { AI_MODELS, pickAvailableModel } from "@/lib/aiConfig";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";
import type { CinemaAsset, CinemaAssetType, CinemaFolder, CinemaFolderKind, CinemaProject } from "@/types";

const KIND_OPTIONS: { value: CinemaFolderKind; label: string }[] = [
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "prop", label: "Prop" },
  { value: "other", label: "Other" },
];

const FOLDER_KIND_TO_ASSET_TYPE: Record<CinemaFolderKind, CinemaAssetType> = {
  character: "character_sheet",
  location: "location",
  prop: "prop",
  other: "other",
};

export function CinemaAssets() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.add);
  const [project, setProject] = useState<CinemaProject | null>(null);
  const [folders, setFolders] = useState<CinemaFolder[]>([]);
  const [assets, setAssets] = useState<CinemaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"composer" | "canvas">("composer");
  const [projectAssets, setProjectAssets] = useState<CinemaAsset[]>([]);
  const [canvasFolderFilter, setCanvasFolderFilter] = useState<string>("all");

  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CinemaFolderKind>("other");

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedFolder[]>([]);
  const [modelId] = useState(() => pickAvailableModel()?.id ?? AI_MODELS[0].id);
  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];
  const [showMerge, setShowMerge] = useState(false);
  const [acceptingSuggestion, setAcceptingSuggestion] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([getCinemaProjectById(id), getFoldersForProject(id)])
      .then(([p, f]) => {
        if (!p) { toast("Project not found", "error"); navigate("/cinema-studio"); return; }
        setProject(p);
        setFolders(f);
      })
      .catch(() => toast("Failed to load project", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  useEffect(() => {
    if (!selectedFolderId) { setAssets([]); setSelectedAssetId(undefined); return; }
    getAssetsForFolder(selectedFolderId).then(setAssets).catch(() => toast("Failed to load assets", "error"));
    setSelectedAssetId(undefined);
  }, [selectedFolderId]);

  const reloadAssets = () => {
    if (selectedFolderId) getAssetsForFolder(selectedFolderId).then(setAssets).catch(() => {});
    reloadProjectAssets();
  };

  const reloadProjectAssets = () => {
    if (!id) return;
    getAssetsForProject(id).then(setProjectAssets).catch(() => {});
  };

  useEffect(() => {
    if (viewMode === "canvas") reloadProjectAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, id]);

  const handleCanvasPositionChange = async (assetId: string, x: number, y: number) => {
    try {
      await updateCinemaAsset(assetId, { canvas_x: x, canvas_y: y });
      setProjectAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, canvas_x: x, canvas_y: y } : a)));
    } catch {
      toast("Failed to save position", "error");
    }
  };

  const canvasAssets = canvasFolderFilter === "all" ? projectAssets : projectAssets.filter((a) => a.folder_id === canvasFolderFilter);

  const handleExportAssets = async () => {
    setExporting(true);
    try {
      const { exported, skipped } = await exportAssetsWithNaming(canvasAssets);
      if (exported === 0) toast("No assets with images to export yet", "info");
      else toast(`Exported ${exported} asset${exported !== 1 ? "s" : ""}${skipped ? ` (${skipped} skipped — no image yet)` : ""}`, "success");
    } catch {
      toast("Failed to export assets", "error");
    } finally {
      setExporting(false);
    }
  };

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const handleCreateFolder = async () => {
    if (!id || !newName.trim() || creatingUnder === undefined) return;
    try {
      const folderId = await createCinemaFolder({
        project_id: id,
        parent_id: creatingUnder ?? undefined,
        name: newName.trim(),
        kind: newKind,
        accent_color: ACCENT_COLORS[folders.length % ACCENT_COLORS.length],
      });
      setNewName("");
      setCreatingUnder(undefined);
      setFolders(await getFoldersForProject(id));
      setSelectedFolderId(folderId);
      toast("Folder created", "success");
    } catch {
      toast("Failed to create folder", "error");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm("Delete this folder and everything inside it?")) return;
    try {
      await deleteCinemaFolder(folderId);
      if (!id) return;
      setFolders(await getFoldersForProject(id));
      if (selectedFolderId === folderId) setSelectedFolderId(undefined);
      toast("Folder deleted", "info");
    } catch {
      toast("Failed to delete folder", "error");
    }
  };

  // Optimistic local patch (see CinemaShotEditor's handleUpdateSelected for the same pattern) —
  // avoids a full getFoldersForProject() re-fetch on every name/description keystroke.
  const handleUpdateSelectedFolder = (data: Partial<Pick<CinemaFolder, "name" | "description" | "accent_color" | "kind">>) => {
    if (!selectedFolder) return;
    const folderId = selectedFolder.id;
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, ...data } : f)));
    updateCinemaFolder(folderId, data).catch(() => toast("Failed to update folder", "error"));
  };

  const handleSuggestFolders = async () => {
    if (!project?.script_content?.trim()) { toast("Approve a script first", "error"); return; }
    setSuggesting(true);
    try {
      const found = await suggestFoldersFromScript(project.script_content, model);
      const existingNames = new Set(folders.map((f) => f.name.toLowerCase()));
      setSuggestions(found.filter((f) => !existingNames.has(f.name.toLowerCase())));
      if (found.length === 0) toast("No new folder candidates found", "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to suggest folders", "error");
    } finally {
      setSuggesting(false);
    }
  };

  const handleAcceptSuggestion = async (suggestion: SuggestedFolder) => {
    // Guards against a fast double-click (or two quick clicks on same-kind suggestions) racing
    // getOrCreateMasterFolder's read-then-maybe-create and ending up with two master folders.
    if (!id || acceptingSuggestion) return;
    setAcceptingSuggestion(true);
    try {
      const masterId = await getOrCreateMasterFolder(id, suggestion.kind);
      // Accent color is purely decorative and cycles anyway once the folder count exceeds the
      // palette size, so the already-loaded `folders` state is precise enough here — avoids a
      // third getFoldersForProject() round trip just to recompute an index for a color pick.
      await createCinemaFolder({
        project_id: id,
        parent_id: masterId,
        name: suggestion.name,
        kind: suggestion.kind,
        accent_color: ACCENT_COLORS[folders.length % ACCENT_COLORS.length],
      });
      setFolders(await getFoldersForProject(id));
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
      toast(`"${suggestion.name}" created under ${MASTER_FOLDER_NAMES[suggestion.kind]}`, "success");
    } catch {
      toast("Failed to create folder", "error");
    } finally {
      setAcceptingSuggestion(false);
    }
  };

  const handleNewAsset = async () => {
    if (!id || !selectedFolder) return;
    try {
      const title = `New ${selectedFolder.kind === "other" ? "asset" : selectedFolder.kind}`;
      const tag = await suggestAssetTag(id, selectedFolder.name);
      const { x, y } = computeGridPosition(projectAssets.length);
      const assetId = await createCinemaAsset({
        project_id: id,
        folder_id: selectedFolder.id,
        tag,
        title,
        asset_type: FOLDER_KIND_TO_ASSET_TYPE[selectedFolder.kind],
        canvas_x: x,
        canvas_y: y,
      });
      reloadAssets();
      setSelectedAssetId(assetId);
    } catch {
      toast("Failed to create asset", "error");
    }
  };

  const creatingLabel = creatingUnder === undefined
    ? null
    : creatingUnder === null
      ? "root"
      : folders.find((f) => f.id === creatingUnder)?.name ?? "folder";

  if (loading || !project || !id) {
    return (
      <PageContainer title="Cinema Studio">
        <div className="flex items-center gap-3 h-40 justify-center">
          <span className="font-ndot text-[20px] text-dim/30 animate-pulse">···</span>
          <span className="font-mono text-[12px] text-muted">Loading assets…</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={project.title}
      subtitle="ASSET PRODUCTION"
      action={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-sm border border-white/14 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("composer")}
              className={cn("h-8 px-3 flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-precise",
                viewMode === "composer" ? "bg-cyan/10 text-cyan" : "text-readable hover:text-white")}
            >
              <SquareStack size={12} /> Composer
            </button>
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={cn("h-8 px-3 flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-precise",
                viewMode === "canvas" ? "bg-cyan/10 text-cyan" : "text-readable hover:text-white")}
            >
              <LayoutGrid size={12} /> Moodboard
            </button>
          </div>
          <CinemaStageTabs projectId={id} active="assets" />
        </div>
      }
    >
      {viewMode === "canvas" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCanvasFolderFilter("all")}
              className={cn("h-7 px-3 rounded-sm font-mono text-[9px] tracking-widest uppercase transition-precise border",
                canvasFolderFilter === "all" ? "text-cyan border-cyan/55 bg-cyan/10" : "text-readable border-white/14 hover:text-white")}
            >
              All ({projectAssets.length})
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCanvasFolderFilter(f.id)}
                className={cn("h-7 px-3 rounded-sm font-mono text-[9px] tracking-widest uppercase transition-precise border",
                  canvasFolderFilter === f.id ? "text-cyan border-cyan/55 bg-cyan/10" : "text-readable border-white/14 hover:text-white")}
              >
                {f.name} ({projectAssets.filter((a) => a.folder_id === f.id).length})
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={handleExportAssets} disabled={exporting || canvasAssets.every((a) => !a.file_data)}>
              <Download size={11} /> {exporting ? "Exporting…" : `Export (${canvasAssets.filter((a) => !!a.file_data).length})`}
            </Button>
          </div>
          <MoodboardCanvas assets={canvasAssets} folders={folders} onPositionChange={handleCanvasPositionChange} />
        </div>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left: folder tree + AI suggestions */}
        <div className="flex flex-col gap-4 xl:col-span-1">
          <div className="p-3 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <FolderTree
              folders={folders}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onAddChild={(parentId) => { setCreatingUnder(parentId); setNewName(""); setNewKind("other"); }}
              onDelete={handleDeleteFolder}
            />
          </div>

          {creatingUnder !== undefined && (
            <div className="flex flex-col gap-2 p-3 rounded-card" style={{ border: "var(--border-strong)", background: "var(--surface-card)" }}>
              <span className="font-mono text-[10px] text-muted tracking-widest uppercase">New folder under {creatingLabel}</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Folder name…"
                autoFocus
                className="h-8 px-2.5 font-mono text-[12px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setCreatingUnder(undefined); }}
              />
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as CinemaFolderKind)}
                className="h-8 px-2.5 font-mono text-[11px] text-white bg-dark rounded-sm focus:outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.14)" }}
              >
                {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleCreateFolder} disabled={!newName.trim()}>Create</Button>
                <Button variant="ghost" size="sm" onClick={() => setCreatingUnder(undefined)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 p-3 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
            <div className="flex items-center justify-between">
              <span className="system-label text-[11px]">SUGGEST FROM SCRIPT</span>
              <Button variant="ghost" size="sm" onClick={handleSuggestFolders} disabled={suggesting}>
                <Sparkles size={10} /> {suggesting ? "Reading…" : "Suggest"}
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => handleAcceptSuggestion(s)}
                    disabled={acceptingSuggestion}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-sm border border-cyan/25 hover:bg-cyan/8 transition-precise text-left disabled:opacity-40"
                  >
                    <span className="font-mono text-[11.5px] text-white">{s.name}</span>
                    <span className="font-mono text-[9px] text-cyan tracking-widest uppercase">+ {s.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: folder detail + assets + composer */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {selectedFolder ? (
            <>
              <div className="flex flex-col gap-3 p-4 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
                <div className="flex items-center gap-3">
                  <input
                    value={selectedFolder.name}
                    onChange={(e) => handleUpdateSelectedFolder({ name: e.target.value })}
                    className="flex-1 h-8 px-2.5 font-sans text-[14px] font-semibold text-white bg-transparent rounded-sm focus:outline-none"
                    style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                  <select
                    value={selectedFolder.kind}
                    onChange={(e) => handleUpdateSelectedFolder({ kind: e.target.value as CinemaFolderKind })}
                    className="h-8 px-2 font-mono text-[11px] text-white bg-dark rounded-sm focus:outline-none shrink-0"
                    style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                  >
                    {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleUpdateSelectedFolder({ accent_color: color })}
                        className={cn("w-4 h-4 rounded-full border transition-precise", selectedFolder.accent_color === color ? "border-white scale-110" : "border-white/20")}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
                <textarea
                  value={selectedFolder.description ?? ""}
                  onChange={(e) => handleUpdateSelectedFolder({ description: e.target.value })}
                  placeholder="What this folder holds…"
                  rows={2}
                  className="px-2.5 py-2 font-mono text-[12px] leading-relaxed text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
                  style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="system-label text-[11px]">ASSETS IN THIS FOLDER</span>
                <div className="flex items-center gap-2">
                  {assets.filter((a) => !!a.file_data).length >= MIN_MERGE_SOURCES && (
                    <Button variant="ghost" size="sm" onClick={() => setShowMerge(true)}>
                      <Layers size={10} /> Merge Assets
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleNewAsset}>
                    <Plus size={10} /> New Asset
                  </Button>
                </div>
              </div>

              {assets.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAssetId(a.id)}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-sm border text-left transition-precise",
                        selectedAssetId === a.id ? "border-cyan/55 bg-cyan/10" : "border-white/12 hover:border-white/30"
                      )}
                    >
                      {a.thumbnail_data && (
                        <img src={a.thumbnail_data} alt={a.title} className="w-full aspect-square object-cover rounded-sm" />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-cyan tracking-widest uppercase truncate">{a.tag}</span>
                        {a.is_primary && <Star size={10} className="text-amber shrink-0" fill="currentColor" />}
                      </div>
                      <span className="font-sans text-[13px] text-white truncate">{a.title}</span>
                      {a.merged_from && a.merged_from.length > 0 && (
                        <span className="font-mono text-[8px] text-cyan tracking-widest uppercase">MERGED · {a.merged_from.length} sources</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {showMerge && selectedFolder && (
                <MergeAssetsModal
                  projectId={id}
                  folder={selectedFolder}
                  assets={assets}
                  projectAssetCount={projectAssets.length}
                  onMerged={reloadAssets}
                  onClose={() => setShowMerge(false)}
                />
              )}

              {selectedAsset && (
                <AssetPromptComposer key={selectedAsset.id} asset={selectedAsset} folder={selectedFolder} project={project} onChange={reloadAssets} />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div
                className="flex flex-col items-center gap-3 p-8 rounded-card max-w-md w-full"
                style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
              >
                <FolderTreeIcon size={28} className="text-white/25" />
                <span className="system-label">SELECT OR CREATE A FOLDER</span>
                <span className="font-mono text-[13px] text-readable text-center leading-relaxed">
                  Folders organize character sheets, locations, and props. Use "Suggest from Script" for a
                  head start, or add one manually from the tree on the left.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: script preview + pro tips */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <ScriptPreviewPanel scriptContent={project.script_content} />
          <ProTipPanel stage="assets" provider={project.image_provider} />
          <div className="flex items-center gap-2 p-3 rounded-card font-mono text-[11px] text-muted" style={{ border: "var(--border-default)" }}>
            <Layers size={12} /> {folders.length} folder{folders.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      )}
    </PageContainer>
  );
}
