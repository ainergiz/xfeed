/**
 * useBookmarkFolders - Hook for fetching bookmark folder list
 */

import { useState, useEffect, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { BookmarkFolder } from "@/api/types";

export interface UseBookmarkFoldersOptions {
  client: TwitterClient;
  /** Whether to fetch folders on mount (default: true) */
  enabled?: boolean;
}

export interface UseBookmarkFoldersResult {
  /** List of bookmark folders */
  folders: BookmarkFolder[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => void;
}

export function useBookmarkFolders({
  client,
  enabled = true,
}: UseBookmarkFoldersOptions): UseBookmarkFoldersResult {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchFolders = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    const result = await client.getBookmarkFolders();

    if (result.success) {
      setFolders(result.folders);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, [client, enabled]);

  // Fetch on mount and when refresh is triggered
  useEffect(() => {
    if (enabled) {
      fetchFolders();
    }
  }, [fetchFolders, refreshCounter, enabled]);

  const refresh = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  return {
    folders,
    loading,
    error,
    refresh,
  };
}
