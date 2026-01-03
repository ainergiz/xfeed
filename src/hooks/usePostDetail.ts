/**
 * usePostDetail - Hook for fetching thread context (parent tweet and replies)
 * Shows initial tweet immediately, then fetches additional context in background
 */

import { useState, useEffect, useCallback } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

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
  /** Whether replies are loading */
  loadingReplies: boolean;
  /** Error fetching parent (if any) */
  parentError: string | null;
  /** Error fetching replies (if any) */
  repliesError: string | null;
  /** Refresh replies */
  refreshReplies: () => void;
}

export function usePostDetail({
  client,
  tweet,
}: UsePostDetailOptions): UsePostDetailResult {
  const [parentTweet, setParentTweet] = useState<TweetData | null>(null);
  const [replies, setReplies] = useState<TweetData[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);
  const [repliesError, setRepliesError] = useState<string | null>(null);

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

  // Fetch replies
  const fetchReplies = useCallback(async () => {
    setLoadingReplies(true);
    setRepliesError(null);

    const result = await client.getReplies(tweet.id);

    setLoadingReplies(false);
    if (result.success && result.tweets) {
      setReplies(result.tweets);
    } else {
      setRepliesError(result.error ?? "Failed to fetch replies");
    }
  }, [client, tweet.id]);

  // Fetch replies on mount
  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  return {
    tweet,
    parentTweet,
    replies,
    loadingParent,
    loadingReplies,
    parentError,
    repliesError,
    refreshReplies: fetchReplies,
  };
}
