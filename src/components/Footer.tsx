import { useTerminalDimensions } from "@opentui/react";

import { colors } from "@/lib/colors";

type Shortcut = { key: string; label: string };

const SHORTCUTS: Shortcut[] = [
  { key: "j/k", label: "nav" },
  { key: "l", label: "like" },
  { key: "b", label: "bookmark" },
  { key: "r", label: "refresh" },
  { key: "n", label: "notifs" },
  { key: "Tab", label: "view" },
  { key: "q", label: "quit" },
  { key: "?", label: "hide" },
];

function ShortcutItem({ shortcut }: { shortcut: Shortcut }) {
  return (
    <box style={{ flexDirection: "row", flexShrink: 0 }}>
      <text fg="#ffffff">{shortcut.key}</text>
      <text fg={colors.dim}> {shortcut.label}</text>
    </box>
  );
}

export function Footer() {
  const { width } = useTerminalDimensions();
  const borderLine = "─".repeat(width);

  return (
    <box
      style={{
        flexShrink: 0,
        flexDirection: "column",
        backgroundColor: "#1a1a1a",
      }}
    >
      <text fg="#333333">{borderLine}</text>
      <box
        style={{
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 2,
        }}
      >
        {SHORTCUTS.map((s) => (
          <ShortcutItem key={s.key} shortcut={s} />
        ))}
      </box>
    </box>
  );
}
