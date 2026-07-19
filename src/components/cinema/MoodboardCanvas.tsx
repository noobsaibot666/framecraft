import { useRef, useState } from "react";
import { useDrag, useGesture } from "@use-gesture/react";
import { LayoutGrid, Lock, Maximize2, Minus, Plus, RotateCcw, Star, X } from "lucide-react";
import { useShortcut } from "@/lib/shortcuts";
import { computeGridPosition, groupAssetVersions, stackedVersionPosition } from "@/lib/cinemaAssets";
import type { CinemaAsset, CinemaFolder } from "@/types";

const CARD_W = 160;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const CONNECTOR_COLOR = "#2D7FF9"; // blue — the Moodboard's own accent (view toggle, Export)

/** Smooth cubic-bezier "S-curve" between two node centers, React-Flow-style —
 * horizontally-biased control points so even near-vertically-stacked nodes
 * (the common case here) still read as a real bend, not a straight line with
 * rounded ends. */
function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const curvature = Math.max(dist * 0.5, 40);
  return `M ${from.x} ${from.y} C ${from.x + curvature} ${from.y}, ${to.x - curvature} ${to.y}, ${to.x} ${to.y}`;
}

interface Props {
  assets: CinemaAsset[];
  folders: CinemaFolder[];
  onPositionChange: (assetId: string, x: number, y: number) => void;
  onSelectAsset?: (assetId: string) => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** One draggable card. Owns its own drag gesture so it never fights the canvas's
 * own pan gesture — the pan gesture is bound to a separate background element
 * that isn't an ancestor of any card (see `panCatcherRef` below), so a card's
 * pointer events can never bubble into it no matter how either gesture library
 * schedules its listeners. */
function AssetCard({ asset, folderColor, folderName, zoom, position, onDragEnd, onTap, onLiveMove, showVersionBadge }: {
  asset: CinemaAsset;
  folderColor: string;
  folderName: string;
  zoom: number;
  position: { x: number; y: number };
  onDragEnd: (x: number, y: number) => void;
  onTap: () => void;
  /** Fires on every frame of an active drag (and once more with `null` when it
   * ends) — lets the parent redraw connector lines in step with the card
   * instead of only once the drag settles. */
  onLiveMove?: (pos: { x: number; y: number } | null) => void;
  /** True once this asset is actually part of a multi-version stack (2+
   * siblings) — every version in that stack gets a badge, including V1, so
   * the numbering reads consistently instead of only V2+ looking versioned. */
  showVersionBadge: boolean;
}) {
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);

  const bind = useDrag(
    ({ active, offset: [ox, oy], event, tap }) => {
      event.stopPropagation();
      event.preventDefault();
      if (active) {
        setLive({ x: ox, y: oy });
        onLiveMove?.({ x: ox, y: oy });
      } else {
        setLive(null);
        onLiveMove?.(null);
        if (tap) onTap();
        else onDragEnd(ox, oy);
      }
    },
    {
      from: () => [position.x, position.y],
      // Screen-pixel pointer movement must be converted to canvas-space units,
      // since the card sits inside a scale(zoom)-transformed parent.
      transform: ([x, y]) => [x / zoom, y / zoom],
      filterTaps: true,
      pointer: { capture: true },
    }
  );

  const pos = live ?? position;

  return (
    <div
      {...bind()}
      className="absolute flex flex-col gap-1.5 p-2 rounded-sm cursor-grab active:cursor-grabbing touch-none"
      style={{
        left: pos.x, top: pos.y, width: CARD_W,
        border: asset.locked ? "1px solid rgba(56,183,200,0.65)" : `1px solid ${folderColor}55`,
        background: "rgba(20,20,20,0.92)",
      }}
    >
      <div className="aspect-square rounded-sm overflow-hidden flex items-center justify-center relative" style={{ background: "rgba(255,255,255,0.05)" }}>
        {asset.thumbnail_data ? (
          <img src={asset.thumbnail_data} alt={asset.title} className="w-full h-full object-cover pointer-events-none" draggable={false} />
        ) : (
          <span className="font-mono text-[9px] text-muted">{asset.tag}</span>
        )}
        {asset.locked && (
          <span className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-sm bg-black/70 text-cyan" title="Locked — approved">
            <Lock size={8} />
          </span>
        )}
        {showVersionBadge && (
          <span className="absolute top-1 right-1 px-1 py-0.5 rounded-sm bg-black/70 font-mono text-[8px] text-cyan">
            V{asset.version_number}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] tracking-widest uppercase truncate" style={{ color: folderColor }}>{asset.tag}</span>
        {asset.is_primary && <Star size={9} className="text-amber shrink-0" fill="currentColor" />}
      </div>
      <span className="font-mono text-[8.5px] text-muted truncate">{folderName}</span>
    </div>
  );
}

export function MoodboardCanvas({ assets, folders, onPositionChange, onSelectAsset }: Props) {
  const [view, setView] = useState({ zoom: 1, panX: 24, panY: 24 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  // In-progress drag positions, keyed by asset id — separate from `positions`
  // (which only updates once a drag settles) purely so connector lines can
  // track a card in real time without affecting anything else's render.
  const [liveOverrides, setLiveOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panCatcherRef = useRef<HTMLDivElement>(null);

  const folderColor = (folderId: string) => folders.find((f) => f.id === folderId)?.accent_color ?? "rgba(255,255,255,0.3)";
  const folderName = (folderId: string) => folders.find((f) => f.id === folderId)?.name ?? "";

  // canvas_x/canvas_y are assigned a real grid position at asset-creation time
  // (see cinemaAssets.ts's computeGridPosition), so the stored value can
  // always be trusted directly — no runtime fallback-if-zero heuristic here,
  // which would otherwise be unable to tell "never positioned" apart from
  // "the user dragged it to exactly (0,0)".
  const positionFor = (asset: CinemaAsset) => positions[asset.id] ?? { x: asset.canvas_x, y: asset.canvas_y };
  /** Same as positionFor, but prefers an in-progress drag position — used only
   * by the connector lines so they follow a card while it's being dragged. */
  const livePositionFor = (asset: CinemaAsset) => liveOverrides[asset.id] ?? positionFor(asset);

  const handleAssetLiveMove = (assetId: string, pos: { x: number; y: number } | null) => {
    setLiveOverrides((prev) => {
      if (pos) return { ...prev, [assetId]: pos };
      if (!(assetId in prev)) return prev;
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  };

  const setZoom = (next: number) => setView((v) => ({ ...v, zoom: clamp(next, MIN_ZOOM, MAX_ZOOM) }));

  // Wheel/pinch are fine to bind at the outer canvas level — a card has no
  // wheel handler of its own, so there's nothing for them to conflict with,
  // unlike the drag-to-pan gesture below.
  useGesture(
    {
      // Plain wheel/trackpad scroll pans the canvas (Figma/Miro convention) — it
      // must NOT change zoom, which is the exact bug being fixed here. Ctrl+wheel
      // (trackpad pinch is reported by browsers as ctrl+wheel) is intercepted by
      // the pinch gesture below instead of ever reaching this handler.
      onWheel: ({ delta: [dx, dy], event }) => {
        event.preventDefault();
        setView((v) => ({ ...v, panX: v.panX - dx, panY: v.panY - dy }));
      },
      // Real touch pinch, or ctrl+wheel (trackpad pinch simulated by the browser)
      // — zooms toward the cursor/pinch-center so the point under it stays put,
      // matching Figma. `offset[0]` is the absolute scale, already clamped by
      // scaleBounds below.
      onPinch: ({ offset: [nextZoom], origin: [ox, oy] }) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cursorX = ox - rect.left;
        const cursorY = oy - rect.top;
        setView((v) => {
          const canvasX = (cursorX - v.panX) / v.zoom;
          const canvasY = (cursorY - v.panY) / v.zoom;
          return {
            zoom: nextZoom,
            panX: cursorX - canvasX * nextZoom,
            panY: cursorY - canvasY * nextZoom,
          };
        });
      },
    },
    {
      target: canvasRef,
      eventOptions: { passive: false },
      pinch: { scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM }, from: () => [view.zoom, 0] },
    }
  );

  // Drag-to-pan is bound to a dedicated background element (panCatcherRef)
  // instead of the outer canvas — that element sits behind the cards and,
  // critically, is a *sibling* of the cards layer, not an ancestor of it. A
  // card's own drag can only ever hit elements in its own ancestor chain, so
  // it is now structurally impossible for a card drag to also reach this
  // gesture (previously both were bound to the same canvasRef, and a card's
  // event.stopPropagation() inside its drag handler wasn't reliably winning
  // the race against @use-gesture's own listener registration on the
  // ancestor — the two gestures fired together, panning the whole canvas by
  // roughly the drag distance *in addition to* moving the dragged card,
  // which is what made every thumbnail look like it was moving in lockstep).
  useDrag(
    ({ active, offset: [ox, oy] }) => {
      setPanning(active);
      setView((v) => ({ ...v, panX: ox, panY: oy }));
    },
    {
      target: panCatcherRef,
      filterTaps: true,
      from: () => [view.panX, view.panY],
    }
  );

  const handleAssetDragEnd = (assetId: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [assetId]: { x, y } }));
    onPositionChange(assetId, x, y);
  };

  const handleAssetTap = (assetId: string) => {
    onSelectAsset?.(assetId);
    setLightboxId(assetId);
  };

  // Snaps every asset back into a clean layout — one grid slot per version
  // stack (not per asset), so a stack's siblings stay clustered together
  // instead of scattering across the grid.
  const handleAutoAlign = () => {
    const groups = groupAssetVersions(assets);
    const next: Record<string, { x: number; y: number }> = {};
    groups.forEach((group, groupIndex) => {
      const rootSlot = computeGridPosition(groupIndex);
      group.forEach((asset) => {
        const { x, y } = stackedVersionPosition({ canvas_x: rootSlot.x, canvas_y: rootSlot.y }, asset.version_number);
        next[asset.id] = { x, y };
        onPositionChange(asset.id, x, y);
      });
    });
    setPositions((prev) => ({ ...prev, ...next }));
  };

  const lightboxAsset = assets.find((a) => a.id === lightboxId);
  useShortcut("escape", () => setLightboxId(null), !!lightboxAsset);

  // Version-stack connector lines — one curved segment between each
  // consecutive pair of siblings in a stack, drawn behind the cards. Reads
  // the *live* drag position when a node is being moved, so the curve bends
  // with the card in real time — nodes stay fully independent (dragging one
  // never repositions the other), the line just tracks whichever endpoint is
  // currently moving.
  const versionGroups = groupAssetVersions(assets).filter((group) => group.length > 1);
  const versionedAssetIds = new Set(versionGroups.flatMap((group) => group.map((a) => a.id)));
  const connectorSegments = versionGroups.flatMap((group) =>
    group.slice(1).map((asset, i) => {
      const center = (p: { x: number; y: number }) => ({ x: p.x + CARD_W / 2, y: p.y + CARD_W / 2 });
      const from = center(livePositionFor(group[i]));
      const to = center(livePositionFor(asset));
      return { key: asset.id, path: bezierPath(from, to), from, to };
    })
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={handleAutoAlign}
          disabled={assets.length === 0}
          className="flex items-center gap-1.5 font-mono text-[10px] text-muted hover:text-cyan tracking-widest uppercase transition-precise disabled:opacity-30"
          title="Snap all thumbnails into a clean grid"
        >
          <LayoutGrid size={12} /> Auto-Align
        </button>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setZoom(view.zoom - 0.15)} className="text-muted hover:text-cyan transition-precise" title="Zoom out">
            <Minus size={13} />
          </button>
          <span className="font-mono text-[10px] text-muted w-10 text-center tabular-nums">{Math.round(view.zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(view.zoom + 0.15)} className="text-muted hover:text-cyan transition-precise" title="Zoom in">
            <Plus size={13} />
          </button>
          <button type="button" onClick={() => setView({ zoom: 1, panX: 24, panY: 24 })} className="text-muted hover:text-cyan transition-precise" title="Reset view">
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="relative overflow-hidden rounded-card select-none touch-none"
        style={{ height: 520, border: "var(--border-default)", background: "rgba(0,0,0,0.3)", cursor: panning ? "grabbing" : "grab" }}
      >
        {assets.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-muted">
            No assets yet — create one from a folder to see it here.
          </div>
        ) : (
          <>
            <div ref={panCatcherRef} className="absolute inset-0" />
            <div
              className="absolute top-0 left-0"
              style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`, transformOrigin: "0 0" }}
            >
              {/* A 0×0 SVG relying on overflow:visible to draw its off-box content
                  doesn't reliably paint in this environment (confirmed via live
                  testing — the path has a correct, non-zero bounding rect but
                  nothing is actually painted). Explicit, generously large
                  dimensions fix it; no viewBox means 1 unit stays 1px, so the
                  existing pixel-coordinate paths/circles are unaffected. */}
              <svg className="absolute top-0 left-0 pointer-events-none" width={8000} height={8000}>
                <defs>
                  <filter id="moodboard-connector-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {connectorSegments.map((seg) => (
                  <g key={seg.key} filter="url(#moodboard-connector-glow)">
                    <path d={seg.path} stroke={CONNECTOR_COLOR} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75} />
                    <circle cx={seg.from.x} cy={seg.from.y} r={3} fill={CONNECTOR_COLOR} />
                    <circle cx={seg.to.x} cy={seg.to.y} r={3} fill={CONNECTOR_COLOR} />
                  </g>
                ))}
              </svg>
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  folderColor={folderColor(asset.folder_id)}
                  folderName={folderName(asset.folder_id)}
                  zoom={view.zoom}
                  position={positionFor(asset)}
                  onDragEnd={(x, y) => handleAssetDragEnd(asset.id, x, y)}
                  onTap={() => handleAssetTap(asset.id)}
                  onLiveMove={(pos) => handleAssetLiveMove(asset.id, pos)}
                  showVersionBadge={versionedAssetIds.has(asset.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {lightboxAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "var(--color-black)" }}
          onClick={() => setLightboxId(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxId(null)}
            title="Close (Esc)"
            className="absolute top-16 right-6 flex items-center justify-center w-10 h-10 rounded-full bg-white/8 text-white/70 hover:bg-white/16 hover:text-white transition-precise"
          >
            <X size={18} />
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
