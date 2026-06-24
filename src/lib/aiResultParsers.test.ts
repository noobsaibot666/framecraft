import { describe, expect, it } from "vitest";
import { parseAnalysisResult, parseBriefResult } from "./aiResultParsers";

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
