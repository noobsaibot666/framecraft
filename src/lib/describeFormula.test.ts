import { describe, expect, it } from "vitest";
import { buildFormulaRows, FORMULA_STEP_NOT_INFERABLE, formatFormulaRows } from "./describeFormula";
import type { DescribeElements } from "@/lib/aiResultParsers";

const EMPTY_ELEMENTS: DescribeElements = {
  subject: "", environment: "", composition: "", light: "", material_realism: "",
  mood: "", camera_language: "", style: "", image_type: "", intent: "", action: "",
  text_graphics: "", references: "", consistency: "", quality_tags: "", exclusions: "", moment: "",
};

describe("buildFormulaRows", () => {
  it("maps elements onto the midjourney formula in provider order, filling Parameters from aspect ratio", () => {
    const rows = buildFormulaRows(
      { ...EMPTY_ELEMENTS, subject: "a lone astronaut", light: "hard rim light from behind", mood: "tense, cinematic" },
      "midjourney",
      "16:9"
    );

    expect(rows.map((r) => r.step)).toEqual([
      "Subject", "Environment", "Camera language", "Light", "Mood",
      "Material realism", "Style", "Parameters", "Exclusions",
    ]);
    expect(rows.find((r) => r.step === "Subject")?.value).toBe("a lone astronaut");
    expect(rows.find((r) => r.step === "Light")?.value).toBe("hard rim light from behind");
    expect(rows.find((r) => r.step === "Parameters")?.value).toBe("--ar 16:9");
  });

  it("marks steps with no mapped element or empty value as not inferable", () => {
    const rows = buildFormulaRows(EMPTY_ELEMENTS, "midjourney");
    expect(rows.find((r) => r.step === "Subject")?.value).toBe(FORMULA_STEP_NOT_INFERABLE);
    expect(rows.find((r) => r.step === "Parameters")?.value).toBe(FORMULA_STEP_NOT_INFERABLE);
  });

  it("marks video-only steps (Motion, Shots, Duration, …) not inferable from a still image", () => {
    const rows = buildFormulaRows({ ...EMPTY_ELEMENTS, subject: "a dancer mid-leap" }, "kling");
    expect(rows.find((r) => r.step === "Motion")?.value).toBe(FORMULA_STEP_NOT_INFERABLE);
    expect(rows.find((r) => r.step === "Shots")?.value).toBe(FORMULA_STEP_NOT_INFERABLE);
    expect(rows.find((r) => r.step === "Subject")?.value).toBe("a dancer mid-leap");
  });

  it("routes provider-specific step aliases to the same underlying element", () => {
    const rows = buildFormulaRows({ ...EMPTY_ELEMENTS, environment: "a foggy pier at dawn" }, "seedance");
    expect(rows.find((r) => r.step === "World / Setting")?.value).toBe("a foggy pier at dawn");
  });
});

describe("formatFormulaRows", () => {
  it("renders one uppercased STEP: value line per row", () => {
    const text = formatFormulaRows([
      { step: "Subject", value: "a lone astronaut" },
      { step: "Parameters", value: "--ar 16:9" },
    ]);
    expect(text).toBe("SUBJECT: a lone astronaut\nPARAMETERS: --ar 16:9");
  });
});
