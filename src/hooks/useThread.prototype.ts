/**
 * useThread - Hook for fetching complete thread context
 *
 * This is an experimental hook for Issue #80.
 * Fetches ancestors, the focused tweet, and builds a reply tree.
 *
 * @experimental
 */

import { useState, useEffect, useCallback } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import {
  buildThreadTree,
  type ThreadNode,
} from "@/components/ThreadView.prototype";

export interface UseThreadOptions {
  client: XClient;
  tweet: TweetData;
  /** Maximum depth of ancestor chain to fetch (default: 10) */
  maxAncestorDepth?: number;
}

export interface UseThreadResult {
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
): Promise<{ ancestors: TweetData[]; error: string | null }> {
  const ancestors: TweetData[] = [];
  let current = startTweet;
  let depth = 0;

  while (current.inReplyToStatusId && depth < maxDepth) {
    try {
      const result = await client.getTweet(current.inReplyToStatusId);
      if (!result.success || !result.tweet) {
        // Parent might be deleted or inaccessible
        break;
      }
      ancestors.unshift(result.tweet); // Add to beginning (oldest first)
      current = result.tweet;
      depth++;
    } catch {
      // Stop on error but don't fail the whole operation
      break;
    }
  }

  return { ancestors, error: null };
}

/**
 * Build a reply tree from a flat list of tweets
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

export function useThread({
  client,
  tweet,
  maxAncestorDepth = 10,
}: UseThreadOptions): UseThreadResult {
  const [ancestors, setAncestors] = useState<TweetData[]>([]);
  const [allTweets, setAllTweets] = useState<TweetData[]>([]);
  const [replyTree, setReplyTree] = useState<ThreadNode | null>(null);
  const [loadingAncestors, setLoadingAncestors] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ancestor chain
  useEffect(() => {
    let cancelled = false;

    async function fetchAncestors() {
      if (!tweet.inReplyToStatusId) {
        setAncestors([]);
        return;
      }

      setLoadingAncestors(true);
      setError(null);

      try {
        const result = await fetchAncestorChain(
          client,
          tweet,
          maxAncestorDepth
        );
        if (!cancelled) {
          setAncestors(result.ancestors);
          if (result.error) {
            setError(result.error);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch ancestors"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAncestors(false);
        }
      }
    }

    fetchAncestors();

    return () => {
      cancelled = true;
    };
  }, [client, tweet.id, tweet.inReplyToStatusId, maxAncestorDepth]);

  // Fetch full thread (for reply tree)
  const fetchThread = useCallback(async () => {
    setLoadingReplies(true);
    setError(null);

    try {
      const result = await client.getThread(tweet.id);

      if (!result.success) {
        setError(result.error ?? "Failed to fetch thread");
        setAllTweets([]);
        setReplyTree(null);
        return;
      }

      const tweets = result.tweets ?? [];
      setAllTweets(tweets);

      // Build reply tree
      const tree = buildReplyTree(tweets, tweet.id);
      setReplyTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch thread");
      setAllTweets([]);
      setReplyTree(null);
    } finally {
      setLoadingReplies(false);
    }
  }, [client, tweet.id]);

  // Initial fetch
  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  return {
    ancestors,
    tweet,
    replyTree,
    allTweets,
    loadingAncestors,
    loadingReplies,
    error,
    refreshReplies: fetchThread,
  };
}

/**
 * Alternative: useThreadWithDirectReplies
 *
 * Uses getReplies() instead of getThread() for a simpler flat list,
 * then builds minimal tree structure from the direct replies only.
 */
export function useThreadWithDirectReplies({
  client,
  tweet,
  maxAncestorDepth = 10,
}: UseThreadOptions): UseThreadResult {
  const [ancestors, setAncestors] = useState<TweetData[]>([]);
  const [replies, setReplies] = useState<TweetData[]>([]);
  const [replyTree, setReplyTree] = useState<ThreadNode | null>(null);
  const [loadingAncestors, setLoadingAncestors] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ancestor chain (same as above)
  useEffect(() => {
    let cancelled = false;

    async function fetchAncestors() {
      if (!tweet.inReplyToStatusId) {
        setAncestors([]);
        return;
      }

      setLoadingAncestors(true);

      try {
        const result = await fetchAncestorChain(
          client,
          tweet,
          maxAncestorDepth
        );
        if (!cancelled) {
          setAncestors(result.ancestors);
        }
      } catch {
        // Silently handle - partial ancestor chain is okay
      } finally {
        if (!cancelled) {
          setLoadingAncestors(false);
        }
      }
    }

    fetchAncestors();

    return () => {
      cancelled = true;
    };
  }, [client, tweet.id, tweet.inReplyToStatusId, maxAncestorDepth]);

  // Fetch direct replies only
  const fetchReplies = useCallback(async () => {
    setLoadingReplies(true);
    setError(null);

    try {
      const result = await client.getReplies(tweet.id);

      if (!result.success) {
        setError(result.error ?? "Failed to fetch replies");
        setReplies([]);
        setReplyTree(null);
        return;
      }

      const fetchedReplies = result.tweets ?? [];
      setReplies(fetchedReplies);

      // Build simple tree (focused tweet as root, replies as children)
      if (fetchedReplies.length > 0) {
        const rootNode: ThreadNode = {
          tweet,
          children: fetchedReplies.map((reply) => ({
            tweet: reply,
            children: [], // Direct replies only, no nested fetching
            collapsed: false,
            depth: 1,
          })),
          collapsed: false,
          depth: 0,
        };
        setReplyTree(rootNode);
      } else {
        setReplyTree(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch replies");
      setReplies([]);
      setReplyTree(null);
    } finally {
      setLoadingReplies(false);
    }
  }, [client, tweet]);

  // Initial fetch
  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  return {
    ancestors,
    tweet,
    replyTree,
    allTweets: [tweet, ...replies],
    loadingAncestors,
    loadingReplies,
    error,
    refreshReplies: fetchReplies,
  };
}
