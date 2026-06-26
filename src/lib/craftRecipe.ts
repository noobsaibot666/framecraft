import type { Prompt } from "@/types";

export function buildRecipeDraft(recipe: Prompt) {
  return {
    title: `${recipe.title} Draft`,
    promptText: recipe.prompt_text,
    provider: recipe.provider,
    category: recipe.category ?? "",
    tags: [...new Set(["recipe-applied", ...(recipe.tags ?? [])])],
    parentId: recipe.id,
  };
}
