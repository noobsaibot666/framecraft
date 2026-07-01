interface BoundedAsyncCacheOptions<K, V> {
  maxEntries: number;
  ttlMs: number;
  load?: (key: K) => Promise<V>;
  now?: () => number;
}

interface CacheEntry<V> {
  promise: Promise<V>;
  expiresAt?: number;
}

export function createBoundedAsyncCache<K, V>(options: BoundedAsyncCacheOptions<K, V>) {
  const entries = new Map<K, CacheEntry<V>>();
  const now = options.now ?? Date.now;

  const evictOverflow = () => {
    while (entries.size > options.maxEntries) {
      const oldest = entries.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  const set = (key: K, value: V | Promise<V>) => {
    const promise = Promise.resolve(value);
    const entry: CacheEntry<V> = { promise };
    entries.delete(key);
    entries.set(key, entry);
    evictOverflow();
    promise.then(
      () => {
        if (entries.get(key) === entry) entry.expiresAt = now() + options.ttlMs;
      },
      () => {
        if (entries.get(key) === entry) entries.delete(key);
      },
    );
    return promise;
  };

  const get = (key: K, loader = options.load): Promise<V> => {
    const existing = entries.get(key);
    if (existing && (existing.expiresAt === undefined || existing.expiresAt > now())) {
      entries.delete(key);
      entries.set(key, existing);
      return existing.promise;
    }
    if (existing) entries.delete(key);
    if (!loader) return Promise.reject(new Error("Cache loader is required."));
    return set(key, loader(key));
  };

  const invalidate = (key?: K) => {
    if (key !== undefined) entries.delete(key);
    else entries.clear();
  };

  return { get, set, invalidate, size: () => entries.size, keys: () => [...entries.keys()] };
}
