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
 * User preferences stored in ~/.config/xfeed/preferences.toml
 *
 * All fields use defaults if missing or invalid.
 * Invalid values trigger warnings to stderr.
 */
export interface UserPreferences {
  timeline: TimelinePreferences;
}

/**
 * Default preferences - used when file is missing or values are invalid
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  timeline: {
    default_tab: "for_you",
  },
};

/**
 * Valid values for timeline.default_tab
 */
export const VALID_TIMELINE_TABS = ["for_you", "following"] as const;
