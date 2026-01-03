/**
 * PostCard - Individual post display component
 */

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import { formatCount, formatRelativeTime, truncateText } from "@/lib/format";

import { QuotedPostCard } from "./QuotedPostCard";
import { ReplyPreviewCard } from "./ReplyPreviewCard";

const MAX_TEXT_LINES = 3;

/**
 * Strip leading @mention from reply text if it matches the parent author.
 * This removes redundant mentions when viewing replies in a thread context.
 *
 * Only strips if:
 * - The mention is at the very beginning of the text
 * - It's a single mention (not @user1 @user2 text)
 */
function stripLeadingMention(text: string, username: string): string {
  // Match @username at start, followed by optional whitespace
  // But NOT followed by another @mention (to preserve multi-mention replies)
  const pattern = new RegExp(`^@${username}\\s+(?!@)`, "i");
  return text.replace(pattern, "");
}

interface PostCardProps {
  post: TweetData;
  isSelected: boolean;
  id?: string;
  /** Whether the tweet is liked by the current user */
  isLiked?: boolean;
  /** Whether the tweet is bookmarked by the current user */
  isBookmarked?: boolean;
  /** True briefly after liking (for visual pulse feedback) */
  isJustLiked?: boolean;
  /** True briefly after bookmarking (for visual pulse feedback) */
  isJustBookmarked?: boolean;
  /** Parent post author username - if provided, strips leading @mention matching this user */
  parentAuthorUsername?: string;
  /** Main post author username (for nested reply mention stripping) */
  mainPostAuthorUsername?: string;
}

// Unicode symbols for like/bookmark states
const HEART_EMPTY = "\u2661"; // ♡
const HEART_FILLED = "\u2665"; // ♥
const FLAG_EMPTY = "\u2690"; // ⚐
const FLAG_FILLED = "\u2691"; // ⚑

export function PostCard({
  post,
  isSelected,
  id,
  isLiked,
  isBookmarked,
  isJustLiked,
  isJustBookmarked,
  parentAuthorUsername,
  mainPostAuthorUsername,
}: PostCardProps) {
  const textToDisplay = parentAuthorUsername
    ? stripLeadingMention(post.text, parentAuthorUsername)
    : post.text;
  const displayText = truncateText(textToDisplay, MAX_TEXT_LINES);
  const timeAgo = formatRelativeTime(post.createdAt);
  const hasMedia = post.media && post.media.length > 0;

  return (
    <box
      id={id}
      style={{
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        backgroundColor: isSelected ? colors.selectedBg : undefined,
      }}
    >
      {/* Author line with selection indicator */}
      <box style={{ flexDirection: "row" }}>
        <text fg={colors.primary}>{isSelected ? "> " : "  "}</text>
        <text fg={colors.primary}>@{post.author.username}</text>
        <text fg={colors.dim}>
          {" "}
          · {post.author.name}
          {timeAgo ? ` · ${timeAgo}` : ""}
        </text>
      </box>

      {/* Post text */}
      <box style={{ marginTop: 1, paddingLeft: 2 }}>
        <text fg="#ffffff">{displayText}</text>
      </box>

      {/* Quoted tweet (if present) */}
      {post.quotedTweet ? (
        <box style={{ paddingLeft: 2 }}>
          <QuotedPostCard post={post.quotedTweet} />
        </box>
      ) : null}

      {/* Stats line with action indicators */}
      <box style={{ flexDirection: "row", marginTop: 1, paddingLeft: 2 }}>
        <text fg={colors.muted}>
          {formatCount(post.replyCount)} replies {"  "}
          {formatCount(post.retweetCount)} reposts {"  "}
          {formatCount(post.likeCount)} likes
        </text>
        {/* Like indicator - always visible, filled/empty based on state */}
        <text
          fg={
            isJustLiked
              ? colors.success // Bright green flash
              : isLiked
                ? colors.error // Red when liked
                : colors.muted // Muted when not liked (more visible than dim)
          }
        >
          {"  "}
          {isLiked ? HEART_FILLED : <b>{HEART_EMPTY}</b>}
        </text>
        {/* Bookmark indicator - always visible, filled/empty based on state */}
        <text
          fg={
            isJustBookmarked
              ? colors.success // Bright green flash
              : isBookmarked
                ? colors.primary // Blue when bookmarked
                : colors.muted // Muted when not bookmarked (more visible than dim)
          }
        >
          {"  "}
          {isBookmarked ? FLAG_FILLED : <b>{FLAG_EMPTY}</b>}
        </text>
      </box>

      {/* Media indicators - colored labels */}
      {hasMedia && (
        <box style={{ flexDirection: "row", marginTop: 1, paddingLeft: 2 }}>
          {post.media?.map((item) => {
            const dims =
              item.width && item.height
                ? ` (${item.width}x${item.height})`
                : "";
            const typeLabel =
              item.type === "photo"
                ? "Image"
                : item.type === "video"
                  ? "Video"
                  : "GIF";
            const typeColor =
              item.type === "photo"
                ? colors.primary
                : item.type === "video"
                  ? colors.warning
                  : colors.success;
            return (
              <text key={item.id} fg={typeColor}>
                • {typeLabel}
                {dims}
                {"  "}
              </text>
            );
          })}
        </box>
      )}

      {/* Nested reply preview (if present) */}
      {post.nestedReplyPreview && (
        <box style={{ paddingLeft: 2 }}>
          <ReplyPreviewCard
            reply={post.nestedReplyPreview}
            stripMentions={[
              post.author.username,
              ...(mainPostAuthorUsername ? [mainPostAuthorUsername] : []),
            ]}
          />
        </box>
      )}
    </box>
  );
}
