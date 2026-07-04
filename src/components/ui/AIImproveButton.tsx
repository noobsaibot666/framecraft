import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { getConnectedModels, pickAvailableModel } from "@/lib/aiConfig";
import { improveProjectField } from "@/lib/fieldImprovement";
import { toast } from "@/lib/toast";

/** AI "Improve" action — opens a modal asking what to change, then rewrites the field with that instruction. */
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
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (connectedModels.length === 0) return null;

  const model = connectedModels.find((m) => m.id === modelId) ?? connectedModels[0];
  const isDisabled = disabled ?? !value.trim();

  const handleConfirm = async () => {
    if (improving) return;
    setImproving(true);
    try {
      const currentValue = value.trim() ? value : (fallbackValue ?? value);
      const improved = await improveProjectField({
        fieldName, currentValue, projectTitle, context: projectContext, model,
        instruction: instruction.trim() || undefined,
      });
      onImproved(improved);
      setOpen(false);
      setInstruction("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setImproving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        className="flex items-center gap-1 h-7 px-2.5 rounded-sm font-mono text-[10px] text-cyan border border-cyan/30 hover:bg-cyan/10 disabled:opacity-40 transition-precise"
        title={`Improve ${fieldName} with AI`}
      >
        <Sparkles size={9} />
        Improve
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.72)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !improving) setOpen(false); }}
        >
          <div className="flex flex-col w-full max-w-md rounded-card overflow-hidden"
            style={{ background: "var(--color-panel)", border: "var(--border-default)" }}>
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "var(--border-default)" }}>
              <span className="flex items-center gap-1.5 system-label text-soft-white">
                <Sparkles size={11} className="text-cyan/70" /> Improve {fieldName}
              </span>
              <button type="button" onClick={() => setOpen(false)} disabled={improving} className="text-dim/50 hover:text-white transition-precise disabled:opacity-40">
                <X size={13} />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] leading-relaxed text-readable">
                What should change? Tell the AI what to enhance, fix, or rework.
              </span>
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleConfirm(); }}
                placeholder="e.g. make it punchier, shorten it, focus more on the audience…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-sm bg-black/20 font-mono text-[12px] leading-relaxed text-soft-white placeholder:text-dim resize-none focus:outline-none"
                style={{ border: "var(--border-default)" }}
              />

              {connectedModels.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-dim/60">Model</span>
                  <select
                    value={model.id}
                    onChange={(e) => setModelId(e.target.value)}
                    className="h-8 px-2 rounded-sm bg-dark font-mono text-[11px] text-readable focus:outline-none"
                    style={{ border: "var(--border-default)" }}
                  >
                    {connectedModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "var(--border-default)" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={improving}
                className="font-mono text-[10px] tracking-widest uppercase text-dim/60 hover:text-white transition-precise px-3 py-2 rounded-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={improving}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-cyan border border-cyan/30 hover:bg-cyan/10 disabled:opacity-40 transition-precise px-3 py-2 rounded-sm"
              >
                <Sparkles size={10} /> {improving ? "Improving…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
