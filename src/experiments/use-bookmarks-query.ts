/**
 * useBookmarksQuery - TanStack Query hook for bookmarks fetching
 *
 * Features:
 * - Infinite query for cursor-based pagination
 * - Folder filtering with separate cache keys per folder
 * - Deduplication across pages
 * - Cache mutation for bookmark removal
 */

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData } from "@/api/types";

import { queryKeys } from "./query-client";

interface BookmarksPage {
  tweets: TweetData[];
  nextCursor?: string;
}

interface UseBookmarksQueryOptions {
  client: XClient;
  /** Optional folder ID to filter bookmarks by a specific folder */
  folderId?: string | null;
}

interface UseBookmarksQueryResult {
  /** List of bookmarked posts */
  posts: TweetData[];
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether more data is being loaded (pagination) */
  isFetchingNextPage: boolean;
  /** Whether there are more posts to load */
  hasNextPage: boolean;
  /** Error if fetch failed */
  error: ApiError | null;
  /** Fetch next page of results */
  fetchNextPage: () => void;
  /** Manually refresh bookmarks */
  refresh: () => void;
  /** Whether refresh is in progress */
  isRefetching: boolean;
  /** Remove a post from the cache (used when unbookmarked) */
  removePost: (tweetId: string) => void;
}

/**
 * Fetch bookmarks page from X API
 */
async function fetchBookmarksPage(
  client: XClient,
  folderId: string | undefined | null,
  cursor?: string
): Promise<BookmarksPage> {
  const result = folderId
    ? await client.getBookmarkFolderTimelineV2(folderId, 30, cursor)
    : await client.getBookmarksV2(30, cursor);

  if (!result.success) {
    throw result.error;
  }

  return {
    tweets: result.tweets,
    nextCursor: result.nextCursor,
  };
}

/**
 * Deduplicate tweets across all pages
 */
function deduplicateTweets(pages: BookmarksPage[]): TweetData[] {
  const seen = new Set<string>();
  const result: TweetData[] = [];

  for (const page of pages) {
    for (const tweet of page.tweets) {
      if (!seen.has(tweet.id)) {
        seen.add(tweet.id);
        result.push(tweet);
      }
    }
  }

  return result;
}

export function useBookmarksQuery({
  client,
  folderId,
}: UseBookmarksQueryOptions): UseBookmarksQueryResult {
  const queryClient = useQueryClient();

  // Normalize folderId: treat null and undefined the same
  const normalizedFolderId = folderId ?? undefined;

  // Main infinite query for bookmarks
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: queryKeys.bookmarks.list(normalizedFolderId),
    queryFn: async ({ pageParam }) => {
      return fetchBookmarksPage(client, normalizedFolderId, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 0,
  });

  // Flatten and deduplicate tweets from all pages
  const posts = useMemo(() => {
    if (!data?.pages) return [];
    return deduplicateTweets(data.pages);
  }, [data?.pages]);

  // Manual refresh
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Remove a post from the cache (called when user unbookmarks)
  const removePost = useCallback(
    (tweetId: string) => {
      const queryKey = queryKeys.bookmarks.list(normalizedFolderId);

      queryClient.setQueryData<{
        pages: BookmarksPage[];
        pageParams: (string | undefined)[];
      }>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.filter((tweet) => tweet.id !== tweetId),
          })),
        };
      });
    },
    [queryClient, normalizedFolderId]
  );

  return {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error as ApiError | null,
    fetchNextPage,
    refresh,
    isRefetching,
    removePost,
  };
}
