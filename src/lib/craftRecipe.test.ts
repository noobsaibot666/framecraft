import { describe, expect, it } from "vitest";
import { buildRecipeDraft } from "./craftRecipe";
import type { Prompt } from "@/types";

const recipe: Prompt = {
  id: "recipe-1",
  title: "Premium Product Recipe",
  provider: "midjourney",
  category: "product",
  prompt_text: "Studio product shot of [subject] --ar [aspect-ratio]",
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
};

describe("buildRecipeDraft", () => {
  it("turns a recipe into Craft prefill fields", () => {
    expect(buildRecipeDraft(recipe)).toEqual({
      title: "Premium Product Recipe Draft",
      promptText: "Studio product shot of [subject] --ar [aspect-ratio]",
      provider: "midjourney",
      category: "product",
      tags: ["recipe-applied", "recipe", "product"],
      parentId: "recipe-1",
    });
  });
});
