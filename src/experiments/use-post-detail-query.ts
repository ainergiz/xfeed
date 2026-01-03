/**
 * usePostDetailQuery - TanStack Query hook for post detail fetching
 *
 * Features:
 * - Uses initial tweet data from navigation (avoids refetch)
 * - Fetches parent tweet if this is a reply
 * - Infinite query for paginated replies
 * - Deduplication across reply pages
 */

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import { queryKeys } from "./query-client";

interface RepliesPage {
  replies: TweetData[];
  nextCursor?: string;
}

export interface UsePostDetailQueryOptions {
  /** X API client */
  client: XClient;
  /** Initial tweet data (passed from timeline for immediate display) */
  tweet: TweetData;
}

export interface UsePostDetailQueryResult {
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

/**
 * Fetch replies page from X API
 */
async function fetchRepliesPage(
  client: XClient,
  tweetId: string,
  cursor?: string
): Promise<RepliesPage> {
  const result = await client.getReplies(tweetId, cursor);

  if (!result.success) {
    const error: ApiError = {
      type: "unknown",
      message: result.error ?? "Failed to fetch replies",
    };
    throw error;
  }

  return {
    replies: result.tweets ?? [],
    nextCursor: result.nextCursor,
  };
}

/**
 * Deduplicate replies across all pages
 */
function deduplicateReplies(pages: RepliesPage[]): TweetData[] {
  const seen = new Set<string>();
  const result: TweetData[] = [];

  for (const page of pages) {
    for (const reply of page.replies) {
      if (!seen.has(reply.id)) {
        seen.add(reply.id);
        result.push(reply);
      }
    }
  }

  return result;
}

export function usePostDetailQuery({
  client,
  tweet,
}: UsePostDetailQueryOptions): UsePostDetailQueryResult {
  const queryClient = useQueryClient();

  // Populate the cache with the initial tweet data from navigation
  // This prevents an unnecessary refetch when we already have the data
  useEffect(() => {
    queryClient.setQueryData(queryKeys.tweet.detail(tweet.id), tweet);
  }, [queryClient, tweet.id, tweet]);

  // Fetch parent tweet if this is a reply
  const parentTweetId = tweet.inReplyToStatusId;
  const {
    data: parentTweet,
    isLoading: loadingParent,
    error: parentQueryError,
  } = useQuery({
    queryKey: queryKeys.tweet.detail(parentTweetId ?? ""),
    queryFn: async () => {
      if (!parentTweetId) return null;
      const result = await client.getTweet(parentTweetId);
      if (!result.success) {
        const error: ApiError = {
          type: "unknown",
          message: result.error ?? "Failed to fetch parent tweet",
        };
        throw error;
      }
      return result.tweet ?? null;
    },
    enabled: !!parentTweetId,
  });

  // Infinite query for paginated replies
  const {
    data: repliesData,
    isLoading: loadingReplies,
    isFetchingNextPage: loadingMoreReplies,
    hasNextPage,
    error: repliesQueryError,
    fetchNextPage,
    refetch: refetchReplies,
  } = useInfiniteQuery({
    queryKey: queryKeys.tweet.replies(tweet.id),
    queryFn: async ({ pageParam }) => {
      return fetchRepliesPage(client, tweet.id, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  // Flatten and deduplicate replies from all pages
  const replies = useMemo(() => {
    if (!repliesData?.pages) return [];
    return deduplicateReplies(repliesData.pages);
  }, [repliesData?.pages]);

  // Extract error messages - handle both ApiError and regular Error
  const parentError = parentQueryError
    ? ((parentQueryError as unknown as ApiError).message ??
      (parentQueryError instanceof Error ? parentQueryError.message : null) ??
      "Failed to fetch parent tweet")
    : null;
  const repliesError = repliesQueryError
    ? ((repliesQueryError as unknown as ApiError).message ??
      (repliesQueryError instanceof Error ? repliesQueryError.message : null) ??
      "Failed to fetch replies")
    : null;

  return {
    tweet,
    parentTweet: parentTweet ?? null,
    replies,
    loadingParent: !!parentTweetId && loadingParent,
    loadingReplies,
    loadingMoreReplies,
    hasMoreReplies: hasNextPage ?? false,
    parentError,
    repliesError,
    refreshReplies: () => refetchReplies(),
    loadMoreReplies: () => fetchNextPage(),
  };
}
