import { useNavigate } from "react-router-dom";
import { Check, Clapperboard, ChevronRight, FileText, Image } from "lucide-react";
import { cn } from "@/lib/utils";

export type CinemaStage = "script" | "assets" | "scenes";

const STAGES: { value: CinemaStage; label: string; icon: typeof FileText }[] = [
  { value: "script", label: "Script", icon: FileText },
  { value: "assets", label: "Assets", icon: Image },
  { value: "scenes", label: "Scenes", icon: Clapperboard },
];

export function CinemaStageTabs({ projectId, active, nextStage }: {
  projectId: string;
  active: CinemaStage;
  /** Highlighted in accent color as a "go here next" cue — e.g. Assets right after Script is approved. */
  nextStage?: CinemaStage;
}) {
  const navigate = useNavigate();
  const activeIndex = STAGES.findIndex((s) => s.value === active);

  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => {
        const isActive = s.value === active;
        const isNext = nextStage === s.value;
        const isDone = i < activeIndex;
        const Icon = s.icon;
        return (
          <div key={s.value} className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(`/cinema-studio/${projectId}/${s.value}`)}
              className={cn(
                "flex items-center gap-2 h-8 pl-2 pr-3.5 rounded-sm font-mono text-[10px] tracking-widest uppercase transition-precise border",
                isActive
                  ? "text-cyan border-cyan/55 bg-cyan/10"
                  : isNext
                    ? "text-amber border-amber/60 bg-amber/12 hover:bg-amber/18"
                    : isDone
                      ? "text-readable border-white/20 hover:text-white hover:border-white/35"
                      : "text-dim/60 border-white/10 hover:text-readable hover:border-white/25"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-4 h-4 rounded-full shrink-0 font-mono text-[8.5px]",
                  isActive ? "bg-cyan/20 text-cyan" : isNext ? "bg-amber/20 text-amber" : isDone ? "bg-white/12 text-readable" : "bg-white/6 text-dim/60"
                )}
              >
                {isDone ? <Check size={9} /> : i + 1}
              </span>
              <Icon size={12} />
              {s.label}
            </button>
            {i < STAGES.length - 1 && (
              <ChevronRight size={12} className="text-dim/30 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
