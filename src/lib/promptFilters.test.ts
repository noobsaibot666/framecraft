import { describe, expect, it } from "vitest";
import { filterAndSortPrompts } from "./promptFilters";
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

describe("filterAndSortPrompts", () => {
  it("filters by minimum rating, maximum AI risk, and failed status", () => {
    const prompts = [
      prompt({ id: "kept", rating: 4, ai_look_risk: 3, is_failed: true }),
      prompt({ id: "low_rating", rating: 2, ai_look_risk: 3, is_failed: true }),
      prompt({ id: "high_risk", rating: 4, ai_look_risk: 8, is_failed: true }),
      prompt({ id: "not_failed", rating: 4, ai_look_risk: 3, is_failed: false }),
    ];

    const result = filterAndSortPrompts(prompts, {
      minRating: 3,
      maxAiRisk: 5,
      isFailed: true,
    }, "newest");

    expect(result.map((p) => p.id)).toEqual(["kept"]);
  });

  it("sorts most-used by result count and AI-risk descending", () => {
    const prompts = [
      prompt({ id: "one", ai_look_risk: 2 }),
      prompt({ id: "many", ai_look_risk: 9 }),
      prompt({ id: "none", ai_look_risk: 5 }),
    ];

    expect(filterAndSortPrompts(prompts, {}, "most_used", {
      one: { count: 1, avg_score: 4 },
      many: { count: 3, avg_score: 2 },
    }).map((p) => p.id)).toEqual(["many", "one", "none"]);

    expect(filterAndSortPrompts(prompts, {}, "ai_risk_desc").map((p) => p.id)).toEqual(["many", "none", "one"]);
  });
});
