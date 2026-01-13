/**
 * UrlInputModal - Modal for pasting an x.com URL to navigate to a tweet or profile
 *
 * Uses @opentui-ui/dialog for async dialog management.
 * Features:
 * - Parses x.com and twitter.com URLs
 * - Supports tweet URLs (/username/status/id) and profile URLs (/username)
 * - Enter to submit, Esc to cancel
 * - Loading state during navigation
 * - Error display on failure
 */

import {
  useDialogKeyboard,
  type PromptContext,
} from "@opentui-ui/dialog/react";
import { useAppContext } from "@opentui/react";
import { useEffect, useState } from "react";

import { colors } from "@/lib/colors";
import { parseXUrl, type ParsedUrl } from "@/lib/url-parser";

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

/** Result returned when navigation is successful */
export type UrlNavigationResult = ParsedUrl & { type: "tweet" | "profile" };

/** Props for UrlInputContent (used with dialog.prompt) */
export interface UrlInputContentProps extends PromptContext<UrlNavigationResult> {
  /** Callback to handle navigation to a tweet */
  onNavigateToTweet: (
    tweetId: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Callback to handle navigation to a profile */
  onNavigateToProfile: (
    username: string
  ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Content component for URL input dialog.
 * Use with dialog.prompt<UrlNavigationResult>().
 */
export function UrlInputContent({
  onNavigateToTweet,
  onNavigateToProfile,
  resolve,
  dismiss,
  dialogId,
}: UrlInputContentProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get keyHandler for paste event handling
  const { keyHandler } = useAppContext();

  // Handle ESC to dismiss dialog - useDialogKeyboard ensures only topmost dialog responds
  useDialogKeyboard((key) => {
    if (isSubmitting) return;

    if (key.name === "escape") {
      dismiss();
    }
  }, dialogId);

  // Handle paste events - Input component doesn't handle paste natively
  useEffect(() => {
    if (!keyHandler || isSubmitting) return;

    const handlePaste = (event: { text: string }) => {
      setValue((prev) => prev + event.text);
      if (error) setError(null);
    };

    keyHandler.on("paste", handlePaste);
    return () => {
      keyHandler.off("paste", handlePaste);
    };
  }, [keyHandler, isSubmitting, error]);

  const handleSubmit = async () => {
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Please paste an X URL");
      return;
    }

    const parsed = parseXUrl(trimmed);

    if (parsed.type === "invalid") {
      setError(parsed.error);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (parsed.type === "tweet") {
        const result = await onNavigateToTweet(parsed.tweetId);
        if (result.success) {
          resolve(parsed);
        } else {
          setError(result.error ?? "Failed to load tweet");
          setIsSubmitting(false);
        }
      } else {
        const result = await onNavigateToProfile(parsed.username);
        if (result.success) {
          resolve(parsed);
        } else {
          setError(result.error ?? "Failed to load profile");
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to navigate");
      setIsSubmitting(false);
    }
  };

  return (
    <box flexDirection="column" width={56}>
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
        <text fg={dialogColors.accent}>Go to URL</text>
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
          placeholder="Paste x.com URL..."
          focused={!isSubmitting}
          onInput={(newValue: string) => {
            setValue(newValue);
            if (error) setError(null);
          }}
          onSubmit={() => {
            handleSubmit();
          }}
          width={50}
          height={1}
          backgroundColor={dialogColors.bgInput}
          textColor={dialogColors.textPrimary}
          placeholderColor={dialogColors.textMuted}
          cursorColor={dialogColors.accent}
        />

        {/* Helper text */}
        <text fg={dialogColors.textMuted}>
          Supports x.com/user/status/id and x.com/user
        </text>

        {/* Error message */}
        {error ? <text fg={colors.error}>{error}</text> : null}

        {/* Loading state */}
        {isSubmitting ? (
          <text fg={dialogColors.textMuted}>Loading...</text>
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
        <text fg={dialogColors.textSecondary}>go</text>
        <text fg={dialogColors.textMuted}>Esc</text>
        <text fg={dialogColors.textSecondary}>cancel</text>
      </box>
    </box>
  );
}
