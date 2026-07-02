import { describe, it, expect } from "vitest";
import { detectConsistencyIssues, detectProviderMismatch, findConflictingTexts } from "./tokenConsistency";

describe("detectConsistencyIssues", () => {
  it("returns empty for empty text", () => {
    expect(detectConsistencyIssues("")).toEqual([]);
  });

  it("returns empty for consistent text", () => {
    expect(detectConsistencyIssues("a lone figure walking through a quiet forest at night")).toEqual([]);
  });

  it("flags macro + wide establishing shot", () => {
    const matches = detectConsistencyIssues("macro shot of a flower, wide establishing shot of the valley");
    expect(matches.some((m) => m.rule.id === "camera-macro-wide")).toBe(true);
  });

  it("flags night + morning sunlight", () => {
    const matches = detectConsistencyIssues("night scene with morning sunlight streaming in");
    expect(matches.some((m) => m.rule.id === "lighting-night-morning")).toBe(true);
  });

  it("flags shallow depth of field + everything sharp", () => {
    const matches = detectConsistencyIssues("shallow depth of field, everything sharp in frame");
    expect(matches.some((m) => m.rule.id === "focus-shallow-everything-sharp")).toBe(true);
  });

  it("flags documentary realism + surreal CGI", () => {
    const matches = detectConsistencyIssues("documentary realism with surreal cgi elements");
    expect(matches.some((m) => m.rule.id === "style-documentary-surreal")).toBe(true);
  });

  it("does not flag a rule when only one side is present", () => {
    const matches = detectConsistencyIssues("macro shot of a flower");
    expect(matches.some((m) => m.rule.id === "camera-macro-wide")).toBe(false);
  });

  it("can flag multiple rules at once", () => {
    const matches = detectConsistencyIssues(
      "macro shot, wide establishing shot, night scene, morning sunlight"
    );
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("detectProviderMismatch", () => {
  it("flags video language on an image-only provider", () => {
    const result = detectProviderMismatch("a hero shot with smooth camera motion and fps ramping", "midjourney");
    expect(result).not.toBeNull();
  });

  it("does not flag plain image language on an image-only provider", () => {
    expect(detectProviderMismatch("a studio product shot on white background", "midjourney")).toBeNull();
  });

  it("flags still-image-only language on a video provider", () => {
    const result = detectProviderMismatch("a static shot of the product, still image only", "kling");
    expect(result).not.toBeNull();
  });

  it("returns null for empty text", () => {
    expect(detectProviderMismatch("", "midjourney")).toBeNull();
  });
});

describe("findConflictingTexts", () => {
  it("flags token texts that participate in a match", () => {
    const matches = detectConsistencyIssues("macro shot, wide establishing shot");
    const flagged = findConflictingTexts(["macro shot", "golden hour", "wide establishing shot"], matches);
    expect(flagged.has("macro shot")).toBe(true);
    expect(flagged.has("wide establishing shot")).toBe(true);
    expect(flagged.has("golden hour")).toBe(false);
  });

  it("returns an empty set when there are no matches", () => {
    expect(findConflictingTexts(["golden hour"], [])).toEqual(new Set());
  });
});
