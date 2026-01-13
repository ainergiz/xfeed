/**
 * ExitConfirmationContent - Dialog content for confirming app exit with logout option
 *
 * Shows options: Logout and exit, Just exit, Cancel
 * Uses @opentui-ui/dialog for async dialog management.
 */

import {
  useDialogKeyboard,
  type ChoiceContext,
} from "@opentui-ui/dialog/react";
import { useState } from "react";

const OPTIONS = ["Logout and exit", "Just exit", "Cancel"] as const;
const OPTION_COUNT = OPTIONS.length;

// Dialog colors (Catppuccin-inspired)
const dialogColors = {
  bgDark: "#1e1e2e",
  bgPanel: "#181825",
  bgHover: "#313244",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  textMuted: "#6c7086",
  accent: "#89b4fa",
  warning: "#fab387",
};

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
    <box flexDirection="column">
      {/* Header */}
      <box
        backgroundColor={dialogColors.bgPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        gap={1}
      >
        <text fg={dialogColors.warning}>⚠</text>
        <text fg={dialogColors.textPrimary}>
          <b>Exit xfeed?</b>
        </text>
      </box>

      {/* Content */}
      <box
        backgroundColor={dialogColors.bgDark}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
      >
        {OPTIONS.map((option, index) => (
          <text
            key={option}
            fg={
              selectedIndex === index
                ? dialogColors.textPrimary
                : dialogColors.textSecondary
            }
            bg={selectedIndex === index ? dialogColors.bgHover : undefined}
          >
            {selectedIndex === index ? " › " : "   "}
            {option}
            {"  "}
          </text>
        ))}
      </box>

      {/* Footer */}
      <box
        backgroundColor={dialogColors.bgPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        gap={2}
      >
        <text fg={dialogColors.textMuted}>l</text>
        <text fg={dialogColors.textSecondary}>logout</text>
        <text fg={dialogColors.textMuted}>y</text>
        <text fg={dialogColors.textSecondary}>exit</text>
        <text fg={dialogColors.textMuted}>n/Esc</text>
        <text fg={dialogColors.textSecondary}>cancel</text>
      </box>
    </box>
  );
}
