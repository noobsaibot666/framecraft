import { useState } from "react";
import { X, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mergeImagesSideBySide, MAX_MERGE_SOURCES, MIN_MERGE_SOURCES } from "@/lib/assetMerge";
import { computeGridPosition, createCinemaAsset, suggestAssetTag } from "@/lib/cinemaAssets";
import { thumbnailFromDataUrl } from "@/lib/fileStore";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";
import type { CinemaAsset, CinemaFolder, CinemaFolderKind, CinemaAssetType } from "@/types";

const FOLDER_KIND_TO_ASSET_TYPE: Record<CinemaFolderKind, CinemaAssetType> = {
  character: "character_sheet",
  location: "location",
  prop: "prop",
  other: "other",
};

interface Props {
  projectId: string;
  folder: CinemaFolder;
  assets: CinemaAsset[];
  /** Total assets across the whole project (not just this folder) — used to place the merged asset in an unoccupied moodboard grid slot. */
  projectAssetCount: number;
  onMerged: () => void;
  onClose: () => void;
}

export function MergeAssetsModal({ projectId, folder, assets, projectAssetCount, onMerged, onClose }: Props) {
  const toast = useToastStore((s) => s.add);
  const mergeable = assets.filter((a) => !!a.file_data);
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [preview, setPreview] = useState<string | undefined>();

  const toggle = (id: string) => {
    setPreview(undefined);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= MAX_MERGE_SOURCES) return prev;
      return [...prev, id];
    });
  };

  const handlePreview = async () => {
    const sources = mergeable.filter((a) => selected.includes(a.id)).map((a) => a.file_data!);
    try {
      setPreview(await mergeImagesSideBySide(sources));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to preview merge", "error");
    }
  };

  const handleMerge = async () => {
    setMerging(true);
    try {
      const sourceAssets = mergeable.filter((a) => selected.includes(a.id));
      const merged = preview ?? await mergeImagesSideBySide(sourceAssets.map((a) => a.file_data!));
      const thumb = await thumbnailFromDataUrl(merged);
      const tag = await suggestAssetTag(projectId, `${folder.name} sheet`);
      const { x, y } = computeGridPosition(projectAssetCount);
      await createCinemaAsset({
        project_id: projectId,
        folder_id: folder.id,
        tag,
        title: `${folder.name} — Merged Sheet`,
        asset_type: FOLDER_KIND_TO_ASSET_TYPE[folder.kind],
        file_data: merged,
        thumbnail_data: thumb,
        is_primary: true,
        merged_from: sourceAssets.map((a) => a.id),
        canvas_x: x,
        canvas_y: y,
      });
      toast("Merged character sheet created — originals untouched", "success");
      onMerged();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to merge images", "error");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-card overflow-hidden" style={{ background: "var(--color-panel)", border: "var(--border-strong)" }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "var(--border-default)" }}>
          <div className="flex flex-col gap-1">
            <span className="system-label">MERGE INTO ONE SHEET</span>
            <span className="font-mono text-[11px] text-readable">Select {MIN_MERGE_SOURCES}-{MAX_MERGE_SOURCES} images from "{folder.name}" — originals stay untouched.</span>
          </div>
          <button type="button" onClick={onClose} className="text-dim/40 hover:text-white transition-precise"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {mergeable.length < MIN_MERGE_SOURCES ? (
            <span className="font-mono text-[12px] text-muted">
              Import at least {MIN_MERGE_SOURCES} images into this folder before merging.
            </span>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {mergeable.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "flex flex-col gap-1.5 p-2 rounded-sm border text-left transition-precise",
                    selected.includes(a.id) ? "border-cyan/55 bg-cyan/10" : "border-white/12 hover:border-white/30"
                  )}
                >
                  <img src={a.thumbnail_data ?? a.file_data} alt={a.title} className="w-full aspect-square object-cover rounded-sm" />
                  <span className="font-mono text-[9px] text-cyan tracking-widest uppercase truncate">{a.tag}</span>
                </button>
              ))}
            </div>
          )}

          {selected.length >= MIN_MERGE_SOURCES && !preview && (
            <Button variant="ghost" size="sm" onClick={handlePreview} className="self-start">
              <Layers size={11} /> Preview Merge
            </Button>
          )}

          {preview && (
            <div className="flex flex-col gap-2">
              <span className="system-label text-[11px]">PREVIEW</span>
              <img src={preview} alt="Merged preview" className="w-full rounded-sm border border-white/12" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 py-5" style={{ borderTop: "var(--border-default)" }}>
          <Button variant="primary" size="sm" onClick={handleMerge} disabled={selected.length < MIN_MERGE_SOURCES || merging}>
            {merging ? "Merging…" : `Create Merged Sheet (${selected.length})`}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
