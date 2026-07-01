import { describe, expect, it, vi } from "vitest";
import type { Token } from "@/types";
import { createTokenCategoryCache, filterTokensForProvider } from "./tokenCloudCache";

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    id: "token-1",
    text: "studio",
    category_id: "lighting",
    use_count: 0,
    quality_score: 0,
    is_builtin: false,
    is_favorite: false,
    ...overrides,
  };
}

describe("filterTokensForProvider", () => {
  it("keeps shared tokens and matching provider tokens", () => {
    const tokens = [
      makeToken({ id: "shared", provider: undefined }),
      makeToken({ id: "mj", provider: "midjourney" }),
      makeToken({ id: "sd", provider: "stable_diffusion" }),
    ];

    expect(filterTokensForProvider(tokens, "midjourney").map((token) => token.id)).toEqual(["shared", "mj"]);
  });
});

describe("createTokenCategoryCache", () => {
  it("reuses a fetched category payload across provider switches", async () => {
    const loader = vi.fn(async (categoryId: string) => [
      makeToken({ id: `${categoryId}-shared`, provider: undefined }),
      makeToken({ id: `${categoryId}-mj`, provider: "midjourney" }),
      makeToken({ id: `${categoryId}-sd`, provider: "stable_diffusion" }),
    ]);

    const cache = createTokenCategoryCache(loader);

    const first = await cache.get("lighting");
    const second = await cache.get("lighting");

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(second);
    expect(filterTokensForProvider(first, "midjourney").map((token) => token.id)).toEqual([
      "lighting-shared",
      "lighting-mj",
    ]);
    expect(filterTokensForProvider(second, "stable_diffusion").map((token) => token.id)).toEqual([
      "lighting-shared",
      "lighting-sd",
    ]);
  });

  it("evicts rejected loads and bounds retained categories", async () => {
    const loader = vi.fn(async (categoryId: string) => {
      if (categoryId === "bad" && loader.mock.calls.length === 1) throw new Error("temporary");
      return [makeToken({ id: categoryId, category_id: categoryId })];
    });
    const cache = createTokenCategoryCache(loader, { maxEntries: 2 });

    await expect(cache.get("bad")).rejects.toThrow("temporary");
    await expect(cache.get("bad")).resolves.toHaveLength(1);
    await cache.get("lighting");
    await cache.get("camera");

    expect(cache.size()).toBe(2);
  });
});
