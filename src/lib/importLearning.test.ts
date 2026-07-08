import { describe, expect, it } from "vitest";
import { analyzeImportedPromptLearning, buildImportLearningNotes, suggestPromptTags, suggestPromptTitle } from "./importLearning";

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

  it("captures a multi-token --profile value in full, not just its first word", () => {
    const learning = analyzeImportedPromptLearning(
      "Editorial portrait, natural light --profile gtbhewc awv472p gj5325t gy97k8r --ar 3:4"
    );
    expect(learning.parameterLabels).toContain("--profile gtbhewc awv472p gj5325t gy97k8r");
    // The multi-token value must not leak into reusable tokens / tag phrases.
    expect(learning.reusableTokens.join(" ")).not.toContain("awv472p");
  });

  it("captures a bare --profile as the last parameter through end of string", () => {
    const learning = analyzeImportedPromptLearning(
      "Editorial portrait --ar 3:4 --profile gtbhewc awv472p gj5325t gy97k8r"
    );
    expect(learning.parameterLabels).toContain("--profile gtbhewc awv472p gj5325t gy97k8r");
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

  it("suggests dictionary tags and prompt-specific phrases together", () => {
    const suggestions = suggestPromptTags(
      "Cyberpunk alley at night, neon signs reflecting on wet street, moody lighting --ar 16:9"
    );

    // Descriptive-vocabulary dictionary hits (not full sentences)
    expect(suggestions).toContain("neon");
    expect(suggestions).toContain("moody");
    expect(suggestions).toContain("futuristic");
    expect(suggestions).toContain("urban");
    // Short phrases pulled directly from the prompt's own clauses
    expect(suggestions).toContain("cyberpunk alley at night");
    expect(suggestions).toContain("moody lighting");
    // The 6-word clause exceeds the phrase-candidate cap and is excluded
    expect(suggestions).not.toContain("neon signs reflecting on wet street");
  });

  it("excludes tags already added and returns nothing for blank text", () => {
    const suggestions = suggestPromptTags("Moody cyberpunk alley, neon lighting", ["moody"]);
    expect(suggestions).not.toContain("moody");
    expect(suggestions).toContain("neon");

    expect(suggestPromptTags("   ")).toEqual([]);
  });

  it("derives a short title from the prompt's leading clause", () => {
    expect(suggestPromptTitle("Luxury product campaign, glass perfume bottle on black marble --ar 4:5"))
      .toBe("Luxury Product Campaign");
    // A terse leading clause pulls in the next one for enough context.
    expect(suggestPromptTitle("Portrait, editorial fashion shoot with dramatic rim light --ar 3:4"))
      .toBe("Portrait Editorial Fashion Shoot With Dramatic");
    expect(suggestPromptTitle("   ")).toBe("");
  });

  it("truncates a long leading clause at a word boundary", () => {
    const title = suggestPromptTitle(
      "A sweeping cinematic wide-angle establishing shot of a neon-drenched cyberpunk megacity at night, rain-slicked streets"
    );
    expect(title.length).toBeLessThanOrEqual(48);
    expect(title.endsWith(" ")).toBe(false);
  });
});
