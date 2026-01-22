import type { ReactNode } from "react";

import { colors } from "@/lib/colors";

interface HeaderProps {
  /** The main title to display (e.g., "Timeline", "Bookmarks") */
  title: string;
  /** Optional subtitle shown in parentheses (e.g., "30+ bookmarked") */
  subtitle?: string;
  /** Optional badge count shown with bell icon (e.g., unread notifications) */
  badge?: number;
  /** Optional content for the left slot (defaults to "xfeed" brand) */
  leftContent?: ReactNode;
  /** Optional content for the right slot */
  rightContent?: ReactNode;
}

export function Header({
  title,
  subtitle,
  badge,
  leftContent,
  rightContent,
}: HeaderProps) {
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
      {leftContent ?? <text fg={colors.primary}>xfeed</text>}
      {badge !== undefined && badge > 0 && (
        <text fg={colors.error}> 🔔 {badge}</text>
      )}
      <text fg={colors.dim}> | </text>
      <text fg="#ffffff">{title}</text>
      {subtitle && <text fg={colors.dim}> ({subtitle})</text>}
      {rightContent}
    </box>
  );
}
