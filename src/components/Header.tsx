import type { View } from "@/app";

interface HeaderProps {
  currentView: View;
}

export function Header({ currentView }: HeaderProps) {
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
      <text fg="#666666"> | </text>
      <text fg="#ffffff">{viewLabel}</text>
    </box>
  );
}
