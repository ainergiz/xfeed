/**
 * PostDetailScreen - Full post view with expand/collapse functionality
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect, useCallback } from "react";

import type { TweetData } from "@/api/types";

import { QuotedPostCard } from "@/components/QuotedPostCard";
import { formatCount, truncateText } from "@/lib/format";
import { previewMedia, downloadMedia } from "@/lib/media";

const X_BLUE = "#1DA1F2";
const COLOR_SUCCESS = "#17BF63";
const COLOR_WARNING = "#FFAD1F";

// Maximum lines for truncated content view
// Keeps initial view compact; user can expand with 'e'
const MAX_TRUNCATED_LINES = 10;

interface PostDetailScreenProps {
  tweet: TweetData;
  focused?: boolean;
  onBack?: () => void;
  onProfileOpen?: (username: string) => void;
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
  onProfileOpen,
}: PostDetailScreenProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  const hasMedia = tweet.media && tweet.media.length > 0;
  const mediaCount = tweet.media?.length ?? 0;
  const currentMedia = hasMedia ? tweet.media?.[mediaIndex] : undefined;

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

  // Clear status message after 3 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Handle media preview (i key)
  const handlePreview = useCallback(async () => {
    if (!currentMedia) return;
    setStatusMessage("Opening...");
    const result = await previewMedia(currentMedia, tweet.id, mediaIndex);
    setStatusMessage(result.success ? result.message : result.error);
  }, [currentMedia, tweet.id, mediaIndex]);

  // Handle media download (d key)
  const handleDownload = useCallback(async () => {
    if (!currentMedia) return;
    setStatusMessage("Downloading...");
    const result = await downloadMedia(currentMedia, tweet.id, mediaIndex);
    setStatusMessage(result.success ? result.message : result.error);
  }, [currentMedia, tweet.id, mediaIndex]);

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
      case "p":
        // Open author profile
        onProfileOpen?.(tweet.author.username);
        break;
      case "i":
        // Preview media (Quick Look on macOS, browser for video)
        if (hasMedia) {
          handlePreview();
        }
        break;
      case "d":
        // Download media
        if (hasMedia) {
          handleDownload();
        }
        break;
      case "[":
        // Previous media item
        if (hasMedia && mediaIndex > 0) {
          setMediaIndex((prev) => prev - 1);
        }
        break;
      case "]":
        // Next media item
        if (hasMedia && mediaIndex < mediaCount - 1) {
          setMediaIndex((prev) => prev + 1);
        }
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

  // Media info section - colored labels like bird-tui
  const mediaContent = hasMedia ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {tweet.media?.map((item, idx) => {
          const dims =
            item.width && item.height ? ` (${item.width}x${item.height})` : "";
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
          const isSelected = idx === mediaIndex;
          return (
            <text key={item.id} fg={typeColor}>
              {isSelected ? ">" : "•"} {typeLabel}
              {mediaCount > 1 ? ` ${idx + 1}` : ""}
              {dims}
              {"  "}
            </text>
          );
        })}
        <text fg="#666666">(</text>
        <text fg={X_BLUE}>i</text>
        <text fg="#666666"> view, </text>
        <text fg={X_BLUE}>d</text>
        <text fg="#666666"> download)</text>
      </box>
    </box>
  ) : null;

  // Status message (for media operations feedback)
  const statusContent = statusMessage ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg="#00aa00">{statusMessage}</text>
    </box>
  ) : null;

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
      <text fg="#666666"> like </text>
      <text fg="#ffffff">p</text>
      <text fg="#666666"> profile</text>
      {hasMedia && (
        <>
          <text fg="#ffffff"> i</text>
          <text fg="#666666"> preview </text>
          <text fg="#ffffff">d</text>
          <text fg="#666666"> download</text>
          {mediaCount > 1 && (
            <>
              <text fg="#ffffff"> [/]</text>
              <text fg="#666666"> media</text>
            </>
          )}
        </>
      )}
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
          {mediaContent}
        </scrollbox>
        {statusContent}
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
        {mediaContent}
      </box>
      {statusContent}
      {footerContent}
    </box>
  );
}
