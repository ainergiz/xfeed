/**
 * NotificationList - Scrollable list of notifications with vim-style navigation
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useEffect, useRef } from "react";

import type { NotificationData } from "@/api/types";

import { NotificationItem } from "@/components/NotificationItem";
import { useListNavigation } from "@/hooks/useListNavigation";

interface NotificationListProps {
  notifications: NotificationData[];
  focused?: boolean;
  onNotificationSelect?: (notification: NotificationData) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
}

/**
 * Generate element ID from notification ID for scroll targeting
 */
function getNotificationItemId(notificationId: string): string {
  return `notification-${notificationId}`;
}

export function NotificationList({
  notifications,
  focused = false,
  onNotificationSelect,
  onLoadMore,
  loadingMore = false,
  hasMore = true,
}: NotificationListProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const savedScrollTop = useRef(0);
  const wasFocused = useRef(focused);

  // Restore scroll position when gaining focus
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox) return;

    if (!wasFocused.current && focused && savedScrollTop.current > 0) {
      scrollbox.scrollTo(savedScrollTop.current);
    }

    wasFocused.current = focused;
  }, [focused]);

  const { selectedIndex } = useListNavigation({
    itemCount: notifications.length,
    enabled: focused,
    onSelect: (index) => {
      const notification = notifications[index];
      if (notification) {
        if (scrollRef.current) {
          savedScrollTop.current = scrollRef.current.scrollTop;
        }
        onNotificationSelect?.(notification);
      }
    },
  });

  // Scroll to keep selected item visible
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox || notifications.length === 0) return;

    const selectedNotification = notifications[selectedIndex];
    if (!selectedNotification) return;

    const targetId = getNotificationItemId(selectedNotification.id);
    const target = scrollbox
      .getChildren()
      .find((child) => child.id === targetId);
    if (!target) return;

    const relativeY = target.y - scrollbox.y;
    const viewportHeight = scrollbox.viewport.height;

    const topMargin = Math.max(1, Math.floor(viewportHeight / 10));
    const bottomMargin = Math.max(4, Math.floor(viewportHeight / 3));

    if (selectedIndex === 0) {
      scrollbox.scrollTo(0);
      return;
    }

    if (selectedIndex === notifications.length - 1) {
      scrollbox.scrollTo(scrollbox.scrollHeight);
      return;
    }

    if (relativeY + target.height > viewportHeight - bottomMargin) {
      scrollbox.scrollBy(
        relativeY + target.height - viewportHeight + bottomMargin
      );
    } else if (relativeY < topMargin) {
      scrollbox.scrollBy(relativeY - topMargin);
    }
  }, [selectedIndex, notifications.length]);

  // Trigger load more when approaching the end of the list
  useEffect(() => {
    if (!onLoadMore || loadingMore || !hasMore || notifications.length === 0)
      return;

    // Load more when within 5 items of the end
    const threshold = 5;
    if (selectedIndex >= notifications.length - threshold) {
      onLoadMore();
    }
  }, [selectedIndex, notifications.length, onLoadMore, loadingMore, hasMore]);

  if (notifications.length === 0) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#888888">No notifications</text>
      </box>
    );
  }

  return (
    <scrollbox
      ref={scrollRef}
      focused={focused}
      style={{
        flexGrow: 1,
        height: "100%",
      }}
    >
      {notifications.map((notification, index) => (
        <NotificationItem
          key={notification.id}
          id={getNotificationItemId(notification.id)}
          notification={notification}
          isSelected={index === selectedIndex}
        />
      ))}
      {loadingMore ? (
        <box style={{ padding: 1, paddingLeft: 2 }}>
          <text fg="#888888">Loading more...</text>
        </box>
      ) : null}
      {!hasMore && notifications.length > 0 ? (
        <box style={{ padding: 1, paddingLeft: 2 }}>
          <text fg="#666666">No more notifications</text>
        </box>
      ) : null}
    </scrollbox>
  );
}
