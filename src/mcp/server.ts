#!/usr/bin/env bun
/**
 * MCP (Model Context Protocol) server for X/Twitter
 *
 * This server exposes xfeed's XClient as MCP tools that can be used by
 * Claude Code to interact with X/Twitter directly.
 *
 * Usage:
 *   bun run src/mcp/server.ts
 *
 * Configure in Claude Code (~/.claude/settings.json):
 *   {
 *     "mcpServers": {
 *       "x-twitter": {
 *         "command": "bun",
 *         "args": ["run", "/path/to/xfeed/src/mcp/server.ts"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { ApiError } from "../api/types";

import { XClient } from "../api/client";
import { loadConfig } from "../config/loader";

// Load auth from xfeed config
const config = loadConfig();

if (!config.authToken || !config.ct0) {
  console.error(
    "Error: No auth tokens found. Please run xfeed first to authenticate."
  );
  console.error("  bun run start");
  process.exit(1);
}

// Initialize X client with properly typed cookies
const client = new XClient({
  cookies: {
    authToken: config.authToken,
    ct0: config.ct0,
    cookieHeader: `auth_token=${config.authToken}; ct0=${config.ct0}`,
    source: "config",
  },
});

// Create MCP server
const server = new McpServer({
  name: "x-twitter",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Format output
// ═══════════════════════════════════════════════════════════════════════════

function formatTweet(tweet: unknown): string {
  return JSON.stringify(tweet, null, 2);
}

function formatTweets(tweets: unknown[]): string {
  return JSON.stringify(tweets, null, 2);
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(error: string | ApiError) {
  const message = typeof error === "string" ? error : error.message;
  return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
}

// Extract tweet ID from URL or return as-is
function extractTweetId(input: string): string {
  if (input.includes("/status/")) {
    const match = input.match(/\/status\/(\d+)/);
    return match?.[1] ?? input;
  }
  return input;
}

// ═══════════════════════════════════════════════════════════════════════════
// READ TOOLS
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  "x_get_tweet",
  "Fetch a single tweet by ID or URL",
  { tweet_id: z.string().describe("Tweet ID or full X/Twitter URL") },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.getTweet(id);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweet(result.tweet));
  }
);

server.tool(
  "x_get_bookmarks",
  "Fetch the authenticated user's bookmarked tweets",
  {
    count: z
      .number()
      .optional()
      .describe("Number of tweets to fetch (default: 20, max: 100)"),
  },
  async ({ count }) => {
    const result = await client.getBookmarksV2(count ?? 20);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_get_likes",
  "Fetch tweets the authenticated user has liked",
  {
    count: z
      .number()
      .optional()
      .describe("Number of tweets to fetch (default: 20)"),
  },
  async ({ count }) => {
    const result = await client.getLikes(count ?? 20);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_get_timeline",
  "Fetch home timeline (For You or Following)",
  {
    type: z
      .enum(["for_you", "following"])
      .optional()
      .describe(
        "Timeline type: for_you (algorithmic) or following (chronological)"
      ),
    count: z
      .number()
      .optional()
      .describe("Number of tweets to fetch (default: 20)"),
  },
  async ({ type, count }) => {
    const result =
      type === "following"
        ? await client.getHomeLatestTimelineV2(count ?? 20)
        : await client.getHomeTimelineV2(count ?? 20);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_search",
  "Search for tweets matching a query",
  {
    query: z.string().describe("Search query (supports X search operators)"),
    count: z
      .number()
      .optional()
      .describe("Number of results to fetch (default: 20)"),
  },
  async ({ query, count }) => {
    const result = await client.search(query, count ?? 20);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_get_user",
  "Get a user's profile by username",
  {
    username: z.string().describe("Username (without @ prefix)"),
  },
  async ({ username }) => {
    // Remove @ if present
    const handle = username.startsWith("@") ? username.slice(1) : username;
    const result = await client.getUserByScreenName(handle);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(JSON.stringify(result.user, null, 2));
  }
);

server.tool(
  "x_get_user_tweets",
  "Get tweets from a specific user",
  {
    user_id: z.string().describe("User ID (numeric)"),
    count: z
      .number()
      .optional()
      .describe("Number of tweets to fetch (default: 20)"),
  },
  async ({ user_id, count }) => {
    const result = await client.getUserTweets(user_id, count ?? 20);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_get_replies",
  "Get replies to a specific tweet",
  {
    tweet_id: z.string().describe("Tweet ID to get replies for"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.getReplies(id);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

server.tool(
  "x_get_thread",
  "Get the full conversation thread for a tweet",
  {
    tweet_id: z.string().describe("Tweet ID to get thread for"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.getThread(id);

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(formatTweets(result.tweets ?? []));
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  "x_like",
  "Like a tweet",
  {
    tweet_id: z.string().describe("Tweet ID or URL to like"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.likeTweet(id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Liked successfully");
  }
);

server.tool(
  "x_unlike",
  "Unlike a tweet",
  {
    tweet_id: z.string().describe("Tweet ID or URL to unlike"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.unlikeTweet(id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Unliked successfully");
  }
);

server.tool(
  "x_bookmark",
  "Bookmark a tweet",
  {
    tweet_id: z.string().describe("Tweet ID or URL to bookmark"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.createBookmark(id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Bookmarked successfully");
  }
);

server.tool(
  "x_unbookmark",
  "Remove a bookmark from a tweet",
  {
    tweet_id: z.string().describe("Tweet ID or URL to unbookmark"),
  },
  async ({ tweet_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.deleteBookmark(id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Bookmark removed successfully");
  }
);

server.tool(
  "x_tweet",
  "Post a new tweet",
  {
    text: z.string().describe("Tweet text (max 280 characters)"),
  },
  async ({ text }) => {
    const result = await client.tweet(text);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult(`Tweet posted: https://x.com/i/status/${result.tweetId}`);
  }
);

server.tool(
  "x_reply",
  "Reply to a tweet",
  {
    tweet_id: z.string().describe("Tweet ID or URL to reply to"),
    text: z.string().describe("Reply text (max 280 characters)"),
  },
  async ({ tweet_id, text }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.reply(id, text);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult(`Reply posted: https://x.com/i/status/${result.tweetId}`);
  }
);

server.tool(
  "x_follow",
  "Follow a user",
  {
    user_id: z.string().describe("User ID (numeric) to follow"),
  },
  async ({ user_id }) => {
    const result = await client.followUser(user_id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Followed successfully");
  }
);

server.tool(
  "x_unfollow",
  "Unfollow a user",
  {
    user_id: z.string().describe("User ID (numeric) to unfollow"),
  },
  async ({ user_id }) => {
    const result = await client.unfollowUser(user_id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Unfollowed successfully");
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// BOOKMARK FOLDER TOOLS
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  "x_get_bookmark_folders",
  "Get list of bookmark folders",
  {},
  async () => {
    const result = await client.getBookmarkFolders();

    if (!result.success) {
      return errorResult(result.error ?? "Unknown error");
    }

    return textResult(JSON.stringify(result.folders, null, 2));
  }
);

server.tool(
  "x_move_to_folder",
  "Move a bookmark to a specific folder",
  {
    tweet_id: z.string().describe("Tweet ID to move"),
    folder_id: z.string().describe("Folder ID to move to"),
  },
  async ({ tweet_id, folder_id }) => {
    const id = extractTweetId(tweet_id);
    const result = await client.moveBookmarkToFolder(id, folder_id);

    if (!result.success) {
      return errorResult(result.error);
    }

    return textResult("Moved to folder successfully");
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
