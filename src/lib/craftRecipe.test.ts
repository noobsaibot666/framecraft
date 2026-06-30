import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRecipeDraft, scoreRecipeOverlap, rankRecipeSuggestions, getRecipeSuggestions } from "./craftRecipe";
import type { Prompt } from "@/types";

function makeRecipe(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "recipe-1",
    title: "Premium Product Recipe",
    provider: "midjourney",
    category: "product",
    prompt_text: "studio product shot cinematic lighting --ar 16:9",
    tags: ["recipe", "product"],
    rating: 4,
    ai_look_risk: 1,
    reuse_potential: 0,
    is_recipe: true,
    is_winner: false,
    is_failed: false,
    version: 1,
    created_at: "2026-06-26T00:00:00Z",
    updated_at: "2026-06-26T00:00:00Z",
    ...overrides,
  };
}

describe("buildRecipeDraft", () => {
  it("turns a recipe into Craft prefill fields", () => {
    expect(buildRecipeDraft(makeRecipe())).toEqual({
      title: "Premium Product Recipe Draft",
      promptText: "studio product shot cinematic lighting --ar 16:9",
      provider: "midjourney",
      category: "product",
      tags: ["recipe-applied", "recipe", "product"],
      parentId: "recipe-1",
    });
  });
});

describe("scoreRecipeOverlap", () => {
  it("returns matchedCount equal to how many tokens appear in recipe text", () => {
    const r = makeRecipe();
    const s = scoreRecipeOverlap(["studio", "cinematic", "portrait"], r);
    expect(s.matchedCount).toBe(2); // studio and cinematic match; portrait does not
    expect(s.matchedTokenTexts).toContain("studio");
    expect(s.matchedTokenTexts).toContain("cinematic");
  });

  it("is case-insensitive", () => {
    const r = makeRecipe();
    const s = scoreRecipeOverlap(["Studio", "CINEMATIC"], r);
    expect(s.matchedCount).toBe(2);
  });

  it("returns matchPercent as integer 0–100", () => {
    const r = makeRecipe();
    const s = scoreRecipeOverlap(["studio", "cinematic", "portrait"], r);
    expect(s.matchPercent).toBe(67); // 2/3 = 66.6 → 67
  });

  it("returns 0 matchedCount when no overlap", () => {
    const r = makeRecipe();
    const s = scoreRecipeOverlap(["landscape", "portrait"], r);
    expect(s.matchedCount).toBe(0);
    expect(s.matchedTokenTexts).toHaveLength(0);
  });
});

describe("rankRecipeSuggestions", () => {
  it("returns empty array for empty token list", () => {
    expect(rankRecipeSuggestions([], [makeRecipe()])).toEqual([]);
  });

  it("returns empty array for empty recipe list", () => {
    expect(rankRecipeSuggestions(["studio"], [])).toEqual([]);
  });

  it("filters out recipes with no overlap", () => {
    const recipes = [
      makeRecipe({ id: "r1", prompt_text: "studio product shot" }),
      makeRecipe({ id: "r2", prompt_text: "landscape forest fog" }),
    ];
    const results = rankRecipeSuggestions(["studio"], recipes);
    expect(results).toHaveLength(1);
    expect(results[0].recipe.id).toBe("r1");
  });

  it("sorts by matchedCount descending", () => {
    const recipes = [
      makeRecipe({ id: "r1", prompt_text: "studio cinematic" }),
      makeRecipe({ id: "r2", prompt_text: "studio cinematic lighting depth" }),
    ];
    const results = rankRecipeSuggestions(["studio", "cinematic", "lighting"], recipes, 2);
    expect(results[0].recipe.id).toBe("r2");
  });

  it("respects limit", () => {
    const recipes = [1, 2, 3, 4].map((i) =>
      makeRecipe({ id: `r${i}`, prompt_text: "studio product" })
    );
    expect(rankRecipeSuggestions(["studio"], recipes, 2)).toHaveLength(2);
  });
});

describe("getRecipeSuggestions (dev mode)", () => {
  it("resolves to empty array in dev mode", async () => {
    await expect(getRecipeSuggestions(["studio"])).resolves.toEqual([]);
  });
});

describe("getRecipeSuggestions (tauri mode)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads recipe prompts without reading the full prompt library", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const getRecipePrompts = vi.fn(async () => [
      makeRecipe({ id: "r1", prompt_text: "studio product shot" }),
      makeRecipe({ id: "r2", prompt_text: "forest mist panorama" }),
    ]);
    const getPrompts = vi.fn(async () => []);

    vi.doMock("./db", () => ({
      getRecipePrompts,
      getPrompts,
    }));

    const { getRecipeSuggestions: getSuggestions } = await import("./craftRecipe");
    const suggestions = await getSuggestions(["studio"], 2);

    expect(getRecipePrompts).toHaveBeenCalledTimes(1);
    expect(getPrompts).not.toHaveBeenCalled();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].recipe.id).toBe("r1");
  });
});
