/**
 * useUserProfile - Hook for fetching user profile and their tweets
 */

import { useState, useEffect, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData, UserProfileData } from "@/api/types";

export interface UseUserProfileOptions {
  client: TwitterClient;
  username: string;
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
}

export function useUserProfile({
  client,
  username,
}: UseUserProfileOptions): UseUserProfileResult {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [tweets, setTweets] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

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

  // Fetch when username changes or refresh is triggered
  useEffect(() => {
    // Reset state when username changes
    setUser(null);
    setTweets([]);
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
  };
}
