/**
 * useProfileQuery - TanStack Query hook for user profile fetching
 *
 * Features:
 * - Caches user profiles by username
 * - Separate queries for profile, tweets, replies, highlights, media, and likes
 * - Lazy loading for non-default tabs (only fetched when tab is activated)
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { XClient } from "@/api/client";
import type { TweetData, UserProfileData } from "@/api/types";

import { queryKeys } from "./query-client";

export type ProfileTab =
  | "tweets"
  | "replies"
  | "highlights"
  | "media"
  | "likes";

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
  /** User's tweets and replies */
  repliesTweets: TweetData[];
  /** Whether replies are currently loading */
  isRepliesLoading: boolean;
  /** Error message if replies fetch failed */
  repliesError: string | null;
  /** Fetch replies (lazy, call when Replies tab is activated) */
  fetchReplies: () => void;
  /** Whether replies have been fetched at least once */
  repliesFetched: boolean;
  /** User's media tweets */
  mediaTweets: TweetData[];
  /** Whether media is currently loading */
  isMediaLoading: boolean;
  /** Error message if media fetch failed */
  mediaError: string | null;
  /** Fetch media (lazy, call when Media tab is activated) */
  fetchMedia: () => void;
  /** Whether media has been fetched at least once */
  mediaFetched: boolean;
  /** User's highlighted tweets */
  highlightsTweets: TweetData[];
  /** Whether highlights are currently loading */
  isHighlightsLoading: boolean;
  /** Error message if highlights fetch failed */
  highlightsError: string | null;
  /** Fetch highlights (lazy, call when Highlights tab is activated) */
  fetchHighlights: () => void;
  /** Whether highlights have been fetched at least once */
  highlightsFetched: boolean;
}

export function useProfileQuery({
  client,
  username,
  isSelf = false,
}: UseProfileQueryOptions): UseProfileQueryResult {
  // Track which tabs have been manually triggered (lazy loading)
  const [likesEnabled, setLikesEnabled] = useState(false);
  const [repliesEnabled, setRepliesEnabled] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);

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

  // Replies query - only enabled when manually triggered
  const {
    data: repliesData,
    isLoading: isRepliesLoading,
    error: repliesError,
    refetch: refetchReplies,
    isFetched: repliesFetched,
  } = useQuery({
    queryKey: queryKeys.user.replies(profileData?.id ?? ""),
    queryFn: async () => {
      if (!profileData?.id) return [];
      const result = await client.getUserReplies(profileData.id, 20);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load replies");
      }
      return result.tweets ?? [];
    },
    enabled: !!profileData?.id && repliesEnabled,
  });

  // Media query - only enabled when manually triggered
  const {
    data: mediaData,
    isLoading: isMediaLoading,
    error: mediaError,
    refetch: refetchMedia,
    isFetched: mediaFetched,
  } = useQuery({
    queryKey: queryKeys.user.media(profileData?.id ?? ""),
    queryFn: async () => {
      if (!profileData?.id) return [];
      const result = await client.getUserMedia(profileData.id, 20);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load media");
      }
      return result.tweets ?? [];
    },
    enabled: !!profileData?.id && mediaEnabled,
  });

  // Highlights query - only enabled when manually triggered
  const {
    data: highlightsData,
    isLoading: isHighlightsLoading,
    error: highlightsError,
    refetch: refetchHighlights,
    isFetched: highlightsFetched,
  } = useQuery({
    queryKey: queryKeys.user.highlights(profileData?.id ?? ""),
    queryFn: async () => {
      if (!profileData?.id) return [];
      const result = await client.getUserHighlights(profileData.id, 20);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to load highlights");
      }
      return result.tweets ?? [];
    },
    enabled: !!profileData?.id && highlightsEnabled,
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

  // Trigger replies fetch (lazy loading)
  const fetchReplies = useCallback(() => {
    if (!repliesEnabled) {
      setRepliesEnabled(true);
    } else {
      refetchReplies();
    }
  }, [repliesEnabled, refetchReplies]);

  // Trigger media fetch (lazy loading)
  const fetchMedia = useCallback(() => {
    if (!mediaEnabled) {
      setMediaEnabled(true);
    } else {
      refetchMedia();
    }
  }, [mediaEnabled, refetchMedia]);

  // Trigger highlights fetch (lazy loading)
  const fetchHighlights = useCallback(() => {
    if (!highlightsEnabled) {
      setHighlightsEnabled(true);
    } else {
      refetchHighlights();
    }
  }, [highlightsEnabled, refetchHighlights]);

  // Refresh all data
  const refresh = useCallback(() => {
    refetchProfile();
    if (profileData?.id) {
      refetchTweets();
      if (repliesEnabled) refetchReplies();
      if (mediaEnabled) refetchMedia();
      if (highlightsEnabled) refetchHighlights();
    }
    if (isSelf && likesEnabled) {
      refetchLikes();
    }
  }, [
    refetchProfile,
    refetchTweets,
    refetchReplies,
    refetchMedia,
    refetchHighlights,
    refetchLikes,
    profileData?.id,
    isSelf,
    likesEnabled,
    repliesEnabled,
    mediaEnabled,
    highlightsEnabled,
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
    repliesTweets: repliesData ?? [],
    isRepliesLoading,
    repliesError: repliesError instanceof Error ? repliesError.message : null,
    fetchReplies,
    repliesFetched,
    mediaTweets: mediaData ?? [],
    isMediaLoading,
    mediaError: mediaError instanceof Error ? mediaError.message : null,
    fetchMedia,
    mediaFetched,
    highlightsTweets: highlightsData ?? [],
    isHighlightsLoading,
    highlightsError:
      highlightsError instanceof Error ? highlightsError.message : null,
    fetchHighlights,
    highlightsFetched,
  };
}
