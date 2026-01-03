/**
 * TanStack Query client configuration for terminal environment
 *
 * Key considerations:
 * - No window focus events in terminal, so disable refetchOnWindowFocus
 * - Custom retry logic for X API rate limits
 * - Stale time configured for timeline freshness
 */

import { QueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/api/types";

/**
 * Custom retry function that respects X API rate limits
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Type guard for ApiError
  const apiError = error as ApiError | undefined;

  // Don't retry rate limits - let the UI handle countdown
  if (apiError?.type === "rate_limit") {
    return false;
  }

  // Don't retry auth errors - need user intervention
  if (apiError?.type === "auth_expired") {
    return false;
  }

  // Don't retry not found - permanent error
  if (apiError?.type === "not_found") {
    return false;
  }

  // Retry network errors up to 3 times
  if (apiError?.type === "network_error") {
    return failureCount < 3;
  }

  // Default: retry up to 2 times for unknown errors
  return failureCount < 2;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attemptIndex: number, error: unknown): number {
  const apiError = error as ApiError | undefined;

  // Use rate limit retry-after if available
  if (apiError?.type === "rate_limit" && apiError.retryAfter) {
    return apiError.retryAfter * 1000;
  }

  // Exponential backoff: 1s, 2s, 4s...
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

/**
 * Create a QueryClient configured for the terminal environment
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Terminal has no window focus, disable this
        refetchOnWindowFocus: false,

        // Don't refetch when component remounts (preserve scroll position)
        refetchOnMount: false,

        // Keep data in cache for 5 minutes after last subscriber
        gcTime: 5 * 60 * 1000,

        // Consider data stale after 30 seconds
        // This enables background refetch on next access
        staleTime: 30 * 1000,

        // Custom retry logic for X API
        retry: shouldRetry,
        retryDelay: getRetryDelay,

        // Don't throw errors to error boundaries
        throwOnError: false,
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
      },
    },
  });
}

/**
 * Query key factory for consistent cache keys
 */
export const queryKeys = {
  timeline: {
    all: ["timeline"] as const,
    forYou: () => [...queryKeys.timeline.all, "for_you"] as const,
    following: () => [...queryKeys.timeline.all, "following"] as const,
    byTab: (tab: "for_you" | "following") =>
      [...queryKeys.timeline.all, tab] as const,
  },
  bookmarks: {
    all: ["bookmarks"] as const,
    list: (folderId?: string) =>
      folderId
        ? ([...queryKeys.bookmarks.all, "folder", folderId] as const)
        : ([...queryKeys.bookmarks.all, "list"] as const),
    folders: () => [...queryKeys.bookmarks.all, "folders"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => [...queryKeys.notifications.all, "list"] as const,
    poll: () => [...queryKeys.notifications.all, "poll"] as const,
  },
  tweet: {
    all: ["tweet"] as const,
    detail: (id: string) => [...queryKeys.tweet.all, id] as const,
    replies: (id: string) => [...queryKeys.tweet.all, id, "replies"] as const,
  },
  thread: {
    all: ["thread"] as const,
    byTweetId: (tweetId: string) => [...queryKeys.thread.all, tweetId] as const,
    ancestors: (tweetId: string) =>
      [...queryKeys.thread.all, tweetId, "ancestors"] as const,
  },
  user: {
    all: ["user"] as const,
    profile: (username: string) =>
      [...queryKeys.user.all, username, "profile"] as const,
    tweets: (userId: string) =>
      [...queryKeys.user.all, userId, "tweets"] as const,
    likes: () => [...queryKeys.user.all, "likes"] as const,
  },
} as const;
