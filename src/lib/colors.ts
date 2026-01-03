/**
 * Centralized color constants for the xfeed application.
 * Use these instead of magic color strings throughout the codebase.
 */

export const colors = {
  /** X brand blue - used for primary elements, selection, links */
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
} as const;

export type ColorKey = keyof typeof colors;
