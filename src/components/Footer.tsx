import { useTerminalDimensions } from "@opentui/react";

import { colors } from "@/lib/colors";

export type Keybinding = {
  key: string;
  label: string;
  show?: boolean; // Default true - conditional display
  activeColor?: string; // Color when active (e.g., for liked/bookmarked states)
  activeLabel?: string; // Label when active (e.g., "♥" instead of "like")
  isActive?: boolean; // Whether to show active state
};

const DEFAULT_BINDINGS: Keybinding[] = [
  { key: "j/k", label: "nav" },
  { key: "l", label: "like" },
  { key: "b", label: "bookmark" },
  { key: "g", label: "goto" },
  { key: "r", label: "refresh" },
  { key: "Tab", label: "switch" },
  { key: "q", label: "quit" },
];

interface FooterProps {
  bindings?: Keybinding[];
  visible?: boolean;
}

function KeybindingItem({ binding }: { binding: Keybinding }) {
  const labelColor =
    binding.isActive && binding.activeColor ? binding.activeColor : colors.dim;
  const label =
    binding.isActive && binding.activeLabel
      ? binding.activeLabel
      : binding.label;

  return (
    <box style={{ flexDirection: "row", flexShrink: 0 }}>
      <text fg="#ffffff">{binding.key}</text>
      <text fg={labelColor}> {label}</text>
    </box>
  );
}

export function Footer({ bindings, visible = true }: FooterProps) {
  const { width } = useTerminalDimensions();

  if (!visible) {
    return null;
  }

  const borderLine = "─".repeat(width);
  const effectiveBindings = bindings ?? DEFAULT_BINDINGS;

  // Filter out bindings where show is explicitly false
  const visibleBindings = effectiveBindings.filter(
    (b) => b.show === undefined || b.show
  );

  // Always add the . keybinding at the end
  const allBindings: Keybinding[] = [
    ...visibleBindings,
    { key: ".", label: "hide" },
  ];

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
        {allBindings.map((b) => (
          <KeybindingItem key={b.key} binding={b} />
        ))}
      </box>
    </box>
  );
}
