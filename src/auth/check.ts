/**
 * Authentication validation and error handling.
 * Validates credentials and provides clear error messages.
 */

import type { UserData } from "@/api/types";

import { XClient } from "@/api/client";

import type { CookieSource, XCookies } from "./cookies";

import { resolveCredentials } from "./cookies";

/**
 * Auth error types for different failure modes
 */
export type AuthErrorType =
  | "missing_credentials"
  | "expired_session"
  | "network_error"
  | "unknown";

/**
 * Auth check result - success with client or failure with error details
 */
export type AuthCheckResult =
  | {
      ok: true;
      client: XClient;
      user: UserData;
      cookies: XCookies;
      warnings: string[];
    }
  | {
      ok: false;
      errorType: AuthErrorType;
      error: string;
      warnings: string[];
    };

/**
 * Options for checkAuth
 */
export interface CheckAuthOptions {
  /** Auth token from CLI argument */
  authToken?: string;
  /** CSRF token from CLI argument */
  ct0?: string;
  /** Browser(s) to try for cookie extraction */
  cookieSource?: CookieSource | CookieSource[];
  /** Chrome profile name */
  chromeProfile?: string;
  /** Firefox profile name */
  firefoxProfile?: string;
  /** Skip API validation (just check if cookies exist) */
  skipValidation?: boolean;
  /** Timeout for API requests in milliseconds */
  timeoutMs?: number;
}

/**
 * User-friendly error messages for different error types
 */
const ERROR_MESSAGES: Record<AuthErrorType, string> = {
  missing_credentials:
    "Not authenticated.\nPlease log into x.com in your browser (Safari/Chrome/Firefox).\nxfeed reads cookies automatically - no manual setup needed.",
  expired_session:
    "Session expired.\nPlease log into x.com in your browser and restart xfeed.",
  network_error:
    "Network error while validating authentication.\nPlease check your internet connection and try again.",
  unknown: "Authentication failed.\nPlease try logging into x.com again.",
};

/**
 * Check if an error indicates an expired or invalid session
 */
function isSessionExpiredError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("401") ||
    lowerError.includes("403") ||
    lowerError.includes("unauthorized") ||
    lowerError.includes("forbidden") ||
    lowerError.includes("bad authentication") ||
    lowerError.includes("could not authenticate")
  );
}

/**
 * Check if an error indicates a network problem
 */
function isNetworkError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("network") ||
    lowerError.includes("enotfound") ||
    lowerError.includes("econnrefused") ||
    lowerError.includes("econnreset") ||
    lowerError.includes("etimedout") ||
    lowerError.includes("fetch failed") ||
    lowerError.includes("socket")
  );
}

/**
 * Validate authentication by resolving credentials and optionally testing them.
 *
 * @param options - Configuration for credential resolution and validation
 * @returns AuthCheckResult with client and user on success, or error details on failure
 */
export async function checkAuth(
  options: CheckAuthOptions = {}
): Promise<AuthCheckResult> {
  const warnings: string[] = [];

  // Step 1: Resolve credentials from all sources
  const credentialResult = await resolveCredentials({
    authToken: options.authToken,
    ct0: options.ct0,
    cookieSource: options.cookieSource,
    chromeProfile: options.chromeProfile,
    firefoxProfile: options.firefoxProfile,
  });

  warnings.push(...credentialResult.warnings);
  const { cookies } = credentialResult;

  // Step 2: Check if we have both required cookies
  if (!cookies.authToken || !cookies.ct0) {
    return {
      ok: false,
      errorType: "missing_credentials",
      error: ERROR_MESSAGES.missing_credentials,
      warnings,
    };
  }

  // Step 3: Create the client
  const client = new XClient({
    cookies,
    timeoutMs: options.timeoutMs,
  });

  // Step 4: Skip validation if requested (useful for faster startup)
  if (options.skipValidation) {
    return {
      ok: true,
      client,
      user: { id: "", username: "", name: "" },
      cookies,
      warnings,
    };
  }

  // Step 5: Validate credentials by fetching current user
  const userResult = await client.getCurrentUser();

  if (!userResult.success) {
    const error = userResult.error ?? "Unknown error";

    if (isSessionExpiredError(error)) {
      return {
        ok: false,
        errorType: "expired_session",
        error: ERROR_MESSAGES.expired_session,
        warnings,
      };
    }

    if (isNetworkError(error)) {
      return {
        ok: false,
        errorType: "network_error",
        error: ERROR_MESSAGES.network_error,
        warnings,
      };
    }

    return {
      ok: false,
      errorType: "unknown",
      error: `${ERROR_MESSAGES.unknown}\n\nDetails: ${error}`,
      warnings,
    };
  }

  if (!userResult.user) {
    return {
      ok: false,
      errorType: "unknown",
      error: ERROR_MESSAGES.unknown,
      warnings,
    };
  }

  return {
    ok: true,
    client,
    user: userResult.user,
    cookies,
    warnings,
  };
}

/**
 * Get a user-friendly error message for display
 */
export function getAuthErrorMessage(errorType: AuthErrorType): string {
  return ERROR_MESSAGES[errorType];
}

/**
 * Format warnings for display to the user
 */
export function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return "";
  }
  return warnings.map((w) => `  - ${w}`).join("\n");
}
