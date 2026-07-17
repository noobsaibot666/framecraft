import { useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, Star, X } from "lucide-react";
import type { CinemaAsset, CinemaFolder } from "@/types";

const CARD_W = 160;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD = 4;

interface Props {
  assets: CinemaAsset[];
  folders: CinemaFolder[];
  onPositionChange: (assetId: string, x: number, y: number) => void;
  onSelectAsset?: (assetId: string) => void;
}

export function MoodboardCanvas({ assets, folders, onPositionChange, onSelectAsset }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const panState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const dragState = useRef<{
    assetId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const folderColor = (folderId: string) => folders.find((f) => f.id === folderId)?.accent_color ?? "rgba(255,255,255,0.3)";
  const folderName = (folderId: string) => folders.find((f) => f.id === folderId)?.name ?? "";

  // canvas_x/canvas_y are assigned a real grid position at asset-creation time
  // (see cinemaAssets.ts's computeGridPosition), so the stored value can
  // always be trusted directly — no runtime fallback-if-zero heuristic here,
  // which would otherwise be unable to tell "never positioned" apart from
  // "the user dragged it to exactly (0,0)".
  const positionFor = (asset: CinemaAsset) => positions[asset.id] ?? { x: asset.canvas_x, y: asset.canvas_y };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    panState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (panState.current) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      setPan({ x: panState.current.panX + dx, y: panState.current.panY + dy });
    } else if (dragState.current) {
      const dx = (e.clientX - dragState.current.startClientX) / zoom;
      const dy = (e.clientY - dragState.current.startClientY) / zoom;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragState.current.moved = true;
      setPositions((prev) => ({
        ...prev,
        [dragState.current!.assetId]: { x: dragState.current!.startX + dx, y: dragState.current!.startY + dy },
      }));
    }
  };

  const handleCanvasPointerUp = () => {
    panState.current = null;
    if (dragState.current) {
      const { assetId, moved } = dragState.current;
      if (moved) {
        const pos = positions[assetId];
        if (pos) onPositionChange(assetId, pos.x, pos.y);
      } else {
        onSelectAsset?.(assetId);
        setLightboxId(assetId);
      }
      dragState.current = null;
    }
  };

  const handleAssetPointerDown = (e: React.PointerEvent, asset: CinemaAsset) => {
    e.stopPropagation();
    const pos = positionFor(asset);
    dragState.current = { assetId: asset.id, startClientX: e.clientX, startClientY: e.clientY, startX: pos.x, startY: pos.y, moved: false };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
  };

  const lightboxAsset = assets.find((a) => a.id === lightboxId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15))} className="text-muted hover:text-cyan transition-precise" title="Zoom out">
          <Minus size={13} />
        </button>
        <span className="font-mono text-[10px] text-muted w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15))} className="text-muted hover:text-cyan transition-precise" title="Zoom in">
          <Plus size={13} />
        </button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 24, y: 24 }); }} className="text-muted hover:text-cyan transition-precise" title="Reset view">
          <RotateCcw size={12} />
        </button>
      </div>

      <div
        className="relative overflow-hidden rounded-card select-none"
        style={{ height: 520, border: "var(--border-default)", background: "rgba(0,0,0,0.3)", cursor: panState.current ? "grabbing" : "grab" }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        onWheel={handleWheel}
      >
        {assets.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-muted">
            No assets yet — create one from a folder to see it here.
          </div>
        ) : (
          <div
            className="absolute top-0 left-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
            {assets.map((asset) => {
              const pos = positionFor(asset);
              return (
                <div
                  key={asset.id}
                  onPointerDown={(e) => handleAssetPointerDown(e, asset)}
                  className="absolute flex flex-col gap-1.5 p-2 rounded-sm cursor-grab active:cursor-grabbing"
                  style={{
                    left: pos.x, top: pos.y, width: CARD_W,
                    border: `1px solid ${folderColor(asset.folder_id)}55`,
                    background: "rgba(20,20,20,0.92)",
                  }}
                >
                  <div className="aspect-square rounded-sm overflow-hidden flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {asset.thumbnail_data ? (
                      <img src={asset.thumbnail_data} alt={asset.title} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                    ) : (
                      <span className="font-mono text-[9px] text-muted">{asset.tag}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[9px] tracking-widest uppercase truncate" style={{ color: folderColor(asset.folder_id) }}>{asset.tag}</span>
                    {asset.is_primary && <Star size={9} className="text-amber shrink-0" fill="currentColor" />}
                  </div>
                  <span className="font-mono text-[8.5px] text-muted truncate">{folderName(asset.folder_id)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightboxId(null)}
        >
          <button type="button" onClick={() => setLightboxId(null)} className="absolute top-6 right-6 text-white/60 hover:text-white transition-precise">
            <X size={20} />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-3xl max-h-full">
            {lightboxAsset.file_data || lightboxAsset.thumbnail_data ? (
              <img src={lightboxAsset.file_data ?? lightboxAsset.thumbnail_data} alt={lightboxAsset.title} className="max-w-full max-h-[75vh] object-contain rounded-sm" />
            ) : (
              <div className="flex items-center justify-center w-64 h-64 rounded-sm" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Maximize2 size={24} className="text-white/20" />
              </div>
            )}
            <span className="font-mono text-[12px] text-cyan tracking-widest uppercase">{lightboxAsset.tag}</span>
            <span className="font-sans text-[14px] text-white">{lightboxAsset.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}
