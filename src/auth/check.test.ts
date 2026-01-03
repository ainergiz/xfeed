// @ts-nocheck - Test file with module mocking
/**
 * Unit tests for check.ts
 * Tests authentication validation and error handling
 *
 * NOTE: This test uses a preload file for module mocking to avoid
 * polluting other test files. Run with:
 *   bun test --preload ./src/auth/check.test.preload.ts src/auth/check.test.ts
 *
 * Or run all tests in isolation mode (configured in bunfig.toml)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { XCookies } from "./cookies";

import {
  lastClientOptions,
  resetMocks,
  setLastClientOptions,
  setMockGetCurrentUser,
  setMockResolveCredentials,
} from "./check.test.preload";

// Import the module under test (mocks are set up by preload)
const { checkAuth, formatWarnings, getAuthErrorMessage } =
  await import("./check");

// Helper to create valid cookies
function createValidCookies(overrides: Partial<XCookies> = {}): XCookies {
  return {
    authToken: "test-auth-token",
    ct0: "test-ct0",
    cookieHeader: "auth_token=test-auth-token; ct0=test-ct0",
    source: "test",
    ...overrides,
  };
}

describe("check", () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    setLastClientOptions(null);
  });

  describe("checkAuth", () => {
    describe("missing credentials", () => {
      it("returns missing_credentials error when authToken is missing", async () => {
        setMockResolveCredentials(() =>
          Promise.resolve({
            cookies: createValidCookies({ authToken: null }),
            warnings: ["No auth_token found"],
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("missing_credentials");
          expect(result.error).toContain("Not authenticated");
          expect(result.warnings).toContain("No auth_token found");
        }
      });

      it("returns missing_credentials error when ct0 is missing", async () => {
        setMockResolveCredentials(() =>
          Promise.resolve({
            cookies: createValidCookies({ ct0: null }),
            warnings: ["No ct0 found"],
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("missing_credentials");
          expect(result.error).toContain("Not authenticated");
        }
      });

      it("returns missing_credentials error when both cookies are missing", async () => {
        setMockResolveCredentials(() =>
          Promise.resolve({
            cookies: {
              authToken: null,
              ct0: null,
              cookieHeader: null,
              source: null,
            },
            warnings: ["No cookies found"],
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("missing_credentials");
        }
      });
    });

    describe("expired session", () => {
      it("returns expired_session error on 401 response", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "HTTP 401: Unauthorized",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("expired_session");
          expect(result.error).toContain("Session expired");
        }
      });

      it("returns expired_session error on 403 response", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "HTTP 403: Forbidden",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("expired_session");
        }
      });

      it("returns expired_session error on unauthorized message", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "Bad authentication data",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("expired_session");
        }
      });
    });

    describe("network errors", () => {
      it("returns network_error on connection refused", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "ECONNREFUSED",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("network_error");
          expect(result.error).toContain("Network error");
        }
      });

      it("returns network_error on timeout", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "ETIMEDOUT",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("network_error");
        }
      });

      it("returns network_error on fetch failed", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "fetch failed",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("network_error");
        }
      });
    });

    describe("successful authentication", () => {
      it("returns client and user on success", async () => {
        const result = await checkAuth();

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.user.username).toBe("testuser");
          expect(result.user.id).toBe("123");
          expect(result.user.name).toBe("Test User");
          expect(result.client).toBeDefined();
          expect(result.cookies.authToken).toBe("test-auth-token");
        }
      });

      it("passes options to resolveCredentials", async () => {
        let capturedOptions: unknown = null;
        setMockResolveCredentials((options) => {
          capturedOptions = options;
          return Promise.resolve({
            cookies: createValidCookies(),
            warnings: [],
          });
        });

        await checkAuth({
          authToken: "cli-token",
          ct0: "cli-ct0",
          cookieSource: "chrome",
          chromeProfile: "Profile 1",
        });

        expect(capturedOptions).toEqual({
          authToken: "cli-token",
          ct0: "cli-ct0",
          cookieSource: "chrome",
          chromeProfile: "Profile 1",
          firefoxProfile: undefined,
        });
      });

      it("passes timeoutMs to XClient", async () => {
        await checkAuth({ timeoutMs: 5000 });

        expect(lastClientOptions?.timeoutMs).toBe(5000);
      });

      it("includes warnings on success", async () => {
        setMockResolveCredentials(() =>
          Promise.resolve({
            cookies: createValidCookies(),
            warnings: ["Using fallback browser"],
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.warnings).toContain("Using fallback browser");
        }
      });
    });

    describe("skip validation", () => {
      it("skips API call when skipValidation is true", async () => {
        let getCurrentUserCalled = false;
        setMockGetCurrentUser(() => {
          getCurrentUserCalled = true;
          return Promise.resolve({ success: true, user: undefined });
        });

        const result = await checkAuth({ skipValidation: true });

        expect(result.ok).toBe(true);
        expect(getCurrentUserCalled).toBe(false);
        if (result.ok) {
          expect(result.user.username).toBe("");
        }
      });

      it("still checks for missing credentials when skipValidation is true", async () => {
        setMockResolveCredentials(() =>
          Promise.resolve({
            cookies: {
              authToken: null,
              ct0: null,
              cookieHeader: null,
              source: null,
            },
            warnings: [],
          })
        );

        const result = await checkAuth({ skipValidation: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("missing_credentials");
        }
      });
    });

    describe("unknown errors", () => {
      it("returns unknown error for unrecognized API errors", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: false,
            error: "Something unexpected happened",
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("unknown");
          expect(result.error).toContain("Authentication failed");
          expect(result.error).toContain("Something unexpected happened");
        }
      });

      it("returns unknown error when user is missing from success response", async () => {
        setMockGetCurrentUser(() =>
          Promise.resolve({
            success: true,
            user: undefined,
          })
        );

        const result = await checkAuth();

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errorType).toBe("unknown");
        }
      });
    });
  });

  describe("getAuthErrorMessage", () => {
    it("returns correct message for missing_credentials", () => {
      const message = getAuthErrorMessage("missing_credentials");
      expect(message).toContain("Not authenticated");
      expect(message).toContain("log into x.com");
    });

    it("returns correct message for expired_session", () => {
      const message = getAuthErrorMessage("expired_session");
      expect(message).toContain("Session expired");
    });

    it("returns correct message for network_error", () => {
      const message = getAuthErrorMessage("network_error");
      expect(message).toContain("Network error");
    });

    it("returns correct message for unknown", () => {
      const message = getAuthErrorMessage("unknown");
      expect(message).toContain("Authentication failed");
    });
  });

  describe("formatWarnings", () => {
    it("returns empty string for no warnings", () => {
      const result = formatWarnings([]);
      expect(result).toBe("");
    });

    it("formats single warning with bullet", () => {
      const result = formatWarnings(["Something went wrong"]);
      expect(result).toBe("  - Something went wrong");
    });

    it("formats multiple warnings with bullets", () => {
      const result = formatWarnings(["Warning 1", "Warning 2"]);
      expect(result).toBe("  - Warning 1\n  - Warning 2");
    });
  });
});
