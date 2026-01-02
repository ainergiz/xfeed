import type { View } from "@/app";

interface HeaderProps {
  currentView: View;
  postCount?: number;
  unreadNotificationCount?: number;
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
        <text fg="#666666"> ({postCount} posts)</text>
      )}
    </box>
  );
}
