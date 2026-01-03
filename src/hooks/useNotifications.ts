/**
 * useNotifications - Hook for fetching and managing notification data
 * Includes unread count tracking and typed error handling
 */

import { useCallback, useRef, useState } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, NotificationData } from "@/api/types";

import { usePaginatedData } from "./usePaginatedData";
import type { PaginatedFetchResult } from "./usePaginatedData";

export interface UseNotificationsOptions {
  client: XClient;
}

export interface UseNotificationsResult {
  /** List of notifications */
  notifications: NotificationData[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Whether data is currently loading */
  loading: boolean;
  /** Whether more notifications are being loaded (pagination) */
  loadingMore: boolean;
  /** Whether there are more notifications to load */
  hasMore: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh notifications */
  refresh: () => void;
  /** Load more notifications (pagination) */
  loadMore: () => void;
  /** Whether retry is currently blocked (e.g., rate limit countdown) */
  retryBlocked: boolean;
  /** Seconds until retry is allowed (for rate limit countdown) */
  retryCountdown: number;
}

export function useNotifications({
  client,
}: UseNotificationsOptions): UseNotificationsResult {
  const [unreadCount, setUnreadCount] = useState(0);
  // Store unreadSortIndex for calculating unread count
  const unreadSortIndexRef = useRef<string | undefined>();

  // Create fetch function that adapts client API to PaginatedFetchResult
  const fetchFn = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<NotificationData>> => {
      const result = await client.getNotifications(30, cursor);

      if (result.success) {
        // On initial fetch, update unread sort index and calculate unread count
        if (!cursor) {
          unreadSortIndexRef.current = result.unreadSortIndex;
          if (result.unreadSortIndex) {
            const unread = result.notifications.filter(
              (n) => n.sortIndex > result.unreadSortIndex!
            ).length;
            setUnreadCount(unread);
          } else {
            setUnreadCount(0);
          }
        }

        return {
          success: true,
          items: result.notifications,
          nextCursor: result.bottomCursor,
        };
      }
      return { success: false, error: result.error };
    },
    [client]
  );

  const getId = useCallback((notification: NotificationData) => notification.id, []);

  const {
    data: notifications,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked,
    retryCountdown,
  } = usePaginatedData({
    fetchFn,
    getId,
  });

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked,
    retryCountdown,
  };
}
