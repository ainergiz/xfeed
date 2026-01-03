import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { BrowserId } from "@/config/types";

export interface AvailableBrowser {
  id: BrowserId;
  name: string;
}

interface BrowserConfig {
  id: BrowserId;
  name: string;
  /** Function to check if the browser has cookies available */
  check: () => boolean;
}

const home = homedir();

const BROWSER_CONFIGS: BrowserConfig[] = [
  {
    id: "safari",
    name: "Safari",
    check: () =>
      // Modern Safari (sandboxed container)
      existsSync(
        path.join(
          home,
          "Library/Containers/com.apple.Safari/Data/Library/Cookies/Cookies.binarycookies"
        )
      ) ||
      // Legacy Safari (pre-sandbox)
      existsSync(path.join(home, "Library/Cookies/Cookies.binarycookies")),
  },
  {
    id: "chrome",
    name: "Chrome",
    check: () =>
      existsSync(
        path.join(
          home,
          "Library/Application Support/Google/Chrome/Default/Cookies"
        )
      ) ||
      existsSync(
        path.join(
          home,
          "Library/Application Support/Google/Chrome/Default/Network/Cookies"
        )
      ),
  },
  {
    id: "brave",
    name: "Brave",
    check: () =>
      existsSync(
        path.join(
          home,
          "Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies"
        )
      ) ||
      existsSync(
        path.join(
          home,
          "Library/Application Support/BraveSoftware/Brave-Browser/Default/Network/Cookies"
        )
      ),
  },
  {
    id: "arc",
    name: "Arc",
    check: () =>
      existsSync(
        path.join(
          home,
          "Library/Application Support/Arc/User Data/Default/Cookies"
        )
      ) ||
      existsSync(
        path.join(
          home,
          "Library/Application Support/Arc/User Data/Default/Network/Cookies"
        )
      ),
  },
  {
    id: "firefox",
    name: "Firefox",
    check: () => {
      const profilesDir = path.join(
        home,
        "Library/Application Support/Firefox/Profiles"
      );
      if (!existsSync(profilesDir)) return false;
      try {
        const profiles = readdirSync(profilesDir);
        return profiles.some((profile) =>
          existsSync(path.join(profilesDir, profile, "cookies.sqlite"))
        );
      } catch {
        return false;
      }
    },
  },
];

/**
 * Detect which browsers have cookie databases available.
 * Returns only browsers that have cookies we can potentially read.
 */
export function detectAvailableBrowsers(): AvailableBrowser[] {
  return BROWSER_CONFIGS.filter((config) => config.check()).map((config) => ({
    id: config.id,
    name: config.name,
  }));
}

/**
 * Get display name for a browser ID.
 */
export function getBrowserName(id: BrowserId): string {
  const config = BROWSER_CONFIGS.find((c) => c.id === id);
  return config?.name ?? id;
}

/**
 * Check if stdin is interactive (TTY).
 * Used to determine if we can prompt the user.
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}
