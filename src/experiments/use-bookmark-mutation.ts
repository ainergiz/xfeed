/**
 * useBookmarkMutation - TanStack Query mutation hook for bookmark operations
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache rollback on error
 * - Supports both adding and removing bookmarks
 * - Updates all relevant bookmark caches (all bookmarks + folder-specific)
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { queryKeys } from "./query-client";

interface BookmarksPage {
  tweets: TweetData[];
  nextCursor?: string;
}

interface BookmarksCacheData {
  pages: BookmarksPage[];
  pageParams: (string | undefined)[];
}

interface UseBookmarkMutationOptions {
  client: XClient;
  /** Callback when mutation succeeds */
  onSuccess?: (message: string) => void;
  /** Callback when mutation fails */
  onError?: (error: string) => void;
}

interface MutationContext {
  previousAllBookmarks?: BookmarksCacheData;
  previousFolderBookmarks?: Map<string, BookmarksCacheData>;
}

/** Duration for "just acted" visual feedback in ms */
const JUST_ACTED_DURATION = 600;

export function useBookmarkMutation({
  client,
  onSuccess,
  onError,
}: UseBookmarkMutationOptions) {
  const queryClient = useQueryClient();

  // Track pending state per tweet
  const [pendingTweets, setPendingTweets] = useState<Set<string>>(new Set());

  // Track "just bookmarked" state per tweet
  const [justBookmarkedTweets, setJustBookmarkedTweets] = useState<Set<string>>(
    new Set()
  );

  // Timeouts for clearing justBookmarked state
  const justBookmarkedTimeouts = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  // Add bookmark mutation
  const addMutation = useMutation({
    mutationFn: async (tweet: TweetData) => {
      const result = await client.createBookmark(tweet.id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { tweet, success: true };
    },
    onMutate: async (tweet) => {
      // Mark as pending
      setPendingTweets((prev) => new Set(prev).add(tweet.id));

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookmarks.all,
      });

      // Snapshot the previous values
      const previousAllBookmarks = queryClient.getQueryData<BookmarksCacheData>(
        queryKeys.bookmarks.list(undefined)
      );

      // Optimistically add to "all bookmarks" cache
      if (previousAllBookmarks) {
        queryClient.setQueryData<BookmarksCacheData>(
          queryKeys.bookmarks.list(undefined),
          (old) => {
            if (!old?.pages?.length) return old;

            // Add tweet to the beginning of the first page
            const firstPage = old.pages[0];
            if (!firstPage) return old;

            // Check if already exists
            const exists = old.pages.some((page) =>
              page.tweets.some((t) => t.id === tweet.id)
            );
            if (exists) return old;

            return {
              ...old,
              pages: [
                {
                  ...firstPage,
                  tweets: [tweet, ...firstPage.tweets],
                },
                ...old.pages.slice(1),
              ],
            };
          }
        );
      }

      return { previousAllBookmarks } as MutationContext;
    },
    onError: (error, tweet, context) => {
      // Remove from pending
      setPendingTweets((prev) => {
        const next = new Set(prev);
        next.delete(tweet.id);
        return next;
      });

      // Rollback cache
      if (context?.previousAllBookmarks) {
        queryClient.setQueryData(
          queryKeys.bookmarks.list(undefined),
          context.previousAllBookmarks
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle "already bookmarked" gracefully
      if (errorMessage.toLowerCase().includes("already bookmarked")) {
        onSuccess?.("Already bookmarked");
        return;
      }

      onError?.(errorMessage);
    },
    onSuccess: (_, tweet) => {
      // Remove from pending
      setPendingTweets((prev) => {
        const next = new Set(prev);
        next.delete(tweet.id);
        return next;
      });

      // Set justBookmarked for visual feedback
      const existingTimeout = justBookmarkedTimeouts.current.get(tweet.id);
      if (existingTimeout) clearTimeout(existingTimeout);

      setJustBookmarkedTweets((prev) => new Set(prev).add(tweet.id));

      const timeout = setTimeout(() => {
        setJustBookmarkedTweets((prev) => {
          const next = new Set(prev);
          next.delete(tweet.id);
          return next;
        });
        justBookmarkedTimeouts.current.delete(tweet.id);
      }, JUST_ACTED_DURATION);
      justBookmarkedTimeouts.current.set(tweet.id, timeout);

      onSuccess?.("Bookmarked");
    },
  });

  // Remove bookmark mutation
  const removeMutation = useMutation({
    mutationFn: async ({
      tweetId,
      folderId,
    }: {
      tweetId: string;
      tweet?: TweetData;
      folderId?: string;
    }) => {
      const result = await client.deleteBookmark(tweetId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { tweetId, folderId, success: true };
    },
    onMutate: async ({ tweetId, folderId }) => {
      // Mark as pending
      setPendingTweets((prev) => new Set(prev).add(tweetId));

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookmarks.all,
      });

      // Snapshot and update "all bookmarks" cache
      const previousAllBookmarks = queryClient.getQueryData<BookmarksCacheData>(
        queryKeys.bookmarks.list(undefined)
      );

      if (previousAllBookmarks) {
        queryClient.setQueryData<BookmarksCacheData>(
          queryKeys.bookmarks.list(undefined),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                tweets: page.tweets.filter((t) => t.id !== tweetId),
              })),
            };
          }
        );
      }

      // Snapshot and update folder-specific cache if provided
      const previousFolderBookmarks = new Map<string, BookmarksCacheData>();
      if (folderId) {
        const folderData = queryClient.getQueryData<BookmarksCacheData>(
          queryKeys.bookmarks.list(folderId)
        );
        if (folderData) {
          previousFolderBookmarks.set(folderId, folderData);
          queryClient.setQueryData<BookmarksCacheData>(
            queryKeys.bookmarks.list(folderId),
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  tweets: page.tweets.filter((t) => t.id !== tweetId),
                })),
              };
            }
          );
        }
      }

      return {
        previousAllBookmarks,
        previousFolderBookmarks,
      } as MutationContext;
    },
    onError: (error, { tweetId }, context) => {
      // Remove from pending
      setPendingTweets((prev) => {
        const next = new Set(prev);
        next.delete(tweetId);
        return next;
      });

      // Rollback caches
      if (context?.previousAllBookmarks) {
        queryClient.setQueryData(
          queryKeys.bookmarks.list(undefined),
          context.previousAllBookmarks
        );
      }
      if (context?.previousFolderBookmarks) {
        for (const [fId, data] of context.previousFolderBookmarks) {
          queryClient.setQueryData(queryKeys.bookmarks.list(fId), data);
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle "not found" gracefully (already removed)
      if (errorMessage.toLowerCase().includes("not found")) {
        onSuccess?.("Already removed");
        return;
      }

      onError?.(errorMessage);
    },
    onSuccess: (_, { tweetId }) => {
      // Remove from pending
      setPendingTweets((prev) => {
        const next = new Set(prev);
        next.delete(tweetId);
        return next;
      });

      onSuccess?.("Removed bookmark");
    },
  });

  // Public API
  const addBookmark = useCallback(
    (tweet: TweetData) => {
      if (pendingTweets.has(tweet.id)) return;
      addMutation.mutate(tweet);
    },
    [addMutation, pendingTweets]
  );

  const removeBookmark = useCallback(
    (tweetId: string, folderId?: string, tweet?: TweetData) => {
      if (pendingTweets.has(tweetId)) return;
      removeMutation.mutate({ tweetId, folderId, tweet });
    },
    [removeMutation, pendingTweets]
  );

  const toggleBookmark = useCallback(
    (tweet: TweetData, isCurrentlyBookmarked: boolean, folderId?: string) => {
      if (isCurrentlyBookmarked) {
        removeBookmark(tweet.id, folderId, tweet);
      } else {
        addBookmark(tweet);
      }
    },
    [addBookmark, removeBookmark]
  );

  const isPending = useCallback(
    (tweetId: string) => pendingTweets.has(tweetId),
    [pendingTweets]
  );

  const isJustBookmarked = useCallback(
    (tweetId: string) => justBookmarkedTweets.has(tweetId),
    [justBookmarkedTweets]
  );

  return {
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isPending,
    isJustBookmarked,
    isAddPending: addMutation.isPending,
    isRemovePending: removeMutation.isPending,
  };
}
