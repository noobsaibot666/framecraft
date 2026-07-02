import { describe, expect, it } from "vitest";
import {
  ACCENT_COLORS,
  ACCENT_COUNT,
  accentColorForIndex,
  accentIndexForSortOrder,
  arcStageForIndex,
  clampShotCount,
  parseStoryboardShots,
  shotToVariationInput,
} from "./storytelling";
import type { CreativeDirection, Project } from "@/types";

describe("clampShotCount", () => {
  it("clamps below the minimum up to 3", () => {
    expect(clampShotCount(1)).toBe(3);
    expect(clampShotCount(0)).toBe(3);
    expect(clampShotCount(-5)).toBe(3);
  });

  it("clamps above the maximum down to 12", () => {
    expect(clampShotCount(20)).toBe(12);
  });

  it("passes through in-range values and rounds fractional input", () => {
    expect(clampShotCount(5)).toBe(5);
    expect(clampShotCount(7.4)).toBe(7);
  });

  it("falls back to the minimum for non-finite input", () => {
    expect(clampShotCount(NaN)).toBe(3);
  });
});

describe("accent assignment", () => {
  it("cycles through the fixed accent set by sort order", () => {
    expect(accentIndexForSortOrder(0)).toBe(0);
    expect(accentIndexForSortOrder(ACCENT_COUNT)).toBe(0);
    expect(accentIndexForSortOrder(ACCENT_COUNT + 2)).toBe(2);
  });

  it("resolves a color for every accent index, never red", () => {
    for (let i = 0; i < ACCENT_COUNT * 2; i += 1) {
      const color = accentColorForIndex(i);
      expect(ACCENT_COLORS).toContain(color);
      expect(color.toLowerCase()).not.toBe("#d71921");
    }
  });
});

describe("arcStageForIndex", () => {
  it("starts at Setup and ends at Final image", () => {
    expect(arcStageForIndex(0, 5)).toBe("Setup");
    expect(arcStageForIndex(4, 5)).toBe("Final image");
  });

  it("scales to shorter counts without throwing", () => {
    expect(arcStageForIndex(0, 3)).toBe("Setup");
    expect(arcStageForIndex(2, 3)).toBe("Final image");
  });

  it("scales to longer counts and stays within the canonical arc", () => {
    const stages = new Set(["Setup", "Movement", "Detail", "Emotional shift", "Final image"]);
    for (let i = 0; i < 12; i += 1) {
      expect(stages.has(arcStageForIndex(i, 12))).toBe(true);
    }
  });

  it("handles a single shot", () => {
    expect(arcStageForIndex(0, 1)).toBe("Setup");
  });
});

describe("parseStoryboardShots", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({
      shots: [
        { shot_label: "Shot 01 — Setup", description: "Wide establishing shot." },
        { shot_label: "Shot 02 — Detail", description: "Macro product detail." },
      ],
    });
    expect(parseStoryboardShots(raw, 2)).toEqual([
      { shot_label: "Shot 01 — Setup", description: "Wide establishing shot." },
      { shot_label: "Shot 02 — Detail", description: "Macro product detail." },
    ]);
  });

  it("strips a markdown code fence", () => {
    const raw = "```json\n" + JSON.stringify({
      shots: [{ shot_label: "Shot 01", description: "desc" }],
    }) + "\n```";
    expect(parseStoryboardShots(raw, 1)).toHaveLength(1);
  });

  it("throws when the shot count does not match", () => {
    const raw = JSON.stringify({ shots: [{ shot_label: "a", description: "b" }] });
    expect(() => parseStoryboardShots(raw, 3)).toThrow(/exactly 3 shots/);
  });

  it("throws when a shot is missing a required field", () => {
    const raw = JSON.stringify({ shots: [{ shot_label: "a", description: "" }] });
    expect(() => parseStoryboardShots(raw, 1)).toThrow(/missing description/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStoryboardShots("not json", 1)).toThrow();
  });
});

describe("shotToVariationInput", () => {
  const direction: CreativeDirection = {
    id: "dir-1",
    project_id: "proj-1",
    title: "Golden Hour",
    campaign_idea: "",
    rationale: "",
    visual_aesthetic: "",
    brand_connection: "",
    product_message: "",
    tone: "",
    prompt_direction: "cinematic product shot, warm backlight, 35mm",
    is_selected: true,
    created_at: "",
    updated_at: "",
  };
  const project: Project = {
    id: "proj-1",
    title: "Summer Launch",
    status: "active",
    provider_targets: ["flux"],
    aspect_ratios: ["16:9"],
    category: "advertising",
    created_at: "",
    updated_at: "",
  };
  const shot = { shot_label: "Shot 01 — Setup", description: "wide establishing shot of the product on a table" };

  it("carries the shot label as the variant label and the direction text as the base prompt", () => {
    const input = shotToVariationInput(shot, direction, project);
    expect(input.variant_label).toBe(shot.shot_label);
    expect(input.prompt_text).toBe(direction.prompt_direction);
    expect(input.title).toContain(direction.title);
    expect(input.title).toContain(shot.shot_label);
  });

  it("seeds the variation delta and consistency factors into builder_state", () => {
    const input = shotToVariationInput(shot, direction, project);
    const builderState = JSON.parse(input.builder_state as string);
    expect(builderState.mode).toBe("manual");
    expect(builderState.variation).toBe(shot.description);
    expect(Array.isArray(builderState.consistencyFactors)).toBe(true);
  });

  it("uses the project's first provider target and aspect ratio", () => {
    const input = shotToVariationInput(shot, direction, project);
    expect(input.provider).toBe("flux");
    expect(input.aspect_ratio).toBe("16:9");
  });

  it("falls back to midjourney when the project has no provider targets", () => {
    const input = shotToVariationInput(shot, direction, { ...project, provider_targets: undefined });
    expect(input.provider).toBe("midjourney");
  });
});
