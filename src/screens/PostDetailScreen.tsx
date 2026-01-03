/**
 * PostDetailScreen - Full post view with thread context
 * Shows parent tweet (if reply), main tweet, and replies below
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { PostCard } from "@/components/PostCard";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { useListNavigation } from "@/hooks/useListNavigation";
import { usePostDetail } from "@/hooks/usePostDetail";
import { formatCount, truncateText } from "@/lib/format";
import {
  previewMedia,
  downloadMedia,
  openInBrowser,
  fetchLinkMetadata,
  type LinkMetadata,
} from "@/lib/media";

const X_BLUE = "#1DA1F2";
const COLOR_SUCCESS = "#17BF63";
const COLOR_WARNING = "#FFAD1F";

/**
 * Generate element ID for reply cards (for scroll targeting)
 */
function getReplyCardId(tweetId: string): string {
  return `reply-${tweetId}`;
}

/**
 * Recursively find a child element by ID within a scrollbox
 */
function findChildById(
  children: { id?: string; getChildren?: () => unknown[] }[],
  targetId: string
): { y: number; height: number } | null {
  for (const child of children) {
    if (child.id === targetId) {
      return child as { y: number; height: number };
    }
    if (typeof child.getChildren === "function") {
      const nested = child.getChildren() as {
        id?: string;
        getChildren?: () => unknown[];
      }[];
      const found = findChildById(nested, targetId);
      if (found) return found;
    }
  }
  return null;
}

// Maximum lines for truncated content view
// Keeps initial view compact; user can expand with 'e'
const MAX_TRUNCATED_LINES = 10;

interface PostDetailScreenProps {
  /** Twitter API client for fetching thread data */
  client: TwitterClient;
  tweet: TweetData;
  focused?: boolean;
  onBack?: () => void;
  onProfileOpen?: (username: string) => void;
  /** Called when user presses 'l' to toggle like */
  onLike?: () => void;
  /** Called when user presses 'b' to toggle bookmark */
  onBookmark?: () => void;
  /** Called when user presses 'm' to move bookmark to folder */
  onMoveToFolder?: () => void;
  /** Whether the tweet is currently liked */
  isLiked?: boolean;
  /** Whether the tweet is currently bookmarked */
  isBookmarked?: boolean;
  /** External action message to display (from parent) */
  actionMessage?: string | null;
  /** Called when user selects a reply to view */
  onReplySelect?: (reply: TweetData) => void;
  /** Get action state for a tweet */
  getActionState?: (tweetId: string) => { liked: boolean; bookmarked: boolean };
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

/**
 * Render text with @mentions highlighted in blue using <span> inside <text>
 * Uses OpenTUI's text helper components for inline styling
 */
function renderTextWithMentions(
  text: string,
  mentionColor: string,
  textColor: string
): React.ReactNode {
  // Match @username (alphanumeric and underscores)
  const mentionRegex = /@(\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${keyIdx++}`} fg={textColor}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    // Add the mention in blue
    parts.push(
      <span key={`mention-${keyIdx++}`} fg={mentionColor}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${keyIdx++}`} fg={textColor}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  // If no mentions found, just return plain text
  if (parts.length === 0) {
    return <text fg={textColor}>{text}</text>;
  }

  return <text>{parts}</text>;
}

export function PostDetailScreen({
  client,
  tweet,
  focused = false,
  onBack,
  onProfileOpen,
  onLike,
  onBookmark,
  onMoveToFolder,
  isLiked = false,
  isBookmarked = false,
  actionMessage,
  onReplySelect,
  getActionState,
}: PostDetailScreenProps) {
  // Fetch thread context (parent tweet and replies)
  const { parentTweet, replies, loadingParent, loadingReplies } = usePostDetail(
    { client, tweet }
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [linkIndex, setLinkIndex] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [repliesMode, setRepliesMode] = useState(false);
  const [mentionsMode, setMentionsMode] = useState(false);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  // Reset state when viewing a different tweet (e.g., navigating to a reply)
  useEffect(() => {
    setRepliesMode(false);
    setMentionsMode(false);
    setIsExpanded(false);
    setMediaIndex(0);
    setLinkIndex(0);
    setMentionIndex(0);
    setLinkMetadata(null);
    setStatusMessage(null);
    // Scroll to top when tweet changes
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0);
    }
  }, [tweet.id]);

  const hasMedia = tweet.media && tweet.media.length > 0;
  const mediaCount = tweet.media?.length ?? 0;
  const currentMedia = hasMedia ? tweet.media?.[mediaIndex] : undefined;

  const hasLinks = tweet.urls && tweet.urls.length > 0;
  const linkCount = tweet.urls?.length ?? 0;
  const currentLink = hasLinks ? tweet.urls?.[linkIndex] : undefined;

  const hasMentions = tweet.mentions && tweet.mentions.length > 0;
  const mentionCount = tweet.mentions?.length ?? 0;
  const currentMention = hasMentions
    ? tweet.mentions?.[mentionIndex]
    : undefined;

  const fullTimestamp = formatFullTimestamp(tweet.createdAt);
  const showTruncated =
    !isExpanded && needsTruncation(tweet.text, MAX_TRUNCATED_LINES);
  const displayText = showTruncated
    ? truncateText(tweet.text, MAX_TRUNCATED_LINES)
    : tweet.text;

  const hasReplies = replies.length > 0;
  const isReply = !!tweet.inReplyToStatusId;

  // List navigation for replies
  const {
    selectedIndex: selectedReplyIndex,
    setSelectedIndex: setSelectedReplyIndex,
  } = useListNavigation({
    itemCount: replies.length,
    enabled: focused && repliesMode && hasReplies,
    onSelect: (index) => {
      const reply = replies[index];
      if (reply && onReplySelect) {
        onReplySelect(reply);
      }
    },
  });

  // Scroll selected reply into view when navigating in replies mode
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox || !repliesMode || replies.length === 0) return;

    const selectedReply = replies[selectedReplyIndex];
    if (!selectedReply) return;

    const targetId = getReplyCardId(selectedReply.id);
    // Use recursive search since PostCards are nested inside boxes
    const children = scrollbox.getChildren() as {
      id?: string;
      getChildren?: () => unknown[];
    }[];
    const target = findChildById(children, targetId);
    if (!target) return;

    // Calculate the element's position relative to the scrollbox viewport
    const relativeY = target.y - scrollbox.y;
    const viewportHeight = scrollbox.viewport.height;

    // Scroll margins to keep selected item visible with context
    const topMargin = Math.max(2, Math.floor(viewportHeight / 8));
    const bottomMargin = Math.max(4, Math.floor(viewportHeight / 4));

    // If element is below viewport, scroll down
    if (relativeY + target.height > viewportHeight - bottomMargin) {
      scrollbox.scrollBy(
        relativeY + target.height - viewportHeight + bottomMargin
      );
    }
    // If element is above viewport, scroll up
    else if (relativeY < topMargin) {
      scrollbox.scrollBy(relativeY - topMargin);
    }
  }, [selectedReplyIndex, repliesMode, replies]);

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

  // Fetch link metadata when selected link changes
  useEffect(() => {
    if (!currentLink) {
      setLinkMetadata(null);
      return;
    }

    let cancelled = false;
    setIsLoadingMetadata(true);

    fetchLinkMetadata(currentLink).then((metadata) => {
      if (!cancelled) {
        setLinkMetadata(metadata);
        setIsLoadingMetadata(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentLink]);

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

  // Handle mention profile navigation (Enter key when mention is selected)
  const handleMentionProfile = useCallback(() => {
    if (!currentMention) return;
    setStatusMessage(`Opening @${currentMention.username}...`);
    onProfileOpen?.(currentMention.username);
  }, [currentMention, onProfileOpen]);

  // Handle open in browser (o key)
  // Opens selected link if available, otherwise opens the tweet itself
  const handleOpenInBrowser = useCallback(async () => {
    const urlToOpen = currentLink
      ? currentLink.expandedUrl
      : `https://x.com/${tweet.author.username}/status/${tweet.id}`;

    const label = currentLink ? currentLink.displayUrl : "tweet";
    setStatusMessage(`Opening ${label}...`);

    try {
      await openInBrowser(urlToOpen);
      setStatusMessage(`Opened ${label}`);
    } catch {
      setStatusMessage("Failed to open browser");
    }
  }, [currentLink, tweet.author.username, tweet.id]);

  useKeyboard((key) => {
    if (!focused) return;

    // Handle mentions mode navigation
    if (mentionsMode && hasMentions) {
      // Exit mentions mode with escape or h
      if (key.name === "escape" || key.name === "h") {
        setMentionsMode(false);
        return;
      }
      // Navigate mentions with j/k
      if (key.name === "j" || key.name === "down") {
        if (mentionIndex < mentionCount - 1) {
          setMentionIndex((prev) => prev + 1);
        }
        return;
      }
      if (key.name === "k" || key.name === "up") {
        if (mentionIndex > 0) {
          setMentionIndex((prev) => prev - 1);
        }
        return;
      }
      // Open mention profile with Enter
      if (key.name === "return") {
        handleMentionProfile();
        return;
      }
      // Other keys exit mentions mode and proceed
    }

    // Handle replies mode navigation separately
    if (repliesMode && hasReplies) {
      // Exit replies mode with escape or h
      if (key.name === "escape" || key.name === "h") {
        setRepliesMode(false);
        return;
      }
      // j/k/g/G/return are handled by useListNavigation
      // Other keys should work normally
      if (
        key.name === "j" ||
        key.name === "k" ||
        key.name === "g" ||
        key.name === "G" ||
        key.name === "down" ||
        key.name === "up" ||
        key.name === "return" ||
        key.name === "u"
      ) {
        return;
      }
    }

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
        handleOpenInBrowser();
        break;
      case "b":
        onBookmark?.();
        break;
      case "l":
        onLike?.();
        break;
      case "m":
        // Handle mentions: single = direct profile, multiple = enter mode
        if (hasMentions && !mentionsMode) {
          if (mentionCount === 1) {
            // Single mention - open profile directly
            const mention = tweet.mentions?.[0];
            if (mention) {
              setStatusMessage(`Opening @${mention.username}...`);
              onProfileOpen?.(mention.username);
            }
          } else {
            // Multiple mentions - enter navigation mode
            setMentionsMode(true);
            setMentionIndex(0);
          }
        } else if (isBookmarked) {
          onMoveToFolder?.();
        }
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
      case ",":
        // Previous link (< key without shift)
        if (hasLinks && linkIndex > 0) {
          setLinkIndex((prev) => prev - 1);
        }
        break;
      case ".":
        // Next link (> key without shift)
        if (hasLinks && linkIndex < linkCount - 1) {
          setLinkIndex((prev) => prev + 1);
        }
        break;
      case "r":
        // Toggle replies mode if there are replies
        if (hasReplies) {
          setRepliesMode((prev) => {
            if (!prev) {
              // Entering replies mode - reset selection to first reply
              setSelectedReplyIndex(0);
            }
            return !prev;
          });
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
      <text fg="#888888">
        {repliesMode || mentionsMode ? "<- Back (Esc) | " : "<- Back (Esc)"}
      </text>
      {repliesMode && <text fg={X_BLUE}>Navigating replies</text>}
      {mentionsMode && <text fg={X_BLUE}>Navigating mentions</text>}
    </box>
  );

  // Parent tweet section (if this is a reply)
  const parentContent =
    isReply && (loadingParent || parentTweet) ? (
      <box
        style={{
          marginBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          borderStyle: "single",
          borderColor: "#444444",
        }}
      >
        {loadingParent ? (
          <text fg="#666666">Loading parent tweet...</text>
        ) : parentTweet ? (
          <box style={{ flexDirection: "column" }}>
            <box style={{ flexDirection: "row" }}>
              <text fg="#666666">Replying to </text>
              <text fg={X_BLUE}>@{parentTweet.author.username}</text>
              <text fg="#888888"> · {parentTweet.author.name}</text>
            </box>
            <box style={{ marginTop: 1 }}>
              <text fg="#aaaaaa">{truncateText(parentTweet.text, 3)}</text>
            </box>
          </box>
        ) : null}
      </box>
    ) : null;

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

  // Post content with @mentions highlighted in blue
  const postContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      {hasMentions ? (
        renderTextWithMentions(displayText, X_BLUE, "#ffffff")
      ) : (
        <text fg="#ffffff">{displayText}</text>
      )}
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

  // Links section - show URLs with metadata
  const linksContent = hasLinks ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row" }}>
          <text fg="#666666">Links: </text>
          {linkCount > 1 && (
            <>
              <text fg={X_BLUE}>,/.</text>
              <text fg="#666666"> navigate </text>
            </>
          )}
          <text fg={X_BLUE}>o</text>
          <text fg="#666666"> open</text>
        </box>
        {tweet.urls?.map((link, idx) => {
          const isSelected = idx === linkIndex;
          const showMetadata = isSelected && linkMetadata;
          return (
            <box
              key={link.url}
              style={{ flexDirection: "column", marginTop: idx === 0 ? 1 : 0 }}
            >
              <box style={{ flexDirection: "row" }}>
                <text fg={isSelected ? X_BLUE : "#888888"}>
                  {isSelected ? ">" : " "} {link.displayUrl}
                </text>
              </box>
              {showMetadata && linkMetadata.title && (
                <box style={{ paddingLeft: 2 }}>
                  <text fg="#666666"> "{linkMetadata.title}"</text>
                </box>
              )}
              {isSelected && isLoadingMetadata && (
                <box style={{ paddingLeft: 2 }}>
                  <text fg="#666666"> Loading...</text>
                </box>
              )}
            </box>
          );
        })}
      </box>
    </box>
  ) : null;

  // Mentions section - simplified UI based on count
  const firstMention = tweet.mentions?.[0];
  const mentionsContent = hasMentions ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "column" }}>
        {mentionCount === 1 ? (
          // Single mention - show directly with profile shortcut
          <box style={{ flexDirection: "row" }}>
            <text fg="#666666">Mentions: </text>
            <text fg={X_BLUE}>@{firstMention?.username}</text>
            {firstMention?.name && (
              <text fg="#666666"> · {firstMention.name}</text>
            )}
            <text fg="#666666"> (</text>
            <text fg={X_BLUE}>m</text>
            <text fg="#666666"> profile)</text>
          </box>
        ) : mentionsMode ? (
          // Multiple mentions - navigation mode active
          <>
            <box style={{ flexDirection: "row" }}>
              <text fg="#666666">Mentions ({mentionCount}): </text>
              <text fg={X_BLUE}>j/k</text>
              <text fg="#666666"> navigate </text>
              <text fg={X_BLUE}>Enter</text>
              <text fg="#666666"> profile</text>
            </box>
            {tweet.mentions?.map((mention, idx) => {
              const isSelected = idx === mentionIndex;
              return (
                <box
                  key={mention.username}
                  style={{ flexDirection: "row", marginTop: idx === 0 ? 1 : 0 }}
                >
                  <text fg={isSelected ? X_BLUE : "#888888"}>
                    {isSelected ? ">" : " "} @{mention.username}
                  </text>
                  {mention.name && <text fg="#666666"> · {mention.name}</text>}
                </box>
              );
            })}
          </>
        ) : (
          // Multiple mentions - collapsed view
          <box style={{ flexDirection: "row" }}>
            <text fg="#666666">Mentions: </text>
            <text fg={X_BLUE}>@{firstMention?.username}</text>
            <text fg="#666666"> +{mentionCount - 1} more (</text>
            <text fg={X_BLUE}>m</text>
            <text fg="#666666"> to navigate)</text>
          </box>
        )}
      </box>
    </box>
  ) : null;

  // Replies section
  const repliesContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row" }}>
          <text fg="#ffffff">Replies</text>
          {hasReplies && (
            <>
              <text fg="#666666"> ({replies.length}) </text>
              {!repliesMode && (
                <>
                  <text fg={X_BLUE}>r</text>
                  <text fg="#666666"> to navigate</text>
                </>
              )}
            </>
          )}
        </box>

        {loadingReplies ? (
          <box>
            <text fg="#666666">Loading replies...</text>
          </box>
        ) : hasReplies ? (
          <box style={{ flexDirection: "column" }}>
            {replies.map((reply, idx) => {
              const state = getActionState?.(reply.id);
              return (
                <PostCard
                  key={reply.id}
                  id={getReplyCardId(reply.id)}
                  post={reply}
                  isSelected={repliesMode && idx === selectedReplyIndex}
                  isLiked={state?.liked}
                  isBookmarked={state?.bookmarked}
                />
              );
            })}
          </box>
        ) : (
          <box>
            <text fg="#666666">No replies yet</text>
          </box>
        )}
      </box>
    </box>
  );

  // Status message (for media operations and action feedback)
  const displayMessage = actionMessage ?? statusMessage;
  const isError = displayMessage?.startsWith("Error:");
  const statusContent = displayMessage ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={isError ? "#E0245E" : "#00aa00"}>{displayMessage}</text>
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
        flexWrap: "wrap",
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
      <text fg={isBookmarked ? X_BLUE : "#666666"}>
        {isBookmarked ? " ⚑" : " bookmark"}{" "}
      </text>
      {isBookmarked && !hasMentions && (
        <>
          <text fg="#ffffff">m</text>
          <text fg="#666666"> folder </text>
        </>
      )}
      <text fg="#ffffff">l</text>
      <text fg={isLiked ? "#E0245E" : "#666666"}>
        {isLiked ? " ♥" : " like"}{" "}
      </text>
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
      {hasMentions && !mentionsMode && (
        <>
          <text fg="#ffffff"> m</text>
          <text fg="#666666">
            {mentionCount === 1 ? " @profile" : " mentions"}
          </text>
        </>
      )}
      {hasReplies && !repliesMode && (
        <>
          <text fg="#ffffff"> r</text>
          <text fg="#666666"> replies</text>
        </>
      )}
    </box>
  );

  // Main layout - always use scrollbox for thread content
  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {headerContent}
      <scrollbox
        ref={scrollRef}
        focused={focused && !repliesMode}
        style={{ flexGrow: 1, height: "100%" }}
      >
        {parentContent}
        {authorContent}
        {postContent}
        {truncationIndicator}
        {quotedContent}
        {statsContent}
        {mediaContent}
        {linksContent}
        {mentionsContent}
        {repliesContent}
      </scrollbox>
      {statusContent}
      {footerContent}
    </box>
  );
}
