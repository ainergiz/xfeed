import type { TimelineTab } from "@/experiments/use-timeline-query";

/**
 * Timeline preferences section
 */
export interface TimelinePreferences {
  /**
   * Default tab to show when opening the timeline
   * @default "for_you"
   */
  default_tab: TimelineTab;
}

/**
 * Bookmarks preferences section
 */
export interface BookmarksPreferences {
  /**
   * Default folder to show when opening bookmarks.
   * Use "all" for All Bookmarks, or a folder name for a specific folder.
   * @default "all"
   */
  default_folder: string;
}

/**
 * User preferences stored in ~/.config/xfeed/preferences.toml
 *
 * All fields use defaults if missing or invalid.
 * Invalid values trigger warnings to stderr.
 */
export interface UserPreferences {
  timeline: TimelinePreferences;
  bookmarks: BookmarksPreferences;
}

/**
 * Default preferences - used when file is missing or values are invalid
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  timeline: {
    default_tab: "for_you",
  },
  bookmarks: {
    default_folder: "all",
  },
};

/**
 * Valid values for timeline.default_tab
 */
export const VALID_TIMELINE_TABS = ["for_you", "following"] as const;
