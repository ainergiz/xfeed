/**
 * FolderNameInputModal - Modal for creating or editing a bookmark folder name
 *
 * Uses @opentui-ui/dialog for async dialog management.
 * Features:
 * - Max 25 character limit
 * - Enter to submit, Esc to cancel
 * - Loading state during submission
 * - Error display on failure
 */

import {
  useDialogKeyboard,
  type PromptContext,
} from "@opentui-ui/dialog/react";
import { useState } from "react";

import { colors } from "@/lib/colors";

const MAX_FOLDER_NAME_LENGTH = 25;

// Dialog colors (Catppuccin-inspired)
const dialogColors = {
  bgDark: "#1e1e2e",
  bgPanel: "#181825",
  bgInput: "#11111b",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  textMuted: "#6c7086",
  accent: "#89b4fa",
};

/** Props for FolderNameInputContent (used with dialog.prompt) */
export interface FolderNameInputContentProps extends PromptContext<string> {
  /** Whether creating a new folder or editing existing */
  mode: "create" | "edit";
  /** Initial name value (for edit mode) */
  initialName?: string;
  /** Optional async validation/submission before resolving */
  onSubmit?: (name: string) => Promise<void>;
}

/**
 * Content component for folder name input dialog.
 * Use with dialog.prompt<string>().
 */
export function FolderNameInputContent({
  mode,
  initialName = "",
  onSubmit,
  resolve,
  dismiss,
  dialogId,
}: FolderNameInputContentProps) {
  const [value, setValue] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Folder name cannot be empty");
      return;
    }

    if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
      setError(`Name must be ${MAX_FOLDER_NAME_LENGTH} characters or less`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (onSubmit) {
        await onSubmit(trimmed);
      }
      resolve(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
      setIsSubmitting(false);
    }
  };

  useDialogKeyboard((key) => {
    if (isSubmitting) return;

    if (key.name === "escape") {
      dismiss();
    }
  }, dialogId);

  const title = mode === "create" ? "Create Folder" : "Rename Folder";
  const buttonText = mode === "create" ? "Create" : "Save";

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
        <text fg={dialogColors.accent}>📁</text>
        <text fg={dialogColors.textPrimary}>
          <b>{title}</b>
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
        {/* Input field */}
        <input
          value={value}
          placeholder="Enter folder name..."
          maxLength={MAX_FOLDER_NAME_LENGTH}
          focused={!isSubmitting}
          onInput={(newValue: string) => {
            setValue(newValue);
            if (error) setError(null);
          }}
          onSubmit={() => {
            handleSubmit();
          }}
          width={30}
          height={1}
          backgroundColor={dialogColors.bgInput}
          textColor={dialogColors.textPrimary}
          placeholderColor={dialogColors.textMuted}
          cursorColor={dialogColors.accent}
        />

        {/* Character count */}
        <text
          fg={
            value.length > MAX_FOLDER_NAME_LENGTH
              ? colors.error
              : dialogColors.textMuted
          }
        >
          {value.length}/{MAX_FOLDER_NAME_LENGTH}
        </text>

        {/* Error message */}
        {error ? <text fg={colors.error}>{error}</text> : null}

        {/* Loading state */}
        {isSubmitting ? (
          <text fg={dialogColors.textMuted}>Saving...</text>
        ) : null}
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
        <text fg={dialogColors.textSecondary}>{buttonText.toLowerCase()}</text>
        <text fg={dialogColors.textMuted}>Esc</text>
        <text fg={dialogColors.textSecondary}>cancel</text>
      </box>
    </box>
  );
}
