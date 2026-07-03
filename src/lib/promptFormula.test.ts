import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FORMULAS,
  detectFormulaOrder,
  formatFormulaForAI,
  getFormulaForProvider,
  getNarrativeArc,
  learnFormulaFromImport,
  missingFormulaSteps,
  NARRATIVE_FORMATS,
  PROVIDER_GUIDANCE,
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
  it("returns the GPT Image visual-hierarchy formula from doc 03 §2", () => {
    expect(getFormulaForProvider("gpt_image")).toEqual([
      "Image type",
      "Subject",
      "Environment",
      "Composition",
      "Moment",
      "Light",
      "Style",
      "Material realism",
      "Color grade / Mood",
      "Camera language",
      "Exclusions",
    ]);
  });

  it("returns a brief-style formula for Nano Banana Pro (doc 03 §3)", () => {
    const formula = getFormulaForProvider("nano_banana");
    expect(formula[0]).toBe("Intent");
    expect(formula).toContain("Text / Graphics");
    expect(formula).toContain("References");
    expect(formula).toContain("Consistency");
    expect(formula[formula.length - 1]).toBe("Exclusions");
  });

  it("returns a director-brief formula for Seedance (doc 03 §4)", () => {
    const formula = getFormulaForProvider("seedance");
    for (const step of ["Narrative format", "Shots", "Transitions", "Motion logic", "Continuity", "Audio / Rhythm"]) {
      expect(formula).toContain(step);
    }
  });

  it("returns compact scene direction for Kling (doc 03 §5)", () => {
    const formula = getFormulaForProvider("kling");
    for (const step of ["Subject description", "Motion", "Scene", "Continuity lock", "Transitions", "Audio / Dialogue"]) {
      expect(formula).toContain(step);
    }
  });

  it("Kling's formula includes Shots and World / Setting now that real fields back them (audit doc 05 §13)", () => {
    const formula = getFormulaForProvider("kling");
    expect(formula).toContain("Shots");
    expect(formula).toContain("World / Setting");
  });

  it("returns a video-shaped formula for the remaining video providers", () => {
    for (const provider of ["runway", "higgsfield"] as const) {
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

  it("only keeps steps from the provider's own formula vocabulary", () => {
    const learned = learnFormulaFromImport(
      "softbox lighting on a woman in a studio, 85mm lens, cinematic mood, avoid text",
      "gpt_image"
    )!;
    // "Place" and "Scene" signals fire on "studio" but are not GPT Image steps.
    expect(learned).not.toContain("Place");
    expect(learned).not.toContain("Scene");
    expect(new Set(learned).size).toBe(learned.length);
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

  it("treats equivalent step groups as covering each other", () => {
    // "consistent" covers Consistency → also Continuity lock; "dolly" covers Motion → also Motion logic.
    const missing = missingFormulaSteps(
      "same character stays consistent across shots, slow dolly in",
      ["Continuity lock", "Motion logic", "Transitions"]
    );
    expect(missing).toEqual(["Transitions"]);
  });
});

describe("narrative formats", () => {
  it("ships the six classical formats from doc 03 §4", () => {
    expect(NARRATIVE_FORMATS).toHaveLength(6);
    expect(getNarrativeArc("brand")).toBe("Tension → Transformation → Payoff");
    expect(getNarrativeArc("product")).toContain("Hero reveal");
  });

  it("returns empty arc for unknown format", () => {
    expect(getNarrativeArc("")).toBe("");
    expect(getNarrativeArc("nope")).toBe("");
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

  it("includes the provider's core prompting rule", () => {
    expect(formatFormulaForAI(["Subject"], "kling")).toContain("not one giant beautiful paragraph");
    expect(formatFormulaForAI(["Subject"], "seedance")).toContain("director's brief");
    expect(formatFormulaForAI(["Subject"], "gpt_image")).toContain("visual hierarchy");
  });

  it("has guidance defined for every provider", () => {
    for (const provider of Object.keys(DEFAULT_FORMULAS)) {
      expect(PROVIDER_GUIDANCE[provider as keyof typeof PROVIDER_GUIDANCE]).toBeTruthy();
    }
  });
});
