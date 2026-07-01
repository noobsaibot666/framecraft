import type { Token } from "@/types";
import { createBoundedAsyncCache } from "./boundedCache";

type TokenLoader = (categoryId: string) => Promise<Token[]>;

export function filterTokensForProvider(tokens: Token[], providerFilter?: string): Token[] {
  if (!providerFilter) return [...tokens];
  return tokens.filter((token) => !token.provider || token.provider === providerFilter);
}

export function createTokenCategoryCache(
  loadTokens: TokenLoader,
  options: { maxEntries?: number; ttlMs?: number } = {}
) {
  const cache = createBoundedAsyncCache<string, Token[]>({
    maxEntries: options.maxEntries ?? 24,
    ttlMs: options.ttlMs ?? 5 * 60_000,
    load: async (categoryId) => [...await loadTokens(categoryId)],
  });

  const read = async (categoryId: string): Promise<Token[]> => {
    return [...await cache.get(categoryId)];
  };

  const write = (categoryId: string, tokens: Token[]) => {
    cache.set(categoryId, [...tokens]);
  };

  const mutate = async (categoryId: string, updater: (tokens: Token[]) => Token[]) => {
    const current = await read(categoryId);
    write(categoryId, updater(current));
  };

  const invalidate = (categoryId?: string) => {
    if (categoryId) {
      cache.invalidate(categoryId);
      return;
    }
    cache.invalidate();
  };

  return { get: read, set: write, mutate, invalidate, size: cache.size };
}
