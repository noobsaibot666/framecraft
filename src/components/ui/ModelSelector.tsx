import { getConnectedModels, providerLabel } from "@/lib/aiConfig";
import { cn } from "@/lib/utils";

/**
 * Small inline AI model switcher. Renders nothing when 0 or 1 model is
 * connected — with only one option there's nothing to switch between.
 * Grouped by provider so within a provider it reads flagship → cheapest,
 * matching AI_MODELS' declared order.
 */
export function ModelSelector({ value, onChange, className }: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const connectedModels = getConnectedModels();
  if (connectedModels.length <= 1) return null;

  const selected = connectedModels.some((m) => m.id === value) ? value : connectedModels[0].id;

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      title="AI model"
      className={cn(
        "h-7 px-2 rounded-sm bg-dark font-mono text-[10px] text-readable focus:outline-none",
        className
      )}
      style={{ border: "var(--border-default)" }}
    >
      {(["anthropic", "openai", "deepseek"] as const).map((provider) => {
        const models = connectedModels.filter((m) => m.provider === provider);
        if (models.length === 0) return null;
        return (
          <optgroup key={provider} label={providerLabel(provider)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
