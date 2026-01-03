/**
 * useTimelineQuery - TanStack Query hook for timeline fetching
 *
 * Features:
 * - Infinite query for cursor-based pagination
 * - Shows "Refresh for new posts" banner after 5 minutes
 * - Deduplication across pages
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import { queryKeys } from "./query-client";

export type TimelineTab = "for_you" | "following";

interface TimelinePage {
  tweets: TweetData[];
  nextCursor?: string;
}

interface UseTimelineQueryOptions {
  client: XClient;
  initialTab?: TimelineTab;
  /** Time in ms before showing refresh banner (default: 300000 = 5 minutes) */
  refreshBannerDelay?: number;
}

interface UseTimelineQueryResult {
  /** Currently active tab */
  tab: TimelineTab;
  /** Switch to a different tab */
  setTab: (tab: TimelineTab) => void;
  /** Flattened list of posts with deduplication */
  posts: TweetData[];
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether more data is being loaded (pagination) */
  isFetchingNextPage: boolean;
  /** Whether there are more posts to load */
  hasNextPage: boolean;
  /** Error if fetch failed */
  error: ApiError | null;
  /** Fetch next page of results */
  fetchNextPage: () => void;
  /** Manually refresh timeline */
  refresh: () => void;
  /** Whether to show the refresh banner */
  showRefreshBanner: boolean;
  /** Whether refresh is in progress */
  isRefetching: boolean;
}

/**
 * Fetch timeline page from X API
 */
async function fetchTimelinePage(
  client: XClient,
  tab: TimelineTab,
  cursor?: string
): Promise<TimelinePage> {
  // Use V2 for initial fetch (returns ApiError), V1 for pagination
  const result = cursor
    ? tab === "for_you"
      ? await client.getHomeTimeline(30, cursor)
      : await client.getHomeLatestTimeline(30, cursor)
    : tab === "for_you"
      ? await client.getHomeTimelineV2(30)
      : await client.getHomeLatestTimelineV2(30);

  if (!result.success) {
    // Normalize V1 string errors to ApiError
    const error: ApiError =
      typeof result.error === "string"
        ? { type: "unknown", message: result.error }
        : result.error;
    throw error;
  }

  return {
    tweets: result.tweets,
    nextCursor: result.nextCursor,
  };
}

/**
 * Deduplicate tweets across all pages
 */
function deduplicateTweets(pages: TimelinePage[]): TweetData[] {
  const seen = new Set<string>();
  const result: TweetData[] = [];

  for (const page of pages) {
    for (const tweet of page.tweets) {
      if (!seen.has(tweet.id)) {
        seen.add(tweet.id);
        result.push(tweet);
      }
    }
  }

  return result;
}

const DEFAULT_REFRESH_BANNER_DELAY = 5 * 60 * 1000; // 5 minutes

export function useTimelineQuery({
  client,
  initialTab = "for_you",
  refreshBannerDelay = DEFAULT_REFRESH_BANNER_DELAY,
}: UseTimelineQueryOptions): UseTimelineQueryResult {
  const [tab, setTabState] = useState<TimelineTab>(initialTab);
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Main infinite query for timeline
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: queryKeys.timeline.byTab(tab),
    queryFn: async ({ pageParam }) => {
      return fetchTimelinePage(client, tab, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 0,
  });

  // Start/reset banner timer when data loads or refreshes
  const resetBannerTimer = useCallback(() => {
    // Clear existing timer
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    // Hide banner
    setShowRefreshBanner(false);
    // Start new timer
    bannerTimerRef.current = setTimeout(() => {
      setShowRefreshBanner(true);
    }, refreshBannerDelay);
  }, [refreshBannerDelay]);

  // Reset timer when data changes (initial load or refresh)
  useEffect(() => {
    if (data?.pages?.length) {
      resetBannerTimer();
    }
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, [data?.pages, resetBannerTimer]);

  // Flatten and deduplicate tweets from all pages
  const posts = useMemo(() => {
    if (!data?.pages) return [];
    return deduplicateTweets(data.pages);
  }, [data?.pages]);

  // Handle tab switch
  const setTab = useCallback(
    (newTab: TimelineTab) => {
      if (newTab !== tab) {
        setTabState(newTab);
        resetBannerTimer();
      }
    },
    [tab, resetBannerTimer]
  );

  // Manual refresh
  const refresh = useCallback(() => {
    setShowRefreshBanner(false);
    refetch();
  }, [refetch]);

  return {
    tab,
    setTab,
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error as ApiError | null,
    fetchNextPage,
    refresh,
    showRefreshBanner,
    isRefetching,
  };
}
