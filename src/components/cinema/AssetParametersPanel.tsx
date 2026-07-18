// A compact "mini Prompt Creator" parameters editor for Cinema Studio's
// asset composer — same field set and DB shape as the main Prompt Craft
// page's PARAMETERS panel (src/lib/providerParameters.ts is the shared
// source of truth), but starting collapsed to a few core fields with a "+"
// to reveal the rest, since this panel lives inside a much smaller card.
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import {
  CORE_PARAM_FIELDS,
  DALLE_QUALITY_OPTS,
  DALLE_SIZES,
  DALLE_STYLE_OPTS,
  EMPTY_DALLE,
  EMPTY_MJ,
  EMPTY_SD,
  MJ_QUALITY,
  MJ_STYLE,
  MJ_VERSIONS,
  SD_SAMPLERS,
  STRUCTURED_PARAM_PROVIDERS,
  buildProviderParameters,
  restoreDalleParams,
  restoreMJParams,
  restoreSDParams,
  type DalleParams,
  type MJParams,
  type SDParams,
} from "@/lib/providerParameters";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";

interface Props {
  provider: Provider;
  parameters: Record<string, string | boolean> | undefined;
  onChange: (parameters: Record<string, string | boolean> | undefined) => void;
}

function MiniSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 font-mono text-[11px] text-white bg-dark rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MiniInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] text-muted tracking-widest uppercase">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 px-2 font-mono text-[11px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none"
        style={{ border: "1px solid rgba(255,255,255,0.16)" }}
      />
    </div>
  );
}

function MiniCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-cyan w-3 h-3" />
      <span className="font-mono text-[10px] text-readable">{label}</span>
    </label>
  );
}

function MJFields({ p, set, expanded }: { p: MJParams; set: (k: keyof MJParams, v: string | boolean) => void; expanded: boolean }) {
  return (
    <>
      <MiniSelect label="VERSION --v" value={p.model_version} onChange={(v) => set("model_version", v)} options={MJ_VERSIONS} />
      <MiniInput label="STYLIZE --s" value={p.stylize} onChange={(v) => set("stylize", v)} placeholder="250" />
      <MiniInput label="CHAOS --c" value={p.chaos} onChange={(v) => set("chaos", v)} placeholder="0" />
      <MiniInput label="SEED --seed" value={p.seed} onChange={(v) => set("seed", v)} placeholder="random" />
      {expanded && (
        <>
          <MiniSelect label="QUALITY --q" value={p.quality} onChange={(v) => set("quality", v)} options={MJ_QUALITY} />
          <MiniInput label="WEIRD --w" value={p.weird} onChange={(v) => set("weird", v)} placeholder="0" />
          <MiniSelect label="STYLE --style" value={p.style} onChange={(v) => set("style", v)} options={MJ_STYLE} />
          <MiniInput label="STYLE WEIGHT --sw" value={p.sw} onChange={(v) => set("sw", v)} placeholder="100" />
          <MiniInput label="STYLE VERSION --sv" value={p.sv} onChange={(v) => set("sv", v)} placeholder="4" />
          <MiniInput label="ZOOM --zoom" value={p.zoom} onChange={(v) => set("zoom", v)} placeholder="1.5" />
          <MiniInput label="STOP --stop" value={p.stop} onChange={(v) => set("stop", v)} placeholder="80" />
          <MiniInput label="REPEAT --repeat" value={p.repeat} onChange={(v) => set("repeat", v)} placeholder="4" />
          <MiniInput label="NEGATIVE --no" value={p.no_prompt} onChange={(v) => set("no_prompt", v)} placeholder="text, blur" />
          <div className="col-span-2 grid grid-cols-3 gap-x-3 gap-y-1.5 pt-1">
            <MiniCheckbox label="--raw" checked={p.raw} onChange={(v) => set("raw", v)} />
            <MiniCheckbox label="--hd" checked={p.hd} onChange={(v) => set("hd", v)} />
            <MiniCheckbox label="--tile" checked={p.tile} onChange={(v) => set("tile", v)} />
            <MiniCheckbox label="--fast" checked={p.fast} onChange={(v) => set("fast", v)} />
            <MiniCheckbox label="--relax" checked={p.relax} onChange={(v) => set("relax", v)} />
            <MiniCheckbox label="-exp" checked={p.exp} onChange={(v) => set("exp", v)} />
          </div>
        </>
      )}
    </>
  );
}

function DalleFields({ p, set }: { p: DalleParams; set: (k: keyof DalleParams, v: string) => void }) {
  return (
    <>
      <MiniSelect label="SIZE" value={p.size} onChange={(v) => set("size", v)} options={DALLE_SIZES} />
      <MiniSelect label="QUALITY" value={p.quality} onChange={(v) => set("quality", v)} options={DALLE_QUALITY_OPTS} />
      <MiniSelect label="STYLE" value={p.style} onChange={(v) => set("style", v)} options={DALLE_STYLE_OPTS} />
    </>
  );
}

function SDFields({ p, set, expanded }: { p: SDParams; set: (k: keyof SDParams, v: string) => void; expanded: boolean }) {
  return (
    <>
      <MiniInput label="STEPS" value={p.steps} onChange={(v) => set("steps", v)} placeholder="30" />
      <MiniInput label="CFG SCALE" value={p.cfg_scale} onChange={(v) => set("cfg_scale", v)} placeholder="7" />
      <MiniSelect label="SAMPLER" value={p.sampler} onChange={(v) => set("sampler", v)} options={SD_SAMPLERS} />
      {expanded && (
        <>
          <MiniInput label="SEED" value={p.seed} onChange={(v) => set("seed", v)} placeholder="-1 (random)" />
          <div className="col-span-2 flex flex-col gap-1">
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase">NEGATIVE PROMPT</span>
            <textarea
              value={p.negative_prompt}
              onChange={(e) => set("negative_prompt", e.target.value)}
              placeholder="ugly, bad anatomy, blurry…"
              rows={2}
              className="px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-dim bg-transparent rounded-sm focus:outline-none resize-none"
              style={{ border: "1px solid rgba(255,255,255,0.16)" }}
            />
          </div>
        </>
      )}
    </>
  );
}

export function AssetParametersPanel({ provider, parameters, onChange }: Props) {
  const [mj, setMj] = useState<MJParams>(() => ({ ...EMPTY_MJ, ...restoreMJParams(parameters ?? {}) }));
  const [dalle, setDalle] = useState<DalleParams>(() => ({ ...EMPTY_DALLE, ...restoreDalleParams(parameters ?? {}) }));
  const [sd, setSd] = useState<SDParams>(() => ({ ...EMPTY_SD, ...restoreSDParams(parameters ?? {}) }));
  const [expanded, setExpanded] = useState(false);

  if (!STRUCTURED_PARAM_PROVIDERS.includes(provider)) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="system-label">PARAMETERS</label>
        <span className="font-mono text-[10.5px] text-dim/60 leading-relaxed">
          No structured parameters for this provider — everything lives in the prompt text above.
        </span>
      </div>
    );
  }

  const setMJ = (k: keyof MJParams, v: string | boolean) => {
    const next = { ...mj, [k]: v };
    setMj(next);
    onChange(buildProviderParameters(provider, next, dalle, sd));
  };
  const setDalleField = (k: keyof DalleParams, v: string) => {
    const next = { ...dalle, [k]: v };
    setDalle(next);
    onChange(buildProviderParameters(provider, mj, next, sd));
  };
  const setSDField = (k: keyof SDParams, v: string) => {
    const next = { ...sd, [k]: v };
    setSd(next);
    onChange(buildProviderParameters(provider, mj, dalle, next));
  };

  const canExpand = (CORE_PARAM_FIELDS[provider]?.length ?? 0) > 0 && provider !== "dalle";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="system-label">PARAMETERS</label>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex items-center gap-1 font-mono text-[9.5px] tracking-widest uppercase transition-precise",
              expanded ? "text-cyan" : "text-muted hover:text-cyan"
            )}
          >
            {expanded ? <Minus size={10} /> : <Plus size={10} />} {expanded ? "Fewer fields" : "More fields"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {provider === "midjourney" && <MJFields p={mj} set={setMJ} expanded={expanded} />}
        {provider === "dalle" && <DalleFields p={dalle} set={setDalleField} />}
        {provider === "stable_diffusion" && <SDFields p={sd} set={setSDField} expanded={expanded} />}
      </div>
    </div>
  );
}
