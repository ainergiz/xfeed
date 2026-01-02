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
}

/**
 * Internal GraphQL tweet result structure from Twitter API responses
 */
export interface GraphqlTweetResult {
  rest_id?: string;
  legacy?: {
    full_text?: string;
    created_at?: string;
    reply_count?: number;
    retweet_count?: number;
    favorite_count?: number;
    conversation_id_str?: string;
    in_reply_to_status_id_str?: string | null;
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
  | "HomeLatestTimeline";
