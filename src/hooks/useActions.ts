/**
 * useActions - Hook for tweet action mutations (like, bookmark)
 *
 * Provides toggle functions with optimistic updates and error handling.
 */

import { useState, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

export interface UseActionsOptions {
  client: TwitterClient;
  /** Callback when an action fails - use to show error message */
  onError?: (error: string) => void;
  /** Callback when an action succeeds - use to show success message */
  onSuccess?: (message: string) => void;
}

export interface TweetActionState {
  /** Whether the tweet is liked by the current user */
  liked: boolean;
  /** Whether the tweet is bookmarked by the current user */
  bookmarked: boolean;
  /** Whether a like action is in progress */
  likePending: boolean;
  /** Whether a bookmark action is in progress */
  bookmarkPending: boolean;
}

export interface UseActionsResult {
  /** Get current action state for a tweet */
  getState: (tweetId: string) => TweetActionState;
  /** Toggle like state for a tweet */
  toggleLike: (tweet: TweetData) => Promise<void>;
  /** Toggle bookmark state for a tweet */
  toggleBookmark: (tweet: TweetData) => Promise<void>;
  /** Initialize state for a tweet (e.g., from API response) */
  initState: (tweetId: string, liked: boolean, bookmarked: boolean) => void;
}

const DEFAULT_STATE: TweetActionState = {
  liked: false,
  bookmarked: false,
  likePending: false,
  bookmarkPending: false,
};

export function useActions({
  client,
  onError,
  onSuccess,
}: UseActionsOptions): UseActionsResult {
  // Track action states by tweet ID
  const [states, setStates] = useState<Map<string, TweetActionState>>(
    new Map()
  );

  const getState = useCallback(
    (tweetId: string): TweetActionState => {
      return states.get(tweetId) ?? DEFAULT_STATE;
    },
    [states]
  );

  const updateState = useCallback(
    (tweetId: string, updates: Partial<TweetActionState>) => {
      setStates((prev) => {
        const newMap = new Map(prev);
        const current = prev.get(tweetId) ?? DEFAULT_STATE;
        newMap.set(tweetId, { ...current, ...updates });
        return newMap;
      });
    },
    []
  );

  const initState = useCallback(
    (tweetId: string, liked: boolean, bookmarked: boolean) => {
      setStates((prev) => {
        const newMap = new Map(prev);
        const current = prev.get(tweetId) ?? DEFAULT_STATE;
        newMap.set(tweetId, { ...current, liked, bookmarked });
        return newMap;
      });
    },
    []
  );

  const toggleLike = useCallback(
    async (tweet: TweetData) => {
      const currentState = states.get(tweet.id) ?? DEFAULT_STATE;

      // Prevent double-clicks
      if (currentState.likePending) return;

      const wasLiked = currentState.liked;
      const newLiked = !wasLiked;

      // Optimistic update
      updateState(tweet.id, { liked: newLiked, likePending: true });

      try {
        const result = newLiked
          ? await client.likeTweet(tweet.id)
          : await client.unlikeTweet(tweet.id);

        if (result.success) {
          updateState(tweet.id, { likePending: false });
          onSuccess?.(newLiked ? "Liked" : "Unliked");
        } else {
          // Check if error indicates the tweet was already in the target state
          const alreadyLiked = result.error.includes("already favorited");
          const notLiked = result.error.includes("not found");

          if (alreadyLiked && newLiked) {
            // We tried to like but it was already liked - sync state
            updateState(tweet.id, { liked: true, likePending: false });
            onSuccess?.("Already liked");
          } else if (notLiked && !newLiked) {
            // We tried to unlike but it wasn't liked - sync state
            updateState(tweet.id, { liked: false, likePending: false });
            onSuccess?.("Already unliked");
          } else {
            // Real error - revert
            updateState(tweet.id, { liked: wasLiked, likePending: false });
            onError?.(result.error);
          }
        }
      } catch (error) {
        // Revert on error
        updateState(tweet.id, { liked: wasLiked, likePending: false });
        onError?.(error instanceof Error ? error.message : String(error));
      }
    },
    [client, states, updateState, onError, onSuccess]
  );

  const toggleBookmark = useCallback(
    async (tweet: TweetData) => {
      const currentState = states.get(tweet.id) ?? DEFAULT_STATE;

      // Prevent double-clicks
      if (currentState.bookmarkPending) return;

      const wasBookmarked = currentState.bookmarked;
      const newBookmarked = !wasBookmarked;

      // Optimistic update
      updateState(tweet.id, {
        bookmarked: newBookmarked,
        bookmarkPending: true,
      });

      try {
        const result = newBookmarked
          ? await client.createBookmark(tweet.id)
          : await client.deleteBookmark(tweet.id);

        if (result.success) {
          updateState(tweet.id, { bookmarkPending: false });
          onSuccess?.(newBookmarked ? "Bookmarked" : "Removed bookmark");
        } else {
          // Check if error indicates the tweet was already in the target state
          const alreadyBookmarked = result.error.includes("already bookmarked");
          const notBookmarked = result.error.includes("not found");

          if (alreadyBookmarked && newBookmarked) {
            // We tried to bookmark but it was already bookmarked - sync state
            updateState(tweet.id, { bookmarked: true, bookmarkPending: false });
            onSuccess?.("Already bookmarked");
          } else if (notBookmarked && !newBookmarked) {
            // We tried to unbookmark but it wasn't bookmarked - sync state
            updateState(tweet.id, {
              bookmarked: false,
              bookmarkPending: false,
            });
            onSuccess?.("Already removed");
          } else {
            // Real error - revert
            updateState(tweet.id, {
              bookmarked: wasBookmarked,
              bookmarkPending: false,
            });
            onError?.(result.error);
          }
        }
      } catch (error) {
        // Revert on error
        updateState(tweet.id, {
          bookmarked: wasBookmarked,
          bookmarkPending: false,
        });
        onError?.(error instanceof Error ? error.message : String(error));
      }
    },
    [client, states, updateState, onError, onSuccess]
  );

  return {
    getState,
    toggleLike,
    toggleBookmark,
    initState,
  };
}
