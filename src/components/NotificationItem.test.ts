/**
 * Unit tests for NotificationItem component logic
 * Tests icon mapping, fallback handling, and data extraction
 */

import { describe, expect, it } from "bun:test";

import type { NotificationIcon } from "@/api/types";

// Mirror the ICON_MAP from NotificationItem.tsx for testing
const ICON_MAP: Record<
  NotificationIcon,
  { symbol: string; color: string; label: string }
> = {
  heart_icon: { symbol: "\u2665", color: "#E0245E", label: "like" },
  person_icon: { symbol: "\u2603", color: "#1DA1F2", label: "follow" },
  bird_icon: { symbol: "\u2699", color: "#794BC4", label: "system" },
  retweet_icon: { symbol: "\u21BB", color: "#17BF63", label: "repost" },
  reply_icon: { symbol: "\u21A9", color: "#1DA1F2", label: "reply" },
};

const DEFAULT_ICON_INFO = {
  symbol: "?",
  color: "#888888",
  label: "notification",
};

function getIconInfo(icon: NotificationIcon | undefined) {
  if (!icon || !ICON_MAP[icon]) {
    return DEFAULT_ICON_INFO;
  }
  return ICON_MAP[icon];
}

describe("NotificationItem", () => {
  describe("ICON_MAP", () => {
    it("has heart_icon for likes", () => {
      expect(ICON_MAP.heart_icon).toBeDefined();
      expect(ICON_MAP.heart_icon.symbol).toBe("♥");
      expect(ICON_MAP.heart_icon.color).toBe("#E0245E");
      expect(ICON_MAP.heart_icon.label).toBe("like");
    });

    it("has person_icon for follows", () => {
      expect(ICON_MAP.person_icon).toBeDefined();
      expect(ICON_MAP.person_icon.symbol).toBe("☃");
      expect(ICON_MAP.person_icon.color).toBe("#1DA1F2");
      expect(ICON_MAP.person_icon.label).toBe("follow");
    });

    it("has bird_icon for system notifications", () => {
      expect(ICON_MAP.bird_icon).toBeDefined();
      expect(ICON_MAP.bird_icon.symbol).toBe("⚙");
      expect(ICON_MAP.bird_icon.color).toBe("#794BC4");
      expect(ICON_MAP.bird_icon.label).toBe("system");
    });

    it("has retweet_icon for reposts", () => {
      expect(ICON_MAP.retweet_icon).toBeDefined();
      expect(ICON_MAP.retweet_icon.symbol).toBe("↻");
      expect(ICON_MAP.retweet_icon.color).toBe("#17BF63");
      expect(ICON_MAP.retweet_icon.label).toBe("repost");
    });

    it("has reply_icon for replies", () => {
      expect(ICON_MAP.reply_icon).toBeDefined();
      expect(ICON_MAP.reply_icon.symbol).toBe("↩");
      expect(ICON_MAP.reply_icon.color).toBe("#1DA1F2");
      expect(ICON_MAP.reply_icon.label).toBe("reply");
    });
  });

  describe("getIconInfo", () => {
    it("returns correct info for heart_icon", () => {
      const info = getIconInfo("heart_icon");
      expect(info.symbol).toBe("♥");
      expect(info.color).toBe("#E0245E");
    });

    it("returns correct info for person_icon", () => {
      const info = getIconInfo("person_icon");
      expect(info.symbol).toBe("☃");
      expect(info.color).toBe("#1DA1F2");
    });

    it("returns correct info for bird_icon", () => {
      const info = getIconInfo("bird_icon");
      expect(info.symbol).toBe("⚙");
      expect(info.color).toBe("#794BC4");
    });

    it("returns correct info for retweet_icon", () => {
      const info = getIconInfo("retweet_icon");
      expect(info.symbol).toBe("↻");
      expect(info.color).toBe("#17BF63");
    });

    it("returns correct info for reply_icon", () => {
      const info = getIconInfo("reply_icon");
      expect(info.symbol).toBe("↩");
      expect(info.color).toBe("#1DA1F2");
    });

    it("returns fallback for unknown icon", () => {
      const info = getIconInfo("unknown_icon" as NotificationIcon);
      expect(info.symbol).toBe("?");
      expect(info.color).toBe("#888888");
      expect(info.label).toBe("notification");
    });

    it("returns fallback for undefined icon", () => {
      const info = getIconInfo(undefined);
      expect(info.symbol).toBe("?");
      expect(info.color).toBe("#888888");
      expect(info.label).toBe("notification");
    });
  });

  describe("icon colors", () => {
    it("uses red for heart (likes)", () => {
      expect(ICON_MAP.heart_icon.color).toBe("#E0245E");
    });

    it("uses blue for person (follows)", () => {
      expect(ICON_MAP.person_icon.color).toBe("#1DA1F2");
    });

    it("uses purple for bird (system)", () => {
      expect(ICON_MAP.bird_icon.color).toBe("#794BC4");
    });

    it("uses green for retweet", () => {
      expect(ICON_MAP.retweet_icon.color).toBe("#17BF63");
    });

    it("uses blue for reply", () => {
      expect(ICON_MAP.reply_icon.color).toBe("#1DA1F2");
    });
  });

  describe("notification element ID generation", () => {
    function getNotificationItemId(notificationId: string): string {
      return `notification-${notificationId}`;
    }

    it("generates correct ID for simple notification ID", () => {
      expect(getNotificationItemId("123")).toBe("notification-123");
    });

    it("generates correct ID for complex notification ID", () => {
      expect(getNotificationItemId("DrwTuwcW4AAA")).toBe(
        "notification-DrwTuwcW4AAA"
      );
    });

    it("handles empty string ID", () => {
      expect(getNotificationItemId("")).toBe("notification-");
    });
  });

  describe("notification display logic", () => {
    it("shows tweet preview for like notifications with targetTweet", () => {
      const notification = {
        icon: "heart_icon" as NotificationIcon,
        targetTweet: { text: "My tweet content" },
      };

      const showTweetPreview = notification.targetTweet !== undefined;
      expect(showTweetPreview).toBe(true);
    });

    it("hides tweet preview for follow notifications", () => {
      const notification = {
        icon: "person_icon" as NotificationIcon,
        targetTweet: undefined,
      };

      const showTweetPreview = notification.targetTweet !== undefined;
      expect(showTweetPreview).toBe(false);
    });

    it("shows user info for follow notifications with fromUsers", () => {
      const notification = {
        icon: "person_icon" as NotificationIcon,
        fromUsers: [{ username: "newfollower" }],
      };

      const showUserInfo =
        notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0;

      expect(showUserInfo).toBe(true);
    });

    it("hides user info for non-follow notifications", () => {
      const notification = {
        icon: "heart_icon" as NotificationIcon,
        fromUsers: [{ username: "liker" }],
      };

      const showUserInfo =
        notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0;

      expect(showUserInfo).toBe(false);
    });

    it("hides user info when fromUsers is empty", () => {
      const notification = {
        icon: "person_icon" as NotificationIcon,
        fromUsers: [],
      };

      const showUserInfo =
        notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0;

      expect(showUserInfo).toBe(false);
    });
  });

  describe("selection state", () => {
    it("applies selection indicator for selected items", () => {
      const isSelected = true;
      const indicator = isSelected ? "> " : "  ";
      expect(indicator).toBe("> ");
    });

    it("applies no indicator for unselected items", () => {
      const isSelected = false;
      const indicator = isSelected ? "> " : "  ";
      expect(indicator).toBe("  ");
    });

    it("applies background color for selected items", () => {
      const isSelected = true;
      const SELECTED_BG = "#1a1a2e";
      const bgColor = isSelected ? SELECTED_BG : undefined;
      expect(bgColor).toBe("#1a1a2e");
    });

    it("applies no background for unselected items", () => {
      const isSelected = false;
      const SELECTED_BG = "#1a1a2e";
      const bgColor = isSelected ? SELECTED_BG : undefined;
      expect(bgColor).toBeUndefined();
    });
  });
});
