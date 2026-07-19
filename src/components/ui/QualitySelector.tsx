import { AI_QUALITIES, type AIQuality } from "@/lib/aiConfig";
import { cn } from "@/lib/utils";

/**
 * Small inline response-quality switcher — the model-independent depth dial
 * (see aiConfig.ts's AIQuality). Unlike ModelSelector, this never hides
 * itself: quality applies regardless of how many models are connected.
 */
export function QualitySelector({ value, onChange, className }: {
  value: AIQuality;
  onChange: (quality: AIQuality) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AIQuality)}
      title="Response quality"
      className={cn(
        "h-7 px-2 rounded-sm bg-dark font-mono text-[10px] text-readable focus:outline-none",
        className
      )}
      style={{ border: "var(--border-default)" }}
    >
      {AI_QUALITIES.map((q) => (
        <option key={q.id} value={q.id} title={q.description}>{q.label}</option>
      ))}
    </select>
  );
}
