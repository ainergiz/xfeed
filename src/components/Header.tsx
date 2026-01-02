import type { View } from "@/app";

interface HeaderProps {
  currentView: View;
  postCount?: number;
  unreadNotificationCount?: number;
}

function getCountLabel(view: View, count: number): string {
  if (view === "notifications") {
    return `${count} notifications`;
  }
  if (view === "bookmarks") {
    return `${count} bookmarked`;
  }
  return `${count} posts`;
}

export function Header({
  currentView,
  postCount,
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
      <text fg="#1DA1F2">xfeed</text>
      {unreadNotificationCount !== undefined && unreadNotificationCount > 0 && (
        <text fg="#E0245E"> ({unreadNotificationCount})</text>
      )}
      <text fg="#666666"> | </text>
      <text fg="#ffffff">{viewLabel}</text>
      {postCount !== undefined && postCount > 0 && (
        <text fg="#666666"> ({getCountLabel(currentView, postCount)})</text>
      )}
    </box>
  );
}
