/**
 * SessionExpiredContent - Dialog content for expired session notification
 *
 * Terminal state - displays message and quits app on any key press.
 * Uses @opentui-ui/dialog for async dialog management.
 */

import { useDialogKeyboard, type AlertContext } from "@opentui-ui/dialog/react";
import { useRenderer } from "@opentui/react";

// Dialog colors (Catppuccin-inspired)
const dialogColors = {
  bgDark: "#1e1e2e",
  bgPanel: "#181825",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  textMuted: "#6c7086",
  red: "#f38ba8",
};

/** Props for SessionExpiredContent (used with dialog.alert) */
export interface SessionExpiredContentProps extends AlertContext {}

/**
 * Content component for session expired dialog.
 * Use with dialog.alert().
 */
export function SessionExpiredContent({
  dismiss,
  dialogId,
}: SessionExpiredContentProps) {
  const renderer = useRenderer();

  useDialogKeyboard((key) => {
    if (key.name === "return" || key.name === "q" || key.name === "escape") {
      dismiss();
      renderer.destroy();
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
        <text fg={dialogColors.red}>✕</text>
        <text fg={dialogColors.textPrimary}>
          <b>Session Expired</b>
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
        gap={1}
      >
        <text fg={dialogColors.textSecondary}>
          Your tokens are no longer valid.
        </text>
        <text fg={dialogColors.textMuted}>
          Please restart the app and log in again.
        </text>
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
        <text fg={dialogColors.textMuted}>Enter</text>
        <text fg={dialogColors.textSecondary}>quit</text>
      </box>
    </box>
  );
}
