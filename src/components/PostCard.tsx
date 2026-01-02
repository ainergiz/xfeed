/**
 * PostCard - Individual post display component
 */

import type { TweetData } from "@/api/types";

import { formatCount, formatRelativeTime, truncateText } from "@/lib/format";

const MAX_TEXT_LINES = 3;
const SELECTED_BG = "#1a1a2e";
const X_BLUE = "#1DA1F2";

interface PostCardProps {
  post: TweetData;
  isSelected: boolean;
  id?: string;
}

export function PostCard({ post, isSelected, id }: PostCardProps) {
  const displayText = truncateText(post.text, MAX_TEXT_LINES);
  const timeAgo = formatRelativeTime(post.createdAt);

  return (
    <box
      id={id}
      style={{
        flexDirection: "row",
        marginBottom: 1,
        backgroundColor: isSelected ? SELECTED_BG : undefined,
      }}
    >
      {/* Selection indicator */}
      <box style={{ width: 2, flexShrink: 0 }}>
        <text fg={X_BLUE}>{isSelected ? "> " : "  "}</text>
      </box>

      {/* Post content */}
      <box
        style={{
          flexDirection: "column",
          flexGrow: 1,
          padding: 1,
        }}
      >
        {/* Author line */}
        <box style={{ flexDirection: "row" }}>
          <text fg={X_BLUE}>@{post.author.username}</text>
          <text fg="#666666">
            {" "}
            · {post.author.name}
            {timeAgo ? ` · ${timeAgo}` : ""}
          </text>
        </box>

        {/* Post text */}
        <box style={{ marginTop: 1 }}>
          <text fg="#ffffff">{displayText}</text>
        </box>

        {/* Stats line */}
        <box style={{ flexDirection: "row", marginTop: 1 }}>
          <text fg="#888888">
            {formatCount(post.replyCount)} replies {"  "}
            {formatCount(post.retweetCount)} reposts {"  "}
            {formatCount(post.likeCount)} likes
          </text>
        </box>
      </box>
    </box>
  );
}
