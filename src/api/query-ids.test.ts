// @ts-nocheck - Test file
/**
 * Unit tests for query-ids.ts
 * Tests query ID constants and exports
 */

import { describe, expect, it } from "bun:test";

import {
  FALLBACK_QUERY_IDS,
  QUERY_IDS,
  TARGET_QUERY_ID_OPERATIONS,
  createRuntimeQueryIdStore,
  runtimeQueryIds,
} from "./query-ids";

describe("query-ids", () => {
  describe("FALLBACK_QUERY_IDS", () => {
    it("contains all required operation names", () => {
      expect(FALLBACK_QUERY_IDS.CreateTweet).toBeDefined();
      expect(FALLBACK_QUERY_IDS.CreateRetweet).toBeDefined();
      expect(FALLBACK_QUERY_IDS.FavoriteTweet).toBeDefined();
      expect(FALLBACK_QUERY_IDS.TweetDetail).toBeDefined();
      expect(FALLBACK_QUERY_IDS.SearchTimeline).toBeDefined();
      expect(FALLBACK_QUERY_IDS.UserArticlesTweets).toBeDefined();
      expect(FALLBACK_QUERY_IDS.Bookmarks).toBeDefined();
      expect(FALLBACK_QUERY_IDS.HomeTimeline).toBeDefined();
      expect(FALLBACK_QUERY_IDS.HomeLatestTimeline).toBeDefined();
    });

    it("has valid query ID format for all operations", () => {
      const queryIdRegex = /^[a-zA-Z0-9_-]+$/;
      for (const [_name, id] of Object.entries(FALLBACK_QUERY_IDS)) {
        expect(queryIdRegex.test(id)).toBe(true);
      }
    });
  });

  describe("TARGET_QUERY_ID_OPERATIONS", () => {
    it("contains all fallback operation names", () => {
      const fallbackKeys = Object.keys(FALLBACK_QUERY_IDS);
      expect(TARGET_QUERY_ID_OPERATIONS.length).toBe(fallbackKeys.length);

      for (const key of fallbackKeys) {
        expect(TARGET_QUERY_ID_OPERATIONS).toContain(key);
      }
    });

    it("is an array of strings", () => {
      expect(Array.isArray(TARGET_QUERY_ID_OPERATIONS)).toBe(true);
      for (const op of TARGET_QUERY_ID_OPERATIONS) {
        expect(typeof op).toBe("string");
      }
    });
  });

  describe("QUERY_IDS", () => {
    it("contains all fallback query IDs", () => {
      for (const [name, _id] of Object.entries(FALLBACK_QUERY_IDS)) {
        expect(QUERY_IDS[name as keyof typeof QUERY_IDS]).toBeDefined();
      }
    });

    it("merges JSON file IDs with fallbacks", () => {
      // The JSON file may override some fallbacks
      // Just verify the structure is correct
      expect(QUERY_IDS.CreateTweet).toBeDefined();
      expect(typeof QUERY_IDS.CreateTweet).toBe("string");
    });

    it("has all operation names from OperationName type", () => {
      const expectedOps = [
        "CreateTweet",
        "CreateRetweet",
        "FavoriteTweet",
        "TweetDetail",
        "SearchTimeline",
        "UserArticlesTweets",
        "Bookmarks",
        "HomeTimeline",
        "HomeLatestTimeline",
      ];

      for (const op of expectedOps) {
        expect(QUERY_IDS[op as keyof typeof QUERY_IDS]).toBeDefined();
      }
    });
  });

  describe("runtimeQueryIds", () => {
    it("exports singleton store", () => {
      expect(runtimeQueryIds).toBeDefined();
      expect(typeof runtimeQueryIds.getQueryId).toBe("function");
      expect(typeof runtimeQueryIds.refresh).toBe("function");
      expect(typeof runtimeQueryIds.getSnapshotInfo).toBe("function");
      expect(typeof runtimeQueryIds.clearMemory).toBe("function");
    });

    it("has default TTL", () => {
      expect(runtimeQueryIds.ttlMs).toBe(24 * 60 * 60 * 1000);
    });

    it("has cache path set", () => {
      expect(runtimeQueryIds.cachePath).toBeDefined();
      expect(typeof runtimeQueryIds.cachePath).toBe("string");
    });
  });

  describe("createRuntimeQueryIdStore", () => {
    it("is exported and callable", () => {
      expect(typeof createRuntimeQueryIdStore).toBe("function");

      const store = createRuntimeQueryIdStore({ ttlMs: 1000 });
      expect(store).toBeDefined();
      expect(store.ttlMs).toBe(1000);
    });
  });
});
