/**
 * ErrorBanner - Displays error messages with countdown timer for rate limits
 * Supports different error types with appropriate styling and actions
 */

import { useState, useEffect } from "react";

import type { ApiError, ApiErrorType } from "@/api/types";

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
 * Format seconds into a readable countdown string
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function ErrorBanner({
  error,
  onRetry,
  onDismiss: _onDismiss,
  retryDisabled: _retryDisabled = false,
}: ErrorBannerProps) {
  // Countdown timer for rate limits
  const [countdown, setCountdown] = useState(() => {
    if (error.type === "rate_limit") {
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
    return 0;
  });

  // Countdown effect for rate limits
  useEffect(() => {
    if (error.type !== "rate_limit" || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [error.type, countdown > 0]);

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
          <text fg="#888888">{actionHint}</text>
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
      <text fg="#ffaa00">
        <b>[~]</b>{" "}
      </text>
      <text fg="#888888">Offline - Check your connection</text>
    </box>
  );
}
