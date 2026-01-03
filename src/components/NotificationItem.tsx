/**
 * NotificationItem - Individual notification display component
 */

import type { NotificationData, NotificationIcon } from "@/api/types";

import { colors } from "@/lib/colors";
import { formatRelativeTime, truncateText } from "@/lib/format";

const ICON_MAP: Record<
  NotificationIcon,
  { symbol: string; color: string; label: string }
> = {
  heart_icon: { symbol: "\u2665", color: colors.error, label: "like" },
  person_icon: { symbol: "\u2603", color: colors.primary, label: "follow" },
  bird_icon: { symbol: "\u2699", color: "#794BC4", label: "system" },
  retweet_icon: { symbol: "\u21BB", color: colors.success, label: "repost" },
  reply_icon: { symbol: "\u21A9", color: colors.primary, label: "reply" },
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
    color: colors.muted,
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
        backgroundColor: isSelected ? colors.selectedBg : undefined,
      }}
    >
      {/* Icon and message line */}
      <box style={{ flexDirection: "row" }}>
        <text fg={iconInfo.color}>{isSelected ? "> " : "  "}</text>
        <text fg={iconInfo.color}>{iconInfo.symbol} </text>
        <text fg="#ffffff">{notification.message}</text>
        {timeAgo && <text fg={colors.dim}> · {timeAgo}</text>}
      </box>

      {/* Show tweet preview if available */}
      {notification.targetTweet && (
        <box style={{ paddingLeft: 4, marginTop: 1 }}>
          <text fg={colors.muted}>
            "{truncateText(notification.targetTweet.text, 2, 70)}"
          </text>
        </box>
      )}

      {/* Show user info for follow notifications */}
      {notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0 && (
          <box style={{ paddingLeft: 4, marginTop: 1 }}>
            <text fg={colors.dim}>
              @{notification.fromUsers[0]?.username ?? "unknown"}
            </text>
          </box>
        )}
    </box>
  );
}
