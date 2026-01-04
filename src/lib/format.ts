/**
 * Formatting utilities for xfeed TUI
 */

/**
 * Format a timestamp as relative time (e.g., "2h", "5d", "Jan 15")
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Truncate text to a maximum number of lines.
 * Does NOT add "..." - caller should show a separate [Show more] indicator.
 */
export function truncateText(
  text: string,
  maxLines: number,
  maxCharsPerLine = 80
): string {
  const lines = text.split("\n").slice(0, maxLines);
  const truncated = lines.map((line) =>
    line.length > maxCharsPerLine ? line.slice(0, maxCharsPerLine) : line
  );
  return truncated.join("\n");
}

/**
 * Truncate text by line count only - no per-line character limit.
 * Suitable for detailed views where full lines should be visible.
 */
export function truncateLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return lines.slice(0, maxLines).join("\n");
}

/**
 * Check if text would be truncated at the given limits.
 */
export function isTruncated(
  text: string,
  maxLines: number,
  maxCharsPerLine = 80
): boolean {
  const lines = text.split("\n");
  if (lines.length > maxLines) {
    return true;
  }
  return lines.some((line) => line.length > maxCharsPerLine);
}

/**
 * Check if text would be truncated by line count only.
 */
export function isLineTruncated(text: string, maxLines: number): boolean {
  return text.split("\n").length > maxLines;
}

/**
 * Format stat count with K/M suffixes
 */
export function formatCount(count?: number): string {
  if (count === undefined || count === 0) return "0";
  if (count < 1000) return String(count);
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format seconds into a readable countdown string (e.g., "5m 30s" or "45s")
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
