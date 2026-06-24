import { describe, expect, it } from "vitest";
import { extractSlots, reconstructPrompt, slotKey } from "./recipeExtract";

describe("extractSlots", () => {
  it("returns no slots for static prompt text", () => {
    expect(extractSlots("Static editorial prompt with no variables")).toEqual([]);
  });

  it("detects bracketed placeholders and stable keys", () => {
    const slots = extractSlots("Editorial photo of [subject] in [location], [mood?]");

    expect(slots.map((slot) => ({
      label: slot.label,
      placeholder: slot.placeholder,
      required: slot.required,
      key: slotKey(slot),
    }))).toEqual([
      { label: "subject", placeholder: "subject", required: true, key: "subject" },
      { label: "location", placeholder: "location", required: true, key: "location" },
      { label: "mood", placeholder: "mood", required: false, key: "mood" },
    ]);
  });

  it("detects Midjourney parameter flags as editable slots", () => {
    const slots = extractSlots("Portrait campaign --ar 16:9 --v 6.1 --sref 12345");

    expect(slots.map((slot) => ({
      label: slot.label,
      placeholder: slot.placeholder,
      required: slot.required,
      flag: slot.flag,
      key: slotKey(slot),
    }))).toEqual([
      { label: "Aspect Ratio", placeholder: "16:9", required: true, flag: "--ar", key: "aspect-ratio" },
      { label: "Version", placeholder: "6.1", required: true, flag: "--v", key: "version" },
      { label: "Style Reference", placeholder: "12345", required: false, flag: "--sref", key: "style-reference" },
    ]);
  });

  it("does not duplicate bracketed parameter template values as standalone slots", () => {
    const slots = extractSlots("Portrait campaign --ar [aspect-ratio] --sref [style-reference?]");

    expect(slots.map((slot) => ({
      kind: slot.kind,
      label: slot.label,
      required: slot.required,
      flag: slot.flag,
    }))).toEqual([
      { kind: "parameter", label: "aspect-ratio", required: true, flag: "--ar" },
      { kind: "parameter", label: "style-reference", required: false, flag: "--sref" },
    ]);
  });

  it("keeps required bracket markers when reconstructing without a value", () => {
    const slots = extractSlots("Product photo of [subject]");

    expect(reconstructPrompt(slots, {})).toBe("Product photo of [subject]");
  });

  it("keeps required parameter markers when reconstructing without a value", () => {
    const slots = extractSlots("Product photo --ar [aspect-ratio]");

    expect(reconstructPrompt(slots, {})).toBe("Product photo --ar [aspect-ratio]");
  });
});

describe("reconstructPrompt", () => {
  it("returns an empty string when no slots are provided", () => {
    expect(reconstructPrompt([], { subject: "unused" })).toBe("");
  });

  it("fills bracketed placeholders and skips empty optional placeholders", () => {
    const slots = extractSlots("Editorial photo of [subject] in [location], [mood?]");

    const prompt = reconstructPrompt(slots, {
      subject: "ceramic headphones",
      location: "a white studio",
      mood: "",
    });

    expect(prompt).toBe("Editorial photo of ceramic headphones in a white studio");
  });

  it("replaces parameter values and removes empty optional parameter flags", () => {
    const slots = extractSlots("Portrait campaign --ar 16:9 --v 6.1 --sref 12345");
    const styleRef = slots.find((slot) => slot.flag === "--sref");
    if (!styleRef) throw new Error("Expected --sref slot");
    styleRef.required = false;

    const prompt = reconstructPrompt(slots, {
      "aspect-ratio": "4:5",
      version: "7",
      "style-reference": "",
    });

    expect(prompt).toBe("Portrait campaign --ar 4:5 --v 7");
  });

  it("cleans dangling comma left by an empty optional placeholder", () => {
    const slots = extractSlots("Studio product shot, [mood?]");

    expect(reconstructPrompt(slots, { mood: "" })).toBe("Studio product shot");
  });
});
