import { describe, expect, it } from "vitest";
import {
  buildProviderParameters,
  restoreDalleParams,
  restoreSDParams,
  type DalleParams,
  type MJParams,
  type SDParams,
} from "./CraftPrompt";

// Audit doc 05 §1 — previously only Midjourney params were ever written to
// the DB, so reopening a DALL-E/Stable Diffusion prompt lost its params
// entirely, and for DALL-E the next autosave then silently stripped the
// [size: ...] etc. suffixes already baked into prompt_text.

const EMPTY_MJ: MJParams = {
  aspect_ratio: "", model_version: "", quality: "",
  stylize: "", chaos: "", weird: "", stop: "", repeat: "",
  seed: "", zoom: "", style: "", sw: "", sv: "",
  sref_code: "", profile: "", no_prompt: "",
  raw: false, hd: false, tile: false, fast: false, relax: false, exp: false,
};
const EMPTY_DALLE: DalleParams = { size: "", quality: "", style: "" };
const EMPTY_SD: SDParams = { steps: "", cfg_scale: "", sampler: "", negative_prompt: "", seed: "" };

describe("buildProviderParameters", () => {
  it("writes DALL-E params, not Midjourney's", () => {
    const dalle: DalleParams = { size: "1024x1024", quality: "hd", style: "vivid" };
    const params = buildProviderParameters("dalle", EMPTY_MJ, dalle, EMPTY_SD);
    expect(params).toEqual({ size: "1024x1024", quality: "hd", style: "vivid" });
  });

  it("writes Stable Diffusion params", () => {
    const sd: SDParams = { steps: "30", cfg_scale: "7.5", sampler: "euler_a", seed: "42", negative_prompt: "blurry" };
    const params = buildProviderParameters("stable_diffusion", EMPTY_MJ, EMPTY_DALLE, sd);
    expect(params).toEqual({ steps: "30", cfg_scale: "7.5", sampler: "euler_a", seed: "42", negative_prompt: "blurry" });
  });

  it("returns undefined for an empty DALL-E param set", () => {
    expect(buildProviderParameters("dalle", EMPTY_MJ, EMPTY_DALLE, EMPTY_SD)).toBeUndefined();
  });

  it("returns undefined for a provider with no structured params", () => {
    expect(buildProviderParameters("flux", EMPTY_MJ, EMPTY_DALLE, EMPTY_SD)).toBeUndefined();
  });

  it("still writes Midjourney params (no regression)", () => {
    const mj: MJParams = { ...EMPTY_MJ, stylize: "500", chaos: "20" };
    const params = buildProviderParameters("midjourney", mj, EMPTY_DALLE, EMPTY_SD);
    expect(params).toEqual({ stylize: "500", chaos: "20" });
  });
});

describe("DALL-E / SD param round-trip through save -> reload", () => {
  it("DALL-E params saved by buildProviderParameters restore identically via restoreDalleParams", () => {
    const original: DalleParams = { size: "1792x1024", quality: "standard", style: "natural" };
    const saved = buildProviderParameters("dalle", EMPTY_MJ, original, EMPTY_SD)!;
    const restored = restoreDalleParams(saved);
    expect(restored).toEqual(original);
  });

  it("Stable Diffusion params saved by buildProviderParameters restore identically via restoreSDParams", () => {
    const original: SDParams = { steps: "25", cfg_scale: "8", sampler: "dpm++", seed: "1234", negative_prompt: "watermark" };
    const saved = buildProviderParameters("stable_diffusion", EMPTY_MJ, EMPTY_DALLE, original)!;
    const restored = restoreSDParams(saved);
    expect(restored).toEqual(original);
  });

  it("restoring from an empty/absent parameters object yields all-empty params, not undefined/crash", () => {
    expect(restoreDalleParams({})).toEqual(EMPTY_DALLE);
    expect(restoreSDParams({})).toEqual(EMPTY_SD);
  });
});
