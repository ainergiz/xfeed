/**
 * BookmarksScreen - Displays the user's bookmarked posts
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { PostList } from "@/components/PostList";
import { useBookmarks } from "@/hooks/useBookmarks";

interface BookmarksScreenProps {
  client: TwitterClient;
  focused?: boolean;
  onPostCountChange?: (count: number) => void;
  onPostSelect?: (post: TweetData) => void;
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

export function BookmarksScreen({
  client,
  focused = false,
  onPostCountChange,
  onPostSelect,
}: BookmarksScreenProps) {
  const { posts, loading, error, refresh } = useBookmarks({ client });

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  // Handle keyboard shortcuts for refresh
  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "r") {
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

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg="#ff6666">Error: {error}</text>
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
      <PostList posts={posts} focused={focused} onPostSelect={onPostSelect} />
    </box>
  );
}
