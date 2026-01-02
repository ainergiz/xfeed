/**
 * useTimeline - Hook for fetching and managing timeline data
 * Supports switching between For You (algorithmic) and Following (chronological) feeds
 * with infinite scroll pagination and typed error handling with rate limit detection
 */

import { useState, useEffect, useCallback, useRef } from "react";

import type { TwitterClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

export type TimelineTab = "for_you" | "following";

export interface UseTimelineOptions {
  client: TwitterClient;
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
  const [posts, setPosts] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track seen IDs to deduplicate posts across pages
  const seenIds = useRef(new Set<string>());

  // Clear countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiError(null);
    // Reset pagination state for fresh fetch
    seenIds.current.clear();

    const result =
      tab === "for_you"
        ? await client.getHomeTimelineV2(30)
        : await client.getHomeLatestTimelineV2(30);

    if (result.success) {
      // Populate seen IDs with initial posts
      for (const tweet of result.tweets) {
        seenIds.current.add(tweet.id);
      }
      setPosts(result.tweets);
      setNextCursor(result.nextCursor);
      setHasMore(!!result.nextCursor && result.tweets.length > 0);
      setRetryCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    } else {
      setError(result.error.message);
      setApiError(result.error);
      setHasMore(false);

      // Start countdown for rate limits
      if (result.error.type === "rate_limit" && result.error.retryAfter) {
        setRetryCountdown(result.error.retryAfter);

        // Clear any existing countdown
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }

        // Start new countdown
        countdownRef.current = setInterval(() => {
          setRetryCountdown((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    setLoading(false);
  }, [client, tab]);

  // Fetch when tab changes or refresh is triggered
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline, refreshCounter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);

    const result =
      tab === "for_you"
        ? await client.getHomeTimeline(30, nextCursor)
        : await client.getHomeLatestTimeline(30, nextCursor);

    if (result.success) {
      // Filter out duplicates using seenIds
      const newPosts = result.tweets.filter((t) => !seenIds.current.has(t.id));
      for (const tweet of newPosts) {
        seenIds.current.add(tweet.id);
      }

      setPosts((prev) => [...prev, ...newPosts]);
      setNextCursor(result.nextCursor);
      setHasMore(!!result.nextCursor && result.tweets.length > 0);
    } else {
      // On error, don't clear existing posts, just stop pagination
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [client, tab, nextCursor, loadingMore, hasMore]);

  const setTab = useCallback((newTab: TimelineTab) => {
    setTabInternal((prev) => {
      if (prev !== newTab) {
        // Clear posts and reset pagination when switching tabs
        setPosts([]);
        setNextCursor(undefined);
        setHasMore(true);
        seenIds.current.clear();
      }
      return newTab;
    });
  }, []);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    // Reset pagination state before refresh
    setNextCursor(undefined);
    setHasMore(true);
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

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
    retryBlocked: retryCountdown > 0,
    retryCountdown,
  };
}
