import { describe, expect, it } from "vitest";
import { analyzeImportedPromptLearning, buildImportLearningNotes } from "./importLearning";

describe("importLearning", () => {
  it("extracts reusable learning signals from an imported prompt", () => {
    const learning = analyzeImportedPromptLearning(
      "Luxury product campaign, glass perfume bottle on black marble, cinematic rim light --ar 4:5 --s 250 --no plastic skin, extra fingers"
    );

    expect(learning.tags).toEqual(["product", "advertising", "cinematic"]);
    expect(learning.avoidanceText).toBe("plastic skin, extra fingers");
    expect(learning.reusableTokens).toEqual([
      "Luxury product campaign",
      "glass perfume bottle on black marble",
      "cinematic rim light",
    ]);
    expect(learning.parameterLabels).toEqual(["--ar 4:5", "--s 250", "--no plastic skin, extra fingers"]);
  });

  it("builds concise import notes without empty sections", () => {
    const notes = buildImportLearningNotes(
      "Midjourney community",
      analyzeImportedPromptLearning("Editorial portrait, natural skin texture, soft window light --ar 3:4")
    );

    expect(notes).toContain("Source: Midjourney community");
    expect(notes).toContain("Learned tags: portrait, editorial");
    expect(notes).toContain("Reusable tokens: Editorial portrait; natural skin texture; soft window light");
    expect(notes).not.toContain("Avoidance:");
  });
});
