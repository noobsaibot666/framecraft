import { describe, expect, it } from "vitest";
import { buildVisualReferenceContext, MAX_VISUAL_REFERENCES, MAX_VISUAL_REFERENCE_NOTE } from "./visualReferences";

describe("buildVisualReferenceContext", () => {
  it("returns empty string with no references", () => {
    expect(buildVisualReferenceContext([])).toBe("");
  });

  it("lists each reference with its note as its role", () => {
    const context = buildVisualReferenceContext([
      { title: "jacket studio", note: "clothing reference" },
      { title: "neon street", note: "lighting reference" },
    ]);
    expect(context).toContain("- jacket studio: clothing reference");
    expect(context).toContain("- neon street: lighting reference");
    expect(context).toContain("respect these roles");
  });

  it("handles references without notes", () => {
    const context = buildVisualReferenceContext([{ title: "moodboard 1", note: "  " }]);
    expect(context).toContain("- moodboard 1");
    expect(context).not.toContain("moodboard 1:");
  });

  it("appends the AI image analysis when present (doc 04 §2)", () => {
    const context = buildVisualReferenceContext([
      { title: "jacket studio", note: "clothing reference", analysis: "Soft top light on waxed cotton." },
      { title: "no-note ref", note: "", analysis: "Backlit macro of condensation." },
    ]);
    expect(context).toContain("- jacket studio: clothing reference (image analysis: Soft top light on waxed cotton.)");
    expect(context).toContain("- no-note ref: (image analysis: Backlit macro of condensation.)");
  });
});

describe("constants", () => {
  it("caps uploads at 5 and notes at 100 chars per spec", () => {
    expect(MAX_VISUAL_REFERENCES).toBe(5);
    expect(MAX_VISUAL_REFERENCE_NOTE).toBe(100);
  });
});
