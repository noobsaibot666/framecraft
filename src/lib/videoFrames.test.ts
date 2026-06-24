import { describe, expect, it } from "vitest";
import {
  buildFramePromptInput,
  dataUrlToBytes,
  frameFilename,
  importableFrameResults,
} from "./videoFrames";
import type { AnalysisResult } from "@/lib/analyzeImage";

function analysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    title: "Frame Study",
    suggested_prompt: "cinematic product frame",
    variation_prompt: "alternate cinematic product frame",
    style_notes: "High contrast frame.",
    elements: ["product"],
    ai_look_risks: ["fake reflection"],
    avoidance_suggestions: ["avoid fake reflections"],
    tags: ["product", "cinematic"],
    aspect_ratio: "16:9",
    quality_tier: "commercial",
    provider: "midjourney",
    ...overrides,
  };
}

describe("frameFilename", () => {
  it("creates a stable png filename from a source video name and timestamp", () => {
    expect(frameFilename("Launch Film.mov", 65.4)).toBe("launch-film-frame-01m05s.png");
  });
});

describe("buildFramePromptInput", () => {
  it("stores the frame as image_ref and includes avoidance text", () => {
    expect(buildFramePromptInput(analysis(), "data:image/jpeg;base64,abc")).toEqual({
      title: "Frame Study",
      prompt_text: "cinematic product frame",
      provider: "midjourney",
      tags: ["product", "cinematic"],
      aspect_ratio: "16:9",
      notes: "High contrast frame.",
      avoidance_text: "avoid fake reflections",
      image_ref: "data:image/jpeg;base64,abc",
    });
  });
});

describe("importableFrameResults", () => {
  it("returns successful, not-yet-imported frame indexes", () => {
    const results = [
      { frameIdx: 2, result: analysis() },
      { frameIdx: 3, result: analysis(), error: "failed" },
      { frameIdx: 4, result: analysis() },
    ];

    expect(importableFrameResults(results, new Set([2])).map((r) => r.frameIdx)).toEqual([4]);
  });
});

describe("dataUrlToBytes", () => {
  it("decodes base64 data URLs into bytes", () => {
    expect([...dataUrlToBytes("data:image/png;base64,aGVsbG8=")]).toEqual([104, 101, 108, 108, 111]);
  });
});
