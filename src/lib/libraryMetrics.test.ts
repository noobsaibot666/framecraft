import { describe, expect, it } from "vitest";
import { getPromptLibraryMetrics } from "./libraryMetrics";
import type { Prompt } from "@/types";

function prompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: crypto.randomUUID(),
    title: "Prompt",
    provider: "midjourney",
    prompt_text: "test prompt",
    rating: 0,
    ai_look_risk: 0,
    reuse_potential: 0,
    is_recipe: false,
    is_winner: false,
    is_failed: false,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getPromptLibraryMetrics", () => {
  it("summarizes library count, winners, recipes, and result coverage", () => {
    const metrics = getPromptLibraryMetrics(
      [
        prompt({ id: "a", is_winner: true, is_recipe: true, provider: "midjourney" }),
        prompt({ id: "b", is_failed: true, provider: "flux" }),
        prompt({ id: "c", provider: "midjourney" }),
      ],
      {
        a: { count: 2, avg_score: 4.5 },
        c: { count: 1, avg_score: 3 },
      }
    );

    expect(metrics).toEqual({
      total: 3,
      winners: 1,
      recipes: 1,
      failed: 1,
      withResults: 2,
      resultCount: 3,
      topProvider: "midjourney",
    });
  });
});
