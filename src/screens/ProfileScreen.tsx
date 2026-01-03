/**
 * ProfileScreen - User profile view with bio and recent tweets
 * Supports collapsible header when scrolling through tweets
 * When viewing own profile (isSelf), shows tabs for Tweets/Likes
 */

import { useKeyboard } from "@opentui/react";
import { useState, useCallback, useEffect } from "react";

import type { XClient } from "@/api/client";
import type { TweetData, UserData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { Footer, type Keybinding } from "@/components/Footer";
import { PostList } from "@/components/PostList";
import { useUserActions } from "@/experiments/use-user-actions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { colors } from "@/lib/colors";
import { formatCount } from "@/lib/format";
import { openInBrowser, previewImageUrl } from "@/lib/media";
import { extractMentions, renderTextWithMentions } from "@/lib/text";

type ProfileTab = "tweets" | "likes";

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
  /** Current logged-in user (used to detect self-view) */
  currentUser?: UserData;
  focused?: boolean;
  onBack?: () => void;
  onPostSelect?: (post: TweetData) => void;
  /** Called when user navigates to a mentioned profile */
  onProfileOpen?: (username: string) => void;
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
  /** Whether to show the footer */
  showFooter?: boolean;
}

export function ProfileScreen({
  client,
  username,
  currentUser,
  focused = false,
  onBack,
  onPostSelect,
  onProfileOpen,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
  showFooter = true,
}: ProfileScreenProps) {
  // Detect if viewing own profile
  const isSelf = Boolean(
    currentUser && username.toLowerCase() === currentUser.username.toLowerCase()
  );

  const {
    user,
    tweets,
    loading,
    error,
    refresh,
    likedTweets,
    likesLoading,
    likesError,
    fetchLikes,
    likesFetched,
  } = useUserProfile({
    client,
    username,
    isSelf,
  });

  // User actions (follow/mute) - only for other profiles
  const userActions = useUserActions({
    client,
    username,
  });

  // Local state for following/muting (initialized from API, updated optimistically)
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMuting, setIsMuting] = useState(false);

  // Sync local state when user profile loads
  useEffect(() => {
    if (user) {
      setIsFollowing(user.following ?? false);
      setIsMuting(user.muting ?? false);
    }
  }, [user]);

  // Tab state (only used when isSelf)
  const [activeTab, setActiveTab] = useState<ProfileTab>("tweets");

  // Track if header should be collapsed (when scrolled past first tweet)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Mentions navigation state
  const [mentionsMode, setMentionsMode] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Fetch likes when switching to likes tab for the first time
  useEffect(() => {
    if (isSelf && activeTab === "likes" && !likesFetched && !likesLoading) {
      fetchLikes();
    }
  }, [isSelf, activeTab, likesFetched, likesLoading, fetchLikes]);

  // Extract mentions from bio
  const bioMentions = user?.description
    ? extractMentions(user.description)
    : [];
  const hasMentions = bioMentions.length > 0;
  const mentionCount = bioMentions.length;
  const currentMention = hasMentions ? bioMentions[mentionIndex] : undefined;

  const handleSelectedIndexChange = useCallback((index: number) => {
    setIsCollapsed(index > 0);
  }, []);

  // Handle keyboard shortcuts
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
        if (currentMention) {
          onProfileOpen?.(currentMention);
        }
        return;
      }
      // Other keys exit mentions mode and proceed
    }

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
      case "p":
        // Handle mentions/profiles: single = direct profile, multiple = enter mode
        if (hasMentions && !mentionsMode) {
          if (mentionCount === 1) {
            // Single mention - open profile directly
            const mention = bioMentions[0];
            if (mention) {
              onProfileOpen?.(mention);
            }
          } else {
            // Multiple mentions - enter navigation mode
            setMentionsMode(true);
            setMentionIndex(0);
          }
        }
        break;
      case "1":
        // Switch to tweets tab (only on own profile)
        if (isSelf && activeTab !== "tweets") {
          setActiveTab("tweets");
          setIsCollapsed(false);
        }
        break;
      case "2":
        // Switch to likes tab (only on own profile)
        if (isSelf && activeTab !== "likes") {
          setActiveTab("likes");
          setIsCollapsed(false);
        }
        break;
      case "f":
        // Toggle follow (only on other profiles)
        if (!isSelf && user) {
          const newFollowing = !isFollowing;
          setIsFollowing(newFollowing);
          userActions.toggleFollow(user.id, isFollowing);
        }
        break;
      case "m":
        // Toggle mute (only on other profiles)
        if (!isSelf && user) {
          const newMuting = !isMuting;
          setIsMuting(newMuting);
          userActions.toggleMute(user.id, isMuting);
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
      <text fg={colors.dim}>{mentionsMode ? "<- Back (Esc) | " : "<- "}</text>
      {mentionsMode && <text fg={colors.primary}>Navigating mentions </text>}
      {isSelf && <text fg={colors.primary}>My Profile </text>}
      <text fg="#ffffff">
        <b>{user.name}</b>
      </text>
      {user.isBlueVerified && <text fg={colors.primary}> {"\u2713"}</text>}
      <text fg={colors.muted}> @{user.username}</text>
      {/* Follow/Mute status (only for other profiles) */}
      {!isSelf && (
        <>
          <text fg={colors.dim}> | </text>
          <text fg={isFollowing ? colors.primary : colors.muted}>
            {userActions.isFollowPending
              ? "..."
              : isFollowing
                ? "Following"
                : "Follow"}
          </text>
          {isMuting && (
            <>
              <text fg={colors.dim}> · </text>
              <text fg={colors.muted}>Muted</text>
            </>
          )}
        </>
      )}
    </box>
  );

  // Full profile header with back hint, bio, and stats
  const joinDate = formatJoinDate(user?.createdAt);
  const websiteDomain = extractDomain(user?.websiteUrl);

  const fullHeader = user && (
    <box
      style={{
        flexShrink: 0,
        flexDirection: "column",
        justifyContent: "flex-start",
        marginBottom: 0,
        paddingBottom: 0,
      }}
    >
      {/* Back hint + Name + Handle on same line */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
        <text fg={colors.dim}>{mentionsMode ? "<- Back (Esc) | " : "<- "}</text>
        {mentionsMode && <text fg={colors.primary}>Navigating mentions </text>}
        {isSelf && <text fg={colors.primary}>My Profile </text>}
        <text fg="#ffffff">
          <b>{user.name}</b>
        </text>
        {user.isBlueVerified && <text fg={colors.primary}> {"\u2713"}</text>}
        <text fg={colors.muted}> @{user.username}</text>
        {/* Follow/Mute status (only for other profiles) */}
        {!isSelf && (
          <>
            <text fg={colors.dim}> | </text>
            <text fg={isFollowing ? colors.primary : colors.muted}>
              {userActions.isFollowPending
                ? "..."
                : isFollowing
                  ? "Following"
                  : "Follow"}
            </text>
            {isMuting && (
              <>
                <text fg={colors.dim}> · </text>
                <text fg={colors.muted}>Muted</text>
              </>
            )}
          </>
        )}
      </box>

      {/* Bio - highlight @mentions in blue */}
      {user.description && (
        <box style={{ paddingLeft: 1, paddingRight: 1 }}>
          {hasMentions ? (
            renderTextWithMentions(
              user.description.trim(),
              colors.primary,
              "#cccccc"
            )
          ) : (
            <text fg="#cccccc">{user.description.trim()}</text>
          )}
        </box>
      )}

      {/* Location, Website, Join Date row */}
      {(user.location || websiteDomain || joinDate) && (
        <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
          {user.location && (
            <>
              <text fg={colors.muted}>{"\u{1F4CD}"} </text>
              <text fg="#aaaaaa">{user.location}</text>
            </>
          )}
          {user.location && websiteDomain && (
            <text fg={colors.dim}> {"\u00B7"} </text>
          )}
          {websiteDomain && (
            <>
              <text fg={colors.muted}>{"\u{1F517}"} </text>
              <text fg={colors.primary}>{websiteDomain}</text>
            </>
          )}
          {(user.location || websiteDomain) && joinDate && (
            <text fg={colors.dim}> {"\u00B7"} </text>
          )}
          {joinDate && (
            <>
              <text fg={colors.muted}>{"\u{1F4C5}"} </text>
              <text fg="#aaaaaa">{joinDate}</text>
            </>
          )}
        </box>
      )}

      {/* Stats */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "row" }}>
        <text fg="#ffffff">{formatCount(user.followersCount)}</text>
        <text fg={colors.muted}> Followers </text>
        <text fg={colors.dim}>{"\u00B7"} </text>
        <text fg="#ffffff">{formatCount(user.followingCount)}</text>
        <text fg={colors.muted}> Following</text>
      </box>

      {/* Mentions section - simplified UI based on count */}
      {hasMentions && (
        <box
          style={{ paddingLeft: 1, paddingRight: 1, flexDirection: "column" }}
        >
          {mentionCount === 1 ? (
            // Single mention - show directly with profile shortcut
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}>Mentions: </text>
              <text fg={colors.primary}>@{bioMentions[0]}</text>
              <text fg={colors.dim}> (</text>
              <text fg={colors.primary}>p</text>
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
              {bioMentions.map((mention, idx) => {
                const isSelected = idx === mentionIndex;
                return (
                  <box key={mention} style={{ flexDirection: "row" }}>
                    <text fg={isSelected ? colors.primary : colors.muted}>
                      {isSelected ? ">" : " "} @{mention}
                    </text>
                  </box>
                );
              })}
            </>
          ) : (
            // Multiple mentions - collapsed view
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}>Mentions: </text>
              <text fg={colors.primary}>@{bioMentions[0]}</text>
              <text fg={colors.dim}> +{mentionCount - 1} more (</text>
              <text fg={colors.primary}>p</text>
              <text fg={colors.dim}> to navigate)</text>
            </box>
          )}
        </box>
      )}
    </box>
  );

  // Tab bar for own profile (Tweets | Likes)
  const tabBar = isSelf && (
    <box
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
        flexDirection: "row",
      }}
    >
      <text fg={activeTab === "tweets" ? colors.primary : colors.dim}>
        {activeTab === "tweets" ? <b>[1] Tweets</b> : " 1  Tweets"}
      </text>
      <text fg={colors.dim}> | </text>
      <text fg={activeTab === "likes" ? colors.primary : colors.dim}>
        {activeTab === "likes" ? <b>[2] Likes</b> : " 2  Likes"}
      </text>
      {activeTab === "likes" && likesLoading && (
        <text fg={colors.muted}> (loading...)</text>
      )}
    </box>
  );

  // Separator
  const separator = (
    <box
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <text fg="#444444">{"─".repeat(50)}</text>
    </box>
  );

  // Determine which posts to show based on active tab
  const displayPosts = isSelf && activeTab === "likes" ? likedTweets : tweets;
  const displayError = isSelf && activeTab === "likes" ? likesError : null;

  // Footer keybindings - show available actions based on what data exists
  // Tab keybindings (1/2) are shown in the tab bar itself, not in footer
  const footerBindings: Keybinding[] = [
    { key: "h/Esc", label: "back" },
    { key: "j/k", label: "nav" },
    { key: "l", label: "like" },
    { key: "b", label: "bkmk" },
    {
      key: "f",
      label: isFollowing ? "unfollow" : "follow",
      show: !isSelf,
    },
    {
      key: "m",
      label: isMuting ? "unmute" : "mute",
      show: !isSelf,
    },
    {
      key: "p",
      label: mentionCount === 1 ? "@profile" : "profiles",
      show: hasMentions && !mentionsMode,
    },
    { key: "a", label: "avatar", show: !!user?.profileImageUrl },
    { key: "v", label: "banner", show: !!user?.bannerImageUrl },
    { key: "w", label: "web", show: !!user?.websiteUrl },
    { key: "x", label: "x.com" },
    { key: "r", label: "refresh" },
  ];

  // Loading state
  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 1, flexDirection: "row" }}>
          <text fg={colors.dim}>{"<- "}</text>
          <text fg={colors.muted}>Loading profile...</text>
        </box>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ padding: 1, flexDirection: "row" }}>
          <text fg={colors.dim}>{"<- "}</text>
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
          <text fg={colors.dim}>{"<- "}</text>
          <text fg={colors.muted}>User not found</text>
        </box>
      </box>
    );
  }

  // Empty state message based on active tab
  const emptyMessage =
    isSelf && activeTab === "likes"
      ? "No liked tweets"
      : "No tweets to display";

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {isCollapsed ? compactHeader : fullHeader}
      {tabBar}
      {separator}
      {displayError ? (
        <box style={{ padding: 1, flexGrow: 1 }}>
          <text fg="#ff6666">Error: {displayError}</text>
        </box>
      ) : displayPosts.length > 0 ? (
        <PostList
          posts={displayPosts}
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
          <text fg={colors.muted}>{emptyMessage}</text>
        </box>
      )}
      <Footer bindings={footerBindings} visible={showFooter} />
    </box>
  );
}
