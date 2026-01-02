/**
 * NotificationItem - Individual notification display component
 */

import type { NotificationData, NotificationIcon } from "@/api/types";

import { formatRelativeTime, truncateText } from "@/lib/format";

const SELECTED_BG = "#1a1a2e";

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

interface NotificationItemProps {
  notification: NotificationData;
  isSelected: boolean;
  id?: string;
}

export function NotificationItem({
  notification,
  isSelected,
  id,
}: NotificationItemProps) {
  const iconInfo = ICON_MAP[notification.icon] ?? {
    symbol: "?",
    color: "#888888",
    label: "notification",
  };
  const timeAgo = formatRelativeTime(notification.timestamp);

  return (
    <box
      id={id}
      style={{
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        backgroundColor: isSelected ? SELECTED_BG : undefined,
      }}
    >
      {/* Icon and message line */}
      <box style={{ flexDirection: "row" }}>
        <text fg={iconInfo.color}>{isSelected ? "> " : "  "}</text>
        <text fg={iconInfo.color}>{iconInfo.symbol} </text>
        <text fg="#ffffff">{notification.message}</text>
        {timeAgo && <text fg="#666666"> · {timeAgo}</text>}
      </box>

      {/* Show tweet preview if available */}
      {notification.targetTweet && (
        <box style={{ paddingLeft: 4, marginTop: 1 }}>
          <text fg="#888888">
            "{truncateText(notification.targetTweet.text, 2, 70)}"
          </text>
        </box>
      )}

      {/* Show user info for follow notifications */}
      {notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0 && (
          <box style={{ paddingLeft: 4, marginTop: 1 }}>
            <text fg="#666666">
              @{notification.fromUsers[0]?.username ?? "unknown"}
            </text>
          </box>
        )}
    </box>
  );
}
