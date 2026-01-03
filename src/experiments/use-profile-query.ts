/**
 * useProfileQuery - TanStack Query hook for user profile and tweets
 *
 * Features:
 * - Caches user profiles by username for instant navigation
 * - Dependent query for tweets (fetched after profile loads)
 * - Automatic background refetching when stale
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, TweetData, UserProfileData } from "@/api/types";

import { queryKeys } from "./query-client";

interface UseProfileQueryOptions {
  client: XClient;
  username: string;
}

interface UseProfileQueryResult {
  /** User profile data */
  user: UserProfileData | null;
  /** User's recent tweets */
  tweets: TweetData[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the profile data */
  refresh: () => void;
}

/**
 * Fetch user profile from X API
 */
async function fetchUserProfile(
  client: XClient,
  username: string
): Promise<UserProfileData> {
  const result = await client.getUserByScreenName(username);

  if (!result.success) {
    const error: ApiError = {
      type: "unknown",
      message: result.error ?? "Failed to load profile",
    };
    throw error;
  }

  if (!result.user) {
    const error: ApiError = {
      type: "not_found",
      message: "User not found",
    };
    throw error;
  }

  return result.user;
}

/**
 * Fetch user tweets from X API
 */
async function fetchUserTweets(
  client: XClient,
  userId: string
): Promise<TweetData[]> {
  const result = await client.getUserTweets(userId, 20);

  if (!result.success) {
    // Return empty array on failure - profile still shows even if tweets fail
    return [];
  }

  return result.tweets ?? [];
}

export function useProfileQuery({
  client,
  username,
}: UseProfileQueryOptions): UseProfileQueryResult {
  // Query for user profile
  const {
    data: user,
    isLoading: isLoadingUser,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: queryKeys.user.profile(username),
    queryFn: () => fetchUserProfile(client, username),
  });

  // Query for user tweets - only runs when we have the user ID
  const userId = user?.id;
  const {
    data: tweets,
    isLoading: isLoadingTweets,
    refetch: refetchTweets,
  } = useQuery({
    queryKey: queryKeys.user.tweets(userId ?? ""),
    queryFn: () => fetchUserTweets(client, userId!),
    enabled: !!userId,
  });

  // Combined loading state - loading if either is loading
  const loading = isLoadingUser || (!!userId && isLoadingTweets);

  // Extract error message from ApiError
  const error = useMemo(() => {
    if (!userError) return null;
    const apiError = userError as unknown as ApiError;
    return apiError.message ?? "Failed to load profile";
  }, [userError]);

  // Refresh both queries
  const refresh = useCallback(() => {
    refetchUser();
    if (userId) {
      refetchTweets();
    }
  }, [refetchUser, refetchTweets, userId]);

  return {
    user: user ?? null,
    tweets: tweets ?? [],
    loading,
    error,
    refresh,
  };
}
