/**
 * QuotedPostCard - Compact display for quoted/embedded tweets
 */

import type { TweetData } from "@/api/types";

import { truncateText } from "@/lib/format";

const MAX_TEXT_LINES = 2;
const QUOTE_BORDER_COLOR = "#444444";
const QUOTE_BG = "#0d0d14";
const X_BLUE = "#1DA1F2";

interface QuotedPostCardProps {
  post: TweetData;
}

export function QuotedPostCard({ post }: QuotedPostCardProps) {
  const displayText = truncateText(post.text, MAX_TEXT_LINES);

  return (
    <box style={{ flexDirection: "row", marginTop: 1 }}>
      {/* Left border indicator */}
      <text fg={QUOTE_BORDER_COLOR}>│ </text>

      {/* Quote content */}
      <box
        style={{
          flexDirection: "column",
          backgroundColor: QUOTE_BG,
          paddingRight: 1,
        }}
      >
        {/* Quoted author line */}
        <box style={{ flexDirection: "row" }}>
          <text fg={X_BLUE}>@{post.author.username}</text>
          <text fg="#666666"> · {post.author.name}</text>
        </box>

        {/* Quoted text (truncated) */}
        <box style={{ marginTop: 1 }}>
          <text fg="#aaaaaa">{displayText}</text>
        </box>
      </box>
    </box>
  );
}
