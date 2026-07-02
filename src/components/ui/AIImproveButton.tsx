import { useState } from "react";
import { Sparkles } from "lucide-react";
import { getConnectedModels, pickAvailableModel } from "@/lib/aiConfig";
import { improveProjectField } from "@/lib/fieldImprovement";
import { toast } from "@/lib/toast";

/** AI "Improve" action with a model picker — only shows connected (valid-key) models, defaults to the cheapest OpenAI model. */
export function AIImproveButton({ value, fieldName, projectTitle, projectContext, onImproved, disabled, fallbackValue }: {
  value: string;
  fieldName: string;
  projectTitle: string;
  projectContext?: string;
  onImproved: (v: string) => void;
  /** Overrides the default "disabled unless value is non-empty" check (e.g. avoidance text is fine to generate from empty). */
  disabled?: boolean;
  /** Sent to the AI instead of an empty value, when value.trim() is empty but disabled=false. */
  fallbackValue?: string;
}) {
  const connectedModels = getConnectedModels();
  const [modelId, setModelId] = useState(() => pickAvailableModel()?.id ?? connectedModels[0]?.id);
  const [improving, setImproving] = useState(false);

  if (connectedModels.length === 0) return null;

  const model = connectedModels.find((m) => m.id === modelId) ?? connectedModels[0];
  const isDisabled = disabled ?? !value.trim();

  const handleImprove = async () => {
    if (isDisabled || improving) return;
    setImproving(true);
    try {
      const currentValue = value.trim() ? value : (fallbackValue ?? value);
      const improved = await improveProjectField({ fieldName, currentValue, projectTitle, context: projectContext, model });
      onImproved(improved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setImproving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {connectedModels.length > 1 && (
        <select
          value={model.id}
          onChange={(e) => setModelId(e.target.value)}
          className="h-7 px-2 rounded-sm bg-dark font-mono text-[10px] text-readable focus:outline-none"
          style={{ border: "var(--border-default)" }}
          title="Model"
        >
          {connectedModels.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={handleImprove}
        disabled={improving || isDisabled}
        className="flex items-center gap-1 h-7 px-2.5 rounded-sm font-mono text-[10px] text-cyan border border-cyan/30 hover:bg-cyan/10 disabled:opacity-40 transition-precise"
        title={`Improve ${fieldName} with AI`}
      >
        <Sparkles size={9} />
        {improving ? "Improving…" : "Improve"}
      </button>
    </div>
  );
}
