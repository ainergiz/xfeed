/**
 * DeleteFolderConfirmModal - Confirmation modal for deleting a bookmark folder
 *
 * Shows folder name and confirm/cancel options.
 * - Enter/y to confirm
 * - Esc/n to cancel
 */

import { useKeyboard } from "@opentui/react";
import { useState } from "react";

import { colors } from "@/lib/colors";

interface DeleteFolderConfirmModalProps {
  /** Name of the folder being deleted */
  folderName: string;
  /** Called when user confirms deletion */
  onConfirm: () => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the modal is focused */
  focused?: boolean;
}

export function DeleteFolderConfirmModal({
  folderName,
  onConfirm,
  onCancel,
  focused = true,
}: DeleteFolderConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
      setIsDeleting(false);
    }
  };

  useKeyboard((key) => {
    if (!focused || isDeleting) return;

    if (key.name === "y" || key.name === "return") {
      handleConfirm();
      return;
    }

    if (key.name === "n" || key.name === "escape") {
      onCancel();
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
          minWidth: 35,
          maxWidth: 50,
        }}
      >
        <box
          style={{
            borderStyle: "rounded",
            borderColor: error ? colors.error : colors.warning,
            padding: 1,
            flexDirection: "column",
          }}
          backgroundColor="#000000"
        >
          {/* Title */}
          <box style={{ paddingBottom: 1 }}>
            <text fg={colors.warning}>
              <b>Delete folder?</b>
            </text>
          </box>

          {/* Folder name */}
          <box style={{ paddingBottom: 1 }}>
            <text fg={colors.muted}>Folder: </text>
            <text fg={colors.primary}>"{folderName}"</text>
          </box>

          {/* Warning */}
          <box style={{ paddingBottom: 1 }}>
            <text fg={colors.dim}>
              Bookmarks will be moved to All Bookmarks.
            </text>
          </box>

          {/* Error message */}
          {error ? (
            <box style={{ paddingBottom: 1 }}>
              <text fg={colors.error}>{error}</text>
            </box>
          ) : null}

          {/* Loading state */}
          {isDeleting ? (
            <box style={{ paddingBottom: 1 }}>
              <text fg={colors.muted}>Deleting...</text>
            </box>
          ) : null}

          {/* Footer hints */}
          <box style={{ flexDirection: "row" }}>
            <text fg={colors.dim}>y/Enter</text>
            <text fg="#444444"> delete </text>
            <text fg={colors.dim}>n/Esc</text>
            <text fg="#444444"> cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
