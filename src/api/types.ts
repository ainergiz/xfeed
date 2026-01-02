/**
 * Twitter API types for xfeed
 * Consolidated from bird reference implementation
 */

import type { TwitterCookies } from "@/auth/cookies";

/**
 * Result of a tweet creation operation
 */
export type TweetResult =
  | { success: true; tweetId: string }
  | { success: false; error: string };

/**
 * Result of a media upload operation
 */
export interface UploadMediaResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Author information for a tweet
 */
export interface TweetAuthor {
  username: string;
  name: string;
}

/**
 * Media item attached to a tweet (photo, video, or animated GIF)
 */
export interface MediaItem {
  /** Unique media ID */
  id: string;
  /** Media type: photo, video, or animated_gif */
  type: "photo" | "video" | "animated_gif";
  /** Direct URL to the media (for photos, this is the display URL) */
  url: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Video variants (only for video/animated_gif types) */
  videoVariants?: VideoVariant[];
}

/**
 * Video variant with quality/format information
 */
export interface VideoVariant {
  /** Bitrate in bits per second (higher = better quality) */
  bitrate?: number;
  /** MIME type (e.g., "video/mp4", "application/x-mpegURL") */
  contentType: string;
  /** Direct URL to the video variant */
  url: string;
}

/**
 * URL entity from tweet text
 */
export interface UrlEntity {
  /** Shortened t.co URL as it appears in tweet text */
  url: string;
  /** Full expanded URL */
  expandedUrl: string;
  /** Display-friendly URL (truncated, no protocol) */
  displayUrl: string;
  /** Character indices in tweet text [start, end] */
  indices: [number, number];
}

/**
 * Core tweet data structure
 */
export interface TweetData {
  id: string;
  text: string;
  author: TweetAuthor;
  authorId?: string;
  createdAt?: string;
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
  conversationId?: string;
  inReplyToStatusId?: string;
  /** Quoted tweet data (recursive, depth controlled by quoteDepth option) */
  quotedTweet?: TweetData;
  /** Media attachments (photos, videos, GIFs) */
  media?: MediaItem[];
  /** URL entities parsed from tweet text */
  urls?: UrlEntity[];
}

/**
 * Result of fetching a single tweet
 */
export interface GetTweetResult {
  success: boolean;
  tweet?: TweetData;
  error?: string;
}

/**
 * Result of a search or timeline fetch operation
 */
export interface SearchResult {
  success: boolean;
  tweets?: TweetData[];
  error?: string;
}

/**
 * Result of a timeline fetch with pagination support
 */
export type TimelineResult =
  | { success: true; tweets: TweetData[]; nextCursor?: string }
  | { success: false; error: string };

/**
 * User information
 */
export interface UserData {
  id: string;
  username: string;
  name: string;
}

/**
 * Extended user profile data with bio and stats
 */
export interface UserProfileData {
  id: string;
  username: string;
  name: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
  isBlueVerified?: boolean;
}

/**
 * Result of fetching a user profile
 */
export interface UserProfileResult {
  success: boolean;
  user?: UserProfileData;
  error?: string;
}

/**
 * Result of fetching user tweets
 */
export interface UserTweetsResult {
  success: boolean;
  tweets?: TweetData[];
  error?: string;
}

/**
 * Result of fetching current user information
 */
export interface CurrentUserResult {
  success: boolean;
  user?: UserData;
  error?: string;
}

/**
 * Options for creating a TwitterClient instance
 */
export interface TwitterClientOptions {
  cookies: TwitterCookies;
  userAgent?: string;
  timeoutMs?: number;
  /** Max depth for quoted tweets (0 disables, default: 1) */
  quoteDepth?: number;
}

/**
 * Internal GraphQL tweet result structure from Twitter API responses
 */
export interface GraphqlTweetResult {
  __typename?: string;
  rest_id?: string;
  legacy?: {
    full_text?: string;
    created_at?: string;
    reply_count?: number;
    retweet_count?: number;
    favorite_count?: number;
    conversation_id_str?: string;
    in_reply_to_status_id_str?: string | null;
    entities?: {
      urls?: Array<{
        url: string;
        expanded_url: string;
        display_url: string;
        indices: [number, number];
      }>;
      media?: Array<{
        url: string;
        indices: [number, number];
      }>;
    };
    extended_entities?: {
      media?: Array<{
        id_str?: string;
        type: "photo" | "video" | "animated_gif";
        media_url_https: string;
        original_info?: {
          width?: number;
          height?: number;
        };
        video_info?: {
          variants: Array<{
            bitrate?: number;
            content_type: string;
            url: string;
          }>;
        };
      }>;
    };
  };
  core?: {
    user_results?: {
      result?: {
        rest_id?: string;
        id?: string;
        legacy?: {
          screen_name?: string;
          name?: string;
        };
        core?: {
          screen_name?: string;
          name?: string;
        };
      };
    };
  };
  note_tweet?: {
    note_tweet_results?: {
      result?: {
        text?: string;
        richtext?: { text?: string };
        rich_text?: { text?: string };
        content?: {
          text?: string;
          richtext?: { text?: string };
          rich_text?: { text?: string };
        };
      };
    };
  };
  article?: ArticleData;
  /** Quoted tweet data - same structure, recursively nested */
  quoted_status_result?: {
    result?: GraphqlTweetResult;
  };
  /** Visibility wrapper - tweet may be nested here instead of at top level */
  tweet?: GraphqlTweetResult;
}

/**
 * Article content structure (for long-form tweets/articles)
 */
export interface ArticleData {
  article_results?: {
    result?: ArticleResult;
  };
  title?: string;
  plain_text?: string;
  text?: string;
  richtext?: { text?: string };
  rich_text?: { text?: string };
  body?: TextContent;
  content?: ContentWithItems;
  sections?: Array<{ items?: ContentItem[] }>;
}

interface TextContent {
  text?: string;
  richtext?: { text?: string };
  rich_text?: { text?: string };
}

interface ContentItem {
  text?: string;
  content?: TextContent;
}

interface ContentWithItems extends TextContent {
  items?: ContentItem[];
}

interface ArticleResult {
  title?: string;
  plain_text?: string;
  text?: string;
  richtext?: { text?: string };
  rich_text?: { text?: string };
  body?: TextContent;
  content?: ContentWithItems;
  sections?: Array<{ items?: ContentItem[] }>;
}

/**
 * Internal response structure for tweet creation
 */
export interface CreateTweetResponse {
  data?: {
    create_tweet?: {
      tweet_results?: {
        result?: {
          rest_id?: string;
          legacy?: {
            full_text?: string;
          };
        };
      };
    };
  };
  errors?: Array<{ message: string; code?: number }>;
}

/**
 * GraphQL operation names that use rotating query IDs
 */
export type OperationName =
  | "CreateTweet"
  | "CreateRetweet"
  | "FavoriteTweet"
  | "TweetDetail"
  | "SearchTimeline"
  | "UserArticlesTweets"
  | "Bookmarks"
  | "HomeTimeline"
  | "HomeLatestTimeline"
  | "UserByScreenName"
  | "UserTweets";
