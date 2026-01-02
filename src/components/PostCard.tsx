/**
 * PostCard - Individual post display component
 */

import type { TweetData } from "@/api/types";

import { formatCount, formatRelativeTime, truncateText } from "@/lib/format";

import { QuotedPostCard } from "./QuotedPostCard";

const MAX_TEXT_LINES = 3;
const SELECTED_BG = "#1a1a2e";
const X_BLUE = "#1DA1F2";
const COLOR_SUCCESS = "#17BF63";
const COLOR_WARNING = "#FFAD1F";

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
        backgroundColor: isSelected ? SELECTED_BG : undefined,
      }}
    >
      {/* Author line with selection indicator */}
      <box style={{ flexDirection: "row" }}>
        <text fg={X_BLUE}>{isSelected ? "> " : "  "}</text>
        <text fg={X_BLUE}>@{post.author.username}</text>
        <text fg="#666666">
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
        <text fg="#888888">
          {formatCount(post.replyCount)} replies {"  "}
          {formatCount(post.retweetCount)} reposts {"  "}
          {formatCount(post.likeCount)} likes
        </text>
        {isLiked ? (
          <text fg="#E0245E">
            {"  "}
            {"\u2665"} liked
          </text>
        ) : null}
        {isBookmarked ? (
          <text fg={X_BLUE}>
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
                ? X_BLUE
                : item.type === "video"
                  ? COLOR_WARNING
                  : COLOR_SUCCESS;
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
