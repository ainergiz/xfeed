/**
 * PostDetailScreen - Full post view with expand/collapse functionality
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect } from "react";

import type { TweetData } from "@/api/types";

import { QuotedPostCard } from "@/components/QuotedPostCard";
import { formatCount, truncateText } from "@/lib/format";

const X_BLUE = "#1DA1F2";

// Maximum lines for truncated content view
// Keeps initial view compact; user can expand with 'e'
const MAX_TRUNCATED_LINES = 10;

interface PostDetailScreenProps {
  tweet: TweetData;
  focused?: boolean;
  onBack?: () => void;
}

/**
 * Format timestamp as full date/time (e.g., "Jan 2, 2026 · 10:30 AM")
 */
function formatFullTimestamp(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr} · ${timeStr}`;
}

/**
 * Check if text needs truncation
 */
function needsTruncation(text: string, maxLines: number): boolean {
  const lines = text.split("\n");
  return lines.length > maxLines;
}

export function PostDetailScreen({
  tweet,
  focused = false,
  onBack,
}: PostDetailScreenProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  const fullTimestamp = formatFullTimestamp(tweet.createdAt);
  const showTruncated =
    !isExpanded && needsTruncation(tweet.text, MAX_TRUNCATED_LINES);
  const displayText = showTruncated
    ? truncateText(tweet.text, MAX_TRUNCATED_LINES)
    : tweet.text;

  // When expanding, ensure scroll starts at top
  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTo(0);
    }
  }, [isExpanded]);

  useKeyboard((key) => {
    if (!focused) return;

    switch (key.name) {
      case "escape":
      case "backspace":
      case "h":
        onBack?.();
        break;
      case "e":
        setIsExpanded((prev) => !prev);
        break;
      case "o":
        // Open in browser (TODO: implement with open command)
        break;
      case "b":
        // Bookmark (TODO: implement when actions are ready)
        break;
      case "l":
        // Like (TODO: implement when actions are ready)
        break;
    }
  });

  // Header with back hint
  const headerContent = (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#666666">{"<- "}</text>
      <text fg="#888888">Back (Esc)</text>
    </box>
  );

  // Author info
  const authorContent = (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={X_BLUE}>@{tweet.author.username}</text>
        <text fg="#ffffff"> · {tweet.author.name}</text>
      </box>
      {fullTimestamp && (
        <box style={{ marginTop: 0 }}>
          <text fg="#666666">{fullTimestamp}</text>
        </box>
      )}
    </box>
  );

  // Post content
  const postContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg="#ffffff">{displayText}</text>
    </box>
  );

  // Truncation indicator
  const truncationIndicator = showTruncated ? (
    <box style={{ paddingLeft: 1, marginTop: 1 }}>
      <text fg="#666666">... </text>
      <text fg={X_BLUE}>[e] Expand</text>
    </box>
  ) : null;

  // Quoted tweet (if present)
  const quotedContent = tweet.quotedTweet ? (
    <box style={{ paddingLeft: 1, paddingRight: 1, marginTop: 1 }}>
      <QuotedPostCard post={tweet.quotedTweet} />
    </box>
  ) : null;

  // Stats bar
  const statsContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text fg="#888888">
          {formatCount(tweet.replyCount)} replies {"  "}
          {formatCount(tweet.retweetCount)} reposts {"  "}
          {formatCount(tweet.likeCount)} likes
        </text>
      </box>
    </box>
  );

  // Actions footer
  const footerContent = (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#ffffff">h/Esc</text>
      <text fg="#666666"> back </text>
      {showTruncated ? (
        <>
          <text fg="#ffffff">e</text>
          <text fg="#666666"> expand </text>
        </>
      ) : isExpanded ? (
        <>
          <text fg="#ffffff">e</text>
          <text fg="#666666"> collapse </text>
        </>
      ) : null}
      <text fg="#ffffff">o</text>
      <text fg="#666666"> open </text>
      <text fg="#ffffff">b</text>
      <text fg="#666666"> bookmark </text>
      <text fg="#ffffff">l</text>
      <text fg="#666666"> like</text>
    </box>
  );

  // Main layout
  if (isExpanded) {
    // Expanded: content in scrollbox to allow scrolling long posts
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        {headerContent}
        <scrollbox
          ref={scrollRef}
          focused={focused}
          style={{ flexGrow: 1, height: "100%" }}
        >
          {authorContent}
          {postContent}
          {quotedContent}
          {statsContent}
        </scrollbox>
        {footerContent}
      </box>
    );
  }

  // Collapsed: fixed layout, no scrolling
  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {headerContent}
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {authorContent}
        {postContent}
        {truncationIndicator}
        {quotedContent}
        {statsContent}
      </box>
      {footerContent}
    </box>
  );
}
