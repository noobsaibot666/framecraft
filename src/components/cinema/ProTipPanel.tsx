import { Lightbulb } from "lucide-react";
import { getProTips, type CinemaStageKey } from "@/lib/videoProviderCapabilities";
import type { Provider } from "@/types";

interface Props {
  stage: CinemaStageKey;
  provider?: Provider;
  title?: string;
}

export function ProTipPanel({ stage, provider, title = "PRO TIPS" }: Props) {
  const tips = getProTips(stage, provider);
  if (tips.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-card"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}
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
  );
}
