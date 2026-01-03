/**
 * usePaginatedData - Generic hook for paginated data fetching
 * Handles loading states, error handling, rate limit countdowns,
 * deduplication, and infinite scroll pagination
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "@/api/types";

/**
 * Result type for paginated fetch operations
 */
export type PaginatedFetchResult<T> =
  | { success: true; items: T[]; nextCursor?: string }
  | { success: false; error: ApiError };

/**
 * Options for configuring the usePaginatedData hook
 */
export interface PaginatedDataOptions<T> {
  /** Function to fetch data, receives cursor for pagination */
  fetchFn: (cursor?: string) => Promise<PaginatedFetchResult<T>>;
  /** Extract unique ID from each item for deduplication */
  getId: (item: T) => string;
  /** Dependencies that trigger a full refetch when changed */
  deps?: unknown[];
}

/**
 * Result returned by the usePaginatedData hook
 */
export interface PaginatedDataResult<T> {
  /** List of fetched items */
  data: T[];
  /** Whether initial data is loading */
  loading: boolean;
  /** Whether more data is being loaded (pagination) */
  loadingMore: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Error message if fetch failed (legacy string for backwards compat) */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh data (resets to first page) */
  refresh: () => void;
  /** Load more items (pagination) */
  loadMore: () => void;
  /** Whether retry is currently blocked (e.g., rate limit countdown) */
  retryBlocked: boolean;
  /** Seconds until retry is allowed (for rate limit countdown) */
  retryCountdown: number;
  /** Reset all data and state (useful for tab switches) */
  reset: () => void;
  /** Remove an item by ID (useful for unbookmarking, etc.) */
  removeItem: (id: string) => void;
}

export function usePaginatedData<T>({
  fetchFn,
  getId,
  deps = [],
}: PaginatedDataOptions<T>): PaginatedDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track seen IDs to deduplicate items across pages
  const seenIds = useRef(new Set<string>());

  // Clear countdown timer helper
  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Clear countdown timer on unmount
  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, [clearCountdown]);

  // Start rate limit countdown
  const startCountdown = useCallback(
    (seconds: number) => {
      setRetryCountdown(seconds);
      clearCountdown();

      countdownRef.current = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev <= 1) {
            clearCountdown();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearCountdown]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiError(null);
    // Reset pagination state for fresh fetch
    seenIds.current.clear();

    const result = await fetchFn();

    if (result.success) {
      // Populate seen IDs with initial items
      for (const item of result.items) {
        seenIds.current.add(getId(item));
      }
      setData(result.items);
      setNextCursor(result.nextCursor);
      setHasMore(!!result.nextCursor && result.items.length > 0);
      setRetryCountdown(0);
      clearCountdown();
    } else {
      setError(result.error.message);
      setApiError(result.error);
      setHasMore(false);

      // Start countdown for rate limits
      if (result.error.type === "rate_limit" && result.error.retryAfter) {
        startCountdown(result.error.retryAfter);
      }
    }

    setLoading(false);
  }, [fetchFn, getId, clearCountdown, startCountdown]);

  // Fetch when dependencies change or refresh is triggered
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refreshCounter, ...deps]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);

    const result = await fetchFn(nextCursor);

    if (result.success) {
      // Filter out duplicates using seenIds
      const newItems = result.items.filter(
        (item) => !seenIds.current.has(getId(item))
      );
      for (const item of newItems) {
        seenIds.current.add(getId(item));
      }

      setData((prev) => [...prev, ...newItems]);
      setNextCursor(result.nextCursor);
      setHasMore(!!result.nextCursor && result.items.length > 0);
    } else {
      // On error, don't clear existing data, just stop pagination
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [fetchFn, getId, nextCursor, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    // Reset pagination state before refresh
    setNextCursor(undefined);
    setHasMore(true);
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

  const reset = useCallback(() => {
    setData([]);
    setNextCursor(undefined);
    setHasMore(true);
    seenIds.current.clear();
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setData((prev) => prev.filter((item) => getId(item) !== id));
      seenIds.current.delete(id);
    },
    [getId]
  );

  return {
    data,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked: retryCountdown > 0,
    retryCountdown,
    reset,
    removeItem,
  };
}
