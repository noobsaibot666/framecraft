import { useState, useCallback, useRef } from "react";
import type { PageResult } from "./pagination";

type Loader<T> = (limit: number, offset: number) => Promise<PageResult<T>>;

export interface PagedList<T> {
  items: T[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

export function usePagedList<T>(loader: Loader<T>, pageSize = 50): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true); else setLoading(true);
      try {
        const result = await loader(pageSize, offset);
        setItems((prev) => append ? [...prev, ...result.items] : result.items);
        setTotal(result.total);
        offsetRef.current = offset + result.items.length;
        hasMoreRef.current = result.hasMore;
      } finally {
        if (append) setLoadingMore(false); else setLoading(false);
      }
    },
    [loader, pageSize]
  );

  const reload = useCallback(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingMore) return;
    fetchPage(offsetRef.current, true);
  }, [fetchPage, loadingMore]);

  return { items, total, loading, loadingMore, hasMore: hasMoreRef.current, loadMore, reload };
}
