/**
 * usePostDetail - Hook for fetching thread context (parent tweet and replies)
 * Shows initial tweet immediately, then fetches additional context in background
 * Supports infinite scroll pagination for replies
 */

import { useState, useEffect, useCallback } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import type { PaginatedFetchResult } from "./usePaginatedData";

import { usePaginatedData } from "./usePaginatedData";

export interface UsePostDetailOptions {
  /** X API client */
  client: XClient;
  /** Initial tweet data (passed from timeline for immediate display) */
  tweet: TweetData;
}

export interface UsePostDetailResult {
  /** The main tweet data */
  tweet: TweetData;
  /** Parent tweet if this is a reply (null if not a reply or still loading) */
  parentTweet: TweetData | null;
  /** Replies to this tweet */
  replies: TweetData[];
  /** Whether parent tweet is loading */
  loadingParent: boolean;
  /** Whether replies are loading (initial load) */
  loadingReplies: boolean;
  /** Whether more replies are loading (pagination) */
  loadingMoreReplies: boolean;
  /** Whether there are more replies to load */
  hasMoreReplies: boolean;
  /** Error fetching parent (if any) */
  parentError: string | null;
  /** Error fetching replies (if any) */
  repliesError: string | null;
  /** Refresh replies (resets to first page) */
  refreshReplies: () => void;
  /** Load more replies (pagination) */
  loadMoreReplies: () => void;
}

export function usePostDetail({
  client,
  tweet,
}: UsePostDetailOptions): UsePostDetailResult {
  const [parentTweet, setParentTweet] = useState<TweetData | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);

  // Fetch parent tweet if this is a reply
  useEffect(() => {
    const parentId = tweet.inReplyToStatusId;
    if (!parentId) {
      setParentTweet(null);
      setLoadingParent(false);
      return;
    }

    let cancelled = false;
    setLoadingParent(true);
    setParentError(null);

    client.getTweet(parentId).then((result) => {
      if (cancelled) return;
      setLoadingParent(false);
      if (result.success && result.tweet) {
        setParentTweet(result.tweet);
      } else {
        setParentError(result.error ?? "Failed to fetch parent tweet");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [client, tweet.inReplyToStatusId]);

  // Create fetch function for paginated replies
  const fetchReplies = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<TweetData>> => {
      const result = await client.getReplies(tweet.id, cursor);

      if (result.success && result.tweets) {
        return {
          success: true,
          items: result.tweets,
          nextCursor: result.nextCursor,
        };
      }
      return {
        success: false,
        error: {
          type: "unknown",
          message: result.error ?? "Failed to fetch replies",
        },
      };
    },
    [client, tweet.id]
  );

  const getId = useCallback((reply: TweetData) => reply.id, []);

  // Use paginated data hook for replies
  const {
    data: replies,
    loading: loadingReplies,
    loadingMore: loadingMoreReplies,
    hasMore: hasMoreReplies,
    error: repliesError,
    refresh: refreshReplies,
    loadMore: loadMoreReplies,
  } = usePaginatedData({
    fetchFn: fetchReplies,
    getId,
    deps: [tweet.id],
  });

  return {
    tweet,
    parentTweet,
    replies,
    loadingParent,
    loadingReplies,
    loadingMoreReplies,
    hasMoreReplies,
    parentError,
    repliesError,
    refreshReplies,
    loadMoreReplies,
  };
}
