// @ts-nocheck - Test file with complex mocking that conflicts with Bun's strict fetch types
/**
 * Unit tests for runtime-query-ids
 * Tests query ID discovery, caching, and refresh functionality
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createRuntimeQueryIdStore,
  type RuntimeQueryIdStore,
} from "./runtime-query-ids";

describe("runtime-query-ids", () => {
  let store: RuntimeQueryIdStore;
  let cachePath: string;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory per test to avoid race conditions
    testDir = await mkdtemp(path.join(tmpdir(), "xfeed-test-"));
    cachePath = path.join(testDir, "query-ids-cache.json");
  });

  afterEach(async () => {
    store?.clearMemory();
    if (testDir) {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("createRuntimeQueryIdStore", () => {
    it("creates store with default options", () => {
      store = createRuntimeQueryIdStore();
      expect(store.cachePath).toBeDefined();
      expect(store.ttlMs).toBe(24 * 60 * 60 * 1000);
    });

    it("creates store with custom cache path", () => {
      store = createRuntimeQueryIdStore({ cachePath });
      expect(store.cachePath).toBe(cachePath);
    });

    it("creates store with custom TTL", () => {
      store = createRuntimeQueryIdStore({ cachePath, ttlMs: 1000 });
      expect(store.ttlMs).toBe(1000);
    });

    it("resolves relative cache path to absolute", () => {
      store = createRuntimeQueryIdStore({ cachePath: "./test-cache.json" });
      expect(path.isAbsolute(store.cachePath)).toBe(true);
    });
  });

  describe("getSnapshotInfo", () => {
    it("returns null when no cache exists", async () => {
      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();
      expect(info).toBeNull();
    });

    it("returns snapshot info when cache exists", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "abc123" },
        discovery: { pages: ["https://x.com"], bundles: ["bundle.js"] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).not.toBeNull();
      expect(info?.snapshot.ids.CreateTweet).toBe("abc123");
      expect(info?.isFresh).toBe(true);
    });

    it("marks snapshot as stale when TTL exceeded", async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const snapshot = {
        fetchedAt: oldDate.toISOString(),
        ttlMs: 86400000, // 24 hours
        ids: { CreateTweet: "abc123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).not.toBeNull();
      expect(info?.isFresh).toBe(false);
      expect(info?.ageMs).toBeGreaterThan(86400000);
    });

    it("uses snapshot TTL when different from store TTL", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 1000, // Very short TTL
        ids: { CreateTweet: "abc123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath, ttlMs: 86400000 });
      const info = await store.getSnapshotInfo();

      expect(info?.snapshot.ttlMs).toBe(1000);
    });

    it("caches snapshot in memory after first load", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "first" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });

      // First call
      const info1 = await store.getSnapshotInfo();
      expect(info1?.snapshot.ids.CreateTweet).toBe("first");

      // Modify file (should not affect cached result)
      snapshot.ids.CreateTweet = "second";
      await writeFile(cachePath, JSON.stringify(snapshot));

      // Second call should return cached
      const info2 = await store.getSnapshotInfo();
      expect(info2?.snapshot.ids.CreateTweet).toBe("first");
    });

    it("handles invalid JSON in cache file", async () => {
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, "not valid json");

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("handles invalid snapshot structure", async () => {
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify({ invalid: "structure" }));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("handles non-object JSON in cache file (number)", async () => {
      await mkdir(path.dirname(cachePath), { recursive: true });
      // Write a valid JSON number - parseSnapshot should return null for non-object
      await writeFile(cachePath, "12345");

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("handles non-object JSON in cache file (string)", async () => {
      await mkdir(path.dirname(cachePath), { recursive: true });
      // Write a valid JSON string - parseSnapshot should return null for non-object
      await writeFile(cachePath, '"just a string"');

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("handles missing discovery.pages", async () => {
      const invalidSnapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "abc123" },
        discovery: { bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(invalidSnapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("handles missing discovery.bundles", async () => {
      const invalidSnapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "abc123" },
        discovery: { pages: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(invalidSnapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).toBeNull();
    });

    it("normalizes empty string IDs", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "   ", ValidId: "abc123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info?.snapshot.ids.CreateTweet).toBeUndefined();
      expect(info?.snapshot.ids.ValidId).toBe("abc123");
    });

    it("handles invalid fetchedAt date", async () => {
      const snapshot = {
        fetchedAt: "invalid-date",
        ttlMs: 86400000,
        ids: { CreateTweet: "abc123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.getSnapshotInfo();

      expect(info).not.toBeNull();
      expect(info?.ageMs).toBe(Number.POSITIVE_INFINITY);
      expect(info?.isFresh).toBe(false);
    });
  });

  describe("getQueryId", () => {
    it("returns null when no cache exists", async () => {
      store = createRuntimeQueryIdStore({ cachePath });
      const id = await store.getQueryId("CreateTweet");
      expect(id).toBeNull();
    });

    it("returns query ID from cache", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "abc123", TweetDetail: "def456" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });

      expect(await store.getQueryId("CreateTweet")).toBe("abc123");
      expect(await store.getQueryId("TweetDetail")).toBe("def456");
      expect(await store.getQueryId("NonExistent")).toBeNull();
    });
  });

  describe("refresh", () => {
    it("returns current snapshot if fresh and not forced", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "existing123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });
      const info = await store.refresh(["CreateTweet"]);

      expect(info?.snapshot.ids.CreateTweet).toBe("existing123");
    });

    it("fetches new IDs when forced", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.abc123.js"></script>'
              ),
          });
        }
        if (url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                'e.exports={queryId:"newQueryId123",operationName:"CreateTweet"}'
              ),
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });

      expect(info?.snapshot.ids.CreateTweet).toBe("newQueryId123");

      // Verify cache was written
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      expect(cached.ids.CreateTweet).toBe("newQueryId123");
    });

    it("handles discovery failure gracefully", async () => {
      const mockFetch = mock(() => Promise.reject(new Error("Network error")));

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      // Should throw because no bundles discovered
      await expect(
        store.refresh(["CreateTweet"], { force: true })
      ).rejects.toThrow("No client bundles discovered");
    });

    it("throws on discovery failure even when stale cache exists", async () => {
      // Stale cache exists (48 hours old, past 24hr TTL)
      const snapshot = {
        fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "stale123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      // Network fails during refresh attempt
      const mockFetch = mock(() => Promise.reject(new Error("Network error")));

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      // refresh() throws rather than returning stale data
      await expect(store.refresh(["CreateTweet"])).rejects.toThrow();
    });

    it("deduplicates concurrent refresh calls", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"concurrent123",operationName:"CreateTweet"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      // Start two refreshes simultaneously
      const [result1, result2] = await Promise.all([
        store.refresh(["CreateTweet"], { force: true }),
        store.refresh(["CreateTweet"], { force: true }),
      ]);

      // Both should return the same result
      expect(result1?.snapshot.ids.CreateTweet).toBe("concurrent123");
      expect(result2?.snapshot.ids.CreateTweet).toBe("concurrent123");
    });

    it("extracts query IDs with operationName first pattern", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/main.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={operationName:"TweetDetail",queryId:"detailId456"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["TweetDetail"], { force: true });
      expect(info?.snapshot.ids.TweetDetail).toBe("detailId456");
    });

    it("extracts query IDs from loose patterns", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/app.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'operationName:"SearchTimeline",other:"stuff",queryId:"searchId789"'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["SearchTimeline"], { force: true });
      expect(info?.snapshot.ids.SearchTimeline).toBe("searchId789");
    });

    it("extracts query IDs with queryId first loose pattern", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/vendor.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'queryId:"bookmarkId111",foo:"bar",operationName:"Bookmarks"'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["Bookmarks"], { force: true });
      expect(info?.snapshot.ids.Bookmarks).toBe("bookmarkId111");
    });

    it("skips invalid query IDs", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"invalid@id!",operationName:"CreateTweet"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBeUndefined();
    });

    it("skips operations not in target list", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"otherId",operationName:"SomeOtherOperation"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.SomeOtherOperation).toBeUndefined();
    });

    it("discovers bundles from multiple pages", async () => {
      let pageCount = 0;
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          pageCount++;
          if (pageCount === 1) {
            // First page fails
            return Promise.reject(new Error("Page error"));
          }
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/multi.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"multipage123",operationName:"CreateTweet"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("multipage123");
    });

    it("handles bundle fetch failure gracefully", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/fail.js"></script>' +
                  '<script src="https://abs.twimg.com/responsive-web/client-web/success.js"></script>'
              ),
          });
        }
        if (url.includes("fail.js")) {
          return Promise.reject(new Error("Bundle error"));
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"success123",operationName:"CreateTweet"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("success123");
    });

    it("handles HTTP error from discovery page", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve("Service unavailable"),
          });
        }
        return Promise.reject(new Error("Should not reach"));
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      await expect(
        store.refresh(["CreateTweet"], { force: true })
      ).rejects.toThrow("No client bundles discovered");
    });

    it("processes bundles in chunks for concurrency", async () => {
      const bundleUrls = Array.from({ length: 12 }, (_, i) => `bundle${i}.js`);
      let bundleFetchCount = 0;

      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          const scripts = bundleUrls
            .map(
              (b) =>
                `<script src="https://abs.twimg.com/responsive-web/client-web/${b}"></script>`
            )
            .join("");
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(scripts),
          });
        }
        bundleFetchCount++;
        // Last bundle has the ID
        if (url.includes("bundle11.js")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                'e.exports={queryId:"chunked123",operationName:"CreateTweet"}'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("// empty bundle"),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("chunked123");
      expect(bundleFetchCount).toBe(12);
    });

    it("stops fetching bundles once all targets found", async () => {
      const bundleUrls = ["bundle1.js", "bundle2.js", "bundle3.js"];

      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          const scripts = bundleUrls
            .map(
              (b) =>
                `<script src="https://abs.twimg.com/responsive-web/client-web/${b}"></script>`
            )
            .join("");
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(scripts),
          });
        }
        if (url.includes("bundle1.js")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                'e.exports={queryId:"early123",operationName:"CreateTweet"}'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("// empty"),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("early123");
    });

    it("exits early within bundle when all targets found mid-iteration", async () => {
      // This test verifies that extractOperations returns early (line 236)
      // when all targets are found before the regex finishes iterating
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
              ),
          });
        }
        if (url.includes("bundle.js")) {
          // Bundle contains TWO query ID matches, but we only want ONE target
          // CreateTweet comes first, then FavoriteTweet (which we don't need)
          // This triggers the early return when discovered.size === targets.size
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                'e.exports={queryId:"first123",operationName:"CreateTweet"};' +
                  'e.exports={queryId:"second456",operationName:"FavoriteTweet"}'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      // Only request CreateTweet - the early exit should trigger after finding it
      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("first123");
      // FavoriteTweet should NOT be in the snapshot since we didn't request it
      expect(info?.snapshot.ids.FavoriteTweet).toBeUndefined();
    });

    it("continues iterating after finding first target when searching for multiple", async () => {
      // This test hits line 237 - the closing brace of the if statement
      // which is reached when discovered.size !== targets.size
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
              ),
          });
        }
        if (url.includes("bundle.js")) {
          // Bundle contains BOTH targets - after finding first, discovered.size (1) !== targets.size (2)
          // so we hit line 237 and continue iterating to find the second target
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                'e.exports={queryId:"tweet123",operationName:"CreateTweet"};' +
                  'e.exports={queryId:"fav456",operationName:"FavoriteTweet"}'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      // Request BOTH targets - after finding CreateTweet, we continue to find FavoriteTweet
      const info = await store.refresh(["CreateTweet", "FavoriteTweet"], {
        force: true,
      });
      expect(info?.snapshot.ids.CreateTweet).toBe("tweet123");
      expect(info?.snapshot.ids.FavoriteTweet).toBe("fav456");
    });

    it("returns null when no IDs discovered and no cache", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web/empty.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("// no query IDs here"),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info).toBeNull();
    });
  });

  describe("clearMemory", () => {
    it("clears cached snapshot", async () => {
      const snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs: 86400000,
        ids: { CreateTweet: "cached123" },
        discovery: { pages: [], bundles: [] },
      };
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(snapshot));

      store = createRuntimeQueryIdStore({ cachePath });

      // Load into memory
      await store.getSnapshotInfo();

      // Clear memory
      store.clearMemory();

      // Delete file
      await rm(cachePath);

      // Should return null since memory cleared and file gone
      const info = await store.getSnapshotInfo();
      expect(info).toBeNull();
    });
  });

  describe("XFEED_QUERY_IDS_CACHE environment variable", () => {
    const originalEnv = process.env.XFEED_QUERY_IDS_CACHE;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.XFEED_QUERY_IDS_CACHE = originalEnv;
      } else {
        delete process.env.XFEED_QUERY_IDS_CACHE;
      }
    });

    it("uses XFEED_QUERY_IDS_CACHE when set", () => {
      process.env.XFEED_QUERY_IDS_CACHE = "/custom/cache/path.json";
      store = createRuntimeQueryIdStore();
      expect(store.cachePath).toBe("/custom/cache/path.json");
    });

    it("ignores empty XFEED_QUERY_IDS_CACHE", () => {
      process.env.XFEED_QUERY_IDS_CACHE = "   ";
      store = createRuntimeQueryIdStore();
      expect(store.cachePath).not.toBe("   ");
      expect(store.cachePath).toContain("query-ids-cache.json");
    });
  });

  describe("legacy bundle URL patterns", () => {
    it("discovers legacy client bundles", async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes("x.com") && !url.includes("abs.twimg.com")) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                '<script src="https://abs.twimg.com/responsive-web/client-web-legacy/bundle.abc.js"></script>'
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'e.exports={queryId:"legacy123",operationName:"CreateTweet"}'
            ),
        });
      });

      store = createRuntimeQueryIdStore({
        cachePath,
        fetchImpl: mockFetch as typeof fetch,
      });

      const info = await store.refresh(["CreateTweet"], { force: true });
      expect(info?.snapshot.ids.CreateTweet).toBe("legacy123");
    });
  });
});
