/**
 * useTimeline - Hook for fetching and managing timeline data
 * Supports switching between For You (algorithmic) and Following (chronological) feeds
 * with infinite scroll pagination and typed error handling with rate limit detection
 */

import { useCallback, useMemo, useState } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import type { PaginatedFetchResult } from "./usePaginatedData";

import { usePaginatedData } from "./usePaginatedData";

export type TimelineTab = "for_you" | "following";

export interface UseTimelineOptions {
  client: XClient;
  initialTab?: TimelineTab;
}

export interface UseTimelineResult {
  /** Currently active tab */
  tab: TimelineTab;
  /** Switch to a different tab */
  setTab: (tab: TimelineTab) => void;
  /** List of posts for current tab */
  posts: TweetData[];
  /** Whether initial data is loading */
  loading: boolean;
  /** Whether more data is being loaded (pagination) */
  loadingMore: boolean;
  /** Whether there are more posts to load */
  hasMore: boolean;
  /** Error message if fetch failed (legacy string for backwards compat) */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh the current timeline (resets to first page) */
  refresh: () => void;
  /** Load more posts (pagination) */
  loadMore: () => void;
  /** Whether retry is currently blocked (e.g., rate limit countdown) */
  retryBlocked: boolean;
  /** Seconds until retry is allowed (for rate limit countdown) */
  retryCountdown: number;
}

export function useTimeline({
  client,
  initialTab = "for_you",
}: UseTimelineOptions): UseTimelineResult {
  const [tab, setTabInternal] = useState<TimelineTab>(initialTab);

  // Create fetch function that adapts client API to PaginatedFetchResult
  const fetchFn = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<TweetData>> => {
      // Use V2 for initial fetch, V1 for pagination (matches original behavior)
      const result = cursor
        ? tab === "for_you"
          ? await client.getHomeTimeline(30, cursor)
          : await client.getHomeLatestTimeline(30, cursor)
        : tab === "for_you"
          ? await client.getHomeTimelineV2(30)
          : await client.getHomeLatestTimelineV2(30);

      if (result.success) {
        return {
          success: true,
          items: result.tweets,
          nextCursor: result.nextCursor,
        };
      }
      // V1 methods return string errors, V2 return ApiError
      // Normalize to ApiError for usePaginatedData
      const error =
        typeof result.error === "string"
          ? { type: "unknown" as const, message: result.error }
          : result.error;
      return { success: false, error };
    },
    [client, tab]
  );

  const getId = useCallback((tweet: TweetData) => tweet.id, []);

  // Memoize deps array to prevent unnecessary re-renders
  const deps = useMemo(() => [tab], [tab]);

  const {
    data: posts,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked,
    retryCountdown,
    reset,
  } = usePaginatedData({
    fetchFn,
    getId,
    deps,
  });

  const setTab = useCallback(
    (newTab: TimelineTab) => {
      setTabInternal((prev) => {
        if (prev !== newTab) {
          // Reset pagination when switching tabs
          reset();
        }
        return newTab;
      });
    },
    [reset]
  );

  return {
    tab,
    setTab,
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked,
    retryCountdown,
  };
}
