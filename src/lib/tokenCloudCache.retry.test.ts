import { describe, expect, it, vi } from "vitest";
import { createTokenCategoryCache } from "./tokenCloudCache";
import type { Token } from "@/types";

function makeToken(id: string): Token {
  return { id, text: id, category_id: "c", use_count: 0, quality_score: 0, is_builtin: false, is_favorite: false };
}

describe("createTokenCategoryCache retry-on-rejection", () => {
  it("evicts a rejected load so the next read retries", async () => {
    const loader = vi
      .fn<(categoryId: string) => Promise<Token[]>>()
      .mockRejectedValueOnce("disk I/O error")
      .mockResolvedValueOnce([makeToken("ok")]);

    const cache = createTokenCategoryCache(loader);

    await expect(cache.get("lighting")).rejects.toBe("disk I/O error");
    // Second read must re-invoke the loader (rejected promise was evicted).
    const second = await cache.get("lighting");
    expect(second.map((t) => t.id)).toEqual(["ok"]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not re-invoke the loader after a successful load", async () => {
    const loader = vi.fn(async () => [makeToken("ok")]);
    const cache = createTokenCategoryCache(loader);
    await cache.get("lighting");
    await cache.get("lighting");
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
