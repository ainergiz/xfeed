/**
 * FolderNameInputModal - Modal for creating or editing a bookmark folder name
 *
 * Uses OpenTUI's <input> intrinsic for text entry with:
 * - Max 25 character limit
 * - Enter to submit, Esc to cancel
 * - Loading state during submission
 * - Error display on failure
 */

import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";

import { colors } from "@/lib/colors";

const MAX_FOLDER_NAME_LENGTH = 25;

interface FolderNameInputModalProps {
  /** Whether creating a new folder or editing existing */
  mode: "create" | "edit";
  /** Initial name value (for edit mode) */
  initialName?: string;
  /** Called when user submits a valid name */
  onSubmit: (name: string) => Promise<void>;
  /** Called when user cancels (Esc) */
  onClose: () => void;
  /** Whether the modal is focused */
  focused?: boolean;
}

export function FolderNameInputModal({
  mode,
  initialName = "",
  onSubmit,
  onClose,
  focused = true,
}: FolderNameInputModalProps) {
  const [value, setValue] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    setValue(initialName);
    setError(null);
    setIsSubmitting(false);
  }, [initialName]);

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
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
      setIsSubmitting(false);
    }
  };

  useKeyboard((key) => {
    if (!focused || isSubmitting) return;

    if (key.name === "escape") {
      onClose();
    }
  });

  const title = mode === "create" ? "Create folder" : "Rename folder";
  const buttonText = mode === "create" ? "Create" : "Save";

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
            borderColor: error ? colors.error : "#444444",
            padding: 1,
            flexDirection: "column",
          }}
          backgroundColor="#000000"
        >
          {/* Title */}
          <box style={{ paddingBottom: 1 }}>
            <text fg={colors.primary}>
              <b>{title}</b>
            </text>
          </box>

          {/* Input field */}
          <box
            style={{
              flexDirection: "row",
              paddingBottom: 1,
            }}
          >
            <input
              value={value}
              placeholder="Enter folder name..."
              maxLength={MAX_FOLDER_NAME_LENGTH}
              focused={focused && !isSubmitting}
              onInput={(newValue: string) => {
                setValue(newValue);
                if (error) setError(null);
              }}
              onSubmit={() => {
                handleSubmit();
              }}
              width={30}
              height={1}
              backgroundColor="#1a1a1a"
              textColor="#ffffff"
              placeholderColor="#666666"
              cursorColor={colors.primary}
            />
          </box>

          {/* Character count */}
          <box style={{ paddingBottom: 1 }}>
            <text
              fg={
                value.length > MAX_FOLDER_NAME_LENGTH
                  ? colors.error
                  : colors.dim
              }
            >
              {value.length}/{MAX_FOLDER_NAME_LENGTH}
            </text>
          </box>

          {/* Error message */}
          {error ? (
            <box style={{ paddingBottom: 1 }}>
              <text fg={colors.error}>{error}</text>
            </box>
          ) : null}

          {/* Loading state */}
          {isSubmitting ? (
            <box style={{ paddingBottom: 1 }}>
              <text fg={colors.muted}>Saving...</text>
            </box>
          ) : null}

          {/* Footer hints */}
          <box style={{ flexDirection: "row" }}>
            <text fg={colors.dim}>Enter</text>
            <text fg="#444444"> {buttonText.toLowerCase()} </text>
            <text fg={colors.dim}>Esc</text>
            <text fg="#444444"> cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
