import type { Prompt } from "@/types";
import { getPrompts } from "./db";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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

export interface RecipeSuggestion {
  recipe: Prompt;
  matchedCount: number;
  matchPercent: number;
  matchedTokenTexts: string[];
}

export function scoreRecipeOverlap(tokenTexts: string[], recipe: Prompt): RecipeSuggestion {
  const lower = recipe.prompt_text.toLowerCase();
  const matched = tokenTexts.filter((t) => t.length > 1 && lower.includes(t.toLowerCase()));
  return {
    recipe,
    matchedCount: matched.length,
    matchPercent: tokenTexts.length > 0 ? Math.round((matched.length / tokenTexts.length) * 100) : 0,
    matchedTokenTexts: matched,
  };
}

export function rankRecipeSuggestions(
  tokenTexts: string[],
  recipes: Prompt[],
  limit = 2
): RecipeSuggestion[] {
  if (tokenTexts.length === 0 || recipes.length === 0) return [];
  return recipes
    .map((r) => scoreRecipeOverlap(tokenTexts, r))
    .filter((s) => s.matchedCount > 0)
    .sort((a, b) => b.matchedCount - a.matchedCount || b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

export async function getRecipeSuggestions(
  tokenTexts: string[],
  limit = 2
): Promise<RecipeSuggestion[]> {
  if (!isTauri || tokenTexts.length === 0) return [];
  const all = await getPrompts();
  const recipes = all.filter((p) => p.is_recipe);
  return rankRecipeSuggestions(tokenTexts, recipes, limit);
}
