/**
 * ErrorBanner - Displays error messages with countdown timer for rate limits
 * Supports different error types with appropriate styling and actions
 */

import { useEffect } from "react";

import type { ApiError, ApiErrorType } from "@/api/types";

import { useCountdown } from "@/hooks/useCountdown";
import { colors } from "@/lib/colors";
import { formatCountdown } from "@/lib/format";

interface ErrorBannerProps {
  /** The error to display */
  error: ApiError;
  /** Called when user presses 'r' to retry */
  onRetry?: () => void;
  /** Called when user dismisses the error */
  onDismiss?: () => void;
  /** Whether retry is currently disabled (e.g., during countdown) */
  retryDisabled?: boolean;
}

/**
 * Get the icon for each error type
 */
function getErrorIcon(type: ApiErrorType): string {
  switch (type) {
    case "rate_limit":
      return "[!]";
    case "auth_expired":
      return "[X]";
    case "network_error":
      return "[~]";
    case "not_found":
      return "[?]";
    case "unavailable":
      return "[!]";
    default:
      return "[!]";
  }
}

/**
 * Get background color for each error type
 */
function getErrorBg(type: ApiErrorType): string {
  switch (type) {
    case "rate_limit":
      return "#442200"; // Orange-ish
    case "auth_expired":
      return "#441111"; // Red-ish
    case "network_error":
      return "#333333"; // Gray
    default:
      return "#441111"; // Red-ish
  }
}

/**
 * Compute initial countdown seconds from error
 */
function getInitialCountdown(error: ApiError): number {
  if (error.type !== "rate_limit") return 0;
  // Use retryAfter if available, otherwise calculate from rateLimitReset
  if (error.retryAfter) {
    return error.retryAfter;
  }
  if (error.rateLimitReset) {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, error.rateLimitReset - now);
  }
  return 900; // Default 15 minutes
}

export function ErrorBanner({
  error,
  onRetry,
  onDismiss: _onDismiss,
  retryDisabled: _retryDisabled = false,
}: ErrorBannerProps) {
  const { countdown, start } = useCountdown();

  // Start countdown when error changes (for rate limits)
  useEffect(() => {
    const seconds = getInitialCountdown(error);
    if (seconds > 0) {
      start(seconds);
    }
  }, [error, start]);

  const icon = getErrorIcon(error.type);
  const bgColor = getErrorBg(error.type);
  const isRetryable =
    error.type === "network_error" ||
    error.type === "unavailable" ||
    (error.type === "rate_limit" && countdown === 0);

  // Build the action hint text
  let actionHint = "";
  if (error.type === "auth_expired") {
    actionHint = "Please log into x.com and restart xfeed";
  } else if (error.type === "rate_limit") {
    if (countdown > 0) {
      actionHint = `Retry in ${formatCountdown(countdown)}`;
    } else {
      actionHint = "Press 'r' to retry";
    }
  } else if (isRetryable && onRetry) {
    actionHint = "Press 'r' to retry";
  }

  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: bgColor,
        flexDirection: "column",
      }}
    >
      <box style={{ flexDirection: "row" }}>
        <text fg="#ff6666">
          <b>{icon}</b>{" "}
        </text>
        <text fg="#ffffff">{error.message}</text>
      </box>
      {actionHint && (
        <box style={{ paddingTop: 1, paddingLeft: 4 }}>
          <text fg={colors.muted}>{actionHint}</text>
        </box>
      )}
    </box>
  );
}

/**
 * Compact error message for inline display
 */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <text fg="#ff6666">
      <b>Error:</b> {message}
    </text>
  );
}

/**
 * Offline indicator for network errors
 */
export function OfflineIndicator() {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: "#333333",
        flexDirection: "row",
      }}
    >
      <text fg={colors.warning}>
        <b>[~]</b>{" "}
      </text>
      <text fg={colors.muted}>Offline - Check your connection</text>
    </box>
  );
}
