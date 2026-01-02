/**
 * NotificationsScreen - Displays the user's notifications
 * Includes error handling with ErrorBanner for rate limits, auth expiry, etc.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { TwitterClient } from "@/api/client";
import type { NotificationData } from "@/api/types";

import { ErrorBanner } from "@/components/ErrorBanner";
import { NotificationList } from "@/components/NotificationList";
import { useNotifications } from "@/hooks/useNotifications";

interface NotificationsScreenProps {
  client: TwitterClient;
  focused?: boolean;
  onNotificationCountChange?: (count: number) => void;
  onUnreadCountChange?: (count: number) => void;
  onNotificationSelect?: (notification: NotificationData) => void;
  /** Action feedback message */
  actionMessage?: string | null;
}

function ScreenHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#1DA1F2">
        <b>Notifications</b>
      </text>
      {unreadCount > 0 && <text fg="#E0245E"> ({unreadCount} new)</text>}
    </box>
  );
}

/**
 * Format seconds into a readable countdown string
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function NotificationsScreen({
  client,
  focused = false,
  onNotificationCountChange,
  onUnreadCountChange,
  onNotificationSelect,
  actionMessage,
}: NotificationsScreenProps) {
  const {
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
  } = useNotifications({ client });

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

    if (key.name === "r" && !retryBlocked) {
      refresh();
    }
  });

  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader unreadCount={0} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">Loading notifications...</text>
        </box>
      </box>
    );
  }

  if (apiError) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader unreadCount={0} />
        <ErrorBanner
          error={apiError}
          onRetry={refresh}
          retryDisabled={retryBlocked}
        />
        {retryBlocked && retryCountdown > 0 && (
          <box style={{ paddingLeft: 1, paddingTop: 1 }}>
            <text fg="#ffaa00">
              Retry available in {formatCountdown(retryCountdown)}
            </text>
          </box>
        )}
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader unreadCount={0} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#ff6666">Error: {error}</text>
          <text fg="#888888"> Press r to retry.</text>
        </box>
      </box>
    );
  }

  if (notifications.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader unreadCount={0} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">No notifications yet. Press r to refresh.</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <ScreenHeader unreadCount={unreadCount} />
      {actionMessage ? (
        <box style={{ paddingLeft: 1 }}>
          <text fg={actionMessage.startsWith("Error:") ? "#E0245E" : "#17BF63"}>
            {actionMessage}
          </text>
        </box>
      ) : null}
      <NotificationList
        notifications={notifications}
        focused={focused}
        onNotificationSelect={onNotificationSelect}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        hasMore={hasMore}
      />
    </box>
  );
}
