import { describe, expect, it } from "vitest";
import { parseAnalysisResult, parseBriefResult, parseDescribeResult } from "./aiResultParsers";

describe("parseAnalysisResult", () => {
  it("defaults optional arrays and strings from partial valid JSON", () => {
    const result = parseAnalysisResult(JSON.stringify({
      suggested_prompt: "editorial product photo",
    }));

    expect(result).toMatchObject({
      title: "Untitled analysis",
      suggested_prompt: "editorial product photo",
      elements: [],
      ai_look_risks: [],
      avoidance_suggestions: [],
      tags: [],
      quality_tier: "concept",
      provider: "midjourney",
    });
  });

  it("rejects responses without a usable prompt", () => {
    expect(() => parseAnalysisResult("{}")).toThrow("suggested_prompt");
  });
});

describe("parseBriefResult", () => {
  it("keeps usable prompts and defaults missing arrays", () => {
    const result = parseBriefResult(JSON.stringify({
      summary: "Launch campaign.",
      prompts: [{ prompt: "hero product image" }],
    }));

    expect(result.prompts).toEqual([{
      title: "Generated Prompt 1",
      prompt: "hero product image",
      use_case: "",
      tags: [],
      aspect_ratio: "",
    }]);
    expect(result.key_elements).toEqual([]);
    expect(result.suggested_recipes).toEqual([]);
  });

  it("rejects responses without usable prompts", () => {
    expect(() => parseBriefResult(JSON.stringify({ prompts: [{ title: "No prompt" }] })))
      .toThrow("usable prompts");
  });
});

describe("parseDescribeResult", () => {
  it("defaults every element to an empty string from partial valid JSON", () => {
    const result = parseDescribeResult(JSON.stringify({
      description: "A close-up editorial portrait shot in soft window light.",
      elements: { subject: "woman's face in profile", light: "soft window light, camera left" },
    }));

    expect(result.description).toBe("A close-up editorial portrait shot in soft window light.");
    expect(result.elements).toEqual({
      subject: "woman's face in profile",
      environment: "",
      composition: "",
      light: "soft window light, camera left",
      material_realism: "",
      mood: "",
      camera_language: "",
      style: "",
      image_type: "",
      intent: "",
      action: "",
      text_graphics: "",
      references: "",
      consistency: "",
      quality_tags: "",
      exclusions: "",
      moment: "",
    });
  });

  it("tolerates a missing elements object entirely", () => {
    const result = parseDescribeResult(JSON.stringify({ description: "Minimal description." }));
    expect(result.elements.subject).toBe("");
  });

  it("strips markdown fences before parsing", () => {
    const result = parseDescribeResult("```json\n" + JSON.stringify({ description: "Fenced." }) + "\n```");
    expect(result.description).toBe("Fenced.");
  });

  it("rejects responses without a description", () => {
    expect(() => parseDescribeResult("{}")).toThrow("description");
  });
});
