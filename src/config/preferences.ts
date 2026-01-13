import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { TimelineTab } from "@/experiments/use-timeline-query";

import {
  DEFAULT_PREFERENCES,
  VALID_TIMELINE_TABS,
  type UserPreferences,
} from "./preferences-types";
import { parseToml } from "./toml";

const CONFIG_DIR = path.join(homedir(), ".config", "xfeed");
const PREFERENCES_PATH = path.join(CONFIG_DIR, "preferences.toml");

/**
 * Result of loading preferences - includes any validation warnings
 */
export interface LoadPreferencesResult {
  preferences: UserPreferences;
  warnings: string[];
}

/**
 * Validate a timeline tab value.
 * Returns the valid tab or undefined if invalid.
 */
function validateTimelineTab(value: unknown): TimelineTab | undefined {
  if (typeof value === "string") {
    if (VALID_TIMELINE_TABS.includes(value as TimelineTab)) {
      return value as TimelineTab;
    }
  }
  return undefined;
}

/**
 * Load user preferences from ~/.config/xfeed/preferences.toml
 *
 * Returns default preferences if:
 * - File doesn't exist (no warnings)
 * - File is empty (no warnings)
 * - File has read errors (warning logged)
 *
 * Individual invalid values fall back to defaults with warnings.
 */
export function loadPreferences(): LoadPreferencesResult {
  const warnings: string[] = [];
  const preferences: UserPreferences = structuredClone(DEFAULT_PREFERENCES);

  // Return defaults if file doesn't exist (common case, no warning)
  if (!existsSync(PREFERENCES_PATH)) {
    return { preferences, warnings };
  }

  let content: string;
  try {
    content = readFileSync(PREFERENCES_PATH, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Could not read preferences file: ${message}`);
    return { preferences, warnings };
  }

  // Empty file is valid - just use defaults
  if (content.trim() === "") {
    return { preferences, warnings };
  }

  // Parse TOML
  const parsed = parseToml(content);

  // Validate [timeline] section
  const timeline = parsed["timeline"];
  if (timeline) {
    // Validate timeline.default_tab
    if ("default_tab" in timeline) {
      const validTab = validateTimelineTab(timeline["default_tab"]);
      if (validTab) {
        preferences.timeline.default_tab = validTab;
      } else {
        warnings.push(
          `Invalid timeline.default_tab: "${timeline["default_tab"]}". ` +
            `Must be one of: ${VALID_TIMELINE_TABS.join(", ")}. ` +
            `Using default: "${DEFAULT_PREFERENCES.timeline.default_tab}"`
        );
      }
    }
  }

  // Validate [bookmarks] section
  const bookmarks = parsed["bookmarks"];
  if (bookmarks) {
    // Validate bookmarks.default_folder
    if ("default_folder" in bookmarks) {
      const value = bookmarks["default_folder"];
      if (typeof value === "string" && value.trim() !== "") {
        preferences.bookmarks.default_folder = value;
      } else {
        warnings.push(
          `Invalid bookmarks.default_folder: "${value}". ` +
            `Must be a non-empty string. ` +
            `Using default: "${DEFAULT_PREFERENCES.bookmarks.default_folder}"`
        );
      }
    }
  }

  return { preferences, warnings };
}

/**
 * Get the preferences file path (for display purposes).
 */
export function getPreferencesPath(): string {
  return PREFERENCES_PATH;
}
