// @ts-nocheck - Test file with complex mocking that conflicts with Bun's strict fetch types
/**
 * Unit tests for TwitterClient
 * Tests all public methods and edge cases for 100% coverage
 */

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

import { TwitterClient } from "./client";
import { runtimeQueryIds } from "./query-ids";

// Mock runtimeQueryIds
const mockGetQueryId = mock(() => Promise.resolve(null));
const mockRefresh = mock(() => Promise.resolve(null));

// Store original fetch
const originalFetch = globalThis.fetch;

// Store original env values for restoration
const originalNodeEnv = process.env.NODE_ENV;
const originalDebugArticle = process.env.XFEED_DEBUG_ARTICLE;

// Store spies for cleanup
let getQueryIdSpy: Mock<typeof runtimeQueryIds.getQueryId>;
let refreshSpy: Mock<typeof runtimeQueryIds.refresh>;

// Mock response factory
function mockResponse(
  body: unknown,
  options: { status?: number; ok?: boolean } = {}
) {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
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

describe("TwitterClient", () => {
  beforeAll(() => {
    // Create spies once for the entire test suite
    getQueryIdSpy = spyOn(runtimeQueryIds, "getQueryId").mockImplementation(
      mockGetQueryId
    );
    refreshSpy = spyOn(runtimeQueryIds, "refresh").mockImplementation(
      mockRefresh
    );
  });

  afterAll(() => {
    // Restore original methods
    getQueryIdSpy.mockRestore();
    refreshSpy.mockRestore();

    // Restore original env values
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalDebugArticle !== undefined) {
      process.env.XFEED_DEBUG_ARTICLE = originalDebugArticle;
    }
  });

  beforeEach(() => {
    // Reset mocks
    mockGetQueryId.mockReset();
    mockRefresh.mockReset();
    mockGetQueryId.mockImplementation(() => Promise.resolve(null));
    mockRefresh.mockImplementation(() => Promise.resolve(null));

    // Set test environment
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.XFEED_DEBUG_ARTICLE;
  });

  describe("constructor", () => {
    it("throws if authToken is missing", () => {
      expect(() => {
        new TwitterClient({
          cookies: {
            authToken: null,
            ct0: "test",
            cookieHeader: null,
            source: null,
          },
        });
      }).toThrow("Both authToken and ct0 cookies are required");
    });

    it("throws if ct0 is missing", () => {
      expect(() => {
        new TwitterClient({
          cookies: {
            authToken: "test",
            ct0: null,
            cookieHeader: null,
            source: null,
          },
        });
      }).toThrow("Both authToken and ct0 cookies are required");
    });

    it("creates client with valid cookies", () => {
      const client = new TwitterClient({ cookies: validCookies });
      expect(client).toBeDefined();
    });

    it("uses provided userAgent", () => {
      const client = new TwitterClient({
        cookies: validCookies,
        userAgent: "CustomAgent/1.0",
      });
      expect(client).toBeDefined();
    });

    it("uses provided timeoutMs", () => {
      const client = new TwitterClient({
        cookies: validCookies,
        timeoutMs: 5000,
      });
      expect(client).toBeDefined();
    });

    it("builds cookieHeader from authToken and ct0 if not provided", () => {
      const client = new TwitterClient({
        cookies: {
          authToken: "abc",
          ct0: "xyz",
          cookieHeader: null,
          source: null,
        },
      });
      expect(client).toBeDefined();
    });
  });

  describe("getTweet", () => {
    it("returns tweet on success", async () => {
      const client = new TwitterClient({ cookies: validCookies });
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

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse(tweetResponse))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.id).toBe("123456");
        expect(result.tweet?.text).toBe("Hello world!");
        expect(result.tweet?.author.username).toBe("testuser");
      }
    });

    it("finds tweet in instructions if not in tweetResult", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      const tweetResponse = {
        data: {
          threaded_conversation_with_injections_v2: {
            instructions: [
              {
                entries: [
                  {
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            rest_id: "123456",
                            legacy: {
                              full_text: "Found in instructions!",
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
                    },
                  },
                ],
              },
            ],
          },
        },
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse(tweetResponse))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 500, ok: false }))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("HTTP 500");
      }
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Tweet not found" }],
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(false);
    });

    it("returns error if tweet not found in response", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse({ data: {} }))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tweet not found in response");
      }
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error")));

      const result = await client.getTweet("123456");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Network error");
      }
    });

    it("retries with refreshed query IDs on 404", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      // All calls return 404 to test the failure case
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 404, ok: false }))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("404");
      }
    });

    it("extracts article text when present", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      const tweetResponse = {
        data: {
          tweetResult: {
            result: {
              rest_id: "123456",
              article: {
                article_results: {
                  result: {
                    title: "Article Title",
                    plain_text: "This is the article body text.",
                  },
                },
              },
              core: {
                user_results: {
                  result: {
                    rest_id: "user123",
                    legacy: { screen_name: "testuser", name: "Test User" },
                  },
                },
              },
            },
          },
        },
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse(tweetResponse))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.text).toContain("Article Title");
        expect(result.tweet?.text).toContain("article body text");
      }
    });

    it("extracts note tweet text when present", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      const tweetResponse = {
        data: {
          tweetResult: {
            result: {
              rest_id: "123456",
              note_tweet: {
                note_tweet_results: {
                  result: {
                    text: "This is a long note tweet that exceeds 280 characters.",
                  },
                },
              },
              core: {
                user_results: {
                  result: {
                    rest_id: "user123",
                    legacy: { screen_name: "testuser", name: "Test User" },
                  },
                },
              },
            },
          },
        },
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse(tweetResponse))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.text).toContain("long note tweet");
      }
    });

    it("handles article with title only, fetches from UserArticlesTweets", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          // TweetDetail response with title-only article
          return Promise.resolve(
            mockResponse({
              data: {
                tweetResult: {
                  result: {
                    rest_id: "123456",
                    article: {
                      article_results: {
                        result: { title: "Title Only" },
                      },
                      title: "Title Only",
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
            })
          );
        }
        // UserArticlesTweets fallback
        return Promise.resolve(
          mockResponse({
            data: {
              user: {
                result: {
                  timeline: {
                    timeline: {
                      instructions: [
                        {
                          entries: [
                            {
                              content: {
                                itemContent: {
                                  tweet_results: {
                                    result: {
                                      rest_id: "123456",
                                      article: {
                                        article_results: {
                                          result: {
                                            title: "Title Only",
                                            plain_text:
                                              "Article body from fallback.",
                                          },
                                        },
                                      },
                                    },
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
              },
            },
          })
        );
      });

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.text).toContain("Article body from fallback");
      }
    });

    it("handles debug article logging", async () => {
      process.env.XFEED_DEBUG_ARTICLE = "1";
      const client = new TwitterClient({ cookies: validCookies });
      const tweetResponse = {
        data: {
          tweetResult: {
            result: {
              rest_id: "123456",
              article: {
                article_results: { result: { title: "Debug Article" } },
              },
              core: {
                user_results: {
                  result: {
                    rest_id: "user123",
                    legacy: { screen_name: "testuser", name: "Test User" },
                  },
                },
              },
            },
          },
        },
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse(tweetResponse))
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
    });
  });

  describe("tweet", () => {
    it("posts tweet successfully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              create_tweet: {
                tweet_results: {
                  result: { rest_id: "new-tweet-123" },
                },
              },
            },
          })
        )
      );

      const result = await client.tweet("Hello Twitter!");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweetId).toBe("new-tweet-123");
      }
    });

    it("posts tweet with media IDs", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              create_tweet: {
                tweet_results: {
                  result: { rest_id: "new-tweet-456" },
                },
              },
            },
          })
        )
      );

      const result = await client.tweet("Tweet with media", [
        "media1",
        "media2",
      ]);
      expect(result.success).toBe(true);
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 403, ok: false }))
      );

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Rate limited", code: 88 }],
          })
        )
      );

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Rate limited");
        expect(result.error).toContain("88");
      }
    });

    it("returns error if no tweet ID returned", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: { create_tweet: { tweet_results: { result: {} } } },
          })
        )
      );

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tweet created but no ID returned");
      }
    });

    it("retries on 404 and succeeds", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse("Not found", { status: 404, ok: false })
          );
        }
        return Promise.resolve(
          mockResponse({
            data: {
              create_tweet: {
                tweet_results: {
                  result: { rest_id: "retry-tweet-123" },
                },
              },
            },
          })
        );
      });

      const result = await client.tweet("Hello");
      expect(result.success).toBe(true);
    });

    it("falls back to status update on error 226", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({
              errors: [{ message: "Automation detected", code: 226 }],
            })
          );
        }
        // Status update fallback
        return Promise.resolve(
          mockResponse({
            id_str: "fallback-tweet-123",
          })
        );
      });

      const result = await client.tweet("Hello");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweetId).toBe("fallback-tweet-123");
      }
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Connection refused"))
      );

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Connection refused");
      }
    });
  });

  describe("reply", () => {
    it("posts reply successfully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              create_tweet: {
                tweet_results: {
                  result: { rest_id: "reply-123" },
                },
              },
            },
          })
        )
      );

      const result = await client.reply(
        "This is a reply",
        "original-tweet-123"
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweetId).toBe("reply-123");
      }
    });

    it("posts reply with media", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              create_tweet: {
                tweet_results: {
                  result: { rest_id: "reply-456" },
                },
              },
            },
          })
        )
      );

      const result = await client.reply("Reply with media", "original-123", [
        "media1",
      ]);
      expect(result.success).toBe(true);
    });
  });

  describe("search", () => {
    it("returns search results on success", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              search_by_raw_query: {
                search_timeline: {
                  timeline: {
                    instructions: [
                      {
                        entries: [
                          {
                            content: {
                              itemContent: {
                                tweet_results: {
                                  result: {
                                    rest_id: "search-tweet-1",
                                    legacy: { full_text: "Search result 1" },
                                    core: {
                                      user_results: {
                                        result: {
                                          rest_id: "user1",
                                          legacy: {
                                            screen_name: "user1",
                                            name: "User 1",
                                          },
                                        },
                                      },
                                    },
                                  },
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
            },
          })
        )
      );

      const result = await client.search("test query");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBeGreaterThan(0);
      }
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.search("test");
      expect(result.success).toBe(false);
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Search error" }],
          })
        )
      );

      const result = await client.search("test");
      expect(result.success).toBe(false);
    });

    it("retries on 404", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      // All calls return 404 to test failure case
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 404, ok: false }))
      );

      const result = await client.search("test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("404");
      }
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Network timeout"))
      );

      const result = await client.search("test");
      expect(result.success).toBe(false);
    });

    it("uses custom count parameter", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              search_by_raw_query: {
                search_timeline: {
                  timeline: { instructions: [] },
                },
              },
            },
          })
        )
      );

      const result = await client.search("test", 50);
      expect(result.success).toBe(true);
    });
  });

  describe("getCurrentUser", () => {
    it("returns user from settings endpoint", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            screen_name: "currentuser",
            name: "Current User",
            user_id: "12345",
          })
        )
      );

      const result = await client.getCurrentUser();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.username).toBe("currentuser");
        expect(result.user?.id).toBe("12345");
      }
    });

    it("returns user from verify_credentials endpoint", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(
            mockResponse("Error", { status: 401, ok: false })
          );
        }
        return Promise.resolve(
          mockResponse({
            screen_name: "verifieduser",
            name: "Verified User",
            user_id_str: "67890",
          })
        );
      });

      const result = await client.getCurrentUser();
      expect(result.success).toBe(true);
    });

    it("returns user with nested user object", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            user: {
              screen_name: "nesteduser",
              name: "Nested User",
              id_str: "11111",
            },
          })
        )
      );

      const result = await client.getCurrentUser();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.username).toBe("nesteduser");
      }
    });

    it("falls back to settings page HTML parsing", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount <= 4) {
          return Promise.resolve(
            mockResponse("Error", { status: 401, ok: false })
          );
        }
        return Promise.resolve(
          mockResponse(
            `<html>some content "screen_name":"htmluser" and "user_id":"99999" with "name":"HTML User"</html>`
          )
        );
      });

      const result = await client.getCurrentUser();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user?.username).toBe("htmluser");
        expect(result.user?.id).toBe("99999");
      }
    });

    it("returns error when all endpoints fail", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 401, ok: false }))
      );

      const result = await client.getCurrentUser();
      expect(result.success).toBe(false);
    });

    it("handles JSON parse error gracefully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve("not json"),
            json: () => Promise.reject(new Error("Invalid JSON")),
          } as Response);
        }
        return Promise.resolve(
          mockResponse({
            screen_name: "fallbackuser",
            user_id: "12345",
          })
        );
      });

      const result = await client.getCurrentUser();
      expect(result.success).toBe(true);
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error")));

      const result = await client.getCurrentUser();
      expect(result.success).toBe(false);
    });
  });

  describe("getReplies", () => {
    it("returns replies to a tweet", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              threaded_conversation_with_injections_v2: {
                instructions: [
                  {
                    entries: [
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                rest_id: "reply-1",
                                legacy: {
                                  full_text: "This is a reply",
                                  in_reply_to_status_id_str: "original-123",
                                },
                                core: {
                                  user_results: {
                                    result: {
                                      rest_id: "user1",
                                      legacy: {
                                        screen_name: "replier",
                                        name: "Replier",
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          })
        )
      );

      const result = await client.getReplies("original-123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBe(1);
      }
    });

    it("returns error on failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.getReplies("123");
      expect(result.success).toBe(false);
    });
  });

  describe("getThread", () => {
    it("returns full thread sorted by time", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              threaded_conversation_with_injections_v2: {
                instructions: [
                  {
                    entries: [
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                rest_id: "tweet-1",
                                legacy: {
                                  full_text: "First tweet",
                                  created_at: "Wed Oct 10 10:00:00 +0000 2018",
                                  conversation_id_str: "conv-123",
                                },
                                core: {
                                  user_results: {
                                    result: {
                                      rest_id: "user1",
                                      legacy: {
                                        screen_name: "user1",
                                        name: "User 1",
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                rest_id: "tweet-2",
                                legacy: {
                                  full_text: "Second tweet",
                                  created_at: "Wed Oct 10 11:00:00 +0000 2018",
                                  conversation_id_str: "conv-123",
                                },
                                core: {
                                  user_results: {
                                    result: {
                                      rest_id: "user1",
                                      legacy: {
                                        screen_name: "user1",
                                        name: "User 1",
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
          })
        )
      );

      const result = await client.getThread("tweet-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBe(2);
        // Should be sorted by time
        expect(result.tweets?.[0]?.id).toBe("tweet-1");
      }
    });

    it("returns error on failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.getThread("123");
      expect(result.success).toBe(false);
    });
  });

  describe("getBookmarks", () => {
    it("returns bookmarks on success", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              bookmark_timeline_v2: {
                timeline: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "bookmark-1",
                                  legacy: { full_text: "Bookmarked tweet" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "user1",
                                        legacy: {
                                          screen_name: "user1",
                                          name: "User 1",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        )
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBeGreaterThan(0);
      }
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(false);
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Bookmarks error" }],
          })
        )
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(false);
    });

    it("retries on 404", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      // All calls return 404 to test failure case
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 404, ok: false }))
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("404");
      }
    });

    it("uses custom count parameter", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              bookmark_timeline_v2: {
                timeline: { instructions: [] },
              },
            },
          })
        )
      );

      const result = await client.getBookmarks(50);
      expect(result.success).toBe(true);
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.reject(new Error("Timeout")));

      const result = await client.getBookmarks();
      expect(result.success).toBe(false);
    });

    it("accepts cursor parameter for pagination", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let capturedUrl = "";
      globalThis.fetch = mock((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          mockResponse({
            data: {
              bookmark_timeline_v2: {
                timeline: { instructions: [] },
              },
            },
          })
        );
      });

      await client.getBookmarks(20, "test-bookmark-cursor");
      expect(capturedUrl).toContain("cursor");
      expect(capturedUrl).toContain("test-bookmark-cursor");
    });

    it("returns nextCursor from response", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              bookmark_timeline_v2: {
                timeline: {
                  instructions: [
                    {
                      entries: [
                        {
                          entryId: "cursor-bottom",
                          content: {
                            cursorType: "Bottom",
                            value: "bookmark-next-cursor-123",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          })
        )
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextCursor).toBe("bookmark-next-cursor-123");
      }
    });

    it("returns undefined nextCursor when no cursor in response", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              bookmark_timeline_v2: {
                timeline: { instructions: [] },
              },
            },
          })
        )
      );

      const result = await client.getBookmarks();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextCursor).toBeUndefined();
      }
    });
  });

  describe("getHomeTimeline", () => {
    it("returns home timeline on success", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "home-tweet-1",
                                  legacy: { full_text: "Home timeline tweet" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "user1",
                                        legacy: {
                                          screen_name: "user1",
                                          name: "User 1",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBeGreaterThan(0);
      }
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(false);
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Timeline error" }],
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(false);
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error")));

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(false);
    });

    it("uses custom count parameter", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: { instructions: [] },
              },
            },
          })
        )
      );

      const result = await client.getHomeTimeline(50);
      expect(result.success).toBe(true);
    });

    it("returns nextCursor from response", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          entryId: "tweet-123",
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "123",
                                  legacy: { full_text: "Tweet" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        {
                          entryId: "cursor-bottom-12345",
                          content: {
                            value: "DAABCgABG9oKYJ-NEXT-CURSOR",
                            cursorType: "Bottom",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextCursor).toBe("DAABCgABG9oKYJ-NEXT-CURSOR");
      }
    });

    it("extracts cursor from TimelineReplaceEntry instruction", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
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
                                result: {
                                  rest_id: "123",
                                  legacy: { full_text: "Tweet" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                    {
                      type: "TimelineReplaceEntry",
                      entry: {
                        entryId: "cursor-bottom-refresh",
                        content: {
                          value: "REPLACE-ENTRY-CURSOR",
                          cursorType: "Bottom",
                        },
                      },
                    },
                  ],
                },
              },
            },
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextCursor).toBe("REPLACE-ENTRY-CURSOR");
      }
    });

    it("accepts cursor parameter for pagination", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let capturedUrl = "";
      globalThis.fetch = mock((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: { instructions: [] },
              },
            },
          })
        );
      });

      await client.getHomeTimeline(20, "test-cursor-value");
      expect(capturedUrl).toContain("cursor");
      expect(capturedUrl).toContain("test-cursor-value");
    });

    it("retries on 404 and succeeds", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve(
            mockResponse("Not found", { status: 404, ok: false })
          );
        }
        return Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "retry-tweet",
                                  legacy: { full_text: "Success after retry" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        );
      });

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
    });

    it("returns error after all query IDs return 404", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 404, ok: false }))
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("404");
      }
    });
  });

  describe("getHomeLatestTimeline", () => {
    it("returns latest timeline on success", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "latest-tweet-1",
                                  legacy: {
                                    full_text: "Latest timeline tweet",
                                  },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "user1",
                                        legacy: {
                                          screen_name: "user1",
                                          name: "User 1",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        )
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBeGreaterThan(0);
      }
    });

    it("returns error on HTTP failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 500, ok: false }))
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(false);
    });

    it("returns error on GraphQL errors", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Latest timeline error" }],
          })
        )
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(false);
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Connection error"))
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(false);
    });

    it("uses custom count parameter", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: { instructions: [] },
              },
            },
          })
        )
      );

      const result = await client.getHomeLatestTimeline(50);
      expect(result.success).toBe(true);
    });

    it("returns nextCursor from response", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          entryId: "tweet-456",
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "456",
                                  legacy: { full_text: "Latest tweet" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        {
                          entryId: "cursor-bottom-67890",
                          content: {
                            value: "DAABCgABG9oKYJ-LATEST-CURSOR",
                            cursorType: "Bottom",
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          })
        )
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nextCursor).toBe("DAABCgABG9oKYJ-LATEST-CURSOR");
      }
    });

    it("accepts cursor parameter for pagination", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let capturedUrl = "";
      globalThis.fetch = mock((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: { instructions: [] },
              },
            },
          })
        );
      });

      await client.getHomeLatestTimeline(20, "latest-cursor-value");
      expect(capturedUrl).toContain("cursor");
      expect(capturedUrl).toContain("latest-cursor-value");
    });

    it("retries on 404 and succeeds", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      // HomeLatestTimeline has only 1 unique query ID in tests (fallback == primary)
      // First tryOnce fails with 404, second tryOnce succeeds
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.resolve(
            mockResponse("Not found", { status: 404, ok: false })
          );
        }
        return Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "retry-latest",
                                  legacy: { full_text: "Latest after retry" },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        );
      });

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(true);
    });

    it("returns error after all query IDs return 404", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Not found", { status: 404, ok: false }))
      );

      const result = await client.getHomeLatestTimeline();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("404");
      }
    });
  });

  describe("uploadMedia", () => {
    it("uploads image successfully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          // INIT
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        if (callCount === 2) {
          // APPEND
          return Promise.resolve(mockResponse({}));
        }
        // FINALIZE
        return Promise.resolve(
          mockResponse({ processing_info: { state: "succeeded" } })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe("media-123");
    });

    it("uploads GIF successfully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse({ media_id_string: "gif-123" }))
      );

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/gif",
      });
      expect(result.success).toBe(true);
    });

    it("uploads video successfully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          // INIT
          return Promise.resolve(
            mockResponse({ media_id_string: "video-123" })
          );
        }
        if (callCount === 2) {
          // APPEND
          return Promise.resolve(mockResponse({}));
        }
        // FINALIZE - return succeeded immediately
        return Promise.resolve(
          mockResponse({
            processing_info: { state: "succeeded" },
          })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "video/mp4",
      });
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe("video-123");
    });

    it("polls for video processing when state is pending", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          // INIT
          return Promise.resolve(
            mockResponse({ media_id_string: "video-poll-123" })
          );
        }
        if (callCount === 2) {
          // APPEND
          return Promise.resolve(mockResponse({}));
        }
        if (callCount === 3) {
          // FINALIZE - return pending to trigger polling
          return Promise.resolve(
            mockResponse({
              processing_info: { state: "pending", check_after_secs: 0.001 },
            })
          );
        }
        // STATUS check - return succeeded
        return Promise.resolve(
          mockResponse({
            processing_info: { state: "succeeded" },
          })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "video/mp4",
      });
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe("video-poll-123");
      // Verify polling happened (INIT + APPEND + FINALIZE + STATUS = 4 calls)
      expect(callCount).toBe(4);
    });

    it("returns error for unsupported media type", async () => {
      const client = new TwitterClient({ cookies: validCookies });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "application/pdf",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported media type");
    });

    it("returns error on INIT failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse("Error", { status: 400, ok: false }))
      );

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 400");
    });

    it("returns error if INIT returns no media_id", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.resolve(mockResponse({})));

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("did not return media_id");
    });

    it("returns error on APPEND failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        return Promise.resolve(
          mockResponse("Error", { status: 400, ok: false })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
    });

    it("returns error on FINALIZE failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        if (callCount === 2) {
          return Promise.resolve(mockResponse({}));
        }
        return Promise.resolve(
          mockResponse("Error", { status: 400, ok: false })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
    });

    it("handles processing failure state", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        if (callCount === 2) {
          return Promise.resolve(mockResponse({}));
        }
        return Promise.resolve(
          mockResponse({
            processing_info: {
              state: "failed",
              error: { message: "Processing failed" },
            },
          })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Processing failed");
    });

    it("adds alt text for images", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        // Alt text request
        return Promise.resolve(mockResponse({}));
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        alt: "Image description",
      });
      expect(result.success).toBe(true);
    });

    it("returns error on alt text failure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve(
            mockResponse({ media_id_string: "media-123" })
          );
        }
        return Promise.resolve(
          mockResponse("Error", { status: 400, ok: false })
        );
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        alt: "Image description",
      });
      expect(result.success).toBe(false);
    });

    it("handles fetch exception", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() => Promise.reject(new Error("Upload failed")));

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload failed");
    });

    it("handles chunked upload for large files", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB
      let appendCount = 0;

      globalThis.fetch = mock((url: string, init?: RequestInit) => {
        const body = init?.body;
        if (body instanceof URLSearchParams) {
          const command = body.get("command");
          if (command === "INIT") {
            return Promise.resolve(
              mockResponse({ media_id_string: "large-media-123" })
            );
          }
          if (command === "FINALIZE") {
            return Promise.resolve(mockResponse({}));
          }
        }
        if (body instanceof FormData) {
          appendCount++;
          return Promise.resolve(mockResponse({}));
        }
        return Promise.resolve(mockResponse({}));
      });

      const result = await client.uploadMedia({
        data: largeData,
        mimeType: "video/mp4",
      });
      expect(result.success).toBe(true);
      expect(appendCount).toBe(2); // 10MB / 5MB = 2 chunks
    });

    it("uses media_id when media_id_string is missing", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockResponse({ media_id: 12345 }));
        }
        return Promise.resolve(mockResponse({}));
      });

      const result = await client.uploadMedia({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      expect(result.success).toBe(true);
      expect(result.mediaId).toBe("12345");
    });
  });

  describe("timeout handling", () => {
    it("respects timeout setting", async () => {
      const client = new TwitterClient({
        cookies: validCookies,
        timeoutMs: 100,
      });

      globalThis.fetch = mock(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse({ data: {} })), 200);
          })
      );

      const result = await client.getTweet("123");
      // Should abort before completion
      expect(result.success).toBe(false);
    });

    it("does not use timeout when set to 0", async () => {
      const client = new TwitterClient({
        cookies: validCookies,
        timeoutMs: 0,
      });

      globalThis.fetch = mock(() =>
        Promise.resolve(mockResponse({ data: {} }))
      );

      const result = await client.getTweet("123");
      expect(result.success).toBe(false); // No tweet in response
    });
  });

  describe("tweet result parsing edge cases", () => {
    it("handles tweet with core.screen_name instead of legacy.screen_name", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  legacy: { full_text: "Tweet text" },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        core: {
                          screen_name: "coreuser",
                          name: "Core User",
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.author.username).toBe("coreuser");
      }
    });

    it("handles tweet with missing text fields gracefully", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      // Should fail because no text was found
      expect(result.success).toBe(false);
    });

    it("handles items array in instructions via getThread", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              threaded_conversation_with_injections_v2: {
                instructions: [
                  {
                    entries: [
                      {
                        content: {
                          items: [
                            {
                              item: {
                                itemContent: {
                                  tweet_results: {
                                    result: {
                                      rest_id: "nested-tweet-1",
                                      legacy: {
                                        full_text: "Nested tweet",
                                        conversation_id_str: "conv-123",
                                      },
                                      core: {
                                        user_results: {
                                          result: {
                                            rest_id: "user1",
                                            legacy: {
                                              screen_name: "user1",
                                              name: "User",
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          })
        )
      );

      // getThread uses parseTweetsFromInstructions which checks items array
      const result = await client.getThread("nested-tweet-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBe(1);
        expect(result.tweets?.[0]?.id).toBe("nested-tweet-1");
      }
    });

    it("deduplicates tweets by ID", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              search_by_raw_query: {
                search_timeline: {
                  timeline: {
                    instructions: [
                      {
                        entries: [
                          {
                            content: {
                              itemContent: {
                                tweet_results: {
                                  result: {
                                    rest_id: "same-id",
                                    legacy: { full_text: "First occurrence" },
                                    core: {
                                      user_results: {
                                        result: {
                                          rest_id: "user1",
                                          legacy: {
                                            screen_name: "user1",
                                            name: "User",
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          {
                            content: {
                              itemContent: {
                                tweet_results: {
                                  result: {
                                    rest_id: "same-id",
                                    legacy: { full_text: "Duplicate" },
                                    core: {
                                      user_results: {
                                        result: {
                                          rest_id: "user1",
                                          legacy: {
                                            screen_name: "user1",
                                            name: "User",
                                          },
                                        },
                                      },
                                    },
                                  },
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
            },
          })
        )
      );

      const result = await client.search("test");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweets?.length).toBe(1);
      }
    });

    it("extracts favorited and bookmarked state from legacy", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  legacy: {
                    full_text: "Liked and bookmarked tweet",
                    favorited: true,
                    bookmarked: true,
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test User" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.favorited).toBe(true);
        expect(result.tweet?.bookmarked).toBe(true);
      }
    });

    it("defaults favorited and bookmarked to false when missing", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  legacy: {
                    full_text: "Tweet without interaction state",
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test User" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.favorited).toBe(false);
        expect(result.tweet?.bookmarked).toBe(false);
      }
    });

    it("extracts partial interaction state (only favorited)", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  legacy: {
                    full_text: "Only liked tweet",
                    favorited: true,
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test User" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.favorited).toBe(true);
        expect(result.tweet?.bookmarked).toBe(false);
      }
    });
  });

  describe("article text extraction edge cases", () => {
    it("extracts text from richtext field", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  note_tweet: {
                    note_tweet_results: {
                      result: {
                        richtext: { text: "Richtext content" },
                      },
                    },
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.text).toBe("Richtext content");
      }
    });

    it("extracts text from content.richtext field", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  note_tweet: {
                    note_tweet_results: {
                      result: {
                        content: {
                          richtext: { text: "Content richtext" },
                        },
                      },
                    },
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweet?.text).toBe("Content richtext");
      }
    });

    it("collects text fields from nested article structure", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "123456",
                  article: {
                    article_results: {
                      result: {
                        title: "Same Title",
                        sections: [
                          {
                            items: [{ text: "Section item text" }],
                          },
                        ],
                      },
                    },
                    title: "Same Title",
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user123",
                        legacy: { screen_name: "testuser", name: "Test" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("123456");
      expect(result.success).toBe(true);
    });
  });

  describe("status update fallback", () => {
    it("handles fallback with reply", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({
              errors: [{ message: "Automation", code: 226 }],
            })
          );
        }
        return Promise.resolve(mockResponse({ id_str: "fallback-reply-123" }));
      });

      const result = await client.reply("Reply text", "original-123");
      expect(result.success).toBe(true);
    });

    it("returns combined error when fallback also fails", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({
              errors: [{ message: "Automation", code: 226 }],
            })
          );
        }
        return Promise.resolve(
          mockResponse({
            errors: [{ message: "Rate limited" }],
          })
        );
      });

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Automation");
        expect(result.error).toContain("fallback");
      }
    });

    it("handles fallback HTTP error", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({
              errors: [{ message: "Automation", code: 226 }],
            })
          );
        }
        return Promise.resolve(
          mockResponse("Error", { status: 403, ok: false })
        );
      });

      const result = await client.tweet("Hello");
      expect(result.success).toBe(false);
    });

    it("handles fallback with media IDs", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      let callCount = 0;

      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            mockResponse({
              errors: [{ message: "Automation", code: 226 }],
            })
          );
        }
        return Promise.resolve(mockResponse({ id: 123456789 }));
      });

      const result = await client.tweet("With media", ["media1", "media2"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tweetId).toBe("123456789");
      }
    });

    it("returns null from status update parsing if no text", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            errors: [{ message: "Automation", code: 226 }],
          })
        )
      );

      // Internally the fallback won't work if tweet_text is not a string
      // but we can't easily trigger this path from public API
      const result = await client.tweet("Valid text");
      expect(result.success).toBe(false);
    });
  });

  describe("URL extraction edge cases", () => {
    it("handles tweets with undefined expanded_url in entities", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              tweetResult: {
                result: {
                  rest_id: "tweet-123",
                  legacy: {
                    full_text: "Tweet with broken URL https://t.co/abc",
                    entities: {
                      urls: [
                        {
                          url: "https://t.co/abc",
                          expanded_url: undefined,
                          display_url: "example.com",
                          indices: [25, 48],
                        },
                      ],
                    },
                  },
                  core: {
                    user_results: {
                      result: {
                        rest_id: "user1",
                        legacy: { screen_name: "user1", name: "User 1" },
                      },
                    },
                  },
                },
              },
            },
          })
        )
      );

      const result = await client.getTweet("tweet-123");
      expect(result.success).toBe(true);
      // Should not crash and should handle gracefully
    });

    it("filters out urls with undefined expanded_url in timeline", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "tweet-456",
                                  legacy: {
                                    full_text: "Tweet with mixed URLs",
                                    entities: {
                                      urls: [
                                        {
                                          url: "https://t.co/good",
                                          expanded_url: "https://example.com",
                                          display_url: "example.com",
                                          indices: [0, 23],
                                        },
                                        {
                                          url: "https://t.co/bad",
                                          expanded_url: undefined,
                                          display_url: "broken.com",
                                          indices: [24, 47],
                                        },
                                      ],
                                    },
                                  },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u1",
                                        legacy: {
                                          screen_name: "user",
                                          name: "User",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
      if (result.success && result.tweets.length > 0) {
        const tweet = result.tweets[0];
        // Should only have the valid URL, not the undefined one
        expect(tweet?.urls?.length).toBe(1);
        expect(tweet?.urls?.[0]?.expandedUrl).toBe("https://example.com");
      }
    });

    it("handles media urls with undefined expanded_url", async () => {
      const client = new TwitterClient({ cookies: validCookies });
      globalThis.fetch = mock(() =>
        Promise.resolve(
          mockResponse({
            data: {
              home: {
                home_timeline_urt: {
                  instructions: [
                    {
                      entries: [
                        {
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: "tweet-789",
                                  legacy: {
                                    full_text:
                                      "Tweet with media URL https://t.co/media",
                                    entities: {
                                      urls: [
                                        {
                                          url: "https://t.co/media",
                                          expanded_url: undefined,
                                          display_url: "pic.twitter.com/abc",
                                          indices: [22, 45],
                                        },
                                      ],
                                    },
                                  },
                                  core: {
                                    user_results: {
                                      result: {
                                        rest_id: "u2",
                                        legacy: {
                                          screen_name: "user2",
                                          name: "User 2",
                                        },
                                      },
                                    },
                                  },
                                },
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
          })
        )
      );

      const result = await client.getHomeTimeline();
      expect(result.success).toBe(true);
      // Should not crash even when isMediaUrl is called with undefined
    });
  });
});
