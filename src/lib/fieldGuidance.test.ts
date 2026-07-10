import { describe, it, expect } from "vitest";
import { buildFieldContext, getFieldRecommendations } from "./fieldGuidance";

describe("buildFieldContext", () => {
  it("detects a person subject from the subject field", () => {
    const ctx = buildFieldContext({ subject: "a woman standing in a doorway" });
    expect(ctx.subjectRegister).toBe("person");
  });

  it("detects a product subject", () => {
    const ctx = buildFieldContext({ subject: "a glass bottle with a matte label" });
    expect(ctx.subjectRegister).toBe("product");
  });

  it("detects a creature subject", () => {
    const ctx = buildFieldContext({ subject: "a mythical dragon perched on a cliff" });
    expect(ctx.subjectRegister).toBe("creature");
  });

  it("falls back to abstract when nothing matches", () => {
    const ctx = buildFieldContext({ subject: "swirling geometric shapes" });
    expect(ctx.subjectRegister).toBe("abstract");
  });

  it("detects a fantastical scene register from mood/environment text", () => {
    const ctx = buildFieldContext({ subject: "a woman", mood: "surreal and dreamlike" });
    expect(ctx.sceneRegister).toBe("fantastical");
  });

  it("detects a photoreal scene register", () => {
    const ctx = buildFieldContext({ subject: "a woman", mood: "editorial photograph" });
    expect(ctx.sceneRegister).toBe("photoreal");
  });

  it("defaults to stylized when no register signal is present", () => {
    const ctx = buildFieldContext({ subject: "a woman", mood: "calm" });
    expect(ctx.sceneRegister).toBe("stylized");
  });

  it("detects a single character for a lone person subject", () => {
    const ctx = buildFieldContext({ subject: "a man walking" });
    expect(ctx.characterCount).toBe(1);
  });

  it("detects multiple characters from explicit signal words", () => {
    const ctx = buildFieldContext({ subject: "a couple embracing" });
    expect(ctx.characterCount).toBe("multiple");
  });

  it("detects zero characters for a non-person subject", () => {
    const ctx = buildFieldContext({ subject: "a glass bottle" });
    expect(ctx.characterCount).toBe(0);
  });

  it("combines subject and character fields when detecting register", () => {
    const ctx = buildFieldContext({ subject: "a figure", character: "a young woman, freckled" });
    expect(ctx.subjectRegister).toBe("person");
  });
});

describe("getFieldRecommendations", () => {
  it("returns the base Subject dimensions for a generic context", () => {
    const ctx = buildFieldContext({ subject: "a chair" });
    const dims = getFieldRecommendations("subject", ctx);
    const keys = dims.map((d) => d.key);
    expect(keys).toContain("type");
    expect(keys).toContain("amount");
    expect(keys).toContain("action");
    expect(keys).not.toContain("age_gender");
    expect(keys).not.toContain("material_finish");
  });

  it("unlocks age/gender for a person subject and hides material/finish", () => {
    const ctx = buildFieldContext({ subject: "a woman in a red coat" });
    const keys = getFieldRecommendations("subject", ctx).map((d) => d.key);
    expect(keys).toContain("age_gender");
    expect(keys).not.toContain("material_finish");
  });

  it("unlocks material/finish for a product subject and hides age/gender", () => {
    const ctx = buildFieldContext({ subject: "a perfume bottle" });
    const keys = getFieldRecommendations("subject", ctx).map((d) => d.key);
    expect(keys).toContain("material_finish");
    expect(keys).not.toContain("age_gender");
  });

  it("does not unlock Character's relationship/interaction dimensions for a single character", () => {
    const ctx = buildFieldContext({ subject: "a man reading" });
    const keys = getFieldRecommendations("character", ctx).map((d) => d.key);
    expect(keys).not.toContain("relationship");
    expect(keys).not.toContain("interaction");
  });

  it("unlocks Character's relationship/interaction dimensions for multiple characters", () => {
    const ctx = buildFieldContext({ subject: "two friends laughing together" });
    const keys = getFieldRecommendations("character", ctx).map((d) => d.key);
    expect(keys).toContain("relationship");
    expect(keys).toContain("interaction");
  });

  it("swaps Lighting's source dimension for a fantastical scene", () => {
    const ctx = buildFieldContext({ subject: "a woman", mood: "surreal and otherworldly" });
    const keys = getFieldRecommendations("lighting", ctx).map((d) => d.key);
    expect(keys).toContain("otherworldly_source");
    expect(keys).not.toContain("source");
  });

  it("keeps Lighting's natural source dimension for a photoreal scene", () => {
    const ctx = buildFieldContext({ subject: "a woman", mood: "editorial photograph" });
    const keys = getFieldRecommendations("lighting", ctx).map((d) => d.key);
    expect(keys).toContain("source");
    expect(keys).not.toContain("otherworldly_source");
  });

  it("gates Direction Notes' continuity dimension on at least one character present", () => {
    const withCharacter = buildFieldContext({ subject: "a woman" });
    const withoutCharacter = buildFieldContext({ subject: "a bottle" });
    expect(getFieldRecommendations("direction_notes", withCharacter).map((d) => d.key)).toContain("continuity");
    expect(getFieldRecommendations("direction_notes", withoutCharacter).map((d) => d.key)).not.toContain("continuity");
  });

  it("returns a non-empty guide for every documented builder field", () => {
    const ctx = buildFieldContext({ subject: "a woman" });
    for (const field of ["subject", "character", "environment", "composition", "camera", "lighting", "mood", "realism", "product_interaction", "direction_notes", "wardrobe_notes"] as const) {
      expect(getFieldRecommendations(field, ctx).length).toBeGreaterThan(0);
    }
  });
});
