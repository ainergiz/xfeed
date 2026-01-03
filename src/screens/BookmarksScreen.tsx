/**
 * BookmarksScreen - Displays the user's bookmarked posts
 * Includes error handling with ErrorBanner for rate limits, auth expiry, etc.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { ErrorBanner } from "@/components/ErrorBanner";
import { PostList } from "@/components/PostList";
import { useBookmarks } from "@/hooks/useBookmarks";

interface BookmarksScreenProps {
  client: XClient;
  focused?: boolean;
  onPostCountChange?: (count: number) => void;
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
  /** Callback to register the removePost function for external sync */
  onRegisterRemovePost?: (removePost: (tweetId: string) => void) => void;
}

function ScreenHeader() {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#1DA1F2">
        <b>All Bookmarks</b>
      </text>
    </box>
  );
}

/**
 * Format seconds into a readable countdown string
 */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function BookmarksScreen({
  client,
  focused = false,
  onPostCountChange,
  onPostSelect,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
  actionMessage,
  onRegisterRemovePost,
}: BookmarksScreenProps) {
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    apiError,
    refresh,
    loadMore,
    retryBlocked,
    retryCountdown,
    removePost,
  } = useBookmarks({ client });

  // Register removePost function for external bookmark sync
  useEffect(() => {
    onRegisterRemovePost?.(removePost);
  }, [onRegisterRemovePost, removePost]);

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  // Handle keyboard shortcuts for refresh
  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "r" && !retryBlocked) {
      refresh();
    }
  });

  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">Loading bookmarks...</text>
        </box>
      </box>
    );
  }

  if (apiError) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader />
        <ErrorBanner
          error={apiError}
          onRetry={refresh}
          retryDisabled={retryBlocked}
        />
        {retryBlocked && retryCountdown > 0 && (
          <box style={{ paddingLeft: 1, paddingTop: 1 }}>
            <text fg="#ffaa00">
              Retry available in {formatCountdown(retryCountdown)}
            </text>
          </box>
        )}
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#ff6666">Error: {error}</text>
          <text fg="#888888"> Press r to retry.</text>
        </box>
      </box>
    );
  }

  if (posts.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">No bookmarks yet. Press r to refresh.</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <ScreenHeader />
      {actionMessage ? (
        <box style={{ paddingLeft: 1 }}>
          <text fg={actionMessage.startsWith("Error:") ? "#E0245E" : "#17BF63"}>
            {actionMessage}
          </text>
        </box>
      ) : null}
      <PostList
        posts={posts}
        focused={focused}
        onPostSelect={onPostSelect}
        onLike={onLike}
        onBookmark={onBookmark}
        getActionState={getActionState}
        initActionState={initActionState}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        hasMore={hasMore}
      />
    </box>
  );
}
