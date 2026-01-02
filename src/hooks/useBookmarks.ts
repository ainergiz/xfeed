/**
 * useBookmarks - Hook for fetching and managing bookmark data
 */

import { useState, useEffect, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

export interface UseBookmarksOptions {
  client: TwitterClient;
}

export interface UseBookmarksResult {
  /** List of bookmarked posts */
  posts: TweetData[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh bookmarks */
  refresh: () => void;
}

export function useBookmarks({
  client,
}: UseBookmarksOptions): UseBookmarksResult {
  const [posts, setPosts] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await client.getBookmarks(30);

    if (result.success) {
      setPosts(result.tweets ?? []);
    } else {
      setError(result.error ?? "Failed to fetch bookmarks");
    }

    setLoading(false);
  }, [client]);

  // Fetch on mount and when refresh is triggered
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks, refreshCounter]);

  const refresh = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  return {
    posts,
    loading,
    error,
    refresh,
  };
}
