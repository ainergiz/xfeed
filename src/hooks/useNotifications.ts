/**
 * useNotifications - Hook for fetching and managing notification data
 * Includes unread count tracking and typed error handling
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { TwitterClient } from "@/api/client";
import type { ApiError, NotificationData } from "@/api/types";

export interface UseNotificationsOptions {
  client: TwitterClient;
}

export interface UseNotificationsResult {
  /** List of notifications */
  notifications: NotificationData[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Typed error with rate limit info, auth status, etc. */
  apiError: ApiError | null;
  /** Refresh notifications */
  refresh: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const result = await client.getNotifications(30);

    if (result.success) {
      setNotifications(result.notifications);

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

  return {
    notifications,
    unreadCount,
    loading,
    error,
    apiError,
    refresh,
    retryBlocked: retryCountdown > 0,
    retryCountdown,
  };
}
