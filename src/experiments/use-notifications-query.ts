/**
 * useNotificationsQuery - TanStack Query hook for notifications fetching
 *
 * Features:
 * - Infinite query for cursor-based pagination
 * - Background polling for new notifications
 * - Deduplication across pages
 * - Unread count tracking
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { XClient } from "@/api/client";
import type { ApiError, NotificationData } from "@/api/types";

import { queryKeys } from "./query-client";

// Debug logging to file
const LOG_FILE = join(homedir(), ".xfeed-notifications.log");

function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`;
  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    // Ignore logging errors
  }
}

interface NotificationsPage {
  notifications: NotificationData[];
  nextCursor?: string;
  unreadSortIndex?: string;
}

interface UseNotificationsQueryOptions {
  client: XClient;
  /** Polling interval in ms for checking new notifications (default: 2 minutes) */
  pollingInterval?: number;
}

interface UseNotificationsQueryResult {
  /** Flattened list of notifications with deduplication */
  notifications: NotificationData[];
  /** Count of unread notifications from API */
  unreadCount: number;
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether more data is being loaded (pagination) */
  isFetchingNextPage: boolean;
  /** Whether there are more notifications to load */
  hasNextPage: boolean;
  /** Error if fetch failed */
  error: ApiError | null;
  /** Fetch next page of results */
  fetchNextPage: () => void;
  /** Manually refresh notifications */
  refresh: () => void;
  /** Count of new notifications since last refresh */
  newNotificationsCount: number;
  /** Whether refresh is in progress */
  isRefetching: boolean;
}

/**
 * Fetch notifications page from X API
 */
async function fetchNotificationsPage(
  client: XClient,
  cursor?: string
): Promise<NotificationsPage> {
  log("fetchNotificationsPage called", { cursor });
  const result = await client.getNotifications(30, cursor);

  if (!result.success) {
    log("fetchNotificationsPage error", result.error);
    throw result.error;
  }

  log("fetchNotificationsPage success", {
    count: result.notifications.length,
    unreadSortIndex: result.unreadSortIndex,
    firstNotificationId: result.notifications[0]?.id,
    firstSortIndex: result.notifications[0]?.sortIndex,
  });

  return {
    notifications: result.notifications,
    nextCursor: result.bottomCursor,
    unreadSortIndex: result.unreadSortIndex,
  };
}

interface PollResult {
  unreadCount: number;
  newestSortIndex?: string;
  newestNotificationId?: string;
  unreadSortIndex?: string;
}

/**
 * Poll for new notifications - fetches first page to detect new ones
 */
async function pollNotifications(client: XClient): Promise<PollResult> {
  log("pollNotifications called");
  const result = await client.getNotifications(30);

  if (!result.success) {
    log("pollNotifications error", result.error);
    throw result.error;
  }

  // Calculate unread count from the response
  const unreadSortIndex = result.unreadSortIndex;
  const newestNotification = result.notifications[0];

  log("pollNotifications success", {
    count: result.notifications.length,
    unreadSortIndex,
    newestNotificationId: newestNotification?.id,
    newestSortIndex: newestNotification?.sortIndex,
  });

  if (!unreadSortIndex) {
    return {
      unreadCount: 0,
      newestSortIndex: newestNotification?.sortIndex,
      newestNotificationId: newestNotification?.id,
      unreadSortIndex: undefined,
    };
  }

  const unreadCount = result.notifications.filter(
    (n) => n.sortIndex > unreadSortIndex
  ).length;

  log("pollNotifications unread calculation", {
    unreadCount,
    unreadSortIndex,
  });

  return {
    unreadCount,
    newestSortIndex: newestNotification?.sortIndex,
    newestNotificationId: newestNotification?.id,
    unreadSortIndex,
  };
}

/**
 * Deduplicate notifications across all pages
 */
function deduplicateNotifications(
  pages: NotificationsPage[]
): NotificationData[] {
  const seen = new Set<string>();
  const result: NotificationData[] = [];

  for (const page of pages) {
    for (const notification of page.notifications) {
      if (!seen.has(notification.id)) {
        seen.add(notification.id);
        result.push(notification);
      }
    }
  }

  return result;
}

const DEFAULT_POLLING_INTERVAL = 30 * 1000; // 30 seconds (for testing)

export function useNotificationsQuery({
  client,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
}: UseNotificationsQueryOptions): UseNotificationsQueryResult {
  // Track the newest notification ID we've seen (for detecting new ones)
  const lastSeenNewestIdRef = useRef<string | null>(null);
  // Track new notifications count for banner
  const [newNotificationsCount, setNewNotificationsCount] = useState(0);

  log("useNotificationsQuery render", {
    lastSeenNewestId: lastSeenNewestIdRef.current,
    newNotificationsCount,
  });

  // Main infinite query for notifications list
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async ({ pageParam }) => {
      return fetchNotificationsPage(client, pageParam);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 0,
  });

  // Flatten and deduplicate notifications from all pages
  const notifications = useMemo(() => {
    if (!data?.pages) return [];
    return deduplicateNotifications(data.pages);
  }, [data?.pages]);

  // Calculate unread count from first page's unreadSortIndex
  const unreadCount = useMemo(() => {
    if (!data?.pages?.length) return 0;

    const firstPage = data.pages[0];
    const unreadSortIndex = firstPage?.unreadSortIndex;

    if (!unreadSortIndex) return 0;

    const count = notifications.filter(
      (n) => n.sortIndex > unreadSortIndex
    ).length;

    log("unreadCount calculated", {
      count,
      unreadSortIndex,
      totalNotifications: notifications.length,
    });

    return count;
  }, [data?.pages, notifications]);

  // Initialize lastSeenNewestId on first load
  useEffect(() => {
    if (lastSeenNewestIdRef.current === null && notifications.length > 0) {
      const newestId = notifications[0]?.id;
      log("Initializing lastSeenNewestId", { newestId });
      lastSeenNewestIdRef.current = newestId ?? null;
    }
  }, [notifications]);

  // Track the unreadSortIndex we last saw (for detecting read changes)
  const lastUnreadSortIndexRef = useRef<string | null>(null);

  // Initialize lastUnreadSortIndex on first load
  useEffect(() => {
    if (lastUnreadSortIndexRef.current === null && data?.pages?.[0]) {
      const sortIndex = data.pages[0].unreadSortIndex;
      log("Initializing lastUnreadSortIndex", { sortIndex });
      lastUnreadSortIndexRef.current = sortIndex ?? null;
    }
  }, [data?.pages]);

  // Background polling with manual setInterval (refetchInterval doesn't work in terminal)
  useEffect(() => {
    // Don't start polling until initial load is complete
    if (isLoading || lastSeenNewestIdRef.current === null) {
      log("Polling not started - waiting for initial load", {
        isLoading,
        lastSeenNewestId: lastSeenNewestIdRef.current,
      });
      return;
    }

    log("Starting polling interval", { pollingInterval });

    const poll = async () => {
      log("Manual poll triggered");
      try {
        const pollResult = await pollNotifications(client);
        const {
          newestNotificationId,
          unreadCount: polledUnreadCount,
          unreadSortIndex: polledUnreadSortIndex,
        } = pollResult;

        log("Poll result checking", {
          polledNewestId: newestNotificationId,
          lastSeenNewestId: lastSeenNewestIdRef.current,
          polledUnreadCount,
          polledUnreadSortIndex,
          lastUnreadSortIndex: lastUnreadSortIndexRef.current,
          newestIdChanged: newestNotificationId !== lastSeenNewestIdRef.current,
          unreadSortIndexChanged:
            polledUnreadSortIndex !== lastUnreadSortIndexRef.current,
        });

        // Check if unreadSortIndex changed (user read notifications elsewhere)
        if (
          polledUnreadSortIndex &&
          lastUnreadSortIndexRef.current &&
          polledUnreadSortIndex !== lastUnreadSortIndexRef.current
        ) {
          log("UnreadSortIndex changed - triggering refetch", {
            old: lastUnreadSortIndexRef.current,
            new: polledUnreadSortIndex,
          });
          // Update our ref and refetch to update the UI
          lastUnreadSortIndexRef.current = polledUnreadSortIndex;
          lastSeenNewestIdRef.current = newestNotificationId ?? null;
          refetch();
          return;
        }

        // If the newest notification from poll is different from what we've seen,
        // there are new notifications
        if (
          newestNotificationId &&
          lastSeenNewestIdRef.current &&
          newestNotificationId !== lastSeenNewestIdRef.current
        ) {
          log("New notifications detected!", {
            newCount: polledUnreadCount,
            newestNotificationId,
            previousNewestId: lastSeenNewestIdRef.current,
          });
          setNewNotificationsCount(polledUnreadCount);
          // Also update refs and refetch to update unreadCount in header
          lastSeenNewestIdRef.current = newestNotificationId;
          if (polledUnreadSortIndex) {
            lastUnreadSortIndexRef.current = polledUnreadSortIndex;
          }
          refetch();
        }
      } catch (err) {
        log("Poll error", { error: String(err) });
      }
    };

    const intervalId = setInterval(poll, pollingInterval);

    return () => {
      log("Clearing polling interval");
      clearInterval(intervalId);
    };
  }, [client, isLoading, pollingInterval, refetch]);

  // Manual refresh - reset state and clear banner
  const refresh = useCallback(() => {
    log("refresh called");
    setNewNotificationsCount(0);
    // Reset lastSeenNewestId to null so it gets re-initialized after refetch
    lastSeenNewestIdRef.current = null;
    refetch();
  }, [refetch]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error as ApiError | null,
    fetchNextPage,
    refresh,
    newNotificationsCount,
    isRefetching,
  };
}
