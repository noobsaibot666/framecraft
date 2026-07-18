import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { getProTips, type CinemaStageKey } from "@/lib/videoProviderCapabilities";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";

interface Props {
  stage: CinemaStageKey;
  provider?: Provider;
  title?: string;
}

/** Compact icon-only trigger — opens the tip list on hover or click, closes on hover-out/click-away. */
export function ProTipPanel({ stage, provider, title = "PRO TIPS" }: Props) {
  const tips = getProTips(stage, provider);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);

  if (tips.length === 0) return null;

  const openPanel = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setOpen(true);
  };
  // Debounced close — tolerates the small visual gap between the icon and the
  // popover below it without the panel flickering shut as the mouse crosses it.
  const scheduleClose = () => {
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <div className="relative" onMouseEnter={openPanel} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        className={cn(
          "flex items-center justify-center h-8 w-8 rounded-sm border transition-precise",
          open ? "text-amber border-amber/55 bg-amber/10" : "text-muted border-white/14 hover:text-amber hover:border-amber/40"
        )}
      >
        <Lightbulb size={13} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-40 flex flex-col gap-3 p-4 rounded-card w-80"
          style={{ border: "var(--border-default)", background: "var(--surface-card)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={12} className="text-amber" />
            <span className="system-label text-[11px]">{title}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <li key={i} className="font-mono text-[11.5px] text-readable leading-relaxed flex gap-2">
                <span className="text-amber/70 shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
