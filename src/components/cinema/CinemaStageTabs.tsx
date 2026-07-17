import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export type CinemaStage = "script" | "assets" | "scenes";

const STAGES: { value: CinemaStage; label: string }[] = [
  { value: "script", label: "Script" },
  { value: "assets", label: "Assets" },
  { value: "scenes", label: "Scenes" },
];

export function CinemaStageTabs({ projectId, active }: { projectId: string; active: CinemaStage }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => navigate(`/cinema-studio/${projectId}/${s.value}`)}
          className={cn(
            "h-8 px-4 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise border",
            active === s.value
              ? "text-cyan border-cyan/55 bg-cyan/10"
              : "text-readable border-white/14 hover:text-white hover:border-white/30"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
