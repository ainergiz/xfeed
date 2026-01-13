/**
 * NotificationsScreen - Displays the user's notifications
 * Uses TanStack Query for data fetching with background polling
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { XClient } from "@/api/client";
import type { NotificationData } from "@/api/types";

import { ErrorBanner } from "@/components/ErrorBanner";
import { NotificationList } from "@/components/NotificationList";
import { useNotificationsQuery } from "@/experiments/use-notifications-query";
import { colors } from "@/lib/colors";

interface NotificationsScreenProps {
  client: XClient;
  focused?: boolean;
  onNotificationCountChange?: (count: number) => void;
  onUnreadCountChange?: (count: number) => void;
  onNotificationSelect?: (notification: NotificationData) => void;
}

function NewNotificationsBanner({ count }: { count: number }) {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 1,
      }}
    >
      <box
        style={{
          backgroundColor: colors.primary,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text fg="#000000">
          <b>
            {count} new notification{count > 1 ? "s" : ""} — Press r
          </b>
        </text>
      </box>
    </box>
  );
}

export function NotificationsScreen({
  client,
  focused = false,
  onNotificationCountChange,
  onUnreadCountChange,
  onNotificationSelect,
}: NotificationsScreenProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refresh,
    newNotificationsCount,
  } = useNotificationsQuery({ client });

  // Report counts to parent
  useEffect(() => {
    onNotificationCountChange?.(notifications.length);
  }, [notifications.length, onNotificationCountChange]);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // Handle keyboard shortcuts for refresh
  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "r") {
      refresh();
    }
  });

  if (isLoading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>Loading notifications...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ErrorBanner error={error} onRetry={refresh} retryDisabled={false} />
      </box>
    );
  }

  if (notifications.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>
            No notifications yet. Press r to refresh.
          </text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {newNotificationsCount > 0 && (
        <NewNotificationsBanner count={newNotificationsCount} />
      )}
      <NotificationList
        notifications={notifications}
        focused={focused}
        onNotificationSelect={onNotificationSelect}
        onLoadMore={fetchNextPage}
        loadingMore={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </box>
  );
}
