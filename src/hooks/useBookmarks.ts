/**
 * useBookmarks - Hook for fetching and managing bookmark data
 * with infinite scroll pagination and typed error handling with rate limit detection
 */

import { useState, useEffect, useCallback, useRef } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

export interface UseBookmarksOptions {
  client: XClient;
}

export interface UseBookmarksResult {
  /** List of bookmarked posts */
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
  /** Refresh bookmarks (resets to first page) */
  refresh: () => void;
  /** Load more bookmarks (pagination) */
  loadMore: () => void;
  /** Whether retry is currently blocked (e.g., rate limit countdown) */
  retryBlocked: boolean;
  /** Seconds until retry is allowed (for rate limit countdown) */
  retryCountdown: number;
  /** Remove a post from the list (used when unbookmarked from detail view) */
  removePost: (tweetId: string) => void;
}

export function useBookmarks({
  client,
}: UseBookmarksOptions): UseBookmarksResult {
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

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiError(null);
    // Reset pagination state for fresh fetch
    seenIds.current.clear();

    const result = await client.getBookmarksV2(30);

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
  }, [client]);

  // Fetch on mount and when refresh is triggered
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks, refreshCounter]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);

    const result = await client.getBookmarksV2(30, nextCursor);

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
  }, [client, nextCursor, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    // Reset pagination state before refresh
    setNextCursor(undefined);
    setHasMore(true);
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

  const removePost = useCallback((tweetId: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== tweetId));
    seenIds.current.delete(tweetId);
  }, []);

  return {
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
    removePost,
  };
}
