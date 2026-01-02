/**
 * useTimeline - Hook for fetching and managing timeline data
 * Supports switching between For You (algorithmic) and Following (chronological) feeds
 */

import { useState, useEffect, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

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
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the current timeline */
  refresh: () => void;
}

export function useTimeline({
  client,
  initialTab = "for_you",
}: UseTimelineOptions): UseTimelineResult {
  const [tab, setTabInternal] = useState<TimelineTab>(initialTab);
  const [posts, setPosts] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result =
      tab === "for_you"
        ? await client.getHomeTimeline(30)
        : await client.getHomeLatestTimeline(30);

    if (result.success) {
      setPosts(result.tweets);
    } else {
      setError(result.error);
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
    setRefreshCounter((prev) => prev + 1);
  }, []);

  return {
    tab,
    setTab,
    posts,
    loading,
    error,
    refresh,
  };
}
