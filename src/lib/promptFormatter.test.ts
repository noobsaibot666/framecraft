import { describe, expect, it } from "vitest";
import { formatPromptForProvider, getProviderHints, getSupportedFormatterProviders } from "./promptFormatter";

describe("formatPromptForProvider — midjourney", () => {
  it("moves parameters to the end", () => {
    const result = formatPromptForProvider(
      "--ar 16:9 cinematic product shot white background",
      "midjourney"
    );
    expect(result.text).toMatch(/--ar 16:9$/);
    expect(result.text).toContain("cinematic product shot");
  });

  it("strips markdown bold syntax", () => {
    const result = formatPromptForProvider("**hero shot** cinematic --ar 16:9", "midjourney");
    expect(result.text).not.toContain("**");
    expect(result.text).toContain("hero shot");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("returns unchanged text with no changes when already formatted", () => {
    const text = "cinematic product shot on white background --ar 16:9 --v 6";
    const result = formatPromptForProvider(text, "midjourney");
    expect(result.text).toBe(text);
  });
});

describe("formatPromptForProvider — dalle", () => {
  it("removes MJ parameters", () => {
    const result = formatPromptForProvider(
      "a product on white background --ar 16:9 --v 6",
      "dalle"
    );
    expect(result.text).not.toContain("--ar");
    expect(result.text).not.toContain("--v");
    expect(result.text).toContain("product on white background");
    expect(result.changes).toContain("Removed Midjourney parameters (--ar, --v, etc.)");
  });

  it("removes SD weight notation", () => {
    const result = formatPromptForProvider(
      "[cinematic:1.3] shot of a product",
      "dalle"
    );
    expect(result.text).not.toContain("[");
    expect(result.text).toContain("cinematic");
    expect(result.changes.some((c) => c.includes("weight"))).toBe(true);
  });
});

describe("formatPromptForProvider — stable_diffusion", () => {
  it("removes MJ parameters", () => {
    const result = formatPromptForProvider(
      "masterpiece, cinematic lighting --ar 16:9",
      "stable_diffusion"
    );
    expect(result.text).not.toContain("--ar");
    expect(result.text).toContain("masterpiece");
  });
});

describe("formatPromptForProvider — flux", () => {
  it("strips markdown and MJ params", () => {
    const result = formatPromptForProvider(
      "**dramatic lighting** --v 6 product shot",
      "flux"
    );
    expect(result.text).not.toContain("**");
    expect(result.text).not.toContain("--v");
  });
});

describe("formatPromptForProvider — unknown provider", () => {
  it("returns text unchanged for unsupported provider", () => {
    const text = "some prompt text";
    const result = formatPromptForProvider(text, "other");
    expect(result.text).toBe(text);
    expect(result.changes).toHaveLength(0);
  });
});

describe("getProviderHints", () => {
  it("returns hints for midjourney", () => {
    const hints = getProviderHints("midjourney");
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.toLowerCase().includes("param"))).toBe(true);
  });

  it("returns empty array for unknown provider", () => {
    expect(getProviderHints("other")).toEqual([]);
  });
});

describe("getSupportedFormatterProviders", () => {
  it("includes midjourney, dalle, stable_diffusion, flux", () => {
    const providers = getSupportedFormatterProviders();
    expect(providers).toContain("midjourney");
    expect(providers).toContain("dalle");
    expect(providers).toContain("stable_diffusion");
    expect(providers).toContain("flux");
  });
});
