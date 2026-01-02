/**
 * TimelineScreen - Displays the user's timeline with For You / Following tabs
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { PostList } from "@/components/PostList";
import { useTimeline, type TimelineTab } from "@/hooks/useTimeline";

interface TimelineScreenProps {
  client: TwitterClient;
  focused?: boolean;
  onPostCountChange?: (count: number) => void;
  onPostSelect?: (post: TweetData) => void;
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
}: TimelineScreenProps) {
  const { tab, setTab, posts, loading, error, refresh } = useTimeline({
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
        refresh();
        break;
    }
  });

  if (loading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">Loading timeline...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#ff6666">Error: {error}</text>
        </box>
      </box>
    );
  }

  if (posts.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <TabBar activeTab={tab} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#888888">No posts to display. Press r to refresh.</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <TabBar activeTab={tab} />
      <PostList posts={posts} focused={focused} onPostSelect={onPostSelect} />
    </box>
  );
}
