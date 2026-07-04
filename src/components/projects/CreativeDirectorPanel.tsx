import { useCallback, useEffect, useState } from "react";
import { Compass, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pickAvailableModel } from "@/lib/aiConfig";
import {
  clearCreativeStrategy,
  generateCreativeStrategy,
  getCreativeStrategy,
  saveCreativeStrategy,
  type CreativeStrategy,
} from "@/lib/creativeDirectorMode";
import type { Project } from "@/types";

// Creative Director Mode (doc 04 §4) — early project strategy. One structured
// generation, reviewed and saved on the project; the saved strategy feeds
// Direction Studio, Prompt Craft analysis, and the project assistant.

interface CreativeDirectorPanelProps {
  project: Project;
  /** Push strategy fields into the Project Setup form (brief stays untouched). */
  onApplyToSetup: (fields: { visual_direction?: string; creative_goals?: string }) => void;
  /** Saved/cleared strategy JSON — lets the parent keep Direction Studio's context current. */
  onStrategyChanged?: (raw: string | null) => void;
}

function StrategyRow({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[8px] uppercase tracking-widest text-cyan/50 w-24 shrink-0">{label}</span>
      <span className="font-mono text-[11px] text-white/75 leading-relaxed">{text}</span>
    </div>
  );
}

function StrategyBlock({ strategy }: { strategy: CreativeStrategy }) {
  return (
    <div className="flex flex-col gap-2">
      <StrategyRow label="Campaign idea" text={strategy.campaign_idea} />
      <StrategyRow label="Concepts" text={strategy.concepts.join("  ·  ")} />
      <StrategyRow label="Directions" text={strategy.creative_directions.join("  ·  ")} />
      <StrategyRow label="Aesthetics" text={strategy.visual_aesthetics} />
      <StrategyRow label="Brand" text={strategy.brand_connection} />
      <StrategyRow label="Message" text={strategy.product_message} />
      <StrategyRow label="Audience" text={strategy.audience} />
      <StrategyRow label="Execution" text={strategy.execution_direction} />
    </div>
  );
}

export function CreativeDirectorPanel({ project, onApplyToSetup, onStrategyChanged }: CreativeDirectorPanelProps) {
  const [saved, setSaved] = useState<CreativeStrategy | null>(null);
  const [draft, setDraft] = useState<CreativeStrategy | null>(null);
  const [seed, setSeed] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    try {
      setSaved(await getCreativeStrategy(project.id));
    } catch {
      setSaved(null);
    }
  }, [project.id]);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const model = pickAvailableModel();
      if (!model) throw new Error("Add an OpenAI or Anthropic API key in Settings.");
      setDraft(await generateCreativeStrategy(project, model, seed || undefined));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Strategy generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft) return;
    await saveCreativeStrategy(project.id, draft);
    setSaved(draft);
    setDraft(null);
    onStrategyChanged?.(JSON.stringify(draft));
    setNotice("Strategy saved — Direction Studio, Prompt Craft and the assistant now use it.");
  };

  const handleClear = async () => {
    await clearCreativeStrategy(project.id);
    setSaved(null);
    onStrategyChanged?.(null);
    setNotice("");
  };

  const handleApplyToSetup = () => {
    const strategy = saved ?? draft;
    if (!strategy) return;
    onApplyToSetup({
      visual_direction: strategy.visual_aesthetics || undefined,
      creative_goals: [
        strategy.campaign_idea ? `Campaign idea: ${strategy.campaign_idea}` : "",
        strategy.product_message ? `Product message: ${strategy.product_message}` : "",
        strategy.audience ? `Audience: ${strategy.audience}` : "",
        strategy.execution_direction ? `Execution: ${strategy.execution_direction}` : "",
      ].filter(Boolean).join("\n") || undefined,
    });
    setNotice("Strategy applied to the Setup fields — remember to save the project.");
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-card" style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 system-label">
          <Compass size={11} className="text-cyan/70" /> CREATIVE DIRECTOR
        </span>
        {(saved || draft) && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleApplyToSetup}
              className="font-mono text-[8px] tracking-widest uppercase text-cyan/70 hover:text-cyan px-2 py-0.5 rounded-sm transition-precise"
              style={{ border: "1px solid rgba(56,183,200,0.3)" }}>
              Apply to Setup
            </button>
            {saved && !draft && (
              <button type="button" onClick={handleClear} title="Remove the saved strategy"
                className="text-dim/50 hover:text-red transition-precise">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {!saved && !draft && (
        <p className="font-mono text-[10px] text-readable leading-relaxed">
          Set the strategy before you craft. Save it once, and Direction Studio, Prompt Craft, and the assistant all use it.
        </p>
      )}

      {saved && !draft && <StrategyBlock strategy={saved} />}

      {draft && (
        <div className="flex flex-col gap-3 p-3 rounded-sm" style={{ border: "1px solid rgba(56,183,200,0.3)", background: "rgba(56,183,200,0.04)" }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] uppercase tracking-widest text-cyan/70">Proposed strategy — review before saving</span>
            <button type="button" onClick={() => setDraft(null)} className="text-cyan/50 hover:text-white transition-precise">
              <X size={11} />
            </button>
          </div>
          <StrategyBlock strategy={draft} />
          <Button variant="primary" size="sm" onClick={handleSaveDraft} className="self-start">
            Save Strategy
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Optional starting point: what are we selling, to whom, what must the work achieve…"
          className="flex-1 h-9 px-3 rounded-sm bg-dark font-mono text-[11px] text-soft-white placeholder:text-dim focus:outline-none focus:border-cyan/55 transition-precise"
          style={{ border: "1px solid rgba(255,255,255,0.16)" }}
        />
        <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
          <Sparkles size={10} /> {generating ? "Thinking…" : saved || draft ? "Regenerate" : "Generate Strategy"}
        </Button>
      </div>

      {error && <p className="font-mono text-[10px] text-red/80 leading-relaxed">{error}</p>}
      {notice && <p className="font-mono text-[10px] text-cyan/70 leading-relaxed">{notice}</p>}
    </div>
  );
}
