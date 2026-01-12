import { describe, expect, it } from "bun:test";

import { parseXUrl } from "./url-parser";

describe("parseXUrl", () => {
  describe("tweet URLs", () => {
    it("parses x.com tweet URL", () => {
      const result = parseXUrl("https://x.com/doodlestein/status/2007588870662107197");
      expect(result).toEqual({
        type: "tweet",
        username: "doodlestein",
        tweetId: "2007588870662107197",
      });
    });

    it("parses twitter.com tweet URL", () => {
      const result = parseXUrl("https://twitter.com/elonmusk/status/1234567890");
      expect(result).toEqual({
        type: "tweet",
        username: "elonmusk",
        tweetId: "1234567890",
      });
    });

    it("parses URL without protocol", () => {
      const result = parseXUrl("x.com/user/status/123456");
      expect(result).toEqual({
        type: "tweet",
        username: "user",
        tweetId: "123456",
      });
    });

    it("parses www subdomain", () => {
      const result = parseXUrl("https://www.x.com/user/status/123456");
      expect(result).toEqual({
        type: "tweet",
        username: "user",
        tweetId: "123456",
      });
    });

    it("parses mobile subdomain", () => {
      const result = parseXUrl("https://mobile.twitter.com/user/status/123456");
      expect(result).toEqual({
        type: "tweet",
        username: "user",
        tweetId: "123456",
      });
    });

    it("handles trailing slashes and query params", () => {
      const result = parseXUrl("https://x.com/user/status/123456/?s=20");
      expect(result).toEqual({
        type: "tweet",
        username: "user",
        tweetId: "123456",
      });
    });
  });

  describe("profile URLs", () => {
    it("parses x.com profile URL", () => {
      const result = parseXUrl("https://x.com/elonmusk");
      expect(result).toEqual({
        type: "profile",
        username: "elonmusk",
      });
    });

    it("parses twitter.com profile URL", () => {
      const result = parseXUrl("https://twitter.com/doodlestein");
      expect(result).toEqual({
        type: "profile",
        username: "doodlestein",
      });
    });

    it("parses profile URL without protocol", () => {
      const result = parseXUrl("x.com/testuser");
      expect(result).toEqual({
        type: "profile",
        username: "testuser",
      });
    });

    it("handles profile sub-pages as profile type", () => {
      expect(parseXUrl("https://x.com/user/followers")).toEqual({
        type: "profile",
        username: "user",
      });
      expect(parseXUrl("https://x.com/user/following")).toEqual({
        type: "profile",
        username: "user",
      });
      expect(parseXUrl("https://x.com/user/likes")).toEqual({
        type: "profile",
        username: "user",
      });
    });
  });

  describe("reserved paths", () => {
    it("rejects home URL", () => {
      const result = parseXUrl("https://x.com/home");
      expect(result.type).toBe("invalid");
    });

    it("rejects explore URL", () => {
      const result = parseXUrl("https://x.com/explore");
      expect(result.type).toBe("invalid");
    });

    it("rejects notifications URL", () => {
      const result = parseXUrl("https://x.com/notifications");
      expect(result.type).toBe("invalid");
    });

    it("rejects messages URL", () => {
      const result = parseXUrl("https://x.com/messages");
      expect(result.type).toBe("invalid");
    });

    it("rejects settings URL", () => {
      const result = parseXUrl("https://x.com/settings");
      expect(result.type).toBe("invalid");
    });

    it("rejects i (internal) URL", () => {
      const result = parseXUrl("https://x.com/i/flow/login");
      expect(result.type).toBe("invalid");
    });

    it("rejects search URL", () => {
      const result = parseXUrl("https://x.com/search");
      expect(result.type).toBe("invalid");
    });
  });

  describe("invalid URLs", () => {
    it("rejects empty string", () => {
      const result = parseXUrl("");
      expect(result).toEqual({
        type: "invalid",
        error: "URL cannot be empty",
      });
    });

    it("rejects whitespace-only string", () => {
      const result = parseXUrl("   ");
      expect(result).toEqual({
        type: "invalid",
        error: "URL cannot be empty",
      });
    });

    it("rejects non-X/Twitter domain", () => {
      const result = parseXUrl("https://example.com/user/status/123");
      expect(result).toEqual({
        type: "invalid",
        error: "Not an X or Twitter URL",
      });
    });

    it("rejects URL with no path", () => {
      const result = parseXUrl("https://x.com/");
      expect(result).toEqual({
        type: "invalid",
        error: "No username or tweet ID in URL",
      });
    });

    it("rejects invalid tweet ID (non-numeric)", () => {
      const result = parseXUrl("https://x.com/user/status/abc123");
      expect(result).toEqual({
        type: "invalid",
        error: "Invalid tweet ID",
      });
    });

    it("rejects malformed URL", () => {
      const result = parseXUrl("not a url at all");
      expect(result).toEqual({
        type: "invalid",
        error: "Invalid URL format",
      });
    });
  });
});
