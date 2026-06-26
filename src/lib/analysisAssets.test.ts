import { describe, expect, it } from "vitest";
import {
  buildBriefPromptAsset,
  buildImagePromptAsset,
  normalizeAnalysisProvider,
} from "./analysisAssets";
import type { AnalysisResult } from "./analyzeImage";
import type { BriefResult, GeneratedPrompt } from "./aiResultParsers";

describe("analysisAssets", () => {
  it("normalizes unknown analysis providers to midjourney", () => {
    expect(normalizeAnalysisProvider("flux")).toBe("flux");
    expect(normalizeAnalysisProvider("unknown-model")).toBe("midjourney");
  });

  it("builds image prompt assets with notes and avoidance", () => {
    const result: AnalysisResult = {
      title: "Bottle Rim Light",
      suggested_prompt: "glass bottle on black marble",
      variation_prompt: "alternate crop",
      style_notes: "High contrast rim lighting.",
      elements: ["glass bottle", "black marble"],
      ai_look_risks: ["fake reflection"],
      avoidance_suggestions: ["avoid fake reflections"],
      tags: ["product", "commercial"],
      aspect_ratio: "4:5",
      quality_tier: "commercial",
      provider: "midjourney",
    };

    expect(buildImagePromptAsset(result, ["product", "hero"])).toEqual({
      title: "Bottle Rim Light",
      prompt_text: "glass bottle on black marble",
      provider: "midjourney",
      tags: ["product", "hero", "commercial", "analysis", "image-analysis"],
      notes: [
        "Source: Image Analyzer",
        "Quality tier: commercial",
        "Style notes: High contrast rim lighting.",
        "Elements: glass bottle; black marble",
        "AI-look risks: fake reflection",
      ].join("\n"),
      aspect_ratio: "4:5",
      avoidance_text: "avoid fake reflections",
    });
  });

  it("builds brief prompt assets with brief context notes", () => {
    const brief: BriefResult = {
      summary: "Launch a product campaign.",
      production_goal: "Create social hero visuals.",
      creative_direction: "Premium studio still life.",
      tone: "premium",
      key_elements: ["bottle", "marble"],
      required_deliverables: ["story", "feed"],
      key_constraints: ["no hands"],
      risk_areas: ["generic luxury look"],
      prompts: [],
      suggested_recipes: [],
    };
    const prompt: GeneratedPrompt = {
      title: "Hero Still Life",
      prompt: "premium bottle on marble",
      use_case: "hero",
      tags: ["product"],
      aspect_ratio: "4:5",
    };

    expect(buildBriefPromptAsset(prompt, brief)).toEqual({
      title: "Hero Still Life",
      prompt_text: "premium bottle on marble",
      provider: "midjourney",
      tags: ["product", "analysis", "brief-analysis", "premium"],
      aspect_ratio: "4:5",
      avoidance_text: "no hands, generic luxury look",
      notes: [
        "Source: Brief Analyzer",
        "Use case: hero",
        "Brief summary: Launch a product campaign.",
        "Production goal: Create social hero visuals.",
        "Creative direction: Premium studio still life.",
        "Required deliverables: story; feed",
        "Key elements: bottle; marble",
        "Constraints: no hands",
        "Risk areas: generic luxury look",
      ].join("\n"),
    });
  });
});
