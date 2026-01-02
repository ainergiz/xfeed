/**
 * useBookmarks - Hook for fetching and managing bookmark data
 * Includes typed error handling with rate limit detection
 */

import { useState, useEffect, useCallback, useRef } from "react";

import type { TwitterClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

export interface UseBookmarksOptions {
  client: TwitterClient;
}

export interface UseBookmarksResult {
  /** List of bookmarked posts */
  posts: TweetData[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed (legacy string for backwards compat) */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh bookmarks */
  refresh: () => void;
  /** Whether retry is currently blocked (e.g., rate limit countdown) */
  retryBlocked: boolean;
  /** Seconds until retry is allowed (for rate limit countdown) */
  retryCountdown: number;
}

export function useBookmarks({
  client,
}: UseBookmarksOptions): UseBookmarksResult {
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

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiError(null);

    const result = await client.getBookmarksV2(30);

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
  }, [client]);

  // Fetch on mount and when refresh is triggered
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks, refreshCounter]);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

  return {
    posts,
    loading,
    error,
    apiError,
    refresh,
    retryBlocked: retryCountdown > 0,
    retryCountdown,
  };
}
