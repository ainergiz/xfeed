/**
 * PostCard - Individual post display component
 */

import type { MouseEvent } from "@opentui/core";

import { useRef, useState } from "react";

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import {
  formatCount,
  formatRelativeTime,
  isTruncated,
  truncateText,
} from "@/lib/format";

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
  /** Called when the card is clicked (not on action icons) */
  onCardClick?: () => void;
  /** Called when the like icon is clicked */
  onLikeClick?: () => void;
  /** Called when the bookmark icon is clicked */
  onBookmarkClick?: () => void;
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
  onCardClick,
  onLikeClick,
  onBookmarkClick,
}: PostCardProps) {
  // Track drag state to differentiate clicks from text selection
  // Using refs to avoid re-renders on mouse events
  const cardDragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const likeDragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const bookmarkDragState = useRef({ isDragging: false, startX: 0, startY: 0 });

  // Threshold in pixels - if mouse moves more than this, it's a drag not a click
  const DRAG_THRESHOLD = 3;

  // Mouse handler that differentiates between click and drag/selection
  const handleCardMouse = onCardClick
    ? (event: MouseEvent) => {
        if (event.button !== 0) return; // Only handle left clicks

        if (event.type === "down") {
          cardDragState.current = {
            isDragging: false,
            startX: event.x,
            startY: event.y,
          };
        } else if (event.type === "drag") {
          const dx = Math.abs(event.x - cardDragState.current.startX);
          const dy = Math.abs(event.y - cardDragState.current.startY);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            cardDragState.current.isDragging = true;
          }
        } else if (event.type === "up") {
          if (!cardDragState.current.isDragging) {
            onCardClick();
          }
          cardDragState.current.isDragging = false;
        }
      }
    : undefined;

  const handleLikeMouse = onLikeClick
    ? (event: MouseEvent) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        if (event.type === "down") {
          likeDragState.current = {
            isDragging: false,
            startX: event.x,
            startY: event.y,
          };
        } else if (event.type === "drag") {
          const dx = Math.abs(event.x - likeDragState.current.startX);
          const dy = Math.abs(event.y - likeDragState.current.startY);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            likeDragState.current.isDragging = true;
          }
        } else if (event.type === "up") {
          if (!likeDragState.current.isDragging) {
            onLikeClick();
          }
          likeDragState.current.isDragging = false;
        }
      }
    : undefined;

  const handleBookmarkMouse = onBookmarkClick
    ? (event: MouseEvent) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        if (event.type === "down") {
          bookmarkDragState.current = {
            isDragging: false,
            startX: event.x,
            startY: event.y,
          };
        } else if (event.type === "drag") {
          const dx = Math.abs(event.x - bookmarkDragState.current.startX);
          const dy = Math.abs(event.y - bookmarkDragState.current.startY);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            bookmarkDragState.current.isDragging = true;
          }
        } else if (event.type === "up") {
          if (!bookmarkDragState.current.isDragging) {
            onBookmarkClick();
          }
          bookmarkDragState.current.isDragging = false;
        }
      }
    : undefined;

  // Hover state for action icons
  const [isLikeHovered, setIsLikeHovered] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  const textToDisplay = parentAuthorUsername
    ? stripLeadingMention(post.text, parentAuthorUsername)
    : post.text;
  const displayText = truncateText(textToDisplay, MAX_TEXT_LINES);
  const showShowMore = isTruncated(textToDisplay, MAX_TEXT_LINES);
  const timeAgo = formatRelativeTime(post.createdAt);
  const hasMedia = post.media && post.media.length > 0;

  return (
    <box
      id={id}
      onMouse={handleCardMouse}
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
        <text>
          <b fg={colors.primary}>{post.author.name}</b>
        </text>
        <text fg={colors.handle}> @{post.author.username}</text>
        <text fg={colors.dim}>{timeAgo ? ` · ${timeAgo}` : ""}</text>
      </box>

      {/* Post text */}
      <box style={{ marginTop: 1, paddingLeft: 2, flexDirection: "column" }}>
        <text fg="#ffffff" selectable selectionBg="#264F78">
          {displayText}
        </text>
        {showShowMore && <text fg={colors.primary}>[Show more]</text>}
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
          onMouse={handleLikeMouse}
          onMouseOver={() => setIsLikeHovered(true)}
          onMouseOut={() => setIsLikeHovered(false)}
          fg={
            isJustLiked
              ? colors.success // Bright green flash
              : isLikeHovered
                ? colors.error // Red on hover (preview the liked state)
                : isLiked
                  ? colors.error // Red when liked
                  : colors.muted // Muted when not liked
          }
        >
          {"  "}
          {isLiked ? HEART_FILLED : <b>{HEART_EMPTY}</b>}
        </text>
        {/* Bookmark indicator - always visible, filled/empty based on state */}
        <text
          onMouse={handleBookmarkMouse}
          onMouseOver={() => setIsBookmarkHovered(true)}
          onMouseOut={() => setIsBookmarkHovered(false)}
          fg={
            isJustBookmarked
              ? colors.success // Bright green flash
              : isBookmarkHovered
                ? colors.primary // Blue on hover (preview the bookmarked state)
                : isBookmarked
                  ? colors.primary // Blue when bookmarked
                  : colors.muted // Muted when not bookmarked
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
                ? colors.warning
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
