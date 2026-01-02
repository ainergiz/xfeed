#!/usr/bin/env bun
/**
 * Manual test script for the Twitter API client
 * Run with: bun scripts/test-api.ts
 *
 * This will:
 * 1. Extract cookies from your browser (Safari/Chrome/Firefox)
 * 2. Create a TwitterClient
 * 3. Test basic API calls
 */

import { TwitterClient } from "../src/api/client";
import { resolveCredentials } from "../src/auth/cookies";

async function main() {
  console.log("🔐 Resolving Twitter credentials from browser...\n");

  const { cookies, warnings } = await resolveCredentials({});

  if (warnings.length > 0) {
    console.log("⚠️  Warnings:");
    for (const warning of warnings) {
      console.log(`   - ${warning}`);
    }
    console.log();
  }

  if (!cookies.authToken || !cookies.ct0) {
    console.error("❌ Failed to get credentials. Make sure you're logged into x.com in Safari/Chrome/Firefox.");
    process.exit(1);
  }

  console.log(`✅ Got credentials from: ${cookies.source}\n`);

  const client = new TwitterClient({ cookies });

  // Test 1: Get current user
  console.log("📋 Test 1: getCurrentUser()");
  const userResult = await client.getCurrentUser();
  if (userResult.success) {
    console.log(`   ✅ Logged in as: @${userResult.user?.username} (${userResult.user?.name})`);
    console.log(`   User ID: ${userResult.user?.id}\n`);
  } else {
    console.log(`   ❌ Failed: ${userResult.error}\n`);
  }

  // Test 2: Get home timeline (latest)
  console.log("📋 Test 2: getHomeLatestTimeline(5)");
  const timelineResult = await client.getHomeLatestTimeline(5);
  if (timelineResult.success && timelineResult.tweets) {
    console.log(`   ✅ Got ${timelineResult.tweets.length} tweets from timeline:`);
    for (const tweet of timelineResult.tweets.slice(0, 3)) {
      const preview = tweet.text.slice(0, 60).replace(/\n/g, " ");
      console.log(`   - @${tweet.author.username}: ${preview}...`);
    }
    console.log();
  } else {
    console.log(`   ❌ Failed: ${timelineResult.error}\n`);
  }

  // Test 3: Get bookmarks
  console.log("📋 Test 3: getBookmarks(5)");
  const bookmarksResult = await client.getBookmarks(5);
  if (bookmarksResult.success && bookmarksResult.tweets) {
    console.log(`   ✅ Got ${bookmarksResult.tweets.length} bookmarked tweets`);
    for (const tweet of bookmarksResult.tweets.slice(0, 2)) {
      const preview = tweet.text.slice(0, 60).replace(/\n/g, " ");
      console.log(`   - @${tweet.author.username}: ${preview}...`);
    }
    console.log();
  } else {
    console.log(`   ❌ Failed: ${bookmarksResult.error}\n`);
  }

  // Test 4: Search
  console.log("📋 Test 4: search('typescript', 3)");
  const searchResult = await client.search("typescript", 3);
  if (searchResult.success && searchResult.tweets) {
    console.log(`   ✅ Found ${searchResult.tweets.length} tweets:`);
    for (const tweet of searchResult.tweets.slice(0, 2)) {
      const preview = tweet.text.slice(0, 60).replace(/\n/g, " ");
      console.log(`   - @${tweet.author.username}: ${preview}...`);
    }
    console.log();
  } else {
    console.log(`   ❌ Failed: ${searchResult.error}\n`);
  }

  console.log("✨ API tests complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
