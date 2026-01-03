/**
 * useNotifications - Hook for fetching and managing notification data
 * Includes unread count tracking and typed error handling
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, NotificationData } from "@/api/types";

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
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef(new Set<string>());

  // Clear countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApiError(null);
    seenIds.current.clear();

    const result = await client.getNotifications(30);

    if (result.success) {
      // Track seen IDs for deduplication during pagination
      for (const notif of result.notifications) {
        seenIds.current.add(notif.id);
      }

      setNotifications(result.notifications);
      setNextCursor(result.bottomCursor);
      setHasMore(!!result.bottomCursor && result.notifications.length > 0);

      // Calculate unread count based on sort_index comparison
      if (result.unreadSortIndex) {
        const unread = result.notifications.filter(
          (n) => n.sortIndex > result.unreadSortIndex!
        ).length;
        setUnreadCount(unread);
      } else {
        setUnreadCount(0);
      }

      setRetryCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    } else {
      setError(result.error.message);
      setApiError(result.error);

      // Start countdown for rate limits
      if (result.error.type === "rate_limit" && result.error.retryAfter) {
        setRetryCountdown(result.error.retryAfter);

        // Clear any existing countdown
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }

        // Start new countdown
        countdownRef.current = setInterval(() => {
          setRetryCountdown((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    setLoading(false);
  }, [client]);

  // Fetch on mount and when refresh is triggered
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications, refreshCounter]);

  const refresh = useCallback(() => {
    // Don't allow refresh during rate limit countdown
    if (retryCountdown > 0) return;
    setRefreshCounter((prev) => prev + 1);
  }, [retryCountdown]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    setLoadingMore(true);

    const result = await client.getNotifications(30, nextCursor);

    if (result.success) {
      // Filter out duplicates using seenIds
      const newNotifications = result.notifications.filter(
        (n) => !seenIds.current.has(n.id)
      );
      for (const notif of newNotifications) {
        seenIds.current.add(notif.id);
      }

      setNotifications((prev) => [...prev, ...newNotifications]);
      setNextCursor(result.bottomCursor);
      setHasMore(!!result.bottomCursor && result.notifications.length > 0);
    } else {
      // Stop pagination on error
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [client, nextCursor, loadingMore, hasMore]);

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
    retryBlocked: retryCountdown > 0,
    retryCountdown,
  };
}
