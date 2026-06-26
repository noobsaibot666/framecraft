import type { Prompt, Provider } from "@/types";
import type { ResultSummaryMap } from "./promptFilters";

export interface PromptLibraryMetrics {
  total: number;
  winners: number;
  recipes: number;
  failed: number;
  withResults: number;
  resultCount: number;
  topProvider: Provider | null;
}

export function getPromptLibraryMetrics(
  prompts: Prompt[],
  resultSummary: ResultSummaryMap = {}
): PromptLibraryMetrics {
  const providerCounts = new Map<Provider, number>();
  let winners = 0;
  let recipes = 0;
  let failed = 0;
  let withResults = 0;
  let resultCount = 0;

  for (const prompt of prompts) {
    providerCounts.set(prompt.provider, (providerCounts.get(prompt.provider) ?? 0) + 1);
    if (prompt.is_winner) winners += 1;
    if (prompt.is_recipe) recipes += 1;
    if (prompt.is_failed) failed += 1;

    const summary = resultSummary[prompt.id];
    if (summary?.count) {
      withResults += 1;
      resultCount += summary.count;
    }
  }

  let topProvider: Provider | null = null;
  let topProviderCount = 0;
  for (const [provider, count] of providerCounts) {
    if (count > topProviderCount) {
      topProvider = provider;
      topProviderCount = count;
    }
  }

  return {
    total: prompts.length,
    winners,
    recipes,
    failed,
    withResults,
    resultCount,
    topProvider,
  };
}
