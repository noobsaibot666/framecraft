import { describe, expect, it } from "vitest";
import {
  CONSISTENCY_FACTOR_PRESETS,
  buildConsistencySuffix,
  suggestConsistencyFactors,
} from "./consistencyFactors";

describe("suggestConsistencyFactors", () => {
  it("returns nothing for empty input", () => {
    expect(suggestConsistencyFactors({})).toEqual([]);
    expect(suggestConsistencyFactors({ promptText: "   " })).toEqual([]);
  });

  it("suggests character + clothing factors for a person-centric prompt", () => {
    const result = suggestConsistencyFactors({
      promptText: "woman wearing a red silk jacket running through a forest",
    });
    expect(result).toContain("character identity");
    expect(result).toContain("clothing");
    expect(result).toContain("environment");
  });

  it("suggests product factors for a product prompt", () => {
    const result = suggestConsistencyFactors({
      promptText: "glass bottle of perfume on a marble surface, softbox lighting",
    });
    expect(result).toContain("product shape");
    expect(result).toContain("lighting direction");
  });

  it("uses project direction as additional signal", () => {
    const result = suggestConsistencyFactors({
      promptText: "hero shot",
      projectDirection: "strict brand identity with a muted color palette",
    });
    expect(result).toContain("brand elements");
    expect(result).toContain("color palette");
  });

  it("never re-suggests existing factors and caps at 5", () => {
    const result = suggestConsistencyFactors({
      promptText:
        "woman wearing a jacket, face close-up, product bottle, studio background, brand logo, teal palette, rim light, macro lens, skin texture",
      existing: ["character identity"],
    });
    expect(result).not.toContain("character identity");
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("only ever suggests known presets", () => {
    const result = suggestConsistencyFactors({
      promptText: "woman with a bottle in a studio wearing fabric under sunlight with a logo",
    });
    for (const factor of result) {
      expect(CONSISTENCY_FACTOR_PRESETS).toContain(factor);
    }
  });
});

describe("buildConsistencySuffix", () => {
  it("returns empty string with no factors", () => {
    expect(buildConsistencySuffix([])).toBe("");
    expect(buildConsistencySuffix(["  ", ""])).toBe("");
  });

  it("joins factors into a copy-ready sentence", () => {
    expect(buildConsistencySuffix(["face", "clothing: red jacket"])).toBe(
      "Keep consistent across variations: face, clothing: red jacket."
    );
  });
});
