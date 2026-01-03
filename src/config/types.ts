/**
 * Browser identifiers for cookie extraction.
 * These match the browsers supported by sweet-cookie.
 */
export type BrowserId = "safari" | "chrome" | "brave" | "arc" | "firefox";

/**
 * xfeed configuration stored in ~/.config/xfeed/config.json
 */
export interface XfeedConfig {
  /** Preferred browser for cookie extraction */
  browser?: BrowserId;
  /** Chrome/Chromium profile name (e.g., "Default", "Profile 1") */
  chromeProfile?: string;
  /** Firefox profile name */
  firefoxProfile?: string;
  /** Manually entered auth token */
  authToken?: string;
  /** Manually entered ct0 token */
  ct0?: string;
}
