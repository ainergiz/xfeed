/**
 * PostCard - Individual post display component
 */

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import { formatCount, formatRelativeTime, truncateText } from "@/lib/format";

import { QuotedPostCard } from "./QuotedPostCard";

const MAX_TEXT_LINES = 3;

interface PostCardProps {
  post: TweetData;
  isSelected: boolean;
  id?: string;
  /** Whether the tweet is liked by the current user */
  isLiked?: boolean;
  /** Whether the tweet is bookmarked by the current user */
  isBookmarked?: boolean;
}

export function PostCard({
  post,
  isSelected,
  id,
  isLiked,
  isBookmarked,
}: PostCardProps) {
  const displayText = truncateText(post.text, MAX_TEXT_LINES);
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

      {/* Stats line */}
      <box style={{ flexDirection: "row", marginTop: 1, paddingLeft: 2 }}>
        <text fg={colors.muted}>
          {formatCount(post.replyCount)} replies {"  "}
          {formatCount(post.retweetCount)} reposts {"  "}
          {formatCount(post.likeCount)} likes
        </text>
        {isLiked ? (
          <text fg={colors.error}>
            {"  "}
            {"\u2665"} liked
          </text>
        ) : null}
        {isBookmarked ? (
          <text fg={colors.primary}>
            {"  "}
            {"\u2691"} saved
          </text>
        ) : null}
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
    </box>
  );
}
