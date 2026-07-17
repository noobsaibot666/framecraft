import { Compass } from "lucide-react";
import { getCreativeHints } from "@/lib/cinemaCreativeHints";

export function CreativeHintsPanel({ mood }: { mood?: string }) {
  const groups = getCreativeHints(mood);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center gap-2">
        <Compass size={12} className="text-cyan" />
        <span className="system-label text-[11px]">CREATIVE HINTS{mood ? ` · ${mood.toUpperCase()}` : ""}</span>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <span className="font-mono text-[9.5px] text-cyan tracking-widest uppercase">{group.label}</span>
          <ul className="flex flex-col gap-1">
            {group.hints.map((hint, i) => (
              <li key={i} className="font-mono text-[11px] text-readable leading-relaxed flex gap-2">
                <span className="text-cyan/60 shrink-0">·</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
