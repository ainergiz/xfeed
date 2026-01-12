/**
 * QuotedPostCard - Compact display for quoted/embedded tweets
 */

import type { MouseEvent } from "@opentui/core";

import { useRef, useState } from "react";

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import { truncateText } from "@/lib/format";

const MAX_TEXT_LINES = 2;
const QUOTE_BORDER_COLOR = "#444444";
const QUOTE_BG = "#0d0d14";
const DRAG_THRESHOLD = 3;

interface QuotedPostCardProps {
  post: TweetData;
  /** Show [t] navigation hint */
  showNavigationHint?: boolean;
  /** Called when user clicks on the profile handle */
  onProfileOpen?: (username: string) => void;
}

export function QuotedPostCard({
  post,
  showNavigationHint = false,
  onProfileOpen,
}: QuotedPostCardProps) {
  const displayText = truncateText(post.text, MAX_TEXT_LINES);
  const handleDragState = useRef({ isDragging: false, startX: 0, startY: 0 });
  const [isHandleHovered, setIsHandleHovered] = useState(false);

  // Handle click handler for profile navigation
  const handleHandleMouse = onProfileOpen
    ? (event: MouseEvent) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        if (event.type === "down") {
          handleDragState.current = {
            isDragging: false,
            startX: event.x,
            startY: event.y,
          };
        } else if (event.type === "drag") {
          const dx = Math.abs(event.x - handleDragState.current.startX);
          const dy = Math.abs(event.y - handleDragState.current.startY);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            handleDragState.current.isDragging = true;
          }
        } else if (event.type === "up") {
          if (!handleDragState.current.isDragging) {
            onProfileOpen(post.author.username);
          }
          handleDragState.current.isDragging = false;
        }
      }
    : undefined;

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
          <text>
            <b fg={colors.quoted}>{post.author.name}</b>
          </text>
          <text
            onMouse={handleHandleMouse}
            onMouseOver={() => setIsHandleHovered(true)}
            onMouseOut={() => setIsHandleHovered(false)}
            fg={isHandleHovered ? colors.quoted : colors.handle}
          >
            {" "}@{post.author.username}
          </text>
          {showNavigationHint && <text fg={colors.dim}> [u]</text>}
        </box>

        {/* Quoted text (truncated) */}
        <box style={{ marginTop: 1 }}>
          <text fg="#aaaaaa" selectable selectionBg="#264F78">
            {displayText}
          </text>
        </box>
      </box>
    </box>
  );
}
