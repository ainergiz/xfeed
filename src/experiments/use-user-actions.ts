/**
 * useUserActions - TanStack Query mutation hook for user actions
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache rollback on error
 * - Supports follow/unfollow and mute/unmute
 * - Updates user profile cache
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { XClient } from "@/api/client";
import type { UserProfileData, UserProfileResult } from "@/api/types";

import { queryKeys } from "./query-client";

interface UseUserActionsOptions {
  client: XClient;
  /** Username for cache key (to update profile cache) */
  username: string;
  /** Callback when mutation succeeds */
  onSuccess?: (message: string) => void;
  /** Callback when mutation fails */
  onError?: (error: string) => void;
}

type UserActionType = "follow" | "unfollow" | "mute" | "unmute";

interface MutationContext {
  previousProfile?: UserProfileResult;
  previousFollowing?: boolean;
  previousMuting?: boolean;
}

export function useUserActions({
  client,
  username,
  onSuccess,
  onError,
}: UseUserActionsOptions) {
  const queryClient = useQueryClient();

  // Track pending state for each action type
  const [pendingAction, setPendingAction] = useState<UserActionType | null>(
    null
  );

  // Helper to update profile cache optimistically
  const updateProfileCache = useCallback(
    (updates: Partial<UserProfileData>) => {
      queryClient.setQueryData<UserProfileResult>(
        queryKeys.user.profile(username),
        (old) => {
          if (!old?.success || !old.user) return old;
          return {
            ...old,
            user: {
              ...old.user,
              ...updates,
            },
          };
        }
      );
    },
    [queryClient, username]
  );

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.followUser(userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    },
    onMutate: async () => {
      setPendingAction("follow");

      await queryClient.cancelQueries({
        queryKey: queryKeys.user.profile(username),
      });

      const previousProfile = queryClient.getQueryData<UserProfileResult>(
        queryKeys.user.profile(username)
      );

      // Optimistic update
      updateProfileCache({ following: true });

      return {
        previousProfile,
        previousFollowing: previousProfile?.user?.following,
      } as MutationContext;
    },
    onError: (error, _, context) => {
      setPendingAction(null);

      // Rollback
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.user.profile(username),
          context.previousProfile
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onError?.(errorMessage);
    },
    onSuccess: () => {
      setPendingAction(null);
      onSuccess?.("Followed");
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.unfollowUser(userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    },
    onMutate: async () => {
      setPendingAction("unfollow");

      await queryClient.cancelQueries({
        queryKey: queryKeys.user.profile(username),
      });

      const previousProfile = queryClient.getQueryData<UserProfileResult>(
        queryKeys.user.profile(username)
      );

      // Optimistic update
      updateProfileCache({ following: false });

      return {
        previousProfile,
        previousFollowing: previousProfile?.user?.following,
      } as MutationContext;
    },
    onError: (error, _, context) => {
      setPendingAction(null);

      // Rollback
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.user.profile(username),
          context.previousProfile
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onError?.(errorMessage);
    },
    onSuccess: () => {
      setPendingAction(null);
      onSuccess?.("Unfollowed");
    },
  });

  // Mute mutation
  const muteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.muteUser(userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    },
    onMutate: async () => {
      setPendingAction("mute");

      await queryClient.cancelQueries({
        queryKey: queryKeys.user.profile(username),
      });

      const previousProfile = queryClient.getQueryData<UserProfileResult>(
        queryKeys.user.profile(username)
      );

      // Optimistic update
      updateProfileCache({ muting: true });

      return {
        previousProfile,
        previousMuting: previousProfile?.user?.muting,
      } as MutationContext;
    },
    onError: (error, _, context) => {
      setPendingAction(null);

      // Rollback
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.user.profile(username),
          context.previousProfile
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onError?.(errorMessage);
    },
    onSuccess: () => {
      setPendingAction(null);
      onSuccess?.("Muted");
    },
  });

  // Unmute mutation
  const unmuteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await client.unmuteUser(userId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    },
    onMutate: async () => {
      setPendingAction("unmute");

      await queryClient.cancelQueries({
        queryKey: queryKeys.user.profile(username),
      });

      const previousProfile = queryClient.getQueryData<UserProfileResult>(
        queryKeys.user.profile(username)
      );

      // Optimistic update
      updateProfileCache({ muting: false });

      return {
        previousProfile,
        previousMuting: previousProfile?.user?.muting,
      } as MutationContext;
    },
    onError: (error, _, context) => {
      setPendingAction(null);

      // Rollback
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.user.profile(username),
          context.previousProfile
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onError?.(errorMessage);
    },
    onSuccess: () => {
      setPendingAction(null);
      onSuccess?.("Unmuted");
    },
  });

  // Public API
  const toggleFollow = useCallback(
    (userId: string, isCurrentlyFollowing: boolean) => {
      if (pendingAction) return;

      if (isCurrentlyFollowing) {
        unfollowMutation.mutate(userId);
      } else {
        followMutation.mutate(userId);
      }
    },
    [followMutation, unfollowMutation, pendingAction]
  );

  const toggleMute = useCallback(
    (userId: string, isCurrentlyMuting: boolean) => {
      if (pendingAction) return;

      if (isCurrentlyMuting) {
        unmuteMutation.mutate(userId);
      } else {
        muteMutation.mutate(userId);
      }
    },
    [muteMutation, unmuteMutation, pendingAction]
  );

  const follow = useCallback(
    (userId: string) => {
      if (pendingAction) return;
      followMutation.mutate(userId);
    },
    [followMutation, pendingAction]
  );

  const unfollow = useCallback(
    (userId: string) => {
      if (pendingAction) return;
      unfollowMutation.mutate(userId);
    },
    [unfollowMutation, pendingAction]
  );

  const mute = useCallback(
    (userId: string) => {
      if (pendingAction) return;
      muteMutation.mutate(userId);
    },
    [muteMutation, pendingAction]
  );

  const unmute = useCallback(
    (userId: string) => {
      if (pendingAction) return;
      unmuteMutation.mutate(userId);
    },
    [unmuteMutation, pendingAction]
  );

  return {
    // Toggle functions (recommended for UI)
    toggleFollow,
    toggleMute,

    // Individual action functions
    follow,
    unfollow,
    mute,
    unmute,

    // State
    pendingAction,
    isFollowPending: pendingAction === "follow" || pendingAction === "unfollow",
    isMutePending: pendingAction === "mute" || pendingAction === "unmute",
    isPending: pendingAction !== null,
  };
}
