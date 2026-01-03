/**
 * ExitConfirmationModal - Modal for confirming app exit
 *
 * Shows a simple Yes/No confirmation when user attempts to exit from timeline.
 * Follows the same modal pattern as FolderPicker.
 */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

const X_BLUE = "#1DA1F2";

interface ExitConfirmationModalProps {
  /** Called when user confirms exit (y or Enter on Yes) */
  onConfirm: () => void;
  /** Called when user cancels (n or Escape) */
  onCancel: () => void;
  /** Whether the modal is focused (should handle keyboard) */
  focused?: boolean;
}

export function ExitConfirmationModal({
  onConfirm,
  onCancel,
  focused = true,
}: ExitConfirmationModalProps) {
  // 0 = Yes, 1 = No
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to "No"

  useKeyboard((key) => {
    if (!focused) return;

    // Direct key shortcuts
    if (key.name === "y") {
      onConfirm();
      return;
    }

    if (key.name === "n" || key.name === "escape") {
      onCancel();
      return;
    }

    // Navigation between options
    if (key.name === "j" || key.name === "down" || key.name === "tab") {
      setSelectedIndex((prev) => (prev + 1) % 2);
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((prev) => (prev - 1 + 2) % 2);
      return;
    }

    // Enter confirms current selection
    if (key.name === "return") {
      if (selectedIndex === 0) {
        onConfirm();
      } else {
        onCancel();
      }
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
      backgroundColor="#000000"
      opacity={0.8}
    >
      <box
        style={{
          flexDirection: "column",
          padding: 2,
          minWidth: 30,
        }}
      >
        <box
          style={{
            borderStyle: "rounded",
            borderColor: "#444444",
            padding: 1,
          }}
          backgroundColor="#000000"
        >
          <box style={{ paddingBottom: 1 }}>
            <text fg={X_BLUE}>Exit xfeed?</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <text fg={selectedIndex === 0 ? X_BLUE : "#888888"}>
              {selectedIndex === 0 ? "> " : "  "}Yes
            </text>
          </box>
          <box style={{ flexDirection: "row" }}>
            <text fg={selectedIndex === 1 ? X_BLUE : "#888888"}>
              {selectedIndex === 1 ? "> " : "  "}No
            </text>
          </box>

          <box style={{ paddingTop: 1, flexDirection: "row" }}>
            <text fg="#666666">y</text>
            <text fg="#444444"> yes </text>
            <text fg="#666666">n/Esc</text>
            <text fg="#444444"> no</text>
          </box>
        </box>
      </box>
    </box>
  );
}
