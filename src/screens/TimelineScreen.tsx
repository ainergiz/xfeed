/**
 * TimelineScreen - Displays the user's timeline with For You / Following tabs
 * Includes error handling with ErrorBanner for rate limits, auth expiry, etc.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { ErrorBanner } from "@/components/ErrorBanner";
import { PostList } from "@/components/PostList";
import { useTimeline, type TimelineTab } from "@/hooks/useTimeline";
import { formatCountdown } from "@/lib/format";

interface TimelineScreenProps {
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
}

interface TabBarProps {
  activeTab: TimelineTab;
}

function TabBar({ activeTab }: TabBarProps) {
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
      <text fg={activeTab === "for_you" ? "#1DA1F2" : "#666666"}>
        {activeTab === "for_you" ? <b>[1] For You</b> : " 1  For You"}
      </text>
      <text fg="#666666"> | </text>
      <text fg={activeTab === "following" ? "#1DA1F2" : "#666666"}>
        {activeTab === "following" ? <b>[2] Following</b> : " 2  Following"}
      </text>
    </box>
  );
}

export function TimelineScreen({
  client,
  focused = false,
  onPostCountChange,
  onPostSelect,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
  actionMessage,
}: TimelineScreenProps) {
  const {
    tab,
    setTab,
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
  } = useTimeline({
    client,
  });

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  // Handle keyboard shortcuts for tab switching and refresh
  useKeyboard((key) => {
    if (!focused) return;

    switch (key.name) {
      case "1":
        setTab("for_you");
        break;
      case "2":
        setTab("following");
        break;
      case "r":
        if (!retryBlocked) {
          refresh();
        }
        break;
    }
  });

  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        {focused && <TabBar activeTab={tab} />}
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">Loading timeline...</text>
        </box>
      </box>
    );
  }

  if (apiError) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        {focused && <TabBar activeTab={tab} />}
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
        {focused && <TabBar activeTab={tab} />}
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
        {focused && <TabBar activeTab={tab} />}
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">No posts to display. Press r to refresh.</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {focused && <TabBar activeTab={tab} />}
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
