/**
 * Centralized color constants for the xfeed application.
 * Use these instead of magic color strings throughout the codebase.
 */

export const colors = {
  /** X brand blue - used for primary elements, selection, links, main author */
  primary: "#1DA1F2",

  /** Success green - used for likes, retweets, success states */
  success: "#17BF63",

  /** Warning orange - used for warning indicators */
  warning: "#FFAD1F",

  /** Error/Like red - used for errors and like icons */
  error: "#E0245E",

  /** Selection highlight background */
  selectedBg: "#1a1a2e",

  /** Muted/secondary text color */
  muted: "#888888",

  /** Dim text color - less prominent than muted */
  dim: "#666666",

  /** Purple - used for @mentions in tweet text */
  mention: "#9B59B6",

  /** Light blue - used for quoted tweet authors */
  quoted: "#3498DB",

  /** Gray - used for reply context ("Replying to...") */
  reply: "#95A5A6",

  /** Muted blue - used for @handles (secondary to name) */
  handle: "#6B8A9E",

  /** Color for liked state (heart icon) */
  liked: "#E0245E",

  /** Color for bookmarked state (flag icon) */
  bookmarked: "#1DA1F2",

  /** Color for inactive action icons */
  actionInactive: "#888888",
} as const;

export type ColorKey = keyof typeof colors;
