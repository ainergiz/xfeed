/**
 * ProfileScreen - User profile view with bio and recent tweets
 * Supports collapsible header when scrolling through tweets
 */

import { useKeyboard } from "@opentui/react";
import { useState, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { PostList } from "@/components/PostList";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCount } from "@/lib/format";

const X_BLUE = "#1DA1F2";

interface ProfileScreenProps {
  client: TwitterClient;
  username: string;
  focused?: boolean;
  onBack?: () => void;
  onPostSelect?: (post: TweetData) => void;
}

export function ProfileScreen({
  client,
  username,
  focused = false,
  onBack,
  onPostSelect,
}: ProfileScreenProps) {
  const { user, tweets, loading, error, refresh } = useUserProfile({
    client,
    username,
  });

  // Track if header should be collapsed (when scrolled past first tweet)
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSelectedIndexChange = useCallback((index: number) => {
    setIsCollapsed(index > 0);
  }, []);

  // Handle keyboard shortcuts
  useKeyboard((key) => {
    if (!focused) return;

    switch (key.name) {
      case "escape":
      case "backspace":
      case "h":
        onBack?.();
        break;
      case "r":
        refresh();
        break;
    }
  });

  // Compact header for collapsed state - just name and handle
  const compactHeader = user && (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#666666">{"<- "}</text>
      <text fg="#ffffff">
        <b>{user.name}</b>
      </text>
      {user.isBlueVerified && <text fg={X_BLUE}> {"\u2713"}</text>}
      <text fg="#888888"> @{user.username}</text>
    </box>
  );

  // Full profile header with back hint, bio, and stats
  const fullHeader = user && (
    <box style={{ flexShrink: 0, flexDirection: "column" }}>
      {/* Back hint + Name + Handle on same line */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
        <text fg="#666666">{"<- "}</text>
        <text fg="#ffffff">
          <b>{user.name}</b>
        </text>
        {user.isBlueVerified && <text fg={X_BLUE}> {"\u2713"}</text>}
        <text fg="#888888"> @{user.username}</text>
      </box>

      {/* Bio */}
      {user.description && (
        <box style={{ paddingLeft: 1, paddingRight: 1 }}>
          <text fg="#cccccc">{user.description}</text>
        </box>
      )}

      {/* Stats */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
        <text fg="#ffffff">{formatCount(user.followersCount)}</text>
        <text fg="#888888"> Followers </text>
        <text fg="#666666">{"\u00B7"} </text>
        <text fg="#ffffff">{formatCount(user.followingCount)}</text>
        <text fg="#888888"> Following</text>
      </box>
    </box>
  );

  // Separator
  const separator = (
    <box style={{ paddingLeft: 1, paddingRight: 1, flexShrink: 0 }}>
      <text fg="#444444">{"─".repeat(50)}</text>
    </box>
  );

  // Footer
  const footerContent = (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#ffffff">h/Esc</text>
      <text fg="#666666"> back </text>
      <text fg="#ffffff">j/k</text>
      <text fg="#666666"> navigate </text>
      <text fg="#ffffff">Enter</text>
      <text fg="#666666"> view </text>
      <text fg="#ffffff">r</text>
      <text fg="#666666"> refresh</text>
    </box>
  );

  // Loading state
  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 1, flexDirection: "row" }}>
          <text fg="#666666">{"<- "}</text>
          <text fg="#888888">Loading profile...</text>
        </box>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 1, flexDirection: "row" }}>
          <text fg="#666666">{"<- "}</text>
          <text fg="#ff6666">Error: {error}</text>
        </box>
      </box>
    );
  }

  // User not found
  if (!user) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 1, flexDirection: "row" }}>
          <text fg="#666666">{"<- "}</text>
          <text fg="#888888">User not found</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {isCollapsed ? compactHeader : fullHeader}
      {separator}
      {tweets.length > 0 ? (
        <PostList
          posts={tweets}
          focused={focused}
          onPostSelect={onPostSelect}
          onSelectedIndexChange={handleSelectedIndexChange}
        />
      ) : (
        <box style={{ padding: 1, flexGrow: 1 }}>
          <text fg="#888888">No tweets to display</text>
        </box>
      )}
      {footerContent}
    </box>
  );
}
