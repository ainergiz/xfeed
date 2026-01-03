/**
 * useThreadQuery - TanStack Query hook for thread/conversation fetching
 *
 * Features:
 * - Uses initial tweet data from navigation (avoids refetch)
 * - Fetches ancestor chain (parent tweets)
 * - Fetches thread replies via getThread API
 * - Builds reply tree structure for ThreadView
 * - Caches by root tweet ID
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import {
  buildThreadTree,
  type ThreadNode,
} from "@/components/ThreadView.prototype";

import { queryKeys } from "./query-client";

export interface UseThreadQueryOptions {
  /** X API client */
  client: XClient;
  /** Initial tweet data (passed from timeline for immediate display) */
  tweet: TweetData;
  /** Maximum depth of ancestor chain to fetch (default: 10) */
  maxAncestorDepth?: number;
}

export interface UseThreadQueryResult {
  /** Chain of ancestors from oldest to most recent parent */
  ancestors: TweetData[];
  /** The focused tweet */
  tweet: TweetData;
  /** Tree structure of replies */
  replyTree: ThreadNode | null;
  /** All tweets in the thread (flat) */
  allTweets: TweetData[];
  /** Loading state for ancestors */
  loadingAncestors: boolean;
  /** Loading state for replies */
  loadingReplies: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the reply tree */
  refreshReplies: () => void;
}

/**
 * Fetch the chain of ancestor tweets
 */
async function fetchAncestorChain(
  client: XClient,
  startTweet: TweetData,
  maxDepth: number
): Promise<TweetData[]> {
  const ancestors: TweetData[] = [];
  let current = startTweet;
  let depth = 0;

  while (current.inReplyToStatusId && depth < maxDepth) {
    const result = await client.getTweet(current.inReplyToStatusId);
    if (!result.success || !result.tweet) {
      // Parent might be deleted or inaccessible - stop but don't fail
      break;
    }
    ancestors.unshift(result.tweet); // Add to beginning (oldest first)
    current = result.tweet;
    depth++;
  }

  return ancestors;
}

/**
 * Fetch thread data (replies) from X API
 */
async function fetchThread(
  client: XClient,
  tweetId: string
): Promise<TweetData[]> {
  const result = await client.getThread(tweetId);

  if (!result.success) {
    const error: ApiError = {
      type: "unknown",
      message: result.error ?? "Failed to fetch thread",
    };
    throw error;
  }

  return result.tweets ?? [];
}

/**
 * Build a reply tree from thread data
 */
function buildReplyTree(
  tweets: TweetData[],
  focusedTweetId: string
): ThreadNode | null {
  // Filter to only replies to our focused tweet (and their children)
  const relevantTweets = tweets.filter((t) => t.id !== focusedTweetId);

  if (relevantTweets.length === 0) return null;

  // Create a virtual root node for the focused tweet
  const focusedTweet = tweets.find((t) => t.id === focusedTweetId);
  if (!focusedTweet) return null;

  return buildThreadTree([focusedTweet, ...relevantTweets], focusedTweetId);
}

export function useThreadQuery({
  client,
  tweet,
  maxAncestorDepth = 10,
}: UseThreadQueryOptions): UseThreadQueryResult {
  const queryClient = useQueryClient();

  // Populate the cache with the initial tweet data from navigation
  // This prevents an unnecessary refetch when we already have the data
  useEffect(() => {
    queryClient.setQueryData(queryKeys.tweet.detail(tweet.id), tweet);
  }, [queryClient, tweet.id, tweet]);

  // Query for ancestor chain
  const {
    data: ancestors = [],
    isLoading: loadingAncestors,
    error: ancestorsError,
  } = useQuery({
    queryKey: queryKeys.thread.ancestors(tweet.id),
    queryFn: () => fetchAncestorChain(client, tweet, maxAncestorDepth),
    // Only fetch if this tweet is a reply
    enabled: !!tweet.inReplyToStatusId,
    // Ancestors rarely change, longer stale time
    staleTime: 5 * 60 * 1000,
  });

  // Query for thread (replies)
  const {
    data: threadTweets = [],
    isLoading: loadingReplies,
    error: repliesError,
    refetch: refetchThread,
  } = useQuery({
    queryKey: queryKeys.thread.byTweetId(tweet.id),
    queryFn: () => fetchThread(client, tweet.id),
  });

  // Build reply tree from thread data
  const replyTree = useMemo(() => {
    if (threadTweets.length === 0) return null;
    return buildReplyTree(threadTweets, tweet.id);
  }, [threadTweets, tweet.id]);

  // Extract error messages
  const error = useMemo(() => {
    if (ancestorsError) {
      const apiError = ancestorsError as unknown as ApiError;
      return (
        apiError.message ??
        (ancestorsError instanceof Error
          ? ancestorsError.message
          : "Failed to fetch ancestors")
      );
    }
    if (repliesError) {
      const apiError = repliesError as unknown as ApiError;
      return (
        apiError.message ??
        (repliesError instanceof Error
          ? repliesError.message
          : "Failed to fetch thread")
      );
    }
    return null;
  }, [ancestorsError, repliesError]);

  return {
    ancestors,
    tweet,
    replyTree,
    allTweets: threadTweets,
    loadingAncestors: !!tweet.inReplyToStatusId && loadingAncestors,
    loadingReplies,
    error,
    refreshReplies: () => refetchThread(),
  };
}
