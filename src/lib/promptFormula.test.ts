import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FORMULAS,
  detectFormulaOrder,
  formatFormulaForAI,
  getFormulaForProvider,
  learnFormulaFromImport,
  missingFormulaSteps,
} from "./promptFormula";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
});

describe("getFormulaForProvider", () => {
  it("returns the GPT Image formula from the spec", () => {
    expect(getFormulaForProvider("gpt_image")).toEqual([
      "Subject",
      "Place",
      "Moment",
      "Composition",
      "Light",
      "Material realism",
      "Mood",
      "Camera language",
      "Exclusions",
    ]);
  });

  it("returns a video-shaped formula for video providers", () => {
    for (const provider of ["seedance", "kling", "runway", "higgsfield"] as const) {
      expect(getFormulaForProvider(provider)).toContain("Motion");
      expect(getFormulaForProvider(provider)).toContain("Duration");
    }
  });

  it("returns a fresh copy each call (mutation safe)", () => {
    const a = getFormulaForProvider("midjourney");
    a.push("Mutated");
    expect(getFormulaForProvider("midjourney")).not.toContain("Mutated");
    expect(DEFAULT_FORMULAS.midjourney).not.toContain("Mutated");
  });
});

describe("detectFormulaOrder", () => {
  it("detects steps in order of first appearance", () => {
    const order = detectFormulaOrder(
      "woman in a studio, softbox lighting, macro lens, avoid text"
    );
    expect(order[0]).toBe("Subject");
    expect(order).toContain("Light");
    expect(order).toContain("Camera language");
    expect(order[order.length - 1]).toBe("Exclusions");
  });

  it("returns empty for unstructured text", () => {
    expect(detectFormulaOrder("hello world foo bar")).toEqual([]);
  });
});

describe("learnFormulaFromImport", () => {
  it("ignores prompts with too little structure", () => {
    expect(learnFormulaFromImport("a nice picture", "midjourney")).toBeNull();
    expect(getFormulaForProvider("midjourney")).toEqual(DEFAULT_FORMULAS.midjourney);
  });

  it("stores the observed order and getFormulaForProvider returns it", () => {
    const learned = learnFormulaFromImport(
      "softbox lighting on a woman in a studio, 85mm lens, cinematic mood, avoid text",
      "flux"
    );
    expect(learned).not.toBeNull();
    expect(learned![0]).toBe("Light");
    expect(getFormulaForProvider("flux")).toEqual(learned);
  });

  it("keeps undemonstrated default steps at the end", () => {
    const learned = learnFormulaFromImport(
      "softbox lighting on a woman in a studio, 85mm lens, avoid text",
      "gpt_image"
    )!;
    // "Moment" was not in the import — still present, after observed steps.
    expect(learned).toContain("Moment");
    expect(learned.indexOf("Moment")).toBeGreaterThan(learned.indexOf("Light"));
  });
});

describe("missingFormulaSteps", () => {
  it("flags uncovered steps", () => {
    const missing = missingFormulaSteps("woman in a studio", ["Subject", "Environment", "Light", "Exclusions"]);
    expect(missing).toEqual(["Light", "Exclusions"]);
  });

  it("treats Place and Environment as equivalent", () => {
    const missing = missingFormulaSteps("woman in a studio", ["Subject", "Place"]);
    expect(missing).toEqual([]);
  });
});

describe("formatFormulaForAI", () => {
  it("returns empty string for empty formula", () => {
    expect(formatFormulaForAI([], "midjourney")).toBe("");
  });

  it("joins steps with + and names the provider", () => {
    const line = formatFormulaForAI(["Subject", "Light"], "gpt_image");
    expect(line).toContain("Subject + Light");
    expect(line).toContain("gpt_image");
  });
});
