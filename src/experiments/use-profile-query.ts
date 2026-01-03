/**
 * useProfileQuery - TanStack Query hook for user profile fetching
 *
 * Features:
 * - Caches user profiles by username
 * - Separate queries for profile, tweets, and likes
 * - Lazy loading for likes (only fetched when tab is active)
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { XClient } from "@/api/client";
import type { TweetData, UserProfileData } from "@/api/types";

import { queryKeys } from "./query-client";

export type ProfileTab = "tweets" | "likes";

interface UseProfileQueryOptions {
  client: XClient;
  username: string;
  /** Whether this is the current user's own profile (enables likes tab) */
  isSelf?: boolean;
}

interface UseProfileQueryResult {
  /** User profile data */
  user: UserProfileData | null;
  /** User's recent tweets */
  tweets: TweetData[];
  /** Whether profile is loading */
  isLoading: boolean;
  /** Whether tweets are loading */
  isTweetsLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh profile and tweets */
  refresh: () => void;
  /** User's liked tweets (only available when isSelf) */
  likedTweets: TweetData[];
  /** Whether likes are currently loading */
  isLikesLoading: boolean;
  /** Error message if likes fetch failed */
  likesError: string | null;
  /** Fetch likes (lazy, call when Likes tab is activated) */
  fetchLikes: () => void;
  /** Whether likes have been fetched at least once */
  likesFetched: boolean;
  /** Whether a refetch is in progress */
  isRefetching: boolean;
}

export function useProfileQuery({
  client,
  username,
  isSelf = false,
}: UseProfileQueryOptions): UseProfileQueryResult {
  // Track if likes have been manually triggered
  const [likesEnabled, setLikesEnabled] = useState(false);

  // Profile query - fetch user data by screen name
  const {
    data: profileData,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
    isRefetching: isProfileRefetching,
  } = useQuery({
    queryKey: queryKeys.user.profile(username.toLowerCase()),
    queryFn: async () => {
      const result = await client.getUserByScreenName(username);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load profile");
      }
      if (!result.user) {
        throw new Error("User not found");
      }
      return result.user;
    },
  });

  // Tweets query - fetch user tweets (depends on profile having loaded)
  const {
    data: tweetsData,
    isLoading: isTweetsLoading,
    refetch: refetchTweets,
    isRefetching: isTweetsRefetching,
  } = useQuery({
    queryKey: queryKeys.user.tweets(profileData?.id ?? ""),
    queryFn: async () => {
      if (!profileData?.id) return [];
      const result = await client.getUserTweets(profileData.id, 20);
      if (!result.success) {
        return []; // Still show profile even if tweets fail
      }
      return result.tweets ?? [];
    },
    enabled: !!profileData?.id,
  });

  // Likes query - only enabled when isSelf and manually triggered
  const {
    data: likesData,
    isLoading: isLikesLoading,
    error: likesError,
    refetch: refetchLikes,
    isFetched: likesFetched,
  } = useQuery({
    queryKey: queryKeys.user.likes(),
    queryFn: async () => {
      const result = await client.getLikes(20);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load likes");
      }
      return result.tweets ?? [];
    },
    enabled: isSelf && likesEnabled,
  });

  // Trigger likes fetch (lazy loading)
  const fetchLikes = useCallback(() => {
    if (isSelf && !likesEnabled) {
      setLikesEnabled(true);
    } else if (isSelf && likesEnabled) {
      refetchLikes();
    }
  }, [isSelf, likesEnabled, refetchLikes]);

  // Refresh all data
  const refresh = useCallback(() => {
    refetchProfile();
    if (profileData?.id) {
      refetchTweets();
    }
    if (isSelf && likesEnabled) {
      refetchLikes();
    }
  }, [
    refetchProfile,
    refetchTweets,
    refetchLikes,
    profileData?.id,
    isSelf,
    likesEnabled,
  ]);

  return {
    user: profileData ?? null,
    tweets: tweetsData ?? [],
    isLoading: isProfileLoading,
    isTweetsLoading,
    error: profileError instanceof Error ? profileError.message : null,
    refresh,
    likedTweets: likesData ?? [],
    isLikesLoading,
    likesError: likesError instanceof Error ? likesError.message : null,
    fetchLikes,
    likesFetched,
    isRefetching: isProfileRefetching || isTweetsRefetching,
  };
}
