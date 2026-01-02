# Twitter GraphQL API Response Structure

> **Note**: Twitter's GraphQL API is undocumented and unofficial. This documentation is based on reverse-engineering from the [steipete/bird](https://github.com/steipete/bird) project and observing real API responses.

## Overview

Twitter's web client uses an internal GraphQL API at `https://x.com/i/api/graphql/{queryId}/{operationName}`. Query IDs rotate periodically, requiring runtime refresh logic.

## Tweet Response Structure

When fetching tweets (timeline, search, tweet detail), the response contains nested `GraphqlTweetResult` objects:

```typescript
interface GraphqlTweetResult {
  __typename?: string;           // "Tweet" or "TweetWithVisibilityResults"
  rest_id?: string;              // Tweet ID

  legacy?: {
    full_text?: string;          // Tweet text (up to 280 chars)
    created_at?: string;         // "Wed Oct 10 20:19:24 +0000 2018"
    reply_count?: number;
    retweet_count?: number;
    favorite_count?: number;     // Like count
    quote_count?: number;        // NOT EXTRACTED
    bookmark_count?: number;     // NOT EXTRACTED
    conversation_id_str?: string;
    in_reply_to_status_id_str?: string | null;

    // User interaction state (NOT EXTRACTED)
    favorited?: boolean;         // Is liked by current user
    bookmarked?: boolean;        // Is bookmarked by current user
    retweeted?: boolean;         // Is retweeted by current user

    // Media (NOT EXTRACTED)
    extended_entities?: {
      media?: Array<{
        type: "photo" | "video" | "animated_gif";
        media_url_https: string;
        video_info?: {
          variants: Array<{
            bitrate?: number;
            content_type: string;
            url: string;
          }>;
        };
      }>;
    };

    // Entities (NOT EXTRACTED)
    entities?: {
      urls?: Array<{ expanded_url: string; display_url: string }>;
      user_mentions?: Array<{ screen_name: string }>;
      hashtags?: Array<{ text: string }>;
    };
  };

  core?: {
    user_results?: {
      result?: {
        __typename?: string;     // "User"
        rest_id?: string;        // User ID
        legacy?: {
          screen_name?: string;  // @handle
          name?: string;         // Display name
          profile_image_url_https?: string;  // NOT EXTRACTED
          verified?: boolean;    // NOT EXTRACTED
        };
        is_blue_verified?: boolean;  // NOT EXTRACTED
      };
    };
  };

  // Long tweets (> 280 chars)
  note_tweet?: {
    note_tweet_results?: {
      result?: {
        text?: string;
        richtext?: { text?: string };
      };
    };
  };

  // Articles (long-form content)
  article?: {
    article_results?: {
      result?: {
        title?: string;
        plain_text?: string;
      };
    };
  };

  // Quoted tweet - SAME STRUCTURE, recursively nested
  quoted_status_result?: {
    result?: GraphqlTweetResult;
  };

  // Visibility wrapper (some tweets wrapped in this)
  tweet?: GraphqlTweetResult;

  // View count (NOT EXTRACTED)
  views?: {
    count?: string;  // Note: string, not number
  };
}
```

## What We Extract

Currently extracted into `TweetData`:

| Field | Source | Extracted |
|-------|--------|-----------|
| `id` | `rest_id` | Yes |
| `text` | `legacy.full_text` / `note_tweet` / `article` | Yes |
| `createdAt` | `legacy.created_at` | Yes |
| `replyCount` | `legacy.reply_count` | Yes |
| `retweetCount` | `legacy.retweet_count` | Yes |
| `likeCount` | `legacy.favorite_count` | Yes |
| `conversationId` | `legacy.conversation_id_str` | Yes |
| `inReplyToStatusId` | `legacy.in_reply_to_status_id_str` | Yes |
| `author.username` | `core.user_results.result.legacy.screen_name` | Yes |
| `author.name` | `core.user_results.result.legacy.name` | Yes |
| `authorId` | `core.user_results.result.rest_id` | Yes |
| `quotedTweet` | `quoted_status_result.result` (recursive) | Yes |

## Not Yet Extracted

Could be added in future:

- `views.count` - View count
- `legacy.quote_count` - Quote count
- `legacy.bookmark_count` - Bookmark count
- `legacy.favorited` / `bookmarked` / `retweeted` - User interaction state
- `legacy.extended_entities.media` - Photos, videos, GIFs
- `legacy.entities` - URLs, mentions, hashtags
- `core.user_results.result.legacy.profile_image_url_https` - Avatar
- `core.user_results.result.is_blue_verified` - Verification status

## Quoted Tweets

Quoted tweets are nested inline in `quoted_status_result.result`. No additional API call is needed - the data comes in the same response as the parent tweet.

The `quoteDepth` option controls parsing depth:
- `0` - Don't parse quoted tweets
- `1` - Parse one level (default)
- `2+` - Parse nested quotes (quote of a quote)

### Visibility Wrapper

Sometimes Twitter wraps tweets in a visibility container:

```json
{
  "quoted_status_result": {
    "result": {
      "__typename": "TweetWithVisibilityResults",
      "tweet": { /* actual tweet data */ }
    }
  }
}
```

The `unwrapTweetResult()` function handles this by checking for the `tweet` field.

## Timeline Response Structure

Timeline endpoints (`HomeTimeline`, `HomeLatestTimeline`) return:

```typescript
{
  data: {
    home: {
      home_timeline_urt: {
        instructions: Array<{
          entries?: Array<{
            entryId: string;
            content: {
              // Tweet entry
              itemContent?: {
                tweet_results: {
                  result: GraphqlTweetResult;
                };
              };
              // OR cursor entry
              cursorType?: "Top" | "Bottom";
              value?: string;  // Pagination cursor
            };
          }>;
        }>;
      };
    };
  };
}
```

## References

- [steipete/bird](https://github.com/steipete/bird) - Reference implementation
- [fa0311/TwitterInternalAPIDocument](https://github.com/fa0311/TwitterInternalAPIDocument) - Community API docs
- Browser DevTools → Network tab → filter "graphql" for live inspection
