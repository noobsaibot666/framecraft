import { describe, expect, it } from "vitest";
import { buildRecommendationCacheKey, getRecommendations, type RecommendationContext } from "./recommendations";

// isTauri is false in Vitest — all scorers return empty arrays.
// These tests verify the public contract: shape, non-throwing, context flexibility.

const baseCtx: RecommendationContext = {
  provider: "midjourney",
  category: "advertising",
};

describe("getRecommendations", () => {
  it("keys every context field that changes recommendation output", () => {
    const base = buildRecommendationCacheKey({
      provider: "midjourney", category: "product", projectId: "p", excludePromptId: "x",
      tags: ["shoe", "studio"], promptText: "red shoe",
    });
    expect(buildRecommendationCacheKey({ provider: "midjourney", category: "product", projectId: "p", excludePromptId: "x", tags: ["shoe", "studio"], promptText: "blue shoe" })).not.toBe(base);
    expect(buildRecommendationCacheKey({ provider: "midjourney", category: "product", projectId: "p", excludePromptId: "x", tags: ["shoe", "outdoor"], promptText: "red shoe" })).not.toBe(base);
    expect(buildRecommendationCacheKey({ provider: "midjourney", category: "product", projectId: "p", excludePromptId: "x", tags: ["studio", "shoe"], promptText: "red shoe" })).not.toBe(base);
  });
  it("returns the full RecommendationSet shape", async () => {
    const result = await getRecommendations(baseCtx);
    expect(result).toHaveProperty("tokens");
    expect(result).toHaveProperty("prompts");
    expect(result).toHaveProperty("recipes");
    expect(result).toHaveProperty("srefs");
    expect(result).toHaveProperty("profiles");
    expect(result).toHaveProperty("references");
    expect(result).toHaveProperty("avoidance");
  });

  it("all keys are arrays", async () => {
    const result = await getRecommendations(baseCtx);
    for (const key of ["tokens", "prompts", "recipes", "srefs", "profiles", "references", "avoidance"] as const) {
      expect(Array.isArray(result[key])).toBe(true);
    }
  });

  it("returns empty arrays when not in Tauri context", async () => {
    const result = await getRecommendations(baseCtx);
    for (const key of ["tokens", "prompts", "recipes", "srefs", "profiles", "references", "avoidance"] as const) {
      expect(result[key]).toHaveLength(0);
    }
  });

  it("does not throw with minimal context (no category)", async () => {
    const ctx: RecommendationContext = { provider: "dalle" };
    await expect(getRecommendations(ctx)).resolves.toBeDefined();
  });

  it("does not throw with only projectId context", async () => {
    const ctx: RecommendationContext = { projectId: "proj_abc" };
    await expect(getRecommendations(ctx)).resolves.toBeDefined();
  });

  it("does not throw with all context fields populated", async () => {
    const ctx: RecommendationContext = {
      provider: "stable_diffusion",
      category: "cinematic",
      tags: ["portrait", "lighting"],
      promptText: "cinematic portrait dramatic lighting",
      excludePromptId: "prompt_xyz",
      projectId: "proj_xyz",
    };
    await expect(getRecommendations(ctx)).resolves.toBeDefined();
  });
});
