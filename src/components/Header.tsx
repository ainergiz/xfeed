import type { View } from "@/app";

import { colors } from "@/lib/colors";

interface HeaderProps {
  currentView: View;
  postCount?: number;
  hasMore?: boolean;
  unreadNotificationCount?: number;
}

function getCountLabel(view: View, count: number, hasMore: boolean): string {
  // Only show "+" if we have a full page (30+) and there are more to load
  // If count < 30, we know we have all items regardless of hasMore
  const suffix = hasMore && count >= 30 ? "+" : "";
  if (view === "notifications") {
    return `${count} notifications`;
  }
  if (view === "bookmarks") {
    return `${count}${suffix} bookmarked`;
  }
  return `${count} posts`;
}

export function Header({
  currentView,
  postCount,
  hasMore = false,
  unreadNotificationCount,
}: HeaderProps) {
  const viewLabel = currentView.charAt(0).toUpperCase() + currentView.slice(1);

  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        flexDirection: "row",
      }}
    >
      <text fg={colors.primary}>xfeed</text>
      {unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
        <text fg={colors.error}> ({unreadNotificationCount})</text>
      )}
      <text fg={colors.dim}> | </text>
      <text fg="#ffffff">{viewLabel}</text>
      {postCount !== undefined && postCount > 0 && (
        <text fg={colors.dim}>
          {" "}
          ({getCountLabel(currentView, postCount, hasMore)})
        </text>
      )}
    </box>
  );
}
