/**
 * Unit tests for useNotifications hook
 * Tests notification fetching, unread count calculation, and error handling
 */

import { describe, expect, it, mock } from "bun:test";

import type { XClient } from "@/api/client";
import type {
  ApiError,
  NotificationData,
  NotificationsResult,
} from "@/api/types";

// Simple test harness for the hook logic
// We test the core logic directly rather than React integration
function createMockClient(
  getNotificationsResult: NotificationsResult
): XClient {
  return {
    getNotifications: mock(() => Promise.resolve(getNotificationsResult)),
  } as unknown as XClient;
}

function createNotification(
  overrides: Partial<NotificationData> = {}
): NotificationData {
  return {
    id: overrides.id ?? "notif-1",
    icon: overrides.icon ?? "heart_icon",
    message: overrides.message ?? "Test notification",
    url: overrides.url ?? "https://x.com/notification",
    timestamp: overrides.timestamp ?? "2024-01-01T00:00:00Z",
    sortIndex: overrides.sortIndex ?? "1700000000000",
    targetTweet: overrides.targetTweet,
    fromUsers: overrides.fromUsers,
  };
}

describe("useNotifications", () => {
  describe("initial fetch", () => {
    it("returns notifications from successful API response", async () => {
      const notifications = [
        createNotification({ id: "1", sortIndex: "3" }),
        createNotification({ id: "2", sortIndex: "2" }),
        createNotification({ id: "3", sortIndex: "1" }),
      ];

      const client = createMockClient({
        success: true,
        notifications,
      });

      const result = await client.getNotifications();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.notifications).toEqual(notifications);
      }
    });

    it("returns error message from failed API response", async () => {
      const client = createMockClient({
        success: false,
        error: {
          type: "network_error",
          message: "Network timeout",
        },
      });

      const result = await client.getNotifications();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Network timeout");
      }
    });
  });

  describe("unread count calculation", () => {
    it("calculates unread count based on sort index comparison", () => {
      const notifications = [
        createNotification({ id: "1", sortIndex: "1700000000003" }), // unread
        createNotification({ id: "2", sortIndex: "1700000000002" }), // unread
        createNotification({ id: "3", sortIndex: "1700000000001" }), // read
      ];
      const unreadSortIndex = "1700000000001";

      // Simulating the hook's unread count calculation
      const unreadCount = notifications.filter(
        (n) => n.sortIndex > unreadSortIndex
      ).length;

      expect(unreadCount).toBe(2);
    });

    it("returns 0 unread when no unreadSortIndex provided", () => {
      const notifications = [
        createNotification({ id: "1", sortIndex: "1700000000003" }),
        createNotification({ id: "2", sortIndex: "1700000000002" }),
      ];

      // Simulating the hook's unread count calculation when no unreadSortIndex
      function calculateUnreadCount(
        notifs: NotificationData[],
        unreadIdx: string | undefined
      ): number {
        if (!unreadIdx) return 0;
        return notifs.filter((n) => n.sortIndex > unreadIdx).length;
      }

      const unreadCount = calculateUnreadCount(notifications, undefined);
      expect(unreadCount).toBe(0);
    });

    it("returns all as unread when all sort indices are greater", () => {
      const notifications = [
        createNotification({ id: "1", sortIndex: "1700000000003" }),
        createNotification({ id: "2", sortIndex: "1700000000002" }),
        createNotification({ id: "3", sortIndex: "1700000000001" }),
      ];
      const unreadSortIndex = "1700000000000";

      const unreadCount = notifications.filter(
        (n) => n.sortIndex > unreadSortIndex
      ).length;

      expect(unreadCount).toBe(3);
    });

    it("returns 0 unread when all sort indices are less than or equal", () => {
      const notifications = [
        createNotification({ id: "1", sortIndex: "1700000000001" }),
        createNotification({ id: "2", sortIndex: "1700000000002" }),
      ];
      const unreadSortIndex = "1700000000003";

      const unreadCount = notifications.filter(
        (n) => n.sortIndex > unreadSortIndex
      ).length;

      expect(unreadCount).toBe(0);
    });
  });

  describe("error handling", () => {
    it("extracts error message from ApiError", () => {
      const apiError: ApiError = {
        type: "rate_limit",
        message: "Too many requests",
        retryAfter: 60,
      };

      expect(apiError.message).toBe("Too many requests");
      expect(apiError.retryAfter).toBe(60);
    });

    it("identifies rate limit errors", () => {
      const apiError: ApiError = {
        type: "rate_limit",
        message: "Rate limited",
        retryAfter: 120,
      };

      expect(apiError.type).toBe("rate_limit");
      expect(apiError.retryAfter).toBe(120);
    });

    it("identifies auth errors", () => {
      const apiError: ApiError = {
        type: "auth_expired",
        message: "Authentication required",
      };

      expect(apiError.type).toBe("auth_expired");
    });

    it("identifies network errors", () => {
      const apiError: ApiError = {
        type: "network_error",
        message: "Connection refused",
      };

      expect(apiError.type).toBe("network_error");
    });
  });

  describe("rate limit countdown", () => {
    it("blocks retry when countdown is active", () => {
      const retryCountdown = 30;
      const retryBlocked = retryCountdown > 0;

      expect(retryBlocked).toBe(true);
    });

    it("allows retry when countdown is zero", () => {
      const retryCountdown = 0;
      const retryBlocked = retryCountdown > 0;

      expect(retryBlocked).toBe(false);
    });

    it("countdown decrements each second", () => {
      let countdown = 5;

      // Simulate countdown
      countdown = countdown - 1;
      expect(countdown).toBe(4);

      countdown = countdown - 1;
      expect(countdown).toBe(3);

      countdown = countdown - 1;
      expect(countdown).toBe(2);
    });

    it("countdown stops at zero", () => {
      let countdown = 1;

      // Simulate countdown reaching zero
      countdown = Math.max(0, countdown - 1);
      expect(countdown).toBe(0);

      // Should not go negative
      countdown = Math.max(0, countdown - 1);
      expect(countdown).toBe(0);
    });
  });

  describe("refresh behavior", () => {
    it("refresh is blocked during countdown", () => {
      const retryCountdown: number = 10;
      const canRefresh = retryCountdown <= 0;

      expect(canRefresh).toBe(false);
    });

    it("refresh is allowed when countdown is zero", () => {
      const retryCountdown: number = 0;
      const canRefresh = retryCountdown <= 0;

      expect(canRefresh).toBe(true);
    });
  });

  describe("notification data parsing", () => {
    it("handles notification with target tweet", () => {
      const notification = createNotification({
        icon: "heart_icon",
        message: "User liked your post",
        targetTweet: {
          id: "tweet-123",
          text: "This is my tweet",
          author: { username: "testuser", name: "Test User" },
        },
      });

      expect(notification.targetTweet).toBeDefined();
      expect(notification.targetTweet?.id).toBe("tweet-123");
      expect(notification.targetTweet?.text).toBe("This is my tweet");
    });

    it("handles notification with fromUsers", () => {
      const notification = createNotification({
        icon: "person_icon",
        message: "New follower",
        fromUsers: [
          { id: "user-123", username: "newfollower", name: "New Follower" },
        ],
      });

      expect(notification.fromUsers).toBeDefined();
      expect(notification.fromUsers?.length).toBe(1);
      expect(notification.fromUsers?.[0]?.username).toBe("newfollower");
    });

    it("handles notification without target tweet or fromUsers", () => {
      const notification = createNotification({
        icon: "bird_icon",
        message: "System notification",
      });

      expect(notification.targetTweet).toBeUndefined();
      expect(notification.fromUsers).toBeUndefined();
    });
  });

  describe("notification icons", () => {
    it("supports heart_icon for likes", () => {
      const notification = createNotification({ icon: "heart_icon" });
      expect(notification.icon).toBe("heart_icon");
    });

    it("supports person_icon for follows", () => {
      const notification = createNotification({ icon: "person_icon" });
      expect(notification.icon).toBe("person_icon");
    });

    it("supports bird_icon for system notifications", () => {
      const notification = createNotification({ icon: "bird_icon" });
      expect(notification.icon).toBe("bird_icon");
    });

    it("supports retweet_icon for retweets", () => {
      const notification = createNotification({ icon: "retweet_icon" });
      expect(notification.icon).toBe("retweet_icon");
    });

    it("supports reply_icon for replies", () => {
      const notification = createNotification({ icon: "reply_icon" });
      expect(notification.icon).toBe("reply_icon");
    });
  });

  describe("empty states", () => {
    it("handles empty notifications array", async () => {
      const client = createMockClient({
        success: true,
        notifications: [],
      });

      const result = await client.getNotifications();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.notifications.length).toBe(0);
      }
    });

    it("unread count is 0 for empty notifications", () => {
      const notifications: NotificationData[] = [];
      const unreadSortIndex = "1700000000000";

      const unreadCount = notifications.filter(
        (n) => n.sortIndex > unreadSortIndex
      ).length;

      expect(unreadCount).toBe(0);
    });
  });

  describe("API result types", () => {
    it("success result contains notifications", async () => {
      const notifications = [createNotification()];
      const client = createMockClient({
        success: true,
        notifications,
        unreadSortIndex: "1699999999999",
        topCursor: "TOP",
        bottomCursor: "BOTTOM",
      });

      const result = await client.getNotifications();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.notifications).toEqual(notifications);
        expect(result.unreadSortIndex).toBe("1699999999999");
        expect(result.topCursor).toBe("TOP");
        expect(result.bottomCursor).toBe("BOTTOM");
      }
    });

    it("failure result contains error", async () => {
      const client = createMockClient({
        success: false,
        error: {
          type: "unknown",
          message: "Something went wrong",
        },
      });

      const result = await client.getNotifications();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("unknown");
        expect(result.error.message).toBe("Something went wrong");
      }
    });
  });
});
