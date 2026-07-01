import type { Token } from "@/types";

type TokenLoader = (categoryId: string) => Promise<Token[]>;

export function filterTokensForProvider(tokens: Token[], providerFilter?: string): Token[] {
  if (!providerFilter) return [...tokens];
  return tokens.filter((token) => !token.provider || token.provider === providerFilter);
}

export function createTokenCategoryCache(loadTokens: TokenLoader) {
  const cache = new Map<string, Promise<Token[]>>();

  const read = async (categoryId: string): Promise<Token[]> => {
    let pending = cache.get(categoryId);
    if (!pending) {
      pending = loadTokens(categoryId).then((tokens) => [...tokens]);
      // Evict a rejected load so the next read retries instead of replaying the failure.
      pending.catch(() => {
        if (cache.get(categoryId) === pending) cache.delete(categoryId);
      });
      cache.set(categoryId, pending);
    }

    return [...await pending];
  };

  const write = (categoryId: string, tokens: Token[]) => {
    cache.set(categoryId, Promise.resolve([...tokens]));
  };

  const mutate = async (categoryId: string, updater: (tokens: Token[]) => Token[]) => {
    const current = await read(categoryId);
    write(categoryId, updater(current));
  };

  const invalidate = (categoryId?: string) => {
    if (categoryId) {
      cache.delete(categoryId);
      return;
    }
    cache.clear();
  };

  return { get: read, set: write, mutate, invalidate };
}
