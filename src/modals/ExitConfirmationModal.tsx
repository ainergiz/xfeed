/**
 * ExitConfirmationModal - Modal for confirming app exit with logout option
 *
 * Shows options: Logout and exit, Just exit, Cancel
 * Uses @opentui-ui/dialog for async dialog management.
 */

import {
  useDialogKeyboard,
  type ChoiceContext,
} from "@opentui-ui/dialog/react";
import { useState } from "react";

import { colors } from "@/lib/colors";

const OPTIONS = ["Logout and exit", "Just exit", "Cancel"] as const;
const OPTION_COUNT = OPTIONS.length;

/** Choice type for exit confirmation dialog */
export type ExitChoice = "logout" | "exit";

/** Props for ExitConfirmationContent (used with dialog.choice) */
export interface ExitConfirmationContentProps extends ChoiceContext<ExitChoice> {}

/**
 * Content component for exit confirmation dialog.
 * Use with dialog.choice<ExitChoice>().
 */
export function ExitConfirmationContent({
  resolve,
  dismiss,
  dialogId,
}: ExitConfirmationContentProps) {
  // 0 = Logout and exit, 1 = Just exit, 2 = Cancel
  const [selectedIndex, setSelectedIndex] = useState(2); // Default to "Cancel"

  useDialogKeyboard((key) => {
    // Direct key shortcuts
    if (key.name === "l") {
      resolve("logout");
      return;
    }

    if (key.name === "y") {
      resolve("exit");
      return;
    }

    if (key.name === "n" || key.name === "escape") {
      dismiss();
      return;
    }

    // Navigation between options
    if (key.name === "j" || key.name === "down" || key.name === "tab") {
      setSelectedIndex((prev) => (prev + 1) % OPTION_COUNT);
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((prev) => (prev - 1 + OPTION_COUNT) % OPTION_COUNT);
      return;
    }

    // Enter confirms current selection
    if (key.name === "return") {
      if (selectedIndex === 0) {
        resolve("logout");
      } else if (selectedIndex === 1) {
        resolve("exit");
      } else {
        dismiss();
      }
    }
  }, dialogId);

  return (
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
          <text fg={colors.primary}>Exit xfeed?</text>
        </box>

        {OPTIONS.map((option, index) => (
          <box key={option} style={{ flexDirection: "row" }}>
            <text fg={selectedIndex === index ? colors.primary : colors.muted}>
              {selectedIndex === index ? "> " : "  "}
              {option}
            </text>
          </box>
        ))}

        <box style={{ paddingTop: 1, flexDirection: "row" }}>
          <text fg={colors.dim}>l</text>
          <text fg="#444444"> logout </text>
          <text fg={colors.dim}>y</text>
          <text fg="#444444"> exit </text>
          <text fg={colors.dim}>n/Esc</text>
          <text fg="#444444"> cancel</text>
        </box>
      </box>
    </box>
  );
}

// =============================================================================
// Legacy export for backwards compatibility during migration
// TODO: Remove after all modals are migrated to @opentui-ui/dialog
// =============================================================================

import { useKeyboard } from "@opentui/react";

interface ExitConfirmationModalProps {
  /** Called when user chooses to logout and exit (l or Enter on Logout) */
  onLogout: () => void;
  /** Called when user confirms exit without logout (y or Enter on Just exit) */
  onConfirm: () => void;
  /** Called when user cancels (n or Escape) */
  onCancel: () => void;
  /** Whether the modal is focused (should handle keyboard) */
  focused?: boolean;
}

/**
 * @deprecated Use ExitConfirmationContent with dialog.choice() instead.
 * Kept for backwards compatibility with ModalContext during migration.
 */
export function ExitConfirmationModal({
  onLogout,
  onConfirm,
  onCancel,
  focused = true,
}: ExitConfirmationModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(2);

  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "l") {
      onLogout();
      return;
    }

    if (key.name === "y") {
      onConfirm();
      return;
    }

    if (key.name === "n" || key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "j" || key.name === "down" || key.name === "tab") {
      setSelectedIndex((prev) => (prev + 1) % OPTION_COUNT);
      return;
    }

    if (key.name === "k" || key.name === "up") {
      setSelectedIndex((prev) => (prev - 1 + OPTION_COUNT) % OPTION_COUNT);
      return;
    }

    if (key.name === "return") {
      if (selectedIndex === 0) {
        onLogout();
      } else if (selectedIndex === 1) {
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
            <text fg={colors.primary}>Exit xfeed?</text>
          </box>

          {OPTIONS.map((option, index) => (
            <box key={option} style={{ flexDirection: "row" }}>
              <text
                fg={selectedIndex === index ? colors.primary : colors.muted}
              >
                {selectedIndex === index ? "> " : "  "}
                {option}
              </text>
            </box>
          ))}

          <box style={{ paddingTop: 1, flexDirection: "row" }}>
            <text fg={colors.dim}>l</text>
            <text fg="#444444"> logout </text>
            <text fg={colors.dim}>y</text>
            <text fg="#444444"> exit </text>
            <text fg={colors.dim}>n/Esc</text>
            <text fg="#444444"> cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
