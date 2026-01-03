/**
 * ProfileScreen - User profile view with bio and recent tweets
 * Supports collapsible header when scrolling through tweets
 */

import { useKeyboard } from "@opentui/react";
import { useState, useCallback } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { PostList } from "@/components/PostList";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCount } from "@/lib/format";
import { openInBrowser, previewImageUrl } from "@/lib/media";

const X_BLUE = "#1DA1F2";

/**
 * Format X's created_at date to "Joined Month Year"
 */
function formatJoinDate(createdAt: string | undefined): string | undefined {
  if (!createdAt) return undefined;
  try {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return undefined;
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return undefined;
  }
}

/**
 * Extract display domain from a URL
 */
function extractDomain(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

interface ProfileScreenProps {
  client: XClient;
  username: string;
  focused?: boolean;
  onBack?: () => void;
  onPostSelect?: (post: TweetData) => void;
  /** Called when user presses 'l' to toggle like */
  onLike?: (post: TweetData) => void;
  /** Called when user presses 'b' to toggle bookmark */
  onBookmark?: (post: TweetData) => void;
  /** Get current action state for a tweet */
  getActionState?: (tweetId: string) => TweetActionState;
  /** Initialize action state from API data */
  initActionState?: (
    tweetId: string,
    liked: boolean,
    bookmarked: boolean
  ) => void;
  /** Action feedback message */
  actionMessage?: string | null;
}

export function ProfileScreen({
  client,
  username,
  focused = false,
  onBack,
  onPostSelect,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
  actionMessage,
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
      case "a":
        // Open avatar/profile photo in Quick Look
        if (user?.profileImageUrl) {
          previewImageUrl(user.profileImageUrl, `profile_${user.username}`);
        }
        break;
      case "v":
        // View banner image in Quick Look
        if (user?.bannerImageUrl) {
          previewImageUrl(user.bannerImageUrl, `banner_${user.username}`);
        }
        break;
      case "w":
        // Open website in browser
        if (user?.websiteUrl) {
          openInBrowser(user.websiteUrl);
        }
        break;
      case "x":
        // Open profile on x.com
        if (user?.username) {
          openInBrowser(`https://x.com/${user.username}`);
        }
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
  const joinDate = formatJoinDate(user?.createdAt);
  const websiteDomain = extractDomain(user?.websiteUrl);

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

      {/* Location, Website, Join Date row */}
      {(user.location || websiteDomain || joinDate) && (
        <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
          {user.location && (
            <>
              <text fg="#888888">{"\u{1F4CD}"} </text>
              <text fg="#aaaaaa">{user.location}</text>
            </>
          )}
          {user.location && websiteDomain && (
            <text fg="#666666"> {"\u00B7"} </text>
          )}
          {websiteDomain && (
            <>
              <text fg="#888888">{"\u{1F517}"} </text>
              <text fg={X_BLUE}>{websiteDomain}</text>
            </>
          )}
          {(user.location || websiteDomain) && joinDate && (
            <text fg="#666666"> {"\u00B7"} </text>
          )}
          {joinDate && (
            <>
              <text fg="#888888">{"\u{1F4C5}"} </text>
              <text fg="#aaaaaa">{joinDate}</text>
            </>
          )}
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

  // Footer - show available actions based on what data exists
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
      <text fg="#666666"> nav </text>
      <text fg="#ffffff">l</text>
      <text fg="#666666"> like </text>
      <text fg="#ffffff">b</text>
      <text fg="#666666"> bkmk </text>
      {user?.profileImageUrl && (
        <>
          <text fg="#ffffff">a</text>
          <text fg="#666666"> avatar </text>
        </>
      )}
      {user?.bannerImageUrl && (
        <>
          <text fg="#ffffff">v</text>
          <text fg="#666666"> banner </text>
        </>
      )}
      {user?.websiteUrl && (
        <>
          <text fg="#ffffff">w</text>
          <text fg="#666666"> web </text>
        </>
      )}
      <text fg="#ffffff">x</text>
      <text fg="#666666"> x.com </text>
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
      {actionMessage ? (
        <box style={{ paddingLeft: 1 }}>
          <text fg={actionMessage.startsWith("Error:") ? "#E0245E" : "#17BF63"}>
            {actionMessage}
          </text>
        </box>
      ) : null}
      {tweets.length > 0 ? (
        <PostList
          posts={tweets}
          focused={focused}
          onPostSelect={onPostSelect}
          onSelectedIndexChange={handleSelectedIndexChange}
          onLike={onLike}
          onBookmark={onBookmark}
          getActionState={getActionState}
          initActionState={initActionState}
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
