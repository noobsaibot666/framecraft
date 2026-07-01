/**
 * Small bounded cache with optional TTL and LRU-style eviction.
 *
 * - `maxEntries` caps size; when exceeded, the oldest-inserted (or least-recently
 *   read, since a read re-inserts) entry is evicted.
 * - `ttlMs` (optional) expires entries lazily on read.
 *
 * Backed by an insertion-ordered Map: deleting + re-setting a key on read moves it
 * to the newest position, so the first key is always the least-recently-used.
 */
export interface BoundedCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export function createBoundedCache<V>(maxEntries: number, ttlMs?: number): BoundedCache<V> {
  if (maxEntries < 1) throw new Error("createBoundedCache: maxEntries must be >= 1");
  const store = new Map<string, { value: V; ts: number }>();

  const isExpired = (ts: number) => ttlMs != null && Date.now() - ts >= ttlMs;

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (isExpired(entry.ts)) {
        store.delete(key);
        return undefined;
      }
      // Re-insert to mark as most-recently-used.
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      // Delete first so re-set moves the key to the newest position.
      store.delete(key);
      store.set(key, { value, ts: Date.now() });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    has(key) {
      const entry = store.get(key);
      if (!entry) return false;
      if (isExpired(entry.ts)) {
        store.delete(key);
        return false;
      }
      return true;
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}
