/**
 * TimelineScreenExperimental - TanStack Query version of TimelineScreen
 *
 * Features:
 * - Uses useTimelineQuery for data fetching
 * - Shows "Refresh for new posts" banner after 5 minutes
 */

import { useKeyboard } from "@opentui/react";
import { useEffect, useRef } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { ErrorBanner } from "@/components/ErrorBanner";
import { PostList } from "@/components/PostList";
import { usePreferences } from "@/contexts/PreferencesContext";
import { colors } from "@/lib/colors";

import { type TimelineTab, useTimelineQuery } from "./use-timeline-query";

interface TimelineScreenExperimentalProps {
  client: XClient;
  focused?: boolean;
  onPostCountChange?: (count: number) => void;
  /** Called when initial loading completes (success or error) */
  onInitialLoadComplete?: () => void;
  onPostSelect?: (post: TweetData) => void;
  onLike?: (post: TweetData) => void;
  onBookmark?: (post: TweetData) => void;
  getActionState?: (tweetId: string) => TweetActionState;
  initActionState?: (
    tweetId: string,
    liked: boolean,
    bookmarked: boolean
  ) => void;
}

interface TabBarProps {
  activeTab: TimelineTab;
  isRefetching: boolean;
}

function TabBar({ activeTab, isRefetching }: TabBarProps) {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <box style={{ flexDirection: "row" }}>
        <text fg={activeTab === "for_you" ? colors.primary : colors.dim}>
          {activeTab === "for_you" ? <b>[1] For You</b> : " 1  For You"}
        </text>
        <text fg={colors.dim}> | </text>
        <text fg={activeTab === "following" ? colors.primary : colors.dim}>
          {activeTab === "following" ? <b>[2] Following</b> : " 2  Following"}
        </text>
      </box>

      {/* Sync indicator */}
      {isRefetching && (
        <text fg={colors.muted}>
          <i>syncing...</i>
        </text>
      )}
    </box>
  );
}

function RefreshBanner() {
  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 1,
      }}
    >
      <box
        style={{
          backgroundColor: colors.primary,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text fg="#000000">
          <b>Refresh for new posts — Press r</b>
        </text>
      </box>
    </box>
  );
}

export function TimelineScreenExperimental({
  client,
  focused = false,
  onPostCountChange,
  onInitialLoadComplete,
  onPostSelect,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
}: TimelineScreenExperimentalProps) {
  const { preferences } = usePreferences();

  const {
    tab,
    setTab,
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refresh,
    showRefreshBanner,
    isRefetching,
  } = useTimelineQuery({
    client,
    initialTab: preferences.timeline.default_tab,
  });

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  // Track initial load completion (fires once when isLoading transitions to false)
  const hasCalledInitialLoadComplete = useRef(false);
  useEffect(() => {
    if (!isLoading && !hasCalledInitialLoadComplete.current) {
      hasCalledInitialLoadComplete.current = true;
      onInitialLoadComplete?.();
    }
  }, [isLoading, onInitialLoadComplete]);

  // Handle keyboard shortcuts
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
        refresh();
        break;
    }
  });

  if (isLoading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} isRefetching={isRefetching} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>Loading timeline...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} isRefetching={isRefetching} />
        <ErrorBanner error={error} onRetry={refresh} retryDisabled={false} />
      </box>
    );
  }

  if (posts.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} isRefetching={isRefetching} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>
            No posts to display. Press r to refresh.
          </text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <TabBar activeTab={tab} isRefetching={isRefetching} />

      {/* Refresh banner */}
      {focused && showRefreshBanner && <RefreshBanner />}

      <PostList
        posts={posts}
        focused={focused}
        onPostSelect={onPostSelect}
        onLike={onLike}
        onBookmark={onBookmark}
        getActionState={getActionState}
        initActionState={initActionState}
        onLoadMore={fetchNextPage}
        loadingMore={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </box>
  );
}
