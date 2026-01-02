/**
 * useTimeline - Hook for fetching and managing timeline data
 * Supports switching between For You (algorithmic) and Following (chronological) feeds
 * Includes typed error handling with rate limit detection
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
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed (legacy string for backwards compat) */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh the current timeline */
  refresh: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const result =
      tab === "for_you"
        ? await client.getHomeTimelineV2(30)
        : await client.getHomeLatestTimelineV2(30);

    if (result.success) {
      setPosts(result.tweets);
      setRetryCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    } else {
      setError(result.error.message);
      setApiError(result.error);

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

  const setTab = useCallback((newTab: TimelineTab) => {
    setTabInternal((prev) => {
      if (prev !== newTab) {
        // Clear posts when switching tabs for smoother transition
        setPosts([]);
      }
      return newTab;
    });
  }, []);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

  return {
    tab,
    setTab,
    posts,
    loading,
    error,
    apiError,
    refresh,
    retryBlocked: retryCountdown > 0,
    retryCountdown,
  };
}
