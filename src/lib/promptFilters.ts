import type { LibraryFilters, Prompt, SortOption } from "@/types";

export type ResultSummaryMap = Record<string, { count: number; avg_score: number }>;

export function filterAndSortPrompts(
  prompts: Prompt[],
  filters: LibraryFilters,
  sortBy: SortOption,
  resultSummary: ResultSummaryMap = {}
): Prompt[] {
  const list = prompts.filter((p) => {
    if (filters.provider && p.provider !== filters.provider) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.minRating != null && p.rating < filters.minRating) return false;
    if (filters.maxAiRisk != null && p.ai_look_risk > filters.maxAiRisk) return false;
    if (filters.isWinner && !p.is_winner) return false;
    if (filters.isFailed && !p.is_failed) return false;
    if (filters.isRecipe && !p.is_recipe) return false;
    return true;
  });

  switch (sortBy) {
    case "oldest":
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
    case "rating_desc":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "rating_asc":
      list.sort((a, b) => a.rating - b.rating);
      break;
    case "most_used":
      list.sort((a, b) => (resultSummary[b.id]?.count ?? 0) - (resultSummary[a.id]?.count ?? 0));
      break;
    case "ai_risk_desc":
      list.sort((a, b) => b.ai_look_risk - a.ai_look_risk);
      break;
    case "ai_risk_asc":
      list.sort((a, b) => a.ai_look_risk - b.ai_look_risk);
      break;
    case "newest":
    default:
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
  }

  return list;
}
