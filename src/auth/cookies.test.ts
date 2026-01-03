// @ts-nocheck - Test file with module mocking
/**
 * Unit tests for cookies.ts
 * Tests cookie extraction and credential resolution
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Create a wrapper that we can update
let mockImpl = () =>
  Promise.resolve({
    cookies: [] as Array<{ name?: string; value?: string; domain?: string }>,
    warnings: [] as string[],
  });

// Mock the sweet-cookie module - the wrapper calls mockImpl which can be updated
mock.module("@steipete/sweet-cookie", () => ({
  getCookies: () => mockImpl(),
}));

// Now import the module under test (after mocking)
const {
  extractCookiesFromChrome,
  extractCookiesFromFirefox,
  extractCookiesFromSafari,
  resolveCredentials,
} = await import("./cookies");

// Helper to set mock implementation
function setMockCookies(
  cookies: Array<{ name?: string; value?: string; domain?: string }>,
  warnings: string[] = []
) {
  mockImpl = () => Promise.resolve({ cookies, warnings });
}

// Helper for stateful mocks
function setMockCookiesSequence(
  responses: Array<{
    cookies: Array<{ name?: string; value?: string; domain?: string }>;
    warnings: string[];
  }>
) {
  let callCount = 0;
  mockImpl = () => {
    const response = responses[callCount] ?? { cookies: [], warnings: [] };
    callCount++;
    return Promise.resolve(response);
  };
}

describe("cookies", () => {
  beforeEach(() => {
    // Reset mock to default
    mockImpl = () => Promise.resolve({ cookies: [], warnings: [] });

    // Clear environment variables
    delete process.env.AUTH_TOKEN;
    delete process.env.TWITTER_AUTH_TOKEN;
    delete process.env.CT0;
    delete process.env.TWITTER_CT0;
  });

  afterEach(() => {
    delete process.env.AUTH_TOKEN;
    delete process.env.TWITTER_AUTH_TOKEN;
    delete process.env.CT0;
    delete process.env.TWITTER_CT0;
  });

  describe("resolveCredentials", () => {
    it("uses CLI arguments when provided", async () => {
      const result = await resolveCredentials({
        authToken: "cli-auth-token",
        ct0: "cli-ct0",
      });

      expect(result.cookies.authToken).toBe("cli-auth-token");
      expect(result.cookies.ct0).toBe("cli-ct0");
      expect(result.cookies.source).toBe("CLI argument");
      expect(result.cookies.cookieHeader).toBe(
        "auth_token=cli-auth-token; ct0=cli-ct0"
      );
    });

    it("uses environment variables when CLI args not provided", async () => {
      process.env.AUTH_TOKEN = "env-auth-token";
      process.env.CT0 = "env-ct0";

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("env-auth-token");
      expect(result.cookies.ct0).toBe("env-ct0");
      expect(result.cookies.source).toBe("env AUTH_TOKEN");
    });

    it("uses TWITTER_ prefixed environment variables", async () => {
      process.env.TWITTER_AUTH_TOKEN = "twitter-auth-token";
      process.env.TWITTER_CT0 = "twitter-ct0";

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("twitter-auth-token");
      expect(result.cookies.ct0).toBe("twitter-ct0");
    });

    it("prefers non-prefixed env vars over prefixed", async () => {
      process.env.AUTH_TOKEN = "auth-token-1";
      process.env.TWITTER_AUTH_TOKEN = "auth-token-2";

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("auth-token-1");
    });

    it("falls back to browser cookies when env vars not set", async () => {
      setMockCookies([
        { name: "auth_token", value: "browser-auth", domain: ".x.com" },
        { name: "ct0", value: "browser-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("browser-auth");
      expect(result.cookies.ct0).toBe("browser-ct0");
      expect(result.cookies.source).toBe("Safari");
    });

    it("tries multiple browser sources in order", async () => {
      setMockCookiesSequence([
        // Safari fails
        { cookies: [], warnings: ["Safari failed"] },
        // Chrome succeeds
        {
          cookies: [
            { name: "auth_token", value: "chrome-auth", domain: ".x.com" },
            { name: "ct0", value: "chrome-ct0", domain: ".x.com" },
          ],
          warnings: [],
        },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("chrome-auth");
      expect(result.cookies.source).toBe("Chrome");
    });

    it("uses specific cookie source when provided", async () => {
      setMockCookies([
        { name: "auth_token", value: "firefox-auth", domain: ".x.com" },
        { name: "ct0", value: "firefox-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({ cookieSource: "firefox" });

      expect(result.cookies.authToken).toBe("firefox-auth");
      expect(result.cookies.source).toBe("Firefox");
    });

    it("uses array of cookie sources", async () => {
      setMockCookiesSequence([
        // Chrome fails
        { cookies: [], warnings: [] },
        // Firefox succeeds
        {
          cookies: [
            { name: "auth_token", value: "ff-auth", domain: ".x.com" },
            { name: "ct0", value: "ff-ct0", domain: ".x.com" },
          ],
          warnings: [],
        },
      ]);

      const result = await resolveCredentials({
        cookieSource: ["chrome", "firefox"],
      });

      expect(result.cookies.authToken).toBe("ff-auth");
    });

    it("includes Chrome profile in source label", async () => {
      setMockCookies([
        { name: "auth_token", value: "profile-auth", domain: ".x.com" },
        { name: "ct0", value: "profile-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({
        cookieSource: "chrome",
        chromeProfile: "Work",
      });

      expect(result.cookies.source).toBe('Chrome profile "Work"');
    });

    it("includes Firefox profile in source label", async () => {
      setMockCookies([
        { name: "auth_token", value: "ff-auth", domain: ".x.com" },
        { name: "ct0", value: "ff-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({
        cookieSource: "firefox",
        firefoxProfile: "default-release",
      });

      expect(result.cookies.source).toBe('Firefox profile "default-release"');
    });

    it("adds warnings when cookies not found", async () => {
      setMockCookies([], ["No cookies found"]);

      const result = await resolveCredentials({});

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("auth_token"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("ct0"))).toBe(true);
    });

    it("adds browser-specific warnings", async () => {
      const result = await resolveCredentials({ cookieSource: "safari" });

      expect(result.warnings.some((w) => w.includes("Safari"))).toBe(true);
    });

    it("adds Chrome-specific warning", async () => {
      const result = await resolveCredentials({ cookieSource: "chrome" });

      expect(result.warnings.some((w) => w.includes("Chrome"))).toBe(true);
    });

    it("adds Firefox-specific warning", async () => {
      const result = await resolveCredentials({ cookieSource: "firefox" });

      expect(result.warnings.some((w) => w.includes("Firefox"))).toBe(true);
    });

    it("prefers x.com domain over twitter.com", async () => {
      setMockCookies([
        { name: "auth_token", value: "twitter-auth", domain: ".twitter.com" },
        { name: "auth_token", value: "x-auth", domain: ".x.com" },
        { name: "ct0", value: "x-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("x-auth");
    });

    it("uses twitter.com domain if x.com not available", async () => {
      setMockCookies([
        { name: "auth_token", value: "twitter-auth", domain: ".twitter.com" },
        { name: "ct0", value: "twitter-ct0", domain: ".twitter.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("twitter-auth");
    });

    it("uses first cookie if no domain preference matches", async () => {
      setMockCookies([
        { name: "auth_token", value: "other-auth", domain: ".other.com" },
        { name: "ct0", value: "other-ct0", domain: ".other.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("other-auth");
    });

    it("discards partial browser cookies (only auth_token found)", async () => {
      // Browser only finds auth_token, not ct0
      // Current behavior: partial browser results are discarded, warnings added
      setMockCookies([
        { name: "auth_token", value: "partial-auth", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      // Browser partial match is discarded, so both are null
      expect(result.cookies.authToken).toBeNull();
      expect(result.cookies.ct0).toBeNull();
      // Warnings for both missing
      expect(result.warnings.some((w) => w.includes("auth_token"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("ct0"))).toBe(true);
    });

    it("ignores empty string env values", async () => {
      process.env.AUTH_TOKEN = "   ";
      process.env.CT0 = "";

      setMockCookies([
        { name: "auth_token", value: "browser-auth", domain: ".x.com" },
        { name: "ct0", value: "browser-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("browser-auth");
    });

    it("combines CLI args with env vars", async () => {
      process.env.CT0 = "env-ct0";

      const result = await resolveCredentials({
        authToken: "cli-auth",
      });

      expect(result.cookies.authToken).toBe("cli-auth");
      expect(result.cookies.ct0).toBe("env-ct0");
      expect(result.cookies.source).toBe("CLI argument");
    });

    it("sets source from ct0 when authToken not from CLI", async () => {
      const result = await resolveCredentials({
        ct0: "cli-ct0-only",
      });

      expect(result.cookies.ct0).toBe("cli-ct0-only");
      expect(result.cookies.source).toBe("CLI argument");
    });

    it("collects warnings from provider", async () => {
      setMockCookies([], ["Provider warning 1", "Provider warning 2"]);

      const result = await resolveCredentials({});

      expect(result.warnings).toContain("Provider warning 1");
      expect(result.warnings).toContain("Provider warning 2");
    });

    it("handles cookies with missing value", async () => {
      // Cookie exists but has no value - treated as not found
      // Since we only have ct0 (auth_token has no value), partial match is discarded
      setMockCookies([
        { name: "auth_token" },
        { name: "ct0", value: "valid-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      // Browser partial match (only ct0) is discarded
      expect(result.cookies.authToken).toBeNull();
      expect(result.cookies.ct0).toBeNull();
    });

    it("builds cookieHeader when both cookies found from partial sources", async () => {
      process.env.AUTH_TOKEN = "env-auth";

      // Only auth from env, ct0 not found
      const result = await resolveCredentials({});

      // cookieHeader should be null since ct0 is missing
      expect(result.cookies.cookieHeader).toBeNull();
    });

    it("builds cookieHeader when both found from different sources", async () => {
      process.env.AUTH_TOKEN = "env-auth";
      process.env.CT0 = "env-ct0";

      const result = await resolveCredentials({});

      expect(result.cookies.cookieHeader).toBe(
        "auth_token=env-auth; ct0=env-ct0"
      );
    });
  });

  describe("extractCookiesFromSafari", () => {
    it("extracts cookies from Safari", async () => {
      setMockCookies([
        { name: "auth_token", value: "safari-auth", domain: ".x.com" },
        { name: "ct0", value: "safari-ct0", domain: ".x.com" },
      ]);

      const result = await extractCookiesFromSafari();

      expect(result.cookies.authToken).toBe("safari-auth");
      expect(result.cookies.ct0).toBe("safari-ct0");
      expect(result.cookies.source).toBe("Safari");
    });

    it("adds warning when Safari cookies not found", async () => {
      const result = await extractCookiesFromSafari();

      expect(result.cookies.authToken).toBeNull();
      expect(result.warnings.some((w) => w.includes("Safari"))).toBe(true);
    });
  });

  describe("extractCookiesFromChrome", () => {
    it("extracts cookies from Chrome default profile", async () => {
      setMockCookies([
        { name: "auth_token", value: "chrome-auth", domain: ".x.com" },
        { name: "ct0", value: "chrome-ct0", domain: ".x.com" },
      ]);

      const result = await extractCookiesFromChrome();

      expect(result.cookies.authToken).toBe("chrome-auth");
      expect(result.cookies.source).toBe("Chrome");
    });

    it("extracts cookies from Chrome specific profile", async () => {
      setMockCookies([
        { name: "auth_token", value: "profile-auth", domain: ".x.com" },
        { name: "ct0", value: "profile-ct0", domain: ".x.com" },
      ]);

      const result = await extractCookiesFromChrome("Personal");

      expect(result.cookies.source).toBe('Chrome profile "Personal"');
    });

    it("adds warning when Chrome cookies not found", async () => {
      const result = await extractCookiesFromChrome();

      expect(result.warnings.some((w) => w.includes("Chrome"))).toBe(true);
    });
  });

  describe("extractCookiesFromFirefox", () => {
    it("extracts cookies from Firefox default profile", async () => {
      setMockCookies([
        { name: "auth_token", value: "firefox-auth", domain: ".x.com" },
        { name: "ct0", value: "firefox-ct0", domain: ".x.com" },
      ]);

      const result = await extractCookiesFromFirefox();

      expect(result.cookies.authToken).toBe("firefox-auth");
      expect(result.cookies.source).toBe("Firefox");
    });

    it("extracts cookies from Firefox specific profile", async () => {
      setMockCookies([
        { name: "auth_token", value: "ff-auth", domain: ".x.com" },
        { name: "ct0", value: "ff-ct0", domain: ".x.com" },
      ]);

      const result = await extractCookiesFromFirefox("dev-edition-default");

      expect(result.cookies.source).toBe(
        'Firefox profile "dev-edition-default"'
      );
    });

    it("adds warning when Firefox cookies not found", async () => {
      const result = await extractCookiesFromFirefox();

      expect(result.warnings.some((w) => w.includes("Firefox"))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles cookies with undefined domain", async () => {
      setMockCookies([
        { name: "auth_token", value: "no-domain-auth" },
        { name: "ct0", value: "no-domain-ct0" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("no-domain-auth");
      expect(result.cookies.ct0).toBe("no-domain-ct0");
    });

    it("handles cookies with empty value string", async () => {
      // Empty string value is falsy, so the auth check fails (authToken && ct0)
      // This means partial match is discarded
      setMockCookies([
        { name: "auth_token", value: "", domain: ".x.com" },
        { name: "ct0", value: "valid-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      // Empty string makes the truthy check fail, so both are null
      expect(result.cookies.authToken).toBeNull();
      expect(result.cookies.ct0).toBeNull();
    });

    it("handles non-string cookie values", async () => {
      // Non-string auth_token is ignored, so partial match (only ct0) is discarded
      setMockCookies([
        {
          name: "auth_token",
          value: 12345 as unknown as string,
          domain: ".x.com",
        },
        { name: "ct0", value: "valid-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      // Partial browser match is discarded
      expect(result.cookies.authToken).toBeNull();
      expect(result.cookies.ct0).toBeNull();
    });

    it("handles undefined cookie objects", async () => {
      // Undefined objects are skipped, partial match (only ct0) is discarded
      setMockCookies([
        undefined as unknown as { name: string; value: string },
        { name: "ct0", value: "valid-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      // Partial browser match is discarded
      expect(result.cookies.ct0).toBeNull();
    });

    it("handles null cookie objects", async () => {
      // Null objects are skipped, but both valid cookies are found
      setMockCookies([
        null as unknown as { name: string; value: string },
        { name: "auth_token", value: "valid-auth", domain: ".x.com" },
        { name: "ct0", value: "valid-ct0", domain: ".x.com" },
      ]);

      const result = await resolveCredentials({});

      expect(result.cookies.authToken).toBe("valid-auth");
      expect(result.cookies.ct0).toBe("valid-ct0");
    });
  });
});
