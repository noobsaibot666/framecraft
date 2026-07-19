// Shared provider-specific structured-parameter model, extracted from
// CraftPrompt.tsx (audit doc 05 §1) so Cinema Studio's asset composer can
// offer the same field set / DB shape instead of re-deriving it. CraftPrompt.tsx
// re-exports these names so its own imports and existing tests are unaffected.
import type { Provider } from "@/types";

export interface MJParams {
  aspect_ratio: string; model_version: string; quality: string;
  stylize: string; chaos: string; weird: string; stop: string; repeat: string;
  seed: string; zoom: string; style: string; sw: string; sv: string;
  sref_code: string; profile: string; no_prompt: string;
  raw: boolean; hd: boolean; tile: boolean; fast: boolean; relax: boolean; exp: boolean;
}
export interface DalleParams { size: string; quality: string; style: string; }
export interface SDParams { steps: string; cfg_scale: string; sampler: string; negative_prompt: string; seed: string; }

export const EMPTY_MJ: MJParams = {
  aspect_ratio: "", model_version: "", quality: "",
  stylize: "", chaos: "", weird: "", stop: "", repeat: "",
  seed: "", zoom: "", style: "", sw: "", sv: "",
  sref_code: "", profile: "", no_prompt: "",
  raw: false, hd: false, tile: false, fast: false, relax: false, exp: false,
};
export const EMPTY_DALLE: DalleParams = { size: "", quality: "", style: "" };
export const EMPTY_SD: SDParams = { steps: "", cfg_scale: "", sampler: "", negative_prompt: "", seed: "" };

/** Build the `parameters` DB column for the given provider. Pure. */
export function buildProviderParameters(
  provider: Provider,
  mj: MJParams,
  dalle: DalleParams,
  sd: SDParams
): Record<string, string | boolean> | undefined {
  if (provider === "midjourney") {
    const pp: Record<string, string | boolean> = {};
    if (mj.profile)   pp.profile  = mj.profile;
    if (mj.stylize)   pp.stylize  = mj.stylize;
    if (mj.chaos)     pp.chaos    = mj.chaos;
    if (mj.weird)     pp.weird    = mj.weird;
    if (mj.quality)   pp.quality  = mj.quality;
    if (mj.style)     pp.style    = mj.style;
    if (mj.sw)        pp.sw       = mj.sw;
    if (mj.sv)        pp.sv       = mj.sv;
    if (mj.seed)      pp.seed     = mj.seed;
    if (mj.zoom)      pp.zoom     = mj.zoom;
    if (mj.stop)      pp.stop     = mj.stop;
    if (mj.repeat)    pp.repeat   = mj.repeat;
    if (mj.no_prompt) pp.no       = mj.no_prompt;
    if (mj.raw)       pp.raw      = true;
    if (mj.hd)        pp.hd       = true;
    if (mj.tile)      pp.tile     = true;
    if (mj.fast)      pp.fast     = true;
    if (mj.relax)     pp.relax    = true;
    if (mj.exp)       pp.exp      = true;
    return Object.keys(pp).length ? pp : undefined;
  }
  if (provider === "dalle") {
    const pp: Record<string, string | boolean> = {};
    if (dalle.size)    pp.size    = dalle.size;
    if (dalle.quality) pp.quality = dalle.quality;
    if (dalle.style)   pp.style   = dalle.style;
    return Object.keys(pp).length ? pp : undefined;
  }
  if (provider === "stable_diffusion") {
    const pp: Record<string, string | boolean> = {};
    if (sd.steps)           pp.steps           = sd.steps;
    if (sd.cfg_scale)       pp.cfg_scale       = sd.cfg_scale;
    if (sd.sampler)         pp.sampler         = sd.sampler;
    if (sd.seed)            pp.seed            = sd.seed;
    if (sd.negative_prompt) pp.negative_prompt = sd.negative_prompt;
    return Object.keys(pp).length ? pp : undefined;
  }
  return undefined;
}

/** Restore MJParams/DalleParams/SDParams from a loaded `parameters` column. Pure. */
export function restoreMJParams(pp: Record<string, unknown>): MJParams {
  return {
    aspect_ratio: "",
    model_version: "",
    quality:    String(pp.quality    ?? ""),
    stylize:    String(pp.stylize    ?? ""),
    chaos:      String(pp.chaos      ?? ""),
    weird:      String(pp.weird      ?? ""),
    stop:       String(pp.stop       ?? ""),
    repeat:     String(pp.repeat     ?? ""),
    seed:       String(pp.seed       ?? ""),
    zoom:       String(pp.zoom       ?? ""),
    style:      String(pp.style      ?? ""),
    sw:         String(pp.sw         ?? ""),
    sv:         String(pp.sv         ?? ""),
    sref_code:  "",
    profile:    String(pp.profile    ?? ""),
    no_prompt:  String(pp.no         ?? ""),
    raw:   Boolean(pp.raw),
    hd:    Boolean(pp.hd),
    tile:  Boolean(pp.tile),
    fast:  Boolean(pp.fast),
    relax: Boolean(pp.relax),
    exp:   Boolean(pp.exp),
  };
}
/**
 * Reads `--flag value` / `--flag` pairs directly out of raw Midjourney
 * prompt text (typed or pasted straight from Discord/another tool) and
 * returns just the fields it actually found — never a full MJParams object,
 * so callers can merge onto existing state without wiping fields the text
 * doesn't mention. Accepts both short (`--s`) and long (`--stylize`) forms
 * where Midjourney supports both; `\s+` right after the short form keeps
 * `--s 250` from also matching inside `--style`/`--sw`/`--sv`/`--stop`.
 */
export function extractMJParamsFromText(text: string): Partial<MJParams> {
  const result: Partial<MJParams> = {};
  const value = (re: RegExp) => text.match(re)?.[1];
  const has = (re: RegExp) => re.test(text);

  const v = value(/--v(?:ersion)?\s+(\S+)/i); if (v) result.model_version = v;
  const q = value(/--q(?:uality)?\s+(\S+)/i); if (q) result.quality = q;
  const s = value(/--s(?:tylize)?\s+(\d+)/i); if (s) result.stylize = s;
  const c = value(/--c(?:haos)?\s+(\d+)/i); if (c) result.chaos = c;
  const w = value(/--w(?:eird)?\s+(\d+)/i); if (w) result.weird = w;
  const style = value(/--style\s+(\S+)/i); if (style) result.style = style;
  const sw = value(/--sw\s+(\d+)/i); if (sw) result.sw = sw;
  const sv = value(/--sv\s+(\d+)/i); if (sv) result.sv = sv;
  const seed = value(/--seed\s+(\d+)/i); if (seed) result.seed = seed;
  const zoom = value(/--zoom\s+([\d.]+)/i); if (zoom) result.zoom = zoom;
  const stop = value(/--stop\s+(\d+)/i); if (stop) result.stop = stop;
  const repeat = value(/--repeat\s+(\d+)/i); if (repeat) result.repeat = repeat;
  const no = value(/--no\s+([^-]+?)(?=\s+--|-{1,2}exp\b|\s*$)/i); if (no?.trim()) result.no_prompt = no.trim();

  if (has(/--raw\b/i)) result.raw = true;
  if (has(/--hd\b/i)) result.hd = true;
  if (has(/--tile\b/i)) result.tile = true;
  if (has(/--fast\b/i)) result.fast = true;
  if (has(/--relax\b/i)) result.relax = true;
  if (has(/-{1,2}exp\b/i)) result.exp = true;

  return result;
}

export function restoreDalleParams(pp: Record<string, unknown>): DalleParams {
  return {
    size:    String(pp.size    ?? ""),
    quality: String(pp.quality ?? ""),
    style:   String(pp.style   ?? ""),
  };
}
export function restoreSDParams(pp: Record<string, unknown>): SDParams {
  return {
    steps:           String(pp.steps           ?? ""),
    cfg_scale:       String(pp.cfg_scale        ?? ""),
    sampler:         String(pp.sampler          ?? ""),
    seed:            String(pp.seed             ?? ""),
    negative_prompt: String(pp.negative_prompt  ?? ""),
  };
}

export const MJ_VERSIONS = [
  { value: "", label: "Default" },
  { value: "8.1", label: "v8.1 (latest)" },
  { value: "8", label: "v8" },
  { value: "7", label: "v7" },
  { value: "6.1", label: "v6.1" },
  { value: "6", label: "v6" },
  { value: "5.2", label: "v5.2" },
  { value: "niji 7", label: "Niji 7" },
  { value: "niji 6", label: "Niji 6" },
];

export const MJ_QUALITY = [
  { value: "", label: "Default (1)" },
  { value: "1", label: "1 — Standard" },
  { value: ".5", label: ".5 — Half" },
  { value: ".25", label: ".25 — Quarter" },
  { value: "2", label: "2 — Double (v5 only)" },
];

export const MJ_STYLE = [
  { value: "", label: "Default" },
  { value: "raw", label: "raw" },
  { value: "cute", label: "cute (Niji)" },
  { value: "expressive", label: "expressive (Niji)" },
  { value: "original", label: "original (Niji)" },
  { value: "scenic", label: "scenic (Niji)" },
];

export const DALLE_SIZES = [
  { value: "", label: "Default" },
  { value: "1024x1024", label: "1024×1024 — Square" },
  { value: "1792x1024", label: "1792×1024 — Landscape" },
  { value: "1024x1792", label: "1024×1792 — Portrait" },
];

export const DALLE_QUALITY_OPTS = [
  { value: "", label: "Standard" },
  { value: "hd", label: "HD" },
];

export const DALLE_STYLE_OPTS = [
  { value: "", label: "Vivid" },
  { value: "natural", label: "Natural" },
];

export const SD_SAMPLERS = [
  { value: "", label: "Default" },
  { value: "Euler a", label: "Euler a" },
  { value: "DPM++ 2M Karras", label: "DPM++ 2M Karras" },
  { value: "DDIM", label: "DDIM" },
  { value: "UniPC", label: "UniPC" },
  { value: "LMS", label: "LMS" },
];

/**
 * The provider families that have a structured `parameters` shape at all
 * (mirrors buildProviderParameters's provider switch) — everything else has
 * no fields to render in a parameter panel, only free-form prompt text.
 */
export const STRUCTURED_PARAM_PROVIDERS: Provider[] = ["midjourney", "dalle", "stable_diffusion"];

/**
 * Minimal starter field set per provider for a "core fields first, expand
 * for more" editor — CraftPrompt's own panel has no such split (it always
 * renders every field), so this is new, introduced specifically for Cinema
 * Studio's compact asset composer.
 */
export const CORE_PARAM_FIELDS: Partial<Record<Provider, string[]>> = {
  midjourney: ["model_version", "stylize", "chaos", "seed"],
  dalle: ["size", "quality", "style"],
  stable_diffusion: ["steps", "cfg_scale", "sampler"],
};

export const IMAGE_PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "nano_banana", label: "Nano Banana Pro" },
  { value: "gpt_image", label: "GPT Image 2" },
  { value: "midjourney", label: "Midjourney" },
  { value: "flux", label: "Flux" },
  { value: "ideogram", label: "Ideogram" },
  { value: "dalle", label: "DALL-E" },
  { value: "stable_diffusion", label: "Stable Diffusion" },
];

export const VIDEO_PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "seedance", label: "Seedance" },
  { value: "kling", label: "Kling" },
  { value: "runway", label: "Runway" },
  { value: "higgsfield", label: "Higgsfield" },
];

/** Simplified `--flag value` appender for a formatted-copy preview — unlike
 * CraftPrompt's appendMJParams, this has no dependency on the full builder
 * Fields type (aspect ratio / avoidance text aren't part of a Cinema Studio
 * asset's model). */
export function appendMJParamsForCopy(promptText: string, mj: MJParams): string {
  let out = promptText;
  if (mj.model_version) out += ` --v ${mj.model_version}`;
  if (mj.quality)       out += ` --q ${mj.quality}`;
  if (mj.stylize)       out += ` --s ${mj.stylize}`;
  if (mj.chaos)         out += ` --c ${mj.chaos}`;
  if (mj.weird)         out += ` --w ${mj.weird}`;
  if (mj.style)         out += ` --style ${mj.style}`;
  if (mj.sw)            out += ` --sw ${mj.sw}`;
  if (mj.sv)            out += ` --sv ${mj.sv}`;
  if (mj.seed)          out += ` --seed ${mj.seed}`;
  if (mj.zoom)          out += ` --zoom ${mj.zoom}`;
  if (mj.stop)          out += ` --stop ${mj.stop}`;
  if (mj.repeat)        out += ` --repeat ${mj.repeat}`;
  if (mj.sref_code)     out += ` --sref ${mj.sref_code}`;
  if (mj.profile)       out += ` --profile ${mj.profile}`;
  if (mj.no_prompt)     out += ` --no ${mj.no_prompt}`;
  if (mj.raw)           out += ` --raw`;
  if (mj.hd)            out += ` --hd`;
  if (mj.tile)          out += ` --tile`;
  if (mj.fast)          out += ` --fast`;
  if (mj.relax)         out += ` --relax`;
  if (mj.exp)           out += ` -exp`;
  return out;
}

export function appendDalleParamsForCopy(promptText: string, dalle: DalleParams): string {
  let out = promptText;
  if (dalle.size)    out += ` [size: ${dalle.size}]`;
  if (dalle.quality) out += ` [quality: ${dalle.quality}]`;
  if (dalle.style)   out += ` [style: ${dalle.style}]`;
  return out;
}

/** Formats the finished prompt text with any structured parameters baked in
 * as provider-native flags, for a one-click "copy the ready-to-paste prompt"
 * action. */
export function formatPromptWithParameters(
  provider: Provider,
  promptText: string,
  parameters: Record<string, string | boolean> | undefined
): string {
  if (!parameters) return promptText;
  if (provider === "midjourney") return appendMJParamsForCopy(promptText, restoreMJParams(parameters));
  if (provider === "dalle") return appendDalleParamsForCopy(promptText, restoreDalleParams(parameters));
  return promptText;
}
