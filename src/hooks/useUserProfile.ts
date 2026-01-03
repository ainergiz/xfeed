/**
 * useUserProfile - Hook for fetching user profile and their tweets
 * Supports lazy loading of likes when viewing own profile
 */

import { useState, useEffect, useCallback, useRef } from "react";

import type { XClient } from "@/api/client";
import type { TweetData, UserProfileData } from "@/api/types";

export interface UseUserProfileOptions {
  client: XClient;
  username: string;
  /** Whether this is the current user's own profile (enables likes fetching) */
  isSelf?: boolean;
}

export interface UseUserProfileResult {
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
  /** User's liked tweets (only available when isSelf) */
  likedTweets: TweetData[];
  /** Whether likes are currently loading */
  likesLoading: boolean;
  /** Error message if likes fetch failed */
  likesError: string | null;
  /** Fetch likes (lazy, call when Likes tab is activated) */
  fetchLikes: () => void;
  /** Whether likes have been fetched at least once */
  likesFetched: boolean;
}

export function useUserProfile({
  client,
  username,
  isSelf = false,
}: UseUserProfileOptions): UseUserProfileResult {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [tweets, setTweets] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Likes state (only used when isSelf)
  const [likedTweets, setLikedTweets] = useState<TweetData[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState<string | null>(null);
  const [likesFetched, setLikesFetched] = useState(false);
  const likesFetchInProgress = useRef(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    // First fetch the user profile
    const profileResult = await client.getUserByScreenName(username);

    if (!profileResult.success) {
      setError(profileResult.error ?? "Failed to load profile");
      setLoading(false);
      return;
    }

    const userProfile = profileResult.user;
    if (!userProfile) {
      setError("User not found");
      setLoading(false);
      return;
    }

    setUser(userProfile);

    // Then fetch their tweets using the user ID
    const tweetsResult = await client.getUserTweets(userProfile.id, 20);

    if (tweetsResult.success) {
      setTweets(tweetsResult.tweets ?? []);
    } else {
      // Still show profile even if tweets fail to load
      setTweets([]);
    }

    setLoading(false);
  }, [client, username]);

  // Fetch likes lazily (only when requested and isSelf)
  const fetchLikes = useCallback(async () => {
    if (!isSelf || likesFetchInProgress.current) return;

    likesFetchInProgress.current = true;
    setLikesLoading(true);
    setLikesError(null);

    const likesResult = await client.getLikes(20);

    if (likesResult.success) {
      setLikedTweets(likesResult.tweets ?? []);
      setLikesFetched(true);
    } else {
      setLikesError(likesResult.error ?? "Failed to load likes");
    }

    setLikesLoading(false);
    likesFetchInProgress.current = false;
  }, [client, isSelf]);

  // Fetch when username changes or refresh is triggered
  useEffect(() => {
    // Reset state when username changes
    setUser(null);
    setTweets([]);
    setLikedTweets([]);
    setLikesFetched(false);
    setLikesError(null);
    fetchProfile();
  }, [fetchProfile, refreshCounter]);

  const refresh = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  return {
    user,
    tweets,
    loading,
    error,
    refresh,
    likedTweets,
    likesLoading,
    likesError,
    fetchLikes,
    likesFetched,
  };
}
