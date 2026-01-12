/**
 * AnnotationEditor - Modal for adding/editing bookmark annotations
 *
 * Uses @opentui-ui/dialog for async dialog management.
 * Features:
 * - Multi-line text input (500 character limit)
 * - Enter to submit, Esc to cancel
 * - Ctrl+D to delete existing annotation
 * - Character count display
 */

import {
  useDialogKeyboard,
  type PromptContext,
} from "@opentui-ui/dialog/react";
import { useState } from "react";

import { colors } from "@/lib/colors";

const MAX_ANNOTATION_LENGTH = 500;

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

/** Result from the annotation editor */
export interface AnnotationEditorResult {
  /** The action taken */
  action: "save" | "delete";
  /** The annotation text (only for save action) */
  text?: string;
}

/** Props for AnnotationEditorContent (used with dialog.choice) */
export interface AnnotationEditorContentProps
  extends PromptContext<AnnotationEditorResult> {
  /** Initial annotation text (for editing existing annotation) */
  initialText?: string;
  /** Whether an annotation already exists (shows delete option) */
  hasExisting?: boolean;
}

/**
 * Content component for annotation editor dialog.
 * Use with dialog.prompt<AnnotationEditorResult>().
 */
export function AnnotationEditorContent({
  initialText = "",
  hasExisting = false,
  resolve,
  dismiss,
  dialogId,
}: AnnotationEditorContentProps) {
  const [value, setValue] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();

    if (!trimmed) {
      if (hasExisting) {
        // Empty text with existing annotation = delete
        resolve({ action: "delete" });
      } else {
        setError("Annotation cannot be empty");
      }
      return;
    }

    if (trimmed.length > MAX_ANNOTATION_LENGTH) {
      setError(`Annotation must be ${MAX_ANNOTATION_LENGTH} characters or less`);
      return;
    }

    resolve({ action: "save", text: trimmed });
  };

  const handleDelete = () => {
    resolve({ action: "delete" });
  };

  useDialogKeyboard((key) => {
    if (key.name === "escape") {
      dismiss();
      return;
    }

    // Ctrl+D to delete (only if annotation exists)
    if (key.ctrl && key.name === "d" && hasExisting) {
      handleDelete();
    }
  }, dialogId);

  const title = hasExisting ? "Edit Annotation" : "Add Annotation";
  const isOverLimit = value.length > MAX_ANNOTATION_LENGTH;

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
        <text fg={dialogColors.accent}>+</text>
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
        {/* Input field - larger for annotations */}
        <input
          value={value}
          placeholder="Why did you save this tweet?"
          maxLength={MAX_ANNOTATION_LENGTH + 50} // Allow typing over limit to show error
          focused={true}
          onInput={(newValue: string) => {
            setValue(newValue);
            if (error) setError(null);
          }}
          onSubmit={() => {
            handleSubmit();
          }}
          width={50}
          height={3}
          backgroundColor={dialogColors.bgInput}
          textColor={dialogColors.textPrimary}
          placeholderColor={dialogColors.textMuted}
          cursorColor={dialogColors.accent}
        />

        {/* Character count */}
        <text fg={isOverLimit ? colors.error : dialogColors.textMuted}>
          {value.length}/{MAX_ANNOTATION_LENGTH}
        </text>

        {/* Error message */}
        {error ? <text fg={colors.error}>{error}</text> : null}
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
        <text fg={dialogColors.textSecondary}>save</text>
        <text fg={dialogColors.textMuted}>Esc</text>
        <text fg={dialogColors.textSecondary}>cancel</text>
        {hasExisting ? (
          <>
            <text fg={dialogColors.textMuted}>^D</text>
            <text fg={dialogColors.textSecondary}>delete</text>
          </>
        ) : null}
      </box>
    </box>
  );
}
