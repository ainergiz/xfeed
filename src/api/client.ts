/**
 * Twitter GraphQL API client for xfeed
 * Adapted from bird reference implementation
 */

import { randomBytes, randomUUID } from "node:crypto";
import { ClientTransaction, handleXMigration } from "x-client-transaction-id";

import type {
  ActionResult,
  CreateTweetResponse,
  CurrentUserResult,
  GetTweetResult,
  GraphqlTweetResult,
  MediaItem,
  OperationName,
  SearchResult,
  TimelineResult,
  TweetData,
  TweetResult,
  TwitterClientOptions,
  UploadMediaResult,
  UrlEntity,
} from "./types";

import {
  QUERY_IDS,
  runtimeQueryIds,
  TARGET_QUERY_ID_OPERATIONS,
} from "./query-ids";

const TWITTER_API_BASE = "https://x.com/i/api/graphql";
const TWITTER_GRAPHQL_POST_URL = "https://x.com/i/api/graphql";
const TWITTER_UPLOAD_URL = "https://upload.twitter.com/i/media/upload.json";
const TWITTER_MEDIA_METADATA_URL =
  "https://x.com/i/api/1.1/media/metadata/create.json";
const TWITTER_STATUS_UPDATE_URL =
  "https://x.com/i/api/1.1/statuses/update.json";
const SETTINGS_SCREEN_NAME_REGEX = /"screen_name":"([^"]+)"/;
const SETTINGS_USER_ID_REGEX = /"user_id"\s*:\s*"(\d+)"/;
const SETTINGS_NAME_REGEX = /"name":"([^"\\]*(?:\\.[^"\\]*)*)"/;

export class TwitterClient {
  private authToken: string;
  private ct0: string;
  private cookieHeader: string;
  private userAgent: string;
  private timeoutMs?: number;
  private quoteDepth: number;
  private clientUuid: string;
  private clientDeviceId: string;
  private clientUserId?: string;
  private clientTransaction?: ClientTransaction;
  private transactionInitPromise?: Promise<void>;

  constructor(options: TwitterClientOptions) {
    if (!options.cookies.authToken || !options.cookies.ct0) {
      throw new Error("Both authToken and ct0 cookies are required");
    }
    this.authToken = options.cookies.authToken;
    this.ct0 = options.cookies.ct0;
    this.cookieHeader =
      options.cookies.cookieHeader ||
      `auth_token=${this.authToken}; ct0=${this.ct0}`;
    this.userAgent =
      options.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    this.timeoutMs = options.timeoutMs;
    this.quoteDepth = this.normalizeQuoteDepth(options.quoteDepth);
    this.clientUuid = randomUUID();
    this.clientDeviceId = randomUUID();
  }

  private normalizeQuoteDepth(value?: number): number {
    if (value === undefined || value === null) {
      return 1; // Default to 1 level of quoted tweets
    }
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.max(0, Math.floor(value));
  }

  private async getQueryId(operationName: OperationName): Promise<string> {
    const cached = await runtimeQueryIds.getQueryId(operationName);
    return cached ?? QUERY_IDS[operationName];
  }

  private async refreshQueryIds(): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    try {
      await runtimeQueryIds.refresh(TARGET_QUERY_ID_OPERATIONS, {
        force: true,
      });
    } catch {
      // ignore refresh failures; callers will fall back to baked-in IDs
    }
  }

  private async getTweetDetailQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("TweetDetail");
    return Array.from(
      new Set([primary, "97JF30KziU00483E_8elBA", "aFvUsJm2c-oDkJV75blV6g"])
    );
  }

  private async getSearchTimelineQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("SearchTimeline");
    return Array.from(
      new Set([
        primary,
        "M1jEez78PEfVfbQLvlWMvQ",
        "5h0kNbk3ii97rmfY6CdgAA",
        "Tp1sewRU1AsZpBWhqCZicQ",
      ])
    );
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    if (!this.timeoutMs || this.timeoutMs <= 0) {
      return fetch(url, init);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private findTweetInInstructions(
    instructions:
      | Array<{
          entries?: Array<{
            content?: {
              itemContent?: {
                tweet_results?: {
                  result?: GraphqlTweetResult;
                };
              };
            };
          }>;
        }>
      | undefined,
    tweetId: string
  ) {
    if (!instructions) {
      return undefined;
    }

    for (const instruction of instructions) {
      for (const entry of instruction.entries || []) {
        const result = entry.content?.itemContent?.tweet_results?.result;
        if (result?.rest_id === tweetId) {
          return result;
        }
      }
    }

    return undefined;
  }

  private getHeaders(): Record<string, string> {
    return this.getJsonHeaders();
  }

  /**
   * Ensure ClientTransaction is initialized for generating valid transaction IDs.
   * Uses lazy initialization - only fetches homepage when first needed.
   */
  private async ensureClientTransaction(): Promise<void> {
    if (this.clientTransaction) return;

    if (!this.transactionInitPromise) {
      this.transactionInitPromise = (async () => {
        try {
          const document = await handleXMigration();
          this.clientTransaction = await ClientTransaction.create(document);
        } catch (error) {
          // Log error but don't fail - we'll fall back to random transaction IDs
          console.error(
            "[xfeed] Failed to initialize ClientTransaction:",
            error
          );
        }
      })();
    }

    await this.transactionInitPromise;
  }

  /**
   * Generate a transaction ID for a specific API request.
   * Uses ClientTransaction when available, falls back to random hex.
   */
  private async generateTransactionId(
    method: string,
    path: string
  ): Promise<string> {
    await this.ensureClientTransaction();

    if (this.clientTransaction) {
      try {
        return await this.clientTransaction.generateTransactionId(method, path);
      } catch (error) {
        // Fall back to random on error
        console.error("[xfeed] Failed to generate transaction ID:", error);
      }
    }

    // Fallback to random hex
    return randomBytes(16).toString("hex");
  }

  /**
   * Legacy sync method for backwards compatibility.
   * Used by getBaseHeaders for requests that don't need the special transaction ID.
   */
  private createRandomTransactionId(): string {
    return randomBytes(16).toString("hex");
  }

  private getBaseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization:
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "x-csrf-token": this.ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "x-client-uuid": this.clientUuid,
      "x-twitter-client-deviceid": this.clientDeviceId,
      "x-client-transaction-id": this.createRandomTransactionId(),
      cookie: this.cookieHeader,
      "user-agent": this.userAgent,
      origin: "https://x.com",
      referer: "https://x.com/",
    };

    if (this.clientUserId) {
      headers["x-twitter-client-user-id"] = this.clientUserId;
    }

    return headers;
  }

  private getJsonHeaders(): Record<string, string> {
    return {
      ...this.getBaseHeaders(),
      "content-type": "application/json",
    };
  }

  private getUploadHeaders(): Record<string, string> {
    return this.getBaseHeaders();
  }

  private mediaCategoryForMime(mimeType: string): string | null {
    if (mimeType.startsWith("image/")) {
      if (mimeType === "image/gif") {
        return "tweet_gif";
      }
      return "tweet_image";
    }
    if (mimeType.startsWith("video/")) {
      return "tweet_video";
    }
    return null;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async uploadMedia(input: {
    data: Uint8Array;
    mimeType: string;
    alt?: string;
  }): Promise<UploadMediaResult> {
    const category = this.mediaCategoryForMime(input.mimeType);
    if (!category) {
      return {
        success: false,
        error: `Unsupported media type: ${input.mimeType}`,
      };
    }

    try {
      const initParams = new URLSearchParams({
        command: "INIT",
        total_bytes: String(input.data.byteLength),
        media_type: input.mimeType,
        media_category: category,
      });

      const initResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
        method: "POST",
        headers: this.getUploadHeaders(),
        body: initParams,
      });

      if (!initResp.ok) {
        const text = await initResp.text();
        return {
          success: false,
          error: `HTTP ${initResp.status}: ${text.slice(0, 200)}`,
        };
      }

      const initBody = (await initResp.json()) as {
        media_id_string?: string;
        media_id?: string | number;
      };
      const mediaId =
        typeof initBody.media_id_string === "string"
          ? initBody.media_id_string
          : initBody.media_id !== undefined
            ? String(initBody.media_id)
            : undefined;
      if (!mediaId) {
        return {
          success: false,
          error: "Media upload INIT did not return media_id",
        };
      }

      const chunkSize = 5 * 1024 * 1024;
      let segmentIndex = 0;
      for (
        let offset = 0;
        offset < input.data.byteLength;
        offset += chunkSize
      ) {
        const chunk = input.data.slice(
          offset,
          Math.min(input.data.byteLength, offset + chunkSize)
        );
        const form = new FormData();
        form.set("command", "APPEND");
        form.set("media_id", mediaId);
        form.set("segment_index", String(segmentIndex));
        form.set("media", new Blob([chunk], { type: input.mimeType }), "media");

        const appendResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
          method: "POST",
          headers: this.getUploadHeaders(),
          body: form,
        });

        if (!appendResp.ok) {
          const text = await appendResp.text();
          return {
            success: false,
            error: `HTTP ${appendResp.status}: ${text.slice(0, 200)}`,
          };
        }
        segmentIndex += 1;
      }

      const finalizeParams = new URLSearchParams({
        command: "FINALIZE",
        media_id: mediaId,
      });
      const finalizeResp = await this.fetchWithTimeout(TWITTER_UPLOAD_URL, {
        method: "POST",
        headers: this.getUploadHeaders(),
        body: finalizeParams,
      });

      if (!finalizeResp.ok) {
        const text = await finalizeResp.text();
        return {
          success: false,
          error: `HTTP ${finalizeResp.status}: ${text.slice(0, 200)}`,
        };
      }

      const finalizeBody = (await finalizeResp.json()) as {
        processing_info?: {
          state?: string;
          check_after_secs?: number;
          error?: { message?: string; name?: string };
        };
      };

      const info = finalizeBody.processing_info;
      if (info?.state && info.state !== "succeeded") {
        let attempts = 0;
        while (attempts < 20) {
          if (info.state === "failed") {
            const msg =
              info.error?.message ||
              info.error?.name ||
              "Media processing failed";
            return { success: false, error: msg };
          }
          const delaySecs = Number.isFinite(info.check_after_secs)
            ? Math.max(1, info.check_after_secs as number)
            : 2;
          await this.sleep(delaySecs * 1000);

          const statusUrl = `${TWITTER_UPLOAD_URL}?${new URLSearchParams({
            command: "STATUS",
            media_id: mediaId,
          }).toString()}`;
          const statusResp = await this.fetchWithTimeout(statusUrl, {
            method: "GET",
            headers: this.getUploadHeaders(),
          });

          if (!statusResp.ok) {
            const text = await statusResp.text();
            return {
              success: false,
              error: `HTTP ${statusResp.status}: ${text.slice(0, 200)}`,
            };
          }

          const statusBody = (await statusResp.json()) as {
            processing_info?: {
              state?: string;
              check_after_secs?: number;
              error?: { message?: string; name?: string };
            };
          };
          if (!statusBody.processing_info) {
            break;
          }
          info.state = statusBody.processing_info.state;
          info.check_after_secs = statusBody.processing_info.check_after_secs;
          info.error = statusBody.processing_info.error;
          if (info.state === "succeeded") {
            break;
          }
          attempts += 1;
        }
      }

      if (input.alt && input.mimeType.startsWith("image/")) {
        const metaResp = await this.fetchWithTimeout(
          TWITTER_MEDIA_METADATA_URL,
          {
            method: "POST",
            headers: this.getJsonHeaders(),
            body: JSON.stringify({
              media_id: mediaId,
              alt_text: { text: input.alt },
            }),
          }
        );
        if (!metaResp.ok) {
          const text = await metaResp.text();
          return {
            success: false,
            error: `HTTP ${metaResp.status}: ${text.slice(0, 200)}`,
          };
        }
      }

      return { success: true, mediaId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private firstText(
    ...values: Array<string | undefined | null>
  ): string | undefined {
    for (const value of values) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    return undefined;
  }

  private collectTextFields(
    value: unknown,
    keys: Set<string>,
    output: string[]
  ): void {
    if (!value) {
      return;
    }
    if (typeof value === "string") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectTextFields(item, keys, output);
      }
      return;
    }

    if (typeof value === "object") {
      for (const [key, nested] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (keys.has(key)) {
          if (typeof nested === "string") {
            const trimmed = nested.trim();
            if (trimmed) {
              output.push(trimmed);
            }
            continue;
          }
        }
        this.collectTextFields(nested, keys, output);
      }
    }
  }

  private uniqueOrdered(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      result.push(value);
    }
    return result;
  }

  private extractArticleText(
    result: GraphqlTweetResult | undefined
  ): string | undefined {
    const article = result?.article;
    if (!article) {
      return undefined;
    }

    const articleResult = article.article_results?.result ?? article;
    if (process.env.XFEED_DEBUG_ARTICLE === "1") {
      console.error(
        "[xfeed][debug][article] payload:",
        JSON.stringify(
          {
            rest_id: result?.rest_id,
            article: articleResult,
            note_tweet: result?.note_tweet?.note_tweet_results?.result ?? null,
          },
          null,
          2
        )
      );
    }
    const title = this.firstText(articleResult.title, article.title);
    let body = this.firstText(
      articleResult.plain_text,
      article.plain_text,
      articleResult.body?.text,
      articleResult.body?.richtext?.text,
      articleResult.body?.rich_text?.text,
      articleResult.content?.text,
      articleResult.content?.richtext?.text,
      articleResult.content?.rich_text?.text,
      articleResult.text,
      articleResult.richtext?.text,
      articleResult.rich_text?.text,
      article.body?.text,
      article.body?.richtext?.text,
      article.body?.rich_text?.text,
      article.content?.text,
      article.content?.richtext?.text,
      article.content?.rich_text?.text,
      article.text,
      article.richtext?.text,
      article.rich_text?.text
    );

    if (body && title && body.trim() === title.trim()) {
      body = undefined;
    }

    if (!body) {
      const collected: string[] = [];
      this.collectTextFields(
        articleResult,
        new Set(["text", "title"]),
        collected
      );
      this.collectTextFields(article, new Set(["text", "title"]), collected);
      const unique = this.uniqueOrdered(collected);
      const filtered = title
        ? unique.filter((value) => value !== title)
        : unique;
      if (filtered.length > 0) {
        body = filtered.join("\n\n");
      }
    }

    if (title && body && !body.startsWith(title)) {
      return `${title}\n\n${body}`;
    }

    return body ?? title;
  }

  private extractNoteTweetText(
    result: GraphqlTweetResult | undefined
  ): string | undefined {
    const note = result?.note_tweet?.note_tweet_results?.result;
    if (!note) {
      return undefined;
    }

    return this.firstText(
      note.text,
      note.richtext?.text,
      note.rich_text?.text,
      note.content?.text,
      note.content?.richtext?.text,
      note.content?.rich_text?.text
    );
  }

  private extractTweetText(
    result: GraphqlTweetResult | undefined
  ): string | undefined {
    return (
      this.extractArticleText(result) ??
      this.extractNoteTweetText(result) ??
      this.firstText(result?.legacy?.full_text)
    );
  }

  /**
   * Unwrap visibility wrapper if present.
   * Twitter sometimes wraps tweet results in a visibility container.
   */
  private unwrapTweetResult(
    result: GraphqlTweetResult | undefined
  ): GraphqlTweetResult | undefined {
    if (!result) {
      return undefined;
    }
    // Handle TweetWithVisibilityResults wrapper
    if (result.tweet) {
      return result.tweet;
    }
    return result;
  }

  /**
   * Extract media items from extended_entities
   */
  private extractMedia(result: GraphqlTweetResult): MediaItem[] | undefined {
    const rawMedia = result.legacy?.extended_entities?.media;
    if (!rawMedia || rawMedia.length === 0) {
      return undefined;
    }

    return rawMedia.map((item) => {
      const mediaItem: MediaItem = {
        id: item.id_str ?? "",
        type: item.type,
        url: item.media_url_https,
        width: item.original_info?.width,
        height: item.original_info?.height,
      };

      // Add video variants for video/gif types
      if (item.video_info?.variants) {
        mediaItem.videoVariants = item.video_info.variants
          .filter((v) => v.content_type === "video/mp4")
          .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
          .map((v) => ({
            bitrate: v.bitrate,
            contentType: v.content_type,
            url: v.url,
          }));
      }

      return mediaItem;
    });
  }

  /**
   * Check if a URL points to media (should be hidden from tweet text)
   */
  private isMediaUrl(expandedUrl: string): boolean {
    const lower = expandedUrl.toLowerCase();
    return (
      lower.includes("pic.twitter.com") ||
      lower.includes("video.twimg.com") ||
      lower.includes("/photo/") ||
      lower.includes("/video/")
    );
  }

  /**
   * Extract URL entities from legacy.entities.urls
   * Filters out media URLs (t.co links that point to pic.twitter.com)
   */
  private extractUrls(result: GraphqlTweetResult): UrlEntity[] | undefined {
    const rawUrls = result.legacy?.entities?.urls;
    if (!rawUrls || rawUrls.length === 0) {
      return undefined;
    }

    // Filter out media URLs (pic.twitter.com, video.twimg.com)
    const urls = rawUrls
      .filter((u) => !this.isMediaUrl(u.expanded_url))
      .map((u) => ({
        url: u.url,
        expandedUrl: u.expanded_url,
        displayUrl: u.display_url,
        indices: u.indices,
      }));

    return urls.length > 0 ? urls : undefined;
  }

  /**
   * Strip media URLs from tweet text
   * Twitter includes t.co links in full_text for media, but hides them in UI
   * Media URLs can be in entities.urls (pointing to pic.twitter.com) OR entities.media
   */
  private stripMediaUrlsFromText(
    text: string,
    result: GraphqlTweetResult
  ): string {
    const allIndices: [number, number][] = [];

    // Check entities.urls for URLs pointing to media (pic.twitter.com, etc)
    const rawUrls = result.legacy?.entities?.urls;
    if (rawUrls) {
      for (const u of rawUrls) {
        if (this.isMediaUrl(u.expanded_url)) {
          allIndices.push(u.indices);
        }
      }
    }

    // Check entities.media for direct media t.co URLs (videos, images)
    const mediaEntities = result.legacy?.entities?.media;
    if (mediaEntities) {
      for (const m of mediaEntities) {
        allIndices.push(m.indices);
      }
    }

    if (allIndices.length === 0) {
      return text;
    }

    // Sort by index descending to remove from end first (preserves earlier indices)
    allIndices.sort((a, b) => b[0] - a[0]);

    // Remove each media URL from text (working backwards to preserve indices)
    let result_text = text;
    for (const [start, end] of allIndices) {
      // Also trim trailing whitespace before the URL
      let trimStart = start;
      while (trimStart > 0 && result_text[trimStart - 1] === " ") {
        trimStart--;
      }
      result_text =
        result_text.substring(0, trimStart) + result_text.substring(end);
    }

    return result_text.trim();
  }

  private mapTweetResult(
    result: GraphqlTweetResult | undefined,
    quoteDepth: number
  ): TweetData | undefined {
    const userResult = result?.core?.user_results?.result;
    const userLegacy = userResult?.legacy;
    const userCore = userResult?.core;
    const username = userLegacy?.screen_name ?? userCore?.screen_name;
    const name = userLegacy?.name ?? userCore?.name ?? username;
    const userId = userResult?.rest_id;
    if (!result?.rest_id || !username) {
      return undefined;
    }

    const rawText = this.extractTweetText(result);
    if (!rawText) {
      return undefined;
    }
    // Strip media URLs (t.co links to pic.twitter.com etc) from displayed text
    const text = this.stripMediaUrlsFromText(rawText, result);

    // Handle quoted tweets recursively
    let quotedTweet: TweetData | undefined;
    if (quoteDepth > 0) {
      const quotedResult = this.unwrapTweetResult(
        result.quoted_status_result?.result
      );
      if (quotedResult) {
        quotedTweet = this.mapTweetResult(quotedResult, quoteDepth - 1);
      }
    }

    return {
      id: result.rest_id,
      text,
      createdAt: result.legacy?.created_at,
      replyCount: result.legacy?.reply_count,
      retweetCount: result.legacy?.retweet_count,
      likeCount: result.legacy?.favorite_count,
      conversationId: result.legacy?.conversation_id_str,
      inReplyToStatusId: result.legacy?.in_reply_to_status_id_str ?? undefined,
      author: {
        username,
        name: name || username,
      },
      authorId: userId,
      quotedTweet,
      media: this.extractMedia(result),
      urls: this.extractUrls(result),
      favorited: result.legacy?.favorited ?? false,
      bookmarked: result.legacy?.bookmarked ?? false,
    };
  }

  private collectTweetResultsFromEntry(entry: {
    content?: {
      itemContent?: {
        tweet_results?: {
          result?: GraphqlTweetResult;
        };
      };
      item?: {
        itemContent?: {
          tweet_results?: {
            result?: GraphqlTweetResult;
          };
        };
      };
      items?: Array<{
        item?: {
          itemContent?: {
            tweet_results?: {
              result?: GraphqlTweetResult;
            };
          };
        };
        itemContent?: {
          tweet_results?: {
            result?: GraphqlTweetResult;
          };
        };
        content?: {
          itemContent?: {
            tweet_results?: {
              result?: GraphqlTweetResult;
            };
          };
        };
      }>;
    };
  }): GraphqlTweetResult[] {
    const results: GraphqlTweetResult[] = [];
    const pushResult = (result?: GraphqlTweetResult) => {
      if (result?.rest_id) {
        results.push(result);
      }
    };

    const content = entry.content;
    pushResult(content?.itemContent?.tweet_results?.result);
    pushResult(content?.item?.itemContent?.tweet_results?.result);

    for (const item of content?.items ?? []) {
      pushResult(item?.item?.itemContent?.tweet_results?.result);
      pushResult(item?.itemContent?.tweet_results?.result);
      pushResult(item?.content?.itemContent?.tweet_results?.result);
    }

    return results;
  }

  private parseTweetsFromInstructions(
    instructions:
      | Array<{
          entries?: Array<{
            content?: {
              itemContent?: {
                tweet_results?: {
                  result?: GraphqlTweetResult;
                };
              };
              item?: {
                itemContent?: {
                  tweet_results?: {
                    result?: GraphqlTweetResult;
                  };
                };
              };
              items?: Array<{
                item?: {
                  itemContent?: {
                    tweet_results?: {
                      result?: GraphqlTweetResult;
                    };
                  };
                };
                itemContent?: {
                  tweet_results?: {
                    result?: GraphqlTweetResult;
                  };
                };
                content?: {
                  itemContent?: {
                    tweet_results?: {
                      result?: GraphqlTweetResult;
                    };
                  };
                };
              }>;
            };
          }>;
        }>
      | undefined,
    quoteDepth: number
  ): TweetData[] {
    const tweets: TweetData[] = [];
    const seen = new Set<string>();

    for (const instruction of instructions ?? []) {
      for (const entry of instruction.entries ?? []) {
        const results = this.collectTweetResultsFromEntry(entry);
        for (const result of results) {
          const mapped = this.mapTweetResult(result, quoteDepth);
          if (!mapped || seen.has(mapped.id)) {
            continue;
          }
          seen.add(mapped.id);
          tweets.push(mapped);
        }
      }
    }

    return tweets;
  }

  private buildArticleFeatures(): Record<string, boolean> {
    return {
      rweb_video_screen_enabled: true,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: false,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    };
  }

  private buildTweetDetailFeatures(): Record<string, boolean> {
    return {
      ...this.buildArticleFeatures(),
      responsive_web_graphql_exclude_directive_enabled: true,
      communities_web_enable_tweet_community_results_fetch: true,
      responsive_web_twitter_article_plain_text_enabled: true,
      responsive_web_twitter_article_seed_tweet_detail_enabled: true,
      responsive_web_twitter_article_seed_tweet_summary_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      verified_phone_label_enabled: false,
    };
  }

  private buildArticleFieldToggles(): Record<string, boolean> {
    return {
      withPayments: false,
      withAuxiliaryUserLabels: false,
      withArticleRichContentState: true,
      withArticlePlainText: true,
      withGrokAnalyze: false,
      withDisallowedReplyControls: false,
    };
  }

  private buildSearchFeatures(): Record<string, boolean> {
    return {
      rweb_video_screen_enabled: true,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: false,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      articles_preview_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };
  }

  private buildTimelineFeatures(): Record<string, boolean> {
    return {
      ...this.buildSearchFeatures(),
      responsive_web_home_pinned_timelines_enabled: true,
      blue_business_profile_image_shape_enabled: true,
      responsive_web_text_conversations_enabled: false,
      tweetypie_unmention_optimization_enabled: true,
      vibe_api_enabled: true,
      responsive_web_twitter_blue_verified_badge_is_enabled: true,
      interactive_text_enabled: true,
      longform_notetweets_richtext_consumption_enabled: true,
      responsive_web_media_download_video_enabled: false,
    };
  }

  private async fetchUserArticlePlainText(
    userId: string,
    tweetId: string
  ): Promise<{ title?: string; plainText?: string }> {
    const variables = {
      userId,
      count: 20,
      includePromotedContent: true,
      withVoice: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withCommunity: true,
      withSafetyModeUserFields: true,
      withSuperFollowsUserFields: true,
      withDownvotePerspective: false,
      withReactionsMetadata: false,
      withReactionsPerspective: false,
      withSuperFollowsTweetFields: true,
      withSuperFollowsReplyCount: false,
      withClientEventToken: false,
    };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(this.buildArticleFeatures()),
      fieldToggles: JSON.stringify(this.buildArticleFieldToggles()),
    });

    const queryId = await this.getQueryId("UserArticlesTweets");
    const url = `${TWITTER_API_BASE}/${queryId}/UserArticlesTweets?${params.toString()}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "GET",
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        return {};
      }

      const data = (await response.json()) as {
        data?: {
          user?: {
            result?: {
              timeline?: {
                timeline?: {
                  instructions?: Array<{
                    entries?: Array<{
                      content?: {
                        itemContent?: {
                          tweet_results?: { result?: GraphqlTweetResult };
                        };
                      };
                    }>;
                  }>;
                };
              };
            };
          };
        };
      };

      const instructions =
        data.data?.user?.result?.timeline?.timeline?.instructions ?? [];
      for (const instruction of instructions) {
        for (const entry of instruction.entries ?? []) {
          const result = entry.content?.itemContent?.tweet_results?.result;
          if (result?.rest_id !== tweetId) {
            continue;
          }
          const articleResult = result.article?.article_results?.result;
          const title = this.firstText(
            articleResult?.title,
            result.article?.title
          );
          const plainText = this.firstText(
            articleResult?.plain_text,
            result.article?.plain_text
          );
          return { title, plainText };
        }
      }
    } catch {
      return {};
    }

    return {};
  }

  private async fetchTweetDetail(tweetId: string): Promise<
    | {
        success: true;
        data: {
          tweetResult?: { result?: GraphqlTweetResult };
          threaded_conversation_with_injections_v2?: {
            instructions?: Array<{
              entries?: Array<{
                content?: {
                  itemContent?: {
                    tweet_results?: {
                      result?: GraphqlTweetResult;
                    };
                  };
                };
              }>;
            }>;
          };
        };
      }
    | { success: false; error: string }
  > {
    const variables = {
      focalTweetId: tweetId,
      with_rux_injections: false,
      rankingMode: "Relevance",
      includePromotedContent: true,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true,
    };

    const features = {
      ...this.buildTweetDetailFeatures(),
      articles_preview_enabled: true,
      articles_rest_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
    };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    try {
      const parseResponse = async (response: Response) => {
        if (!response.ok) {
          const text = await response.text();
          return {
            success: false as const,
            error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          };
        }

        const data = (await response.json()) as {
          data?: {
            tweetResult?: { result?: GraphqlTweetResult };
            threaded_conversation_with_injections_v2?: {
              instructions?: Array<{
                entries?: Array<{
                  content?: {
                    itemContent?: {
                      tweet_results?: {
                        result?: GraphqlTweetResult;
                      };
                    };
                  };
                }>;
              }>;
            };
          };
          errors?: Array<{ message: string; code?: number }>;
        };

        if (data.errors && data.errors.length > 0) {
          return {
            success: false as const,
            error: data.errors.map((e) => e.message).join(", "),
          };
        }

        return { success: true as const, data: data.data ?? {} };
      };

      let lastError: string | undefined;
      let had404 = false;

      const tryOnce = async () => {
        const queryIds = await this.getTweetDetailQueryIds();

        for (const queryId of queryIds) {
          const url = `${TWITTER_API_BASE}/${queryId}/TweetDetail?${params.toString()}`;
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status !== 404) {
            return parseResponse(response);
          }

          had404 = true;

          const postResponse = await this.fetchWithTimeout(
            `${TWITTER_API_BASE}/${queryId}/TweetDetail`,
            {
              method: "POST",
              headers: this.getHeaders(),
              body: JSON.stringify({ variables, features, queryId }),
            }
          );

          if (postResponse.status !== 404) {
            return parseResponse(postResponse);
          }

          lastError = "HTTP 404";
        }

        return {
          success: false as const,
          error: lastError ?? "Unknown error fetching tweet detail",
        };
      };

      const firstAttempt = await tryOnce();
      if (firstAttempt.success) {
        return firstAttempt;
      }

      if (had404) {
        await this.refreshQueryIds();
        return tryOnce();
      }

      return firstAttempt;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get tweet details by ID
   */
  async getTweet(tweetId: string): Promise<GetTweetResult> {
    const response = await this.fetchTweetDetail(tweetId);
    if (!response.success) {
      return response;
    }

    const tweetResult =
      (response.data.tweetResult as { result?: GraphqlTweetResult } | undefined)
        ?.result ??
      this.findTweetInInstructions(
        response.data.threaded_conversation_with_injections_v2?.instructions as
          | Array<{
              entries?: Array<{
                content?: {
                  itemContent?: {
                    tweet_results?: {
                      result?: GraphqlTweetResult;
                    };
                  };
                };
              }>;
            }>
          | undefined,
        tweetId
      );

    const mapped = this.mapTweetResult(tweetResult, this.quoteDepth);
    if (mapped) {
      if (tweetResult?.article) {
        const title = this.firstText(
          tweetResult.article.article_results?.result?.title,
          tweetResult.article.title
        );
        const articleText = this.extractArticleText(tweetResult);
        if (title && (!articleText || articleText.trim() === title.trim())) {
          const userId = tweetResult.core?.user_results?.result?.rest_id;
          if (userId) {
            const fallback = await this.fetchUserArticlePlainText(
              userId,
              tweetId
            );
            if (fallback.plainText) {
              mapped.text = fallback.title
                ? `${fallback.title}\n\n${fallback.plainText}`
                : fallback.plainText;
            }
          }
        }
      }
      return { success: true, tweet: mapped };
    }
    return { success: false, error: "Tweet not found in response" };
  }

  /**
   * Post a new tweet
   */
  async tweet(text: string, mediaIds?: string[]): Promise<TweetResult> {
    const variables = {
      tweet_text: text,
      dark_request: false,
      media: {
        media_entities: (mediaIds ?? []).map((id) => ({
          media_id: id,
          tagged_users: [],
        })),
        possibly_sensitive: false,
      },
      semantic_annotation_ids: [],
    };

    const features = {
      rweb_video_screen_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: false,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: false,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      articles_preview_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };

    return this.createTweet(variables, features);
  }

  /**
   * Reply to an existing tweet
   */
  async reply(
    text: string,
    replyToTweetId: string,
    mediaIds?: string[]
  ): Promise<TweetResult> {
    const variables = {
      tweet_text: text,
      reply: {
        in_reply_to_tweet_id: replyToTweetId,
        exclude_reply_user_ids: [],
      },
      dark_request: false,
      media: {
        media_entities: (mediaIds ?? []).map((id) => ({
          media_id: id,
          tagged_users: [],
        })),
        possibly_sensitive: false,
      },
      semantic_annotation_ids: [],
    };

    const features = {
      rweb_video_screen_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: false,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: false,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      articles_preview_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };

    return this.createTweet(variables, features);
  }

  private async createTweet(
    variables: Record<string, unknown>,
    features: Record<string, boolean>
  ): Promise<TweetResult> {
    await this.ensureClientUserId();
    let queryId = await this.getQueryId("CreateTweet");
    let urlWithOperation = `${TWITTER_API_BASE}/${queryId}/CreateTweet`;

    const buildBody = () => JSON.stringify({ variables, features, queryId });
    let body = buildBody();

    try {
      const headers = {
        ...this.getHeaders(),
        referer: "https://x.com/compose/post",
      };
      let response = await this.fetchWithTimeout(urlWithOperation, {
        method: "POST",
        headers,
        body,
      });

      if (response.status === 404) {
        await this.refreshQueryIds();
        queryId = await this.getQueryId("CreateTweet");
        urlWithOperation = `${TWITTER_API_BASE}/${queryId}/CreateTweet`;
        body = buildBody();

        response = await this.fetchWithTimeout(urlWithOperation, {
          method: "POST",
          headers: {
            ...this.getHeaders(),
            referer: "https://x.com/compose/post",
          },
          body,
        });

        if (response.status === 404) {
          const retry = await this.fetchWithTimeout(TWITTER_GRAPHQL_POST_URL, {
            method: "POST",
            headers: {
              ...this.getHeaders(),
              referer: "https://x.com/compose/post",
            },
            body,
          });

          if (!retry.ok) {
            const text = await retry.text();
            return {
              success: false,
              error: `HTTP ${retry.status}: ${text.slice(0, 200)}`,
            };
          }

          const data = (await retry.json()) as CreateTweetResponse;

          if (data.errors && data.errors.length > 0) {
            const fallback = await this.tryStatusUpdateFallback(
              data.errors,
              variables
            );
            if (fallback) {
              return fallback;
            }
            return { success: false, error: this.formatErrors(data.errors) };
          }

          const tweetId =
            data.data?.create_tweet?.tweet_results?.result?.rest_id;
          if (tweetId) {
            return { success: true, tweetId };
          }

          return { success: false, error: "Tweet created but no ID returned" };
        }
      }

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as CreateTweetResponse;

      if (data.errors && data.errors.length > 0) {
        const fallback = await this.tryStatusUpdateFallback(
          data.errors,
          variables
        );
        if (fallback) {
          return fallback;
        }
        return {
          success: false,
          error: this.formatErrors(data.errors),
        };
      }

      const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
      if (tweetId) {
        return {
          success: true,
          tweetId,
        };
      }

      return {
        success: false,
        error: "Tweet created but no ID returned",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private formatErrors(
    errors: Array<{ message: string; code?: number }>
  ): string {
    return errors
      .map((error) =>
        typeof error.code === "number"
          ? `${error.message} (${error.code})`
          : error.message
      )
      .join(", ");
  }

  private statusUpdateInputFromCreateTweetVariables(
    variables: Record<string, unknown>
  ): {
    text: string;
    inReplyToTweetId?: string;
    mediaIds?: string[];
  } | null {
    const text =
      typeof variables.tweet_text === "string" ? variables.tweet_text : null;
    if (!text) {
      return null;
    }

    const reply = variables.reply;
    const inReplyToTweetId =
      reply &&
      typeof reply === "object" &&
      typeof (reply as { in_reply_to_tweet_id?: unknown })
        .in_reply_to_tweet_id === "string"
        ? (reply as { in_reply_to_tweet_id: string }).in_reply_to_tweet_id
        : undefined;

    const media = variables.media;
    const mediaEntities =
      media && typeof media === "object"
        ? (media as { media_entities?: unknown }).media_entities
        : undefined;

    const mediaIds = Array.isArray(mediaEntities)
      ? mediaEntities
          .map((entity) =>
            entity &&
            typeof entity === "object" &&
            "media_id" in (entity as Record<string, unknown>)
              ? (entity as { media_id?: unknown }).media_id
              : undefined
          )
          .filter(
            (value): value is string | number =>
              typeof value === "string" || typeof value === "number"
          )
          .map((value) => String(value))
      : undefined;

    return {
      text,
      inReplyToTweetId,
      mediaIds: mediaIds && mediaIds.length > 0 ? mediaIds : undefined,
    };
  }

  private async postStatusUpdate(input: {
    text: string;
    inReplyToTweetId?: string;
    mediaIds?: string[];
  }): Promise<TweetResult> {
    const params = new URLSearchParams();
    params.set("status", input.text);
    if (input.inReplyToTweetId) {
      params.set("in_reply_to_status_id", input.inReplyToTweetId);
      params.set("auto_populate_reply_metadata", "true");
    }
    if (input.mediaIds && input.mediaIds.length > 0) {
      params.set("media_ids", input.mediaIds.join(","));
    }

    try {
      const response = await this.fetchWithTimeout(TWITTER_STATUS_UPDATE_URL, {
        method: "POST",
        headers: {
          ...this.getBaseHeaders(),
          "content-type": "application/x-www-form-urlencoded",
          referer: "https://x.com/compose/post",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = (await response.json()) as {
        id_str?: string;
        id?: string | number;
        errors?: Array<{ message: string; code?: number }>;
      };

      if (data.errors && data.errors.length > 0) {
        return { success: false, error: this.formatErrors(data.errors) };
      }

      const tweetId =
        typeof data.id_str === "string"
          ? data.id_str
          : data.id !== undefined
            ? String(data.id)
            : undefined;

      if (tweetId) {
        return { success: true, tweetId };
      }
      return { success: false, error: "Tweet created but no ID returned" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async tryStatusUpdateFallback(
    errors: Array<{ message: string; code?: number }>,
    variables: Record<string, unknown>
  ): Promise<TweetResult | null> {
    if (!errors.some((error) => error.code === 226)) {
      return null;
    }
    const input = this.statusUpdateInputFromCreateTweetVariables(variables);
    if (!input) {
      return null;
    }

    const fallback = await this.postStatusUpdate(input);
    if (fallback.success) {
      return fallback;
    }

    return {
      success: false,
      error: `${this.formatErrors(errors)} | fallback: ${fallback.error ?? "Unknown error"}`,
    };
  }

  private async ensureClientUserId(): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    if (this.clientUserId) {
      return;
    }
    const result = await this.getCurrentUser();
    if (result.success && result.user?.id) {
      this.clientUserId = result.user.id;
    }
  }

  /**
   * Search for tweets matching a query
   */
  async search(query: string, count = 20): Promise<SearchResult> {
    const variables = {
      rawQuery: query,
      count,
      querySource: "typed_query",
      product: "Latest",
    };

    const features = this.buildSearchFeatures();

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
    });

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getSearchTimelineQueryIds();

      for (const queryId of queryIds) {
        const url = `${TWITTER_API_BASE}/${queryId}/SearchTimeline?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ features, queryId }),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          const data = (await response.json()) as {
            data?: {
              search_by_raw_query?: {
                search_timeline?: {
                  timeline?: {
                    instructions?: Array<{
                      entries?: Array<{
                        content?: {
                          itemContent?: {
                            tweet_results?: {
                              result?: GraphqlTweetResult;
                            };
                          };
                        };
                      }>;
                    }>;
                  };
                };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors.map((e) => e.message).join(", "),
              had404,
            };
          }

          const instructions =
            data.data?.search_by_raw_query?.search_timeline?.timeline
              ?.instructions;
          const tweets = this.parseTweetsFromInstructions(
            instructions,
            this.quoteDepth
          );

          return { success: true as const, tweets, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching search results",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return { success: true, tweets: firstAttempt.tweets };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return { success: true, tweets: secondAttempt.tweets };
      }
      return { success: false, error: secondAttempt.error };
    }

    return { success: false, error: firstAttempt.error };
  }

  /**
   * Fetch the account associated with the current cookies
   */
  async getCurrentUser(): Promise<CurrentUserResult> {
    const candidateUrls = [
      "https://x.com/i/api/account/settings.json",
      "https://api.twitter.com/1.1/account/settings.json",
      "https://x.com/i/api/account/verify_credentials.json?skip_status=true&include_entities=false",
      "https://api.twitter.com/1.1/account/verify_credentials.json?skip_status=true&include_entities=false",
    ];

    let lastError: string | undefined;

    for (const url of candidateUrls) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const text = await response.text();
          lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
          continue;
        }

        let data: Record<string, unknown>;
        try {
          data = (await response.json()) as Record<string, unknown>;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          continue;
        }

        const username =
          typeof data?.screen_name === "string"
            ? data.screen_name
            : typeof (data?.user as Record<string, unknown> | undefined)
                  ?.screen_name === "string"
              ? ((data.user as Record<string, unknown>).screen_name as string)
              : null;

        const name =
          typeof data?.name === "string"
            ? data.name
            : typeof (data?.user as Record<string, unknown> | undefined)
                  ?.name === "string"
              ? ((data.user as Record<string, unknown>).name as string)
              : (username ?? "");

        const userId =
          typeof data?.user_id === "string"
            ? data.user_id
            : typeof data?.user_id_str === "string"
              ? data.user_id_str
              : typeof (data?.user as Record<string, unknown> | undefined)
                    ?.id_str === "string"
                ? (data.user as Record<string, unknown>).id_str
                : typeof (data?.user as Record<string, unknown> | undefined)
                      ?.id === "string"
                  ? (data.user as Record<string, unknown>).id
                  : null;

        if (username && userId) {
          this.clientUserId = userId as string;
          return {
            success: true,
            user: {
              id: userId as string,
              username: username as string,
              name: (name || username) as string,
            },
          };
        }

        lastError = "Could not determine current user from response";
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const profilePages = [
      "https://x.com/settings/account",
      "https://twitter.com/settings/account",
    ];
    for (const page of profilePages) {
      try {
        const response = await this.fetchWithTimeout(page, {
          headers: {
            cookie: this.cookieHeader,
            "user-agent": this.userAgent,
          },
        });

        if (!response.ok) {
          lastError = `HTTP ${response.status} (settings page)`;
          continue;
        }

        const html = await response.text();
        const usernameMatch = SETTINGS_SCREEN_NAME_REGEX.exec(html);
        const idMatch = SETTINGS_USER_ID_REGEX.exec(html);
        const nameMatch = SETTINGS_NAME_REGEX.exec(html);

        const username = usernameMatch?.[1];
        const userId = idMatch?.[1];
        const name = nameMatch?.[1]?.replace(/\\"/g, '"');

        if (username && userId) {
          return {
            success: true,
            user: {
              id: userId,
              username,
              name: name || username,
            },
          };
        }

        lastError = "Could not parse settings page for user info";
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      success: false,
      error: lastError ?? "Unknown error fetching current user",
    };
  }

  /**
   * Get replies to a tweet by ID
   */
  async getReplies(tweetId: string): Promise<SearchResult> {
    const response = await this.fetchTweetDetail(tweetId);
    if (!response.success) {
      return response;
    }

    const instructions =
      response.data.threaded_conversation_with_injections_v2?.instructions;
    const tweets = this.parseTweetsFromInstructions(
      instructions,
      this.quoteDepth
    );
    const replies = tweets.filter(
      (tweet) => tweet.inReplyToStatusId === tweetId
    );

    return { success: true, tweets: replies };
  }

  /**
   * Get full conversation thread for a tweet ID
   */
  async getThread(tweetId: string): Promise<SearchResult> {
    const response = await this.fetchTweetDetail(tweetId);
    if (!response.success) {
      return response;
    }

    const instructions =
      response.data.threaded_conversation_with_injections_v2?.instructions;
    const tweets = this.parseTweetsFromInstructions(
      instructions,
      this.quoteDepth
    );

    const target = tweets.find((t) => t.id === tweetId);
    const rootId = target?.conversationId || tweetId;
    const thread = tweets.filter((tweet) => tweet.conversationId === rootId);

    thread.sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return aTime - bTime;
    });

    return { success: true, tweets: thread };
  }

  private buildBookmarksFeatures(): Record<string, boolean> {
    return {
      ...this.buildSearchFeatures(),
      graphql_timeline_v2_bookmark_timeline: true,
      blue_business_profile_image_shape_enabled: true,
      responsive_web_text_conversations_enabled: false,
      tweetypie_unmention_optimization_enabled: true,
      vibe_api_enabled: true,
      responsive_web_twitter_blue_verified_badge_is_enabled: true,
      interactive_text_enabled: true,
      longform_notetweets_richtext_consumption_enabled: true,
      responsive_web_media_download_video_enabled: false,
    };
  }

  private async getBookmarksQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("Bookmarks");
    return Array.from(
      new Set([primary, "RV1g3b8n_SGOHwkqKYSCFw", "tmd4ifV8RHltzn8ymGg1aw"])
    );
  }

  private async getHomeTimelineQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("HomeTimeline");
    return Array.from(
      new Set([primary, "V7xdnRnvW6a8vIsMr9xK7A", "HCosKfLNW1AcOo3la3mMgg"])
    );
  }

  private async getHomeLatestTimelineQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("HomeLatestTimeline");
    return Array.from(new Set([primary, "zhX91JE87mWvfprhYE97xA"]));
  }

  private extractBottomCursor(
    instructions:
      | Array<{
          entry?: {
            entryId?: string;
            content?: {
              value?: string;
              cursorType?: string;
            };
          };
          entries?: Array<{
            entryId?: string;
            content?: {
              value?: string;
              cursorType?: string;
            };
          }>;
        }>
      | undefined
  ): string | undefined {
    if (!instructions) {
      return undefined;
    }

    let bottomCursor: string | undefined;

    for (const instruction of instructions) {
      // Check instruction.entry (TimelineReplaceEntry)
      if (
        instruction.entry?.content?.cursorType === "Bottom" &&
        instruction.entry.content.value
      ) {
        bottomCursor = instruction.entry.content.value;
      }

      // Check instruction.entries (TimelineAddEntries)
      for (const entry of instruction.entries ?? []) {
        if (entry.content?.cursorType === "Bottom" && entry.content.value) {
          bottomCursor = entry.content.value;
        }
      }
    }

    return bottomCursor;
  }

  /**
   * Get the authenticated user's bookmarks
   */
  async getBookmarks(count = 20): Promise<SearchResult> {
    const variables = {
      count,
      includePromotedContent: false,
      withDownvotePerspective: false,
      withReactionsMetadata: false,
      withReactionsPerspective: false,
    };

    const features = this.buildBookmarksFeatures();

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getBookmarksQueryIds();

      for (const queryId of queryIds) {
        const url = `${TWITTER_API_BASE}/${queryId}/Bookmarks?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          const data = (await response.json()) as {
            data?: {
              bookmark_timeline_v2?: {
                timeline?: {
                  instructions?: Array<{
                    entries?: Array<{
                      content?: {
                        itemContent?: {
                          tweet_results?: {
                            result?: GraphqlTweetResult;
                          };
                        };
                      };
                    }>;
                  }>;
                };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors.map((e) => e.message).join(", "),
              had404,
            };
          }

          const instructions =
            data.data?.bookmark_timeline_v2?.timeline?.instructions;
          const tweets = this.parseTweetsFromInstructions(
            instructions,
            this.quoteDepth
          );

          return { success: true as const, tweets, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching bookmarks",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return { success: true, tweets: firstAttempt.tweets };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return { success: true, tweets: secondAttempt.tweets };
      }
      return { success: false, error: secondAttempt.error };
    }

    return { success: false, error: firstAttempt.error };
  }

  /**
   * Get the "For You" timeline (algorithmic feed)
   * @param count Number of tweets to fetch (default 20)
   * @param cursor Pagination cursor from previous response's nextCursor
   */
  async getHomeTimeline(count = 20, cursor?: string): Promise<TimelineResult> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: true,
      withCommunity: true,
    };

    if (cursor) {
      variables.cursor = cursor;
    } else {
      variables.requestContext = "launch";
    }

    const features = this.buildTimelineFeatures();

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getHomeTimelineQueryIds();

      for (const queryId of queryIds) {
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features),
        });
        const url = `${TWITTER_API_BASE}/${queryId}/HomeTimeline?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          const data = (await response.json()) as {
            data?: {
              home?: {
                home_timeline_urt?: {
                  instructions?: Array<{
                    entries?: Array<{
                      entryId?: string;
                      content?: {
                        value?: string;
                        cursorType?: string;
                        itemContent?: {
                          tweet_results?: {
                            result?: GraphqlTweetResult;
                          };
                        };
                      };
                    }>;
                  }>;
                };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors.map((e) => e.message).join(", "),
              had404,
            };
          }

          const instructions = data.data?.home?.home_timeline_urt?.instructions;
          const tweets = this.parseTweetsFromInstructions(
            instructions,
            this.quoteDepth
          );
          const nextCursor = this.extractBottomCursor(instructions);

          return { success: true as const, tweets, nextCursor, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching home timeline",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return {
        success: true,
        tweets: firstAttempt.tweets,
        nextCursor: firstAttempt.nextCursor,
      };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return {
          success: true,
          tweets: secondAttempt.tweets,
          nextCursor: secondAttempt.nextCursor,
        };
      }
      return { success: false, error: secondAttempt.error };
    }

    return { success: false, error: firstAttempt.error };
  }

  /**
   * Get the "Following" timeline (chronological feed)
   * @param count Number of tweets to fetch (default 20)
   * @param cursor Pagination cursor from previous response's nextCursor
   */
  async getHomeLatestTimeline(
    count = 20,
    cursor?: string
  ): Promise<TimelineResult> {
    const variables: Record<string, unknown> = {
      count,
      includePromotedContent: true,
      withCommunity: true,
    };

    if (cursor) {
      variables.cursor = cursor;
    } else {
      variables.requestContext = "launch";
    }

    const features = this.buildTimelineFeatures();

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getHomeLatestTimelineQueryIds();

      for (const queryId of queryIds) {
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features),
        });
        const url = `${TWITTER_API_BASE}/${queryId}/HomeLatestTimeline?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          const data = (await response.json()) as {
            data?: {
              home?: {
                home_timeline_urt?: {
                  instructions?: Array<{
                    entries?: Array<{
                      entryId?: string;
                      content?: {
                        value?: string;
                        cursorType?: string;
                        itemContent?: {
                          tweet_results?: {
                            result?: GraphqlTweetResult;
                          };
                        };
                      };
                    }>;
                  }>;
                };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors.map((e) => e.message).join(", "),
              had404,
            };
          }

          const instructions = data.data?.home?.home_timeline_urt?.instructions;
          const tweets = this.parseTweetsFromInstructions(
            instructions,
            this.quoteDepth
          );
          const nextCursor = this.extractBottomCursor(instructions);

          return { success: true as const, tweets, nextCursor, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching latest timeline",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return {
        success: true,
        tweets: firstAttempt.tweets,
        nextCursor: firstAttempt.nextCursor,
      };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return {
          success: true,
          tweets: secondAttempt.tweets,
          nextCursor: secondAttempt.nextCursor,
        };
      }
      return { success: false, error: secondAttempt.error };
    }

    return { success: false, error: firstAttempt.error };
  }

  private async getUserByScreenNameQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("UserByScreenName");
    return Array.from(
      new Set([primary, "7mjxD3-C6BxitPMVQ6w0-Q", "sLVLhk0bGj3MVFEKTdax1w"])
    );
  }

  private async getUserTweetsQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId("UserTweets");
    return Array.from(
      new Set([
        primary,
        "HuTx74BxAnezK1gWvYY7zg",
        "V1ze5q3ijDS1VeLwLY0m7g",
        "LNhjy8t3XpIrBYM-ms7sPQ",
      ])
    );
  }

  private buildUserProfileFeatures(): Record<string, boolean> {
    return {
      ...this.buildSearchFeatures(),
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
    };
  }

  /**
   * Get a user profile by screen name (handle without @)
   */
  async getUserByScreenName(
    screenName: string
  ): Promise<import("./types").UserProfileResult> {
    const variables = {
      screen_name: screenName,
      withSafetyModeUserFields: true,
      withSuperFollowsUserFields: true,
    };

    const features = this.buildUserProfileFeatures();
    const fieldToggles = {
      withAuxiliaryUserLabels: false,
    };

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getUserByScreenNameQueryIds();

      for (const queryId of queryIds) {
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features),
          fieldToggles: JSON.stringify(fieldToggles),
        });
        const url = `${TWITTER_API_BASE}/${queryId}/UserByScreenName?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          const data = (await response.json()) as {
            data?: {
              user?: {
                result?: {
                  __typename?: string;
                  rest_id?: string;
                  id?: string;
                  is_blue_verified?: boolean;
                  legacy?: {
                    screen_name?: string;
                    name?: string;
                    description?: string;
                    followers_count?: number;
                    friends_count?: number;
                  };
                };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors.map((e) => e.message).join(", "),
              had404,
            };
          }

          const result = data.data?.user?.result;
          if (!result || result.__typename === "UserUnavailable") {
            return {
              success: false as const,
              error: "User not found or unavailable",
              had404,
            };
          }

          const user: import("./types").UserProfileData = {
            id: result.rest_id || result.id || "",
            username: result.legacy?.screen_name || screenName,
            name: result.legacy?.name || screenName,
            description: result.legacy?.description,
            followersCount: result.legacy?.followers_count,
            followingCount: result.legacy?.friends_count,
            isBlueVerified: result.is_blue_verified,
          };

          return { success: true as const, user, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching user profile",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return { success: true, user: firstAttempt.user };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return { success: true, user: secondAttempt.user };
      }
      return { success: false, error: secondAttempt.error };
    }

    return { success: false, error: firstAttempt.error };
  }

  /**
   * Get tweets from a specific user via REST API
   * Fallback method when GraphQL fails
   */
  private async getUserTweetsViaRest(
    userId: string,
    count: number
  ): Promise<import("./types").UserTweetsResult> {
    const params = new URLSearchParams({
      user_id: userId,
      count: String(count),
      include_rts: "true",
      exclude_replies: "false",
      tweet_mode: "extended",
    });

    const urls = [
      `https://x.com/i/api/1.1/statuses/user_timeline.json?${params.toString()}`,
      `https://api.twitter.com/1.1/statuses/user_timeline.json?${params.toString()}`,
    ];

    let lastError: string | undefined;

    for (const url of urls) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const text = await response.text();
          lastError = `HTTP ${response.status}: ${text.slice(0, 200)}`;
          continue;
        }

        const data = (await response.json()) as Array<{
          id_str?: string;
          full_text?: string;
          text?: string;
          created_at?: string;
          retweet_count?: number;
          favorite_count?: number;
          reply_count?: number;
          conversation_id_str?: string;
          in_reply_to_status_id_str?: string;
          user?: {
            id_str?: string;
            screen_name?: string;
            name?: string;
          };
          extended_entities?: {
            media?: Array<{
              id_str?: string;
              type: "photo" | "video" | "animated_gif";
              media_url_https: string;
              original_info?: { width?: number; height?: number };
              video_info?: {
                variants: Array<{
                  bitrate?: number;
                  content_type: string;
                  url: string;
                }>;
              };
            }>;
          };
        }>;

        const tweets: import("./types").TweetData[] = [];
        for (const tweet of data) {
          const id = tweet.id_str;
          const text = tweet.full_text || tweet.text;
          if (!id || !text) continue;

          const media = tweet.extended_entities?.media?.map((m) => ({
            id: m.id_str || "",
            type: m.type,
            url: m.media_url_https,
            width: m.original_info?.width,
            height: m.original_info?.height,
            videoVariants: m.video_info?.variants?.map((v) => ({
              bitrate: v.bitrate,
              contentType: v.content_type,
              url: v.url,
            })),
          }));

          tweets.push({
            id,
            text,
            author: {
              username: tweet.user?.screen_name || "",
              name: tweet.user?.name || "",
            },
            authorId: tweet.user?.id_str,
            createdAt: tweet.created_at,
            replyCount: tweet.reply_count,
            retweetCount: tweet.retweet_count,
            likeCount: tweet.favorite_count,
            conversationId: tweet.conversation_id_str,
            inReplyToStatusId: tweet.in_reply_to_status_id_str || undefined,
            media,
          });
        }

        return { success: true, tweets };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      success: false,
      error: lastError ?? "Unknown error fetching user tweets via REST",
    };
  }

  /**
   * Get tweets from a specific user by their ID
   * @param userId The user's numeric ID
   * @param count Number of tweets to fetch (default 20)
   */
  async getUserTweets(
    userId: string,
    count = 20
  ): Promise<import("./types").UserTweetsResult> {
    const variables = {
      userId,
      count,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    };

    const features = this.buildTimelineFeatures();
    const fieldToggles = {
      withArticlePlainText: false,
    };

    const tryOnce = async () => {
      let lastError: string | undefined;
      let had404 = false;
      const queryIds = await this.getUserTweetsQueryIds();

      for (const queryId of queryIds) {
        const params = new URLSearchParams({
          variables: JSON.stringify(variables),
          features: JSON.stringify(features),
          fieldToggles: JSON.stringify(fieldToggles),
        });
        const url = `${TWITTER_API_BASE}/${queryId}/UserTweets?${params.toString()}`;

        try {
          const response = await this.fetchWithTimeout(url, {
            method: "GET",
            headers: this.getHeaders(),
          });

          if (response.status === 404) {
            had404 = true;
            lastError = `HTTP ${response.status}`;
            continue;
          }

          if (!response.ok) {
            const text = await response.text();
            return {
              success: false as const,
              error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
              had404,
            };
          }

          // biome-ignore lint/suspicious/noExplicitAny: Twitter API response varies
          const data = (await response.json()) as any;

          if (data.errors && data.errors.length > 0) {
            return {
              success: false as const,
              error: data.errors
                .map((e: { message: string }) => e.message)
                .join(", "),
              had404,
            };
          }

          // Try multiple possible response paths
          const instructions =
            data.data?.user?.result?.timeline_v2?.timeline?.instructions ||
            data.data?.user?.result?.timeline?.timeline?.instructions;

          if (!instructions) {
            lastError = "No instructions found in response";
            continue;
          }

          const tweets = this.parseTweetsFromInstructions(
            instructions,
            this.quoteDepth
          );

          return { success: true as const, tweets, had404 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        success: false as const,
        error: lastError ?? "Unknown error fetching user tweets",
        had404,
      };
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success && firstAttempt.tweets.length > 0) {
      return { success: true, tweets: firstAttempt.tweets };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success && secondAttempt.tweets.length > 0) {
        return { success: true, tweets: secondAttempt.tweets };
      }
    }

    // Fallback to REST API
    const restResult = await this.getUserTweetsViaRest(userId, count);
    if (restResult.success) {
      return restResult;
    }

    return {
      success: false,
      error:
        firstAttempt.error ?? restResult.error ?? "Failed to fetch user tweets",
    };
  }

  /**
   * Like a tweet (favorite)
   * @param tweetId The ID of the tweet to like
   */
  async likeTweet(tweetId: string): Promise<ActionResult> {
    return this.executeActionMutation("FavoriteTweet", tweetId);
  }

  /**
   * Unlike a tweet (unfavorite)
   * @param tweetId The ID of the tweet to unlike
   */
  async unlikeTweet(tweetId: string): Promise<ActionResult> {
    return this.executeActionMutation("UnfavoriteTweet", tweetId);
  }

  /**
   * Bookmark a tweet
   * @param tweetId The ID of the tweet to bookmark
   */
  async createBookmark(tweetId: string): Promise<ActionResult> {
    return this.executeActionMutation("CreateBookmark", tweetId);
  }

  /**
   * Remove a bookmark
   * @param tweetId The ID of the tweet to unbookmark
   */
  async deleteBookmark(tweetId: string): Promise<ActionResult> {
    return this.executeActionMutation("DeleteBookmark", tweetId);
  }

  /**
   * Execute a simple action mutation (like, bookmark, etc.)
   * These mutations take only a tweet_id and return a simple success/error response.
   * Note: No features object - Twitter's action mutations only need variables and queryId.
   */
  private async executeActionMutation(
    operationName: OperationName,
    tweetId: string
  ): Promise<ActionResult> {
    await this.ensureClientUserId();

    const variables = { tweet_id: tweetId };

    const tryOnce = async (): Promise<ActionResult & { had404?: boolean }> => {
      const queryId = await this.getQueryId(operationName);
      const path = `/i/api/graphql/${queryId}/${operationName}`;
      const url = `https://x.com${path}`;

      // Generate proper transaction ID for this specific request
      const transactionId = await this.generateTransactionId("POST", path);

      try {
        const headers = {
          ...this.getHeaders(),
          "x-client-transaction-id": transactionId,
        };

        const response = await this.fetchWithTimeout(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ variables, queryId }),
        });

        if (response.status === 404) {
          return { success: false, error: "HTTP 404", had404: true };
        }

        if (!response.ok) {
          const text = await response.text();
          return {
            success: false,
            error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          };
        }

        const data = (await response.json()) as {
          data?: Record<string, unknown>;
          errors?: Array<{ message: string; code?: number }>;
        };

        if (data.errors && data.errors.length > 0) {
          return {
            success: false,
            error: data.errors.map((e) => e.message).join(", "),
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    const firstAttempt = await tryOnce();
    if (firstAttempt.success) {
      return { success: true };
    }

    if (firstAttempt.had404) {
      await this.refreshQueryIds();
      const secondAttempt = await tryOnce();
      if (secondAttempt.success) {
        return { success: true };
      }
      return { success: false, error: secondAttempt.error ?? "Unknown error" };
    }

    return { success: false, error: firstAttempt.error ?? "Unknown error" };
  }
}

// Re-export types for convenience
export type {
  ActionResult,
  CreateTweetResponse,
  CurrentUserResult,
  GetTweetResult,
  GraphqlTweetResult,
  OperationName,
  SearchResult,
  TimelineResult,
  TweetData,
  TweetResult,
  TwitterClientOptions,
  UploadMediaResult,
  UserProfileData,
  UserProfileResult,
  UserTweetsResult,
} from "./types";
