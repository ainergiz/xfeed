/**
 * PostDetailScreen - Full post view with thread context
 * Shows parent tweet (if reply), main tweet, and replies below
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect, useCallback } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { Footer, type Keybinding } from "@/components/Footer";
import { PostCard } from "@/components/PostCard";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { usePostDetailQuery } from "@/experiments/use-post-detail-query";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";
import { formatCount, truncateText } from "@/lib/format";
import {
  previewAllMedia,
  downloadAllMedia,
  openInBrowser,
  fetchLinkMetadata,
  type LinkMetadata,
} from "@/lib/media";
import { renderTextWithMentions } from "@/lib/text";

// Unicode symbols for like/bookmark states
const HEART_EMPTY = "\u2661"; // ♡
const HEART_FILLED = "\u2665"; // ♥
const FLAG_EMPTY = "\u2690"; // ⚐
const FLAG_FILLED = "\u2691"; // ⚑

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
  /** X API client for fetching thread data */
  client: XClient;
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
  /** True briefly after liking (for visual pulse feedback) */
  isJustLiked?: boolean;
  /** True briefly after bookmarking (for visual pulse feedback) */
  isJustBookmarked?: boolean;
  /** Called when user selects a reply to view */
  onReplySelect?: (reply: TweetData) => void;
  /** Get action state for a tweet */
  getActionState?: (tweetId: string) => { liked: boolean; bookmarked: boolean };
  /** Called when user presses 't' to view thread (when no quoted tweet) */
  onThreadView?: () => void;
  /** Called when user presses 'u' to navigate into a quoted tweet */
  onQuoteSelect?: (quotedTweet: TweetData) => void;
  /** Whether a quote is currently being fetched */
  isLoadingQuote?: boolean;
  /** Called when user presses 'g' to navigate to parent tweet */
  onParentSelect?: (parentTweet: TweetData) => void;
  /** Whether a parent tweet is currently being fetched */
  isLoadingParent?: boolean;
  /** Whether to show the footer */
  showFooter?: boolean;
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
  isJustLiked = false,
  isJustBookmarked = false,
  onReplySelect,
  getActionState,
  onThreadView,
  onQuoteSelect,
  isLoadingQuote = false,
  onParentSelect,
  isLoadingParent = false,
  showFooter = true,
}: PostDetailScreenProps) {
  // Fetch thread context (parent tweet and replies) with pagination
  const {
    parentTweet,
    replies,
    loadingParent,
    loadingReplies,
    loadingMoreReplies,
    hasMoreReplies,
    loadMoreReplies,
  } = usePostDetailQuery({ client, tweet });
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [linkIndex, setLinkIndex] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [linkMetadata, setLinkMetadata] = useState<LinkMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [repliesMode, setRepliesMode] = useState(false);
  const [mentionsMode, setMentionsMode] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  // Reset state when viewing a different tweet (e.g., navigating to a reply)
  useEffect(() => {
    setRepliesMode(false);
    setMentionsMode(false);
    setLinkMode(false);
    setIsExpanded(false);
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
  const hasQuote = !!tweet.quotedTweet;

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

  // Trigger load more when approaching the end of replies list
  useEffect(() => {
    if (
      !repliesMode ||
      loadingMoreReplies ||
      !hasMoreReplies ||
      replies.length === 0
    )
      return;

    // Load more when within 3 replies of the end
    const threshold = 3;
    if (selectedReplyIndex >= replies.length - threshold) {
      loadMoreReplies();
    }
  }, [
    selectedReplyIndex,
    replies.length,
    loadingMoreReplies,
    hasMoreReplies,
    repliesMode,
    loadMoreReplies,
  ]);

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

  // Handle media preview (i key) - opens slideshow for photos, browser for videos
  const handlePreview = useCallback(async () => {
    if (!hasMedia || !tweet.media) return;
    setStatusMessage("Opening...");

    // previewAllMedia handles both single and multiple items, plus videos
    const result = await previewAllMedia(tweet.media, tweet.id);
    setStatusMessage(result.success ? result.message : result.error);
  }, [hasMedia, tweet.media, tweet.id]);

  // Handle media download (d key) - downloads all media
  const handleDownload = useCallback(async () => {
    if (!tweet.media || tweet.media.length === 0) return;
    setStatusMessage("Downloading...");
    const result = await downloadAllMedia(tweet.media, tweet.id);
    setStatusMessage(result.success ? result.message : result.error);
  }, [tweet.media, tweet.id]);

  // Handle mention profile navigation (Enter key when mention is selected)
  const handleMentionProfile = useCallback(() => {
    if (!currentMention) return;
    setStatusMessage(`Opening @${currentMention.username}...`);
    onProfileOpen?.(currentMention.username);
  }, [currentMention, onProfileOpen]);

  // Handle open tweet on x.com (x key)
  // Always opens the tweet itself
  const handleOpenTweet = useCallback(async () => {
    const urlToOpen = `https://x.com/${tweet.author.username}/status/${tweet.id}`;
    setStatusMessage("Opening on x.com...");

    try {
      await openInBrowser(urlToOpen);
      setStatusMessage("Opened on x.com");
    } catch {
      setStatusMessage("Failed to open browser");
    }
  }, [tweet.author.username, tweet.id]);

  // Handle open external link in browser (o key)
  // Opens the currently selected external link with domain highlight
  const handleOpenLink = useCallback(async () => {
    if (!currentLink) {
      setStatusMessage("No external link selected");
      return;
    }

    // Extract and highlight domain for user awareness
    let domain = "";
    try {
      const url = new URL(currentLink.expandedUrl);
      domain = url.hostname;
    } catch {
      domain = currentLink.displayUrl;
    }

    // Check for suspicious URL patterns
    const isSuspicious =
      // IP address instead of domain
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(domain) ||
      // Excessive subdomains (potential phishing)
      domain.split(".").length > 4 ||
      // Known suspicious TLDs
      /\.(xyz|top|click|loan|work|gq|ml|cf|tk)$/i.test(domain);

    if (isSuspicious) {
      setStatusMessage(`⚠ Opening [${domain}] - verify this domain`);
    } else {
      setStatusMessage(`Opening [${domain}]...`);
    }

    try {
      await openInBrowser(currentLink.expandedUrl);
      setStatusMessage(`Opened [${domain}]`);
    } catch {
      setStatusMessage("Failed to open browser");
    }
  }, [currentLink]);

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

    // Handle link mode navigation
    if (linkMode && hasLinks) {
      // Exit link mode with escape or h
      if (key.name === "escape" || key.name === "h") {
        setLinkMode(false);
        return;
      }
      // Navigate links with j/k
      if (key.name === "j" || key.name === "down") {
        if (linkIndex < linkCount - 1) {
          setLinkIndex((prev) => prev + 1);
        }
        return;
      }
      if (key.name === "k" || key.name === "up") {
        if (linkIndex > 0) {
          setLinkIndex((prev) => prev - 1);
        }
        return;
      }
      // Open link with o or Enter
      if (key.name === "o" || key.name === "return") {
        handleOpenLink();
        return;
      }
      // Other keys exit link mode and proceed
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
      case "x":
        // Open tweet on x.com
        handleOpenTweet();
        break;
      case "o":
        // Handle links: single = open directly, multiple = enter mode
        if (hasLinks && !linkMode) {
          if (linkCount === 1) {
            // Single link - open directly
            handleOpenLink();
          } else {
            // Multiple links - enter navigation mode
            setLinkMode(true);
            setLinkIndex(0);
          }
        }
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
        // Preview media (slideshow for multiple photos, browser for videos)
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
      case "t":
        // Open thread view
        onThreadView?.();
        break;
      case "g":
        // Navigate to parent tweet
        if (isReply && parentTweet && !isLoadingParent) {
          onParentSelect?.(parentTweet);
        }
        break;
      case "u":
      case "return":
        // Navigate into quoted tweet (same as timeline enter behavior)
        if (hasQuote && tweet.quotedTweet && !isLoadingQuote) {
          onQuoteSelect?.(tweet.quotedTweet);
        }
        break;
    }
  });

  // Header with back hint
  const isInNavigationMode = repliesMode || mentionsMode || linkMode;
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
      <text fg={colors.muted}>
        {isInNavigationMode ? "<- Back (Esc) | " : "<- Back (Esc)"}
      </text>
      {repliesMode && <text fg={colors.primary}>Navigating replies</text>}
      {mentionsMode && <text fg={colors.primary}>Navigating mentions</text>}
      {linkMode && (
        <text fg={colors.primary}>
          Navigating links ({linkIndex + 1}/{linkCount})
        </text>
      )}
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
          <text fg={colors.dim}>Loading parent tweet...</text>
        ) : parentTweet ? (
          <box style={{ flexDirection: "column" }}>
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}>Replying to </text>
              <text fg={colors.muted}>{parentTweet.author.name}</text>
              <text fg={colors.reply}> @{parentTweet.author.username}</text>
            </box>
            <box style={{ marginTop: 1 }}>
              <text fg="#aaaaaa" selectable selectionBg="#264F78">
                {truncateText(parentTweet.text, 3)}
              </text>
            </box>
          </box>
        ) : null}
      </box>
    ) : null;

  // Author info
  const authorContent = (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text>
          <b fg={colors.primary}>{tweet.author.name}</b>
        </text>
        <text fg={colors.handle}> @{tweet.author.username}</text>
      </box>
      {fullTimestamp && (
        <box style={{ marginTop: 0 }}>
          <text fg={colors.dim}>{fullTimestamp}</text>
        </box>
      )}
    </box>
  );

  // Post content with @mentions highlighted in blue
  const postContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      {hasMentions ? (
        renderTextWithMentions(displayText, colors.mention, "#ffffff")
      ) : (
        <text fg="#ffffff" selectable selectionBg="#264F78">
          {displayText}
        </text>
      )}
    </box>
  );

  // Truncation indicator
  const truncationIndicator = showTruncated ? (
    <box style={{ paddingLeft: 1, marginTop: 1 }}>
      <text fg={colors.dim}>... </text>
      <text fg={colors.primary}>[e] Expand</text>
    </box>
  ) : null;

  // Quoted tweet (if present)
  const quotedContent = tweet.quotedTweet ? (
    <box style={{ paddingLeft: 1, paddingRight: 1, marginTop: 1 }}>
      <QuotedPostCard post={tweet.quotedTweet} showNavigationHint />
    </box>
  ) : null;

  // Stats bar
  const statsContent = (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={colors.muted}>
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
              ? colors.warning
              : item.type === "video"
                ? colors.warning
                : colors.success;
          return (
            <text key={item.id} fg={typeColor}>
              • {typeLabel}
              {mediaCount > 1 ? ` ${idx + 1}` : ""}
              {dims}
              {"  "}
            </text>
          );
        })}
        <text fg={colors.dim}>(</text>
        <text fg={colors.primary}>i</text>
        <text fg={colors.dim}> view, </text>
        <text fg={colors.primary}>d</text>
        <text fg={colors.dim}> download)</text>
      </box>
    </box>
  ) : null;

  // Links section - show URLs with metadata
  const linksContent = hasLinks ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row" }}>
          <text fg={colors.dim}>Links: </text>
          <text fg={colors.primary}>o</text>
          <text fg={colors.dim}>
            {linkMode ? " open" : linkCount === 1 ? " open" : " select"}
          </text>
        </box>
        {tweet.urls?.map((link, idx) => {
          // Only show selection indicator when in link mode
          const isSelected = linkMode && idx === linkIndex;
          const showMetadata = isSelected && linkMetadata;
          return (
            <box
              key={link.url}
              style={{ flexDirection: "column", marginTop: idx === 0 ? 1 : 0 }}
            >
              <box style={{ flexDirection: "row" }}>
                <text fg={isSelected ? colors.mention : colors.muted}>
                  {isSelected ? ">" : "•"} {link.displayUrl}
                </text>
              </box>
              {showMetadata && linkMetadata.title && (
                <box style={{ paddingLeft: 2 }}>
                  <text fg={colors.dim}> "{linkMetadata.title}"</text>
                </box>
              )}
              {isSelected && isLoadingMetadata && (
                <box style={{ paddingLeft: 2 }}>
                  <text fg={colors.dim}> Loading...</text>
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
            <text fg={colors.dim}>Mentions: </text>
            <text fg={colors.mention}>@{firstMention?.username}</text>
            {firstMention?.name && (
              <text fg={colors.dim}> · {firstMention.name}</text>
            )}
            <text fg={colors.dim}> (</text>
            <text fg={colors.primary}>m</text>
            <text fg={colors.dim}> profile)</text>
          </box>
        ) : mentionsMode ? (
          // Multiple mentions - navigation mode active
          <>
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}>Mentions ({mentionCount}): </text>
              <text fg={colors.primary}>j/k</text>
              <text fg={colors.dim}> navigate </text>
              <text fg={colors.primary}>Enter</text>
              <text fg={colors.dim}> profile</text>
            </box>
            {tweet.mentions?.map((mention, idx) => {
              const isSelected = idx === mentionIndex;
              return (
                <box
                  key={mention.username}
                  style={{ flexDirection: "row", marginTop: idx === 0 ? 1 : 0 }}
                >
                  <text fg={isSelected ? colors.mention : colors.muted}>
                    {isSelected ? ">" : " "} @{mention.username}
                  </text>
                  {mention.name && (
                    <text fg={colors.dim}> · {mention.name}</text>
                  )}
                </box>
              );
            })}
          </>
        ) : (
          // Multiple mentions - collapsed view
          <box style={{ flexDirection: "row" }}>
            <text fg={colors.dim}>Mentions: </text>
            <text fg={colors.mention}>@{firstMention?.username}</text>
            <text fg={colors.dim}> +{mentionCount - 1} more (</text>
            <text fg={colors.primary}>m</text>
            <text fg={colors.dim}> to navigate)</text>
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
              <text fg={colors.dim}>
                {" "}
                ({replies.length}
                {hasMoreReplies ? "+" : ""}){" "}
              </text>
              {!repliesMode && (
                <>
                  <text fg={colors.primary}>r</text>
                  <text fg={colors.dim}> to navigate</text>
                </>
              )}
            </>
          )}
        </box>

        {loadingReplies ? (
          <box>
            <text fg={colors.dim}>Loading replies...</text>
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
                  parentAuthorUsername={tweet.author.username}
                  mainPostAuthorUsername={tweet.author.username}
                />
              );
            })}
            {loadingMoreReplies && (
              <box style={{ paddingTop: 1 }}>
                <text fg={colors.dim}>Loading more replies...</text>
              </box>
            )}
          </box>
        ) : (
          <box>
            <text fg={colors.dim}>No replies yet</text>
          </box>
        )}
      </box>
    </box>
  );

  // Status message (for media operations like preview/download)
  const displayMessage = statusMessage;
  const isError = displayMessage?.startsWith("Error:");
  const statusContent = displayMessage ? (
    <box style={{ marginTop: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={isError ? colors.error : colors.success}>{displayMessage}</text>
    </box>
  ) : null;

  // Actions footer keybindings with green flash animation
  const footerBindings: Keybinding[] = [
    { key: "h/Esc", label: "back" },
    {
      key: "e",
      label: showTruncated ? "expand" : "collapse",
      show: showTruncated || isExpanded,
    },
    { key: "x", label: "x.com" },
    {
      key: "l",
      label: isLiked ? HEART_FILLED : HEART_EMPTY,
      activeColor: isJustLiked
        ? colors.success
        : isLiked
          ? colors.error
          : undefined,
      isActive: isLiked || isJustLiked,
    },
    {
      key: "b",
      label: isBookmarked ? FLAG_FILLED : FLAG_EMPTY,
      activeColor: isJustBookmarked
        ? colors.success
        : isBookmarked
          ? colors.primary
          : undefined,
      isActive: isBookmarked || isJustBookmarked,
    },
    { key: "p", label: "profile" },
    { key: "i", label: "view", show: hasMedia },
    { key: "d", label: "download", show: hasMedia },
    {
      key: "m",
      label: mentionCount === 1 ? "@profile" : "mentions",
      show: hasMentions && !mentionsMode,
    },
    { key: "r", label: "replies", show: hasReplies && !repliesMode },
    {
      key: "o",
      label: linkCount === 1 ? "link" : "links",
      show: hasLinks && !linkMode,
    },
    { key: "t", label: "thread" },
    {
      key: "g",
      label: isLoadingParent ? "loading..." : "parent",
      activeColor: isLoadingParent ? colors.primary : undefined,
      show: isReply && parentTweet !== null,
    },
    {
      key: "u",
      label: isLoadingQuote ? "loading..." : "quote",
      activeColor: isLoadingQuote ? colors.primary : undefined,
      show: hasQuote,
    },
    { key: "m", label: "folder", show: isBookmarked && !hasMentions },
  ];

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
      <Footer bindings={footerBindings} visible={showFooter} />
    </box>
  );
}
