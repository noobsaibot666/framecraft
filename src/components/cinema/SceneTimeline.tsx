import { useNavigate } from "react-router-dom";
import { accentColorForIndex } from "@/lib/storytelling";
import { cn } from "@/lib/utils";
import type { CinemaScene } from "@/types";

function WaveformBlock({ shotCount, color }: { shotCount: number; color: string }) {
  const bars = Math.max(shotCount, 6);
  return (
    <div className="flex items-end gap-[2px] h-full w-full px-2 py-2">
      {Array.from({ length: bars }, (_, i) => {
        const h = 20 + ((i * 37) % 60);
        return <div key={i} className="flex-1 rounded-[1px]" style={{ height: `${h}%`, background: `${color}88` }} />;
      })}
    </div>
  );
}

export function SceneTimeline({ projectId, scenes }: { projectId: string; scenes: CinemaScene[] }) {
  const navigate = useNavigate();

  if (scenes.length === 0) {
    return (
      <span className="font-mono text-[12px] text-muted">No scenes yet — split the script or add one manually.</span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="system-label text-[11px]">PROJECT TIMELINE</span>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-fit">
          {scenes.map((scene, index) => {
            const color = accentColorForIndex(scene.accent_index ?? index);
            const shotCount = scene.shot_count ?? 0;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => navigate(`/cinema-studio/${projectId}/scenes/${scene.id}`)}
                className="flex flex-col gap-2 shrink-0 w-44 text-left group"
              >
                <div
                  className="h-16 rounded-sm flex overflow-hidden transition-precise group-hover:brightness-110"
                  style={{ background: `${color}22`, border: `1px solid ${color}66` }}
                >
                  {shotCount > 0 ? (
                    Array.from({ length: shotCount }, (_, i) => (
                      <div key={i} className="flex-1 flex items-center justify-center" style={{ borderRight: i < shotCount - 1 ? `1px solid ${color}44` : undefined }}>
                        <span className="font-mono text-[9px]" style={{ color }}>{i + 1}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color }}>{scene.title}</span>
                    </div>
                  )}
                </div>
                <div className="h-10 rounded-sm overflow-hidden" style={{ background: `${color}14`, border: `1px solid ${color}33` }}>
                  <WaveformBlock shotCount={shotCount} color={color} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-sans text-[12px] text-white truncate")}>{scene.title}</span>
                  <div className="flex items-center gap-2">
                    {scene.mood && <span className="font-mono text-[8.5px] tracking-widest uppercase" style={{ color }}>{scene.mood}</span>}
                    <span className="font-mono text-[8.5px] text-muted">{shotCount} shot{shotCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
