/**
 * X API types for xfeed
 * Consolidated from bird reference implementation
 */

import type { XCookies } from "@/auth/cookies";

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
 * @mention entity from tweet text
 */
export interface MentionEntity {
  /** @username as it appears in text */
  username: string;
  /** User ID from the API */
  userId?: string;
  /** Display name of the mentioned user */
  name?: string;
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
  /** @mention entities parsed from tweet text */
  mentions?: MentionEntity[];
  /** Whether the tweet is liked by the current user */
  favorited?: boolean;
  /** Whether the tweet is bookmarked by the current user */
  bookmarked?: boolean;
  /** First nested reply preview (display-only, not navigable) */
  nestedReplyPreview?: TweetData;
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
  /** Pagination cursor for loading more results (e.g., replies) */
  nextCursor?: string;
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
  /** Profile photo URL */
  profileImageUrl?: string;
  /** Banner/header image URL */
  bannerImageUrl?: string;
  /** User's location string */
  location?: string;
  /** User's website URL (expanded) */
  websiteUrl?: string;
  /** Account creation date (ISO string) */
  createdAt?: string;
  /** Whether the authenticated user follows this user */
  following?: boolean;
  /** Whether the authenticated user has muted this user */
  muting?: boolean;
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
 * Options for creating an XClient instance
 */
export interface XClientOptions {
  cookies: XCookies;
  userAgent?: string;
  timeoutMs?: number;
  /** Max depth for quoted tweets (0 disables, default: 1) */
  quoteDepth?: number;
  /** Callback when session expires (401/403 errors) */
  onSessionExpired?: () => void;
}

/**
 * Internal GraphQL tweet result structure from X API responses
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
    favorited?: boolean;
    bookmarked?: boolean;
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
      user_mentions?: Array<{
        screen_name: string;
        name: string;
        id_str?: string;
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
  | "UnfavoriteTweet"
  | "CreateBookmark"
  | "DeleteBookmark"
  | "TweetDetail"
  | "SearchTimeline"
  | "UserArticlesTweets"
  | "Bookmarks"
  | "BookmarkFolderTimeline"
  | "HomeTimeline"
  | "HomeLatestTimeline"
  | "UserByScreenName"
  | "UserTweets"
  | "Likes"
  | "BookmarkFoldersSlice"
  | "bookmarkTweetToFolder"
  | "NotificationsTimeline"
  | "createBookmarkFolder"
  | "DeleteBookmarkFolder"
  | "EditBookmarkFolder";

/**
 * Result of an action mutation (like, bookmark, etc.)
 */
export type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Bookmark folder data structure
 */
export interface BookmarkFolder {
  /** Folder ID (bookmark_collection_id) */
  id: string;
  /** Folder display name */
  name: string;
}

/**
 * Result of fetching bookmark folders
 */
export type BookmarkFoldersResult =
  | { success: true; folders: BookmarkFolder[] }
  | { success: false; error: string };

/**
 * Result of a bookmark folder mutation (create, edit)
 */
export type BookmarkFolderMutationResult =
  | { success: true; folder: BookmarkFolder }
  | { success: false; error: string };

/**
 * API error types for different failure modes
 */
export type ApiErrorType =
  | "rate_limit"
  | "auth_expired"
  | "network_error"
  | "not_found"
  | "unavailable"
  | "unknown";

/**
 * Structured API error with type discrimination
 */
export interface ApiError {
  /** Error type for programmatic handling */
  type: ApiErrorType;
  /** Human-readable error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Rate limit reset time (Unix timestamp) for rate_limit errors */
  rateLimitReset?: number;
  /** Retry-After header value in seconds */
  retryAfter?: number;
}

/**
 * Timeline result with typed errors
 */
export type TimelineResultV2 =
  | { success: true; tweets: TweetData[]; nextCursor?: string }
  | { success: false; error: ApiError };

/**
 * Generic fetch result with typed errors
 */
export type FetchResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/**
 * User-friendly error messages for each error type
 */
export const API_ERROR_MESSAGES: Record<ApiErrorType, string> = {
  rate_limit: "Rate limited by X. Please wait before trying again.",
  auth_expired: "Session expired. Please log into x.com and restart xfeed.",
  network_error: "Network error. Check your connection and try again.",
  not_found: "Content not found or has been deleted.",
  unavailable: "This content is temporarily unavailable.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Check if an error type is retryable
 */
export function isRetryableError(errorType: ApiErrorType): boolean {
  return errorType === "network_error" || errorType === "rate_limit";
}

/**
 * Check if an error indicates auth issues requiring re-login
 */
export function isAuthError(errorType: ApiErrorType): boolean {
  return errorType === "auth_expired";
}

/**
 * Notification icon types from X API
 */
export type NotificationIcon =
  | "heart_icon"
  | "person_icon"
  | "bird_icon"
  | "retweet_icon"
  | "reply_icon";

/**
 * Notification data structure
 */
export interface NotificationData {
  /** Unique notification ID */
  id: string;
  /** Icon type indicating notification category */
  icon: NotificationIcon;
  /** Human-readable notification message */
  message: string;
  /** URL to navigate to when clicked */
  url: string;
  /** ISO timestamp of the notification */
  timestamp: string;
  /** Sort index for ordering and unread calculation */
  sortIndex: string;
  /** Associated tweet (for likes, retweets, replies) */
  targetTweet?: TweetData;
  /** Users who performed the action */
  fromUsers?: UserData[];
}

/**
 * Result of fetching notifications
 */
export type NotificationsResult =
  | {
      success: true;
      notifications: NotificationData[];
      unreadSortIndex?: string;
      topCursor?: string;
      bottomCursor?: string;
    }
  | { success: false; error: ApiError };

/**
 * Internal notification timeline instruction types from X API
 */
export interface NotificationInstruction {
  type: string;
  sort_index?: string;
  entries?: Array<{
    entryId?: string;
    sortIndex?: string;
    content?: {
      cursorType?: string;
      value?: string;
      itemContent?: {
        itemType?: string;
        id?: string;
        notification_icon?: string;
        rich_message?: {
          text?: string;
        };
        notification_url?: {
          url?: string;
        };
        template?: {
          target_objects?: Array<{
            tweet_results?: {
              result?: GraphqlTweetResult;
            };
          }>;
          from_users?: Array<{
            user_results?: {
              result?: {
                rest_id?: string;
                core?: {
                  screen_name?: string;
                  name?: string;
                };
                legacy?: {
                  screen_name?: string;
                  name?: string;
                };
              };
            };
          }>;
        };
        timestamp_ms?: string;
      };
    };
  }>;
}
