/**
 * DeleteFolderConfirmModal - Confirmation modal for deleting a bookmark folder
 *
 * Shows folder name and confirm/cancel options.
 * - Enter/y to confirm
 * - Esc/n to cancel
 *
 * Uses @opentui-ui/dialog for async dialog management.
 */

import {
  useDialogKeyboard,
  type ConfirmContext,
} from "@opentui-ui/dialog/react";
import { useState } from "react";

import { colors } from "@/lib/colors";

/** Props for DeleteFolderConfirmContent (used with dialog.confirm) */
export interface DeleteFolderConfirmContentProps extends ConfirmContext {
  /** Name of the folder being deleted */
  folderName: string;
  /** Async operation to perform on confirmation */
  onConfirm: () => Promise<void>;
}

// Dialog colors (Catppuccin-inspired)
const dialogColors = {
  bgDark: "#1e1e2e",
  bgPanel: "#181825",
  bgHover: "#313244",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  textMuted: "#6c7086",
  red: "#f38ba8",
  redBg: "#3c2a32",
};

/**
 * Content component for delete folder confirmation dialog.
 * Handles loading/error states internally.
 * Use with dialog.confirm().
 */
export function DeleteFolderConfirmContent({
  folderName,
  onConfirm,
  resolve,
  dismiss,
  dialogId,
}: DeleteFolderConfirmContentProps) {
  const [selected, setSelected] = useState<"cancel" | "delete">("cancel");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      resolve(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
      setIsDeleting(false);
    }
  };

  useDialogKeyboard((key) => {
    if (isDeleting) return;

    // Tab/arrow keys switch between Cancel and Delete
    if (key.name === "tab" || key.name === "left" || key.name === "right") {
      setSelected((prev) => (prev === "cancel" ? "delete" : "cancel"));
      return;
    }

    // Enter confirms current selection
    if (key.name === "return") {
      if (selected === "delete") {
        handleConfirm();
      } else {
        dismiss();
      }
      return;
    }

    // Escape always cancels
    if (key.name === "escape") {
      dismiss();
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
        <text fg={dialogColors.red}>*</text>
        <text fg={dialogColors.textPrimary}>
          <b>Delete Folder</b>
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
          Are you sure you want to delete this folder?
        </text>
        <text fg={dialogColors.textPrimary}>→ {folderName}</text>
        <text fg={dialogColors.textMuted}>
          Bookmarks will be moved to All Bookmarks.
        </text>

        {/* Error message */}
        {error ? <text fg={colors.error}>{error}</text> : null}

        {/* Loading state */}
        {isDeleting ? (
          <text fg={dialogColors.textMuted}>Deleting...</text>
        ) : null}
      </box>

      {/* Actions */}
      <box
        backgroundColor={dialogColors.bgPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        gap={2}
        justifyContent="flex-end"
      >
        <text
          bg={selected === "cancel" ? dialogColors.bgHover : undefined}
          fg={dialogColors.textSecondary}
        >
          {" "}
          Cancel{" "}
        </text>
        <text
          bg={selected === "delete" ? dialogColors.redBg : undefined}
          fg={selected === "delete" ? "#ffffff" : dialogColors.red}
        >
          {" "}
          Delete{" "}
        </text>
      </box>
    </box>
  );
}
