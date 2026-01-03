# xfeed Test Patterns

This file contains patterns specific to the xfeed codebase.

## XClient Test Pattern

```typescript
// @ts-nocheck - Test file with fetch mocking
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  type Mock,
} from "bun:test";
import { XClient } from "./client";
import { runtimeQueryIds } from "./query-ids";

// Mock implementations
const mockGetQueryId = mock(() => Promise.resolve(null));
const mockRefresh = mock(() => Promise.resolve(null));

// Store originals
const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;

// Spies
let getQueryIdSpy: Mock<typeof runtimeQueryIds.getQueryId>;
let refreshSpy: Mock<typeof runtimeQueryIds.refresh>;

// Mock response helper
function mockResponse(body: unknown, options: { status?: number; ok?: boolean } = {}) {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

// Valid cookies for tests
const validCookies = {
  authToken: "test-auth-token",
  ct0: "test-ct0",
  cookieHeader: "auth_token=test-auth-token; ct0=test-ct0",
  source: "test",
};

describe("XClient", () => {
  beforeAll(() => {
    getQueryIdSpy = spyOn(runtimeQueryIds, "getQueryId").mockImplementation(mockGetQueryId);
    refreshSpy = spyOn(runtimeQueryIds, "refresh").mockImplementation(mockRefresh);
  });

  afterAll(() => {
    getQueryIdSpy.mockRestore();
    refreshSpy.mockRestore();
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  beforeEach(() => {
    mockGetQueryId.mockReset();
    mockRefresh.mockReset();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("example test", async () => {
    const client = new XClient({ cookies: validCookies });
    globalThis.fetch = mock(() => Promise.resolve(mockResponse({ data: {} })));

    const result = await client.someMethod();
    expect(result.success).toBe(true);
  });
});
```

## Runtime Query ID Store Test Pattern

```typescript
// @ts-nocheck - Test file with fetch mocking
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeQueryIdStore, type RuntimeQueryIdStore } from "./runtime-query-ids";

describe("runtime-query-ids", () => {
  let store: RuntimeQueryIdStore;
  let cachePath: string;
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), "xfeed-test-"));
    cachePath = path.join(testDir, "query-ids-cache.json");
  });

  afterEach(async () => {
    store?.clearMemory();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("reads from cache", async () => {
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

    expect(info?.snapshot.ids.CreateTweet).toBe("abc123");
  });

  it("fetches from network", async () => {
    const mockFetch = mock((url: string) => {
      if (url.includes("x.com")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(
            '<script src="https://abs.twimg.com/responsive-web/client-web/bundle.js"></script>'
          ),
        });
      }
      if (url.includes("bundle.js")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(
            'e.exports={queryId:"abc123",operationName:"CreateTweet"}'
          ),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve("") });
    });

    store = createRuntimeQueryIdStore({
      cachePath,
      fetchImpl: mockFetch as typeof fetch,
    });

    const info = await store.refresh(["CreateTweet"], { force: true });
    expect(info?.snapshot.ids.CreateTweet).toBe("abc123");
  });
});
```

## Cookie Extraction Test Pattern

```typescript
// @ts-nocheck - Test file with module mocking
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mutable mock implementation
let mockImpl = () => Promise.resolve({ cookies: [], warnings: [] });

// Mock BEFORE importing
mock.module("@steipete/sweet-cookie", () => ({
  getCookies: () => mockImpl(),
}));

// NOW import the module
const { resolveCredentials } = await import("./cookies");

// Helper to set mock cookies
function setMockCookies(cookies: Array<{ name: string; value: string; domain: string }>) {
  mockImpl = () => Promise.resolve({ cookies, warnings: [] });
}

describe("cookies", () => {
  beforeEach(() => {
    mockImpl = () => Promise.resolve({ cookies: [], warnings: [] });
  });

  it("extracts X cookies", async () => {
    setMockCookies([
      { name: "auth_token", value: "token123", domain: ".x.com" },
      { name: "ct0", value: "csrf456", domain: ".x.com" },
    ]);

    const result = await resolveCredentials();
    expect(result.authToken).toBe("token123");
    expect(result.ct0).toBe("csrf456");
  });
});
```

## Preload Pattern for Mock Isolation

When `mock.module()` would pollute other test files, use a **preload file** to isolate mocks.

**Problem:** `mock.module()` persists across test files - `mock.restore()` does NOT reset it.

**Solution:** Create a preload file and run the test with `--preload`:

**1. Create `check.test.preload.ts`:**
```typescript
import { mock } from "bun:test";

// Export mutable mock implementations
export let mockResolveCredentialsImpl = () => Promise.resolve({ cookies: {}, warnings: [] });
export let mockGetCurrentUserImpl = () => Promise.resolve({ success: true, user: {} });

// Helper to update mocks from tests
export function setMockResolveCredentials(impl: typeof mockResolveCredentialsImpl) {
  mockResolveCredentialsImpl = impl;
}

export function resetMocks() {
  mockResolveCredentialsImpl = () => Promise.resolve({ cookies: {}, warnings: [] });
  // ... reset other mocks
}

// Mock modules BEFORE they're imported anywhere
mock.module("./cookies", () => ({
  resolveCredentials: (options: unknown) => mockResolveCredentialsImpl(options),
}));

mock.module("@/api/client", () => ({
  XClient: class MockXClient {
    getCurrentUser() { return mockGetCurrentUserImpl(); }
  },
}));
```

**2. Update test file to use preload helpers:**
```typescript
import { beforeEach, describe, expect, it } from "bun:test";
import { resetMocks, setMockResolveCredentials } from "./check.test.preload";

const { checkAuth } = await import("./check");

describe("check", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("handles missing credentials", async () => {
    setMockResolveCredentials(() => Promise.resolve({
      cookies: { authToken: null, ct0: null },
      warnings: [],
    }));

    const result = await checkAuth();
    expect(result.ok).toBe(false);
  });
});
```

**3. Run with preload:**
```bash
bun test --preload ./src/auth/check.test.preload.ts src/auth/check.test.ts
```

**4. Update package.json to isolate tests:**
```json
{
  "scripts": {
    "test": "bun test src/api src/lib && bun test src/auth/cookies.test.ts && bun test --preload ./src/auth/check.test.preload.ts src/auth/check.test.ts"
  }
}
```

This ensures each test file gets the correct module implementations without pollution.

## Multi-Step Mock Pattern (Video Upload)

For tests that require multiple fetch calls in sequence:

```typescript
it("uploads video with polling", async () => {
  const client = new XClient({ cookies: validCookies });
  let callCount = 0;

  globalThis.fetch = mock(() => {
    callCount++;
    if (callCount === 1) {
      // INIT
      return Promise.resolve(mockResponse({ media_id_string: "video-123" }));
    }
    if (callCount === 2) {
      // APPEND
      return Promise.resolve(mockResponse({}));
    }
    if (callCount === 3) {
      // FINALIZE - return pending to trigger polling
      return Promise.resolve(mockResponse({
        processing_info: { state: "pending", check_after_secs: 0.001 },
      }));
    }
    // STATUS check - return succeeded
    return Promise.resolve(mockResponse({
      processing_info: { state: "succeeded" },
    }));
  });

  const result = await client.uploadMedia({
    data: new Uint8Array([1, 2, 3]),
    mimeType: "video/mp4",
  });

  expect(result.success).toBe(true);
  expect(callCount).toBe(4); // INIT + APPEND + FINALIZE + STATUS
});
```

## GraphQL Response Patterns

X API responses have nested structures. Use these patterns:

```typescript
// Tweet response
const tweetResponse = {
  data: {
    tweetResult: {
      result: {
        rest_id: "123456",
        legacy: {
          full_text: "Hello world!",
          created_at: "Wed Oct 10 20:19:24 +0000 2018",
          reply_count: 5,
          retweet_count: 10,
          favorite_count: 20,
          conversation_id_str: "123456",
        },
        core: {
          user_results: {
            result: {
              rest_id: "user123",
              legacy: {
                screen_name: "testuser",
                name: "Test User",
              },
            },
          },
        },
      },
    },
  },
};

// Timeline response
const timelineResponse = {
  data: {
    home: {
      home_timeline_urt: {
        instructions: [
          {
            type: "TimelineAddEntries",
            entries: [
              {
                entryId: "tweet-123",
                content: {
                  itemContent: {
                    tweet_results: {
                      result: { /* tweet structure */ },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  },
};
```
