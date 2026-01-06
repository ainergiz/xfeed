---
name: x-api-debug
description: Debug X (Twitter) API issues including stale queryIds, feature mismatches, and partial errors. Use when timeline/bookmarks/replies fail with "Query: Unspecified", "features cannot be null", or HTTP 400 errors.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, mcp__claude-in-chrome__*
---

# X API Debugger

Debug X (Twitter) GraphQL API issues for xfeed.

## Prerequisites

For live API debugging with browser network capture, run:

```bash
claude --chrome
```

This enables browser automation to capture real X API calls from the web UI. If the Chrome extension isn't installed, follow the prompts to install it.

## Common Issues & Solutions

### 1. "Query: Unspecified" Error

This error usually means one of:

1. **Stale queryIds** - X rotates GraphQL query IDs frequently
2. **Feature mismatch** - Required features missing or wrong values
3. **Partial errors** - API returns errors alongside valid data (not a real failure)

### 2. "features cannot be null" Error (HTTP 400)

X periodically adds **required** feature flags. If missing, you get:
```
{"errors":[{"message":"The following features cannot be null: feature_name_here"...}]}
```

**Fix:** Add the missing feature to the appropriate `build*Features()` method in `src/api/client.ts`.

Common culprits:
- `responsive_web_grok_annotations_enabled` - Required for TweetDetail (added Jan 2026)
- `responsive_web_grok_analyze_button_fetch_trends_enabled`
- `responsive_web_grok_share_attachment_enabled`

### 3. Debugging Steps

#### Step 1: Check if it's a partial error

X's API can return `errors` AND `data` simultaneously. Test with curl:

```bash
# Get tokens from xfeed config
cat ~/.config/xfeed/config.json

# Make direct API call and check for data
curl -s 'https://x.com/i/api/graphql/QUERY_ID/HomeTimeline?...' \
  -H 'authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA' \
  -H 'cookie: auth_token=TOKEN; ct0=CT0' \
  -H 'x-csrf-token: CT0' \
  | jq '.data.home.home_timeline_urt.instructions[0].entries | length'
```

If entries > 0, it's a partial error - the client should handle it gracefully.

#### Step 2: Capture live queryIds from X web UI

With `claude --chrome` active:

1. Navigate to x.com/home
2. Wait for page load
3. Capture network requests:
   ```
   Use mcp__claude-in-chrome__read_network_requests with urlPattern="HomeTimeline"
   ```
4. Extract queryId from URL: `graphql/{QUERY_ID}/HomeTimeline`

#### Step 3: Compare features

Decode the `features` parameter from captured URL and compare with client's `buildSearchFeatures()` / `buildTimelineFeatures()` in `src/api/client.ts`.

Key features that often change:
- `rweb_video_screen_enabled`
- `responsive_web_profile_redirect_enabled`
- `responsive_web_graphql_exclude_directive_enabled`
- `responsive_web_grok_*` features

### 4. Updating QueryIds

Files to update when queryIds change:

| File | Purpose |
|------|---------|
| `~/.config/xfeed/query-ids-cache.json` | Runtime disk cache (user-specific) |
| `src/api/query-ids.json` | Fallback IDs (git tracked) |
| `src/api/query-ids.ts` | FALLBACK_QUERY_IDS constant |
| `src/api/client.ts` | Method fallbacks (getHomeTimelineQueryIds, etc.) |

### 5. Endpoint-Specific Notes

| Endpoint | Notes |
|----------|-------|
| HomeTimeline | For You feed |
| HomeLatestTimeline | Following feed |
| Bookmarks | REQUIRES `responsive_web_graphql_exclude_directive_enabled: true` |
| TweetDetail | Thread view, replies. REQUIRES `responsive_web_grok_annotations_enabled: false` |
| UserTweets | Profile tweets |

## Testing API Calls Directly

```bash
# Read tokens
AUTH=$(jq -r '.authToken' ~/.config/xfeed/config.json)
CT0=$(jq -r '.ct0' ~/.config/xfeed/config.json)

# Test HomeTimeline
curl -s "https://x.com/i/api/graphql/edseUwk9sP5Phz__9TIRnA/HomeTimeline?variables=%7B%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22requestContext%22%3A%22launch%22%2C%22withCommunity%22%3Atrue%7D&features=%7B%22rweb_video_screen_enabled%22%3Afalse%7D" \
  -H "authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA" \
  -H "cookie: auth_token=$AUTH; ct0=$CT0" \
  -H "x-csrf-token: $CT0" \
  -H "x-twitter-active-user: yes" \
  -H "x-twitter-auth-type: OAuth2Session" \
  | jq '.errors, .data.home.home_timeline_urt.instructions[0].entries | length'
```

## Error Handling Pattern

X API can return partial errors. The client should:

```typescript
// WRONG: Fail on any error
if (data.errors && data.errors.length > 0) {
  return { success: false, error: ... };
}

// RIGHT: Only fail if no usable data
const instructions = data.data?.home?.home_timeline_urt?.instructions;
if (data.errors && data.errors.length > 0 && !instructions?.length) {
  return { success: false, error: ... };
}
```

## Runtime Query ID Discovery

The client attempts to discover fresh queryIds by scraping X's client bundles:

1. Fetches pages like `x.com/?lang=en`, `x.com/explore`
2. Extracts bundle URLs matching `abs.twimg.com/responsive-web/client-web/*.js`
3. Searches bundles for `queryId`/`operationName` patterns
4. Caches results to `~/.config/xfeed/query-ids-cache.json` (24h TTL)

If discovery fails, falls back to hardcoded IDs in `query-ids.ts`.

## Quick Debug Script

For rapid API testing, create a temporary debug script:

```typescript
// debug-api.ts - run with: bun debug-api.ts <tweet_id>
import { XClient } from "./src/api/client";
import { loadConfig } from "./src/config/loader";

const config = loadConfig();
const client = new XClient({
  cookies: { authToken: config.authToken!, ct0: config.ct0! },
});

// Access private method for raw response
const fetchTweetDetail = (client as any).fetchTweetDetail.bind(client);
const response = await fetchTweetDetail(process.argv[2]);

if (!response.success) {
  console.error("Error:", response.error);
  // Look for "features cannot be null" in error message
  process.exit(1);
}

const instructions = response.data.threaded_conversation_with_injections_v2?.instructions;
console.log("Instructions:", instructions?.length);
console.log("Entry types:", instructions?.[1]?.entries?.map((e: any) => e.entryId?.split("-")[0]));
```

## Workflow: Full Debug Session

1. User reports "Query: Unspecified" or timeline not loading
2. Run `claude --chrome` if not already active
3. Navigate browser to x.com/home
4. Capture network requests for the failing endpoint
5. Extract current queryId and features from URL
6. Compare with client's queryIds and features
7. Update stale values in:
   - `~/.config/xfeed/query-ids-cache.json` (for immediate fix)
   - `src/api/query-ids.json` (for git-tracked fix)
   - `src/api/client.ts` (if method fallbacks need updating)
8. Check error handling for partial errors
9. Test with `bun run start`
10. Run `bun run test` to ensure no regressions

## Historical Fixes

Track feature flag changes to identify patterns:

| Date | Endpoint | Feature Added | Notes |
|------|----------|---------------|-------|
| 2026-01-06 | TweetDetail | `responsive_web_grok_annotations_enabled: false` | Required for replies to load |
| 2026-01-04 | SearchTimeline | Various grok features | Updated to match X web UI |
