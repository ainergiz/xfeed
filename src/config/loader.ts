import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { XfeedConfig } from "./types";

const CONFIG_DIR = path.join(homedir(), ".config", "xfeed");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

/**
 * Load config from ~/.config/xfeed/config.json
 * Returns empty config if file doesn't exist or is invalid JSON.
 */
export function loadConfig(): XfeedConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as XfeedConfig;
  } catch {
    // Corrupt JSON - return empty config
    return {};
  }
}

/**
 * Save config to ~/.config/xfeed/config.json
 * Creates directory if it doesn't exist.
 */
export function saveConfig(config: XfeedConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Update specific fields in config while preserving others.
 */
export function updateConfig(updates: Partial<XfeedConfig>): void {
  const existing = loadConfig();
  saveConfig({ ...existing, ...updates });
}

/**
 * Clear all saved auth data (browser preference and tokens).
 */
export function clearBrowserPreference(): void {
  const config = loadConfig();
  delete config.browser;
  delete config.chromeProfile;
  delete config.firefoxProfile;
  delete config.authToken;
  delete config.ct0;
  saveConfig(config);
}

/**
 * Get the config file path (for display purposes).
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
