/**
 * useBookmarks - Hook for fetching and managing bookmark data
 * with infinite scroll pagination and typed error handling with rate limit detection
 */

import { useCallback } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import type { PaginatedFetchResult } from "./usePaginatedData";

import { usePaginatedData } from "./usePaginatedData";

export interface UseBookmarksOptions {
  client: XClient;
  /** Optional folder ID to filter bookmarks by a specific folder */
  folderId?: string | null;
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
  folderId,
}: UseBookmarksOptions): UseBookmarksResult {
  // Create fetch function that adapts client API to PaginatedFetchResult
  // Fetches from specific folder if folderId is provided, otherwise fetches all bookmarks
  const fetchFn = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<TweetData>> => {
      const result = folderId
        ? await client.getBookmarkFolderTimelineV2(folderId, 30, cursor)
        : await client.getBookmarksV2(30, cursor);

      if (result.success) {
        return {
          success: true,
          items: result.tweets,
          nextCursor: result.nextCursor,
        };
      }
      return { success: false, error: result.error };
    },
    [client, folderId]
  );

  const getId = useCallback((tweet: TweetData) => tweet.id, []);

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
    removeItem,
  } = usePaginatedData({
    fetchFn,
    getId,
    // Re-fetch when folderId changes
    deps: [folderId],
  });

  const removePost = useCallback(
    (tweetId: string) => {
      removeItem(tweetId);
    },
    [removeItem]
  );

  return {
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
    removePost,
  };
}
