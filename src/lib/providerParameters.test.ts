import { describe, expect, it } from "vitest";
import { buildProviderParameters, extractMJParamsFromText, restoreDalleParams, restoreMJParams, restoreSDParams } from "./providerParameters";

describe("extractMJParamsFromText", () => {
  it("reads short-form value flags", () => {
    const result = extractMJParamsFromText("a cat on a rug --v 8.1 --q 1 --s 250 --c 10 --w 500 --seed 12345");
    expect(result).toEqual({
      model_version: "8.1",
      quality: "1",
      stylize: "250",
      chaos: "10",
      weird: "500",
      seed: "12345",
    });
  });

  it("reads long-form value flags", () => {
    const result = extractMJParamsFromText("a cat --stylize 300 --chaos 20 --weird 100");
    expect(result).toEqual({ stylize: "300", chaos: "20", weird: "100" });
  });

  it("doesn't confuse --s with --style/--sw/--sv/--stop", () => {
    const result = extractMJParamsFromText("a cat --style raw --sw 200 --sv 4 --stop 90");
    expect(result.stylize).toBeUndefined();
    expect(result).toEqual({ style: "raw", sw: "200", sv: "4", stop: "90" });
  });

  it("reads boolean flags", () => {
    const result = extractMJParamsFromText("a cat --raw --hd --tile --fast --relax -exp");
    expect(result).toEqual({ raw: true, hd: true, tile: true, fast: true, relax: true, exp: true });
  });

  it("reads a --no negative list up to the next flag", () => {
    const result = extractMJParamsFromText("a cat --no text, watermark, blur --seed 42");
    expect(result.no_prompt).toBe("text, watermark, blur");
    expect(result.seed).toBe("42");
  });

  it("returns an empty object for prompt text with no flags", () => {
    expect(extractMJParamsFromText("just a plain prompt with no flags at all")).toEqual({});
  });

  it("ignores an empty --no with nothing after it", () => {
    const result = extractMJParamsFromText("a cat --seed 42");
    expect(result.no_prompt).toBeUndefined();
  });

  it("extracted values round-trip through buildProviderParameters/restoreMJParams", () => {
    const extracted = extractMJParamsFromText("a cat --v 8.1 --s 250 --raw");
    const mj = { ...restoreMJParams({}), ...extracted };
    const params = buildProviderParameters("midjourney", mj, restoreDalleParams({}), restoreSDParams({}));
    expect(params).toEqual({ stylize: "250", raw: true });
  });
});
