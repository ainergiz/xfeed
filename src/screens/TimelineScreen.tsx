/**
 * TimelineScreen - Displays the user's timeline
 */

import { useState, useEffect } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { PostList } from "@/components/PostList";

interface TimelineScreenProps {
  client: TwitterClient;
  focused?: boolean;
  onPostCountChange?: (count: number) => void;
}

export function TimelineScreen({
  client,
  focused = false,
  onPostCountChange,
}: TimelineScreenProps) {
  const [posts, setPosts] = useState<TweetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      setError(null);

      const result = await client.getHomeLatestTimeline(30);

      if (result.success) {
        setPosts(result.tweets);
      } else {
        setError(result.error);
      }

      setLoading(false);
    }

    fetchTimeline();
  }, [client]);

  if (loading) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#888888">Loading timeline...</text>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#ff6666">Error: {error}</text>
      </box>
    );
  }

  return (
    <PostList
      posts={posts}
      focused={focused}
      onPostSelect={(_post) => {
        // Future: expand post detail view
        // For now, we just highlight - Enter does nothing visible yet
      }}
    />
  );
}
