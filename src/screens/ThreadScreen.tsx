/**
 * ThreadScreen - Full thread view with visual hierarchy
 *
 * Shows ancestor chain, focused tweet, and reply tree with collapse/expand.
 * Uses TanStack Query for data fetching (Issue #159).
 */

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { ThreadViewPrototype } from "@/components/ThreadView.prototype";
import { useThreadQuery } from "@/experiments/use-thread-query";
import { colors } from "@/lib/colors";

interface ThreadScreenProps {
  client: XClient;
  tweet: TweetData;
  focused?: boolean;
  onBack?: () => void;
  onSelectTweet?: (tweet: TweetData) => void;
  showFooter?: boolean;
}

export function ThreadScreen({
  client,
  tweet,
  focused = false,
  onBack,
  onSelectTweet,
  showFooter = true,
}: ThreadScreenProps) {
  const { ancestors, replyTree, loadingAncestors, loadingReplies, error } =
    useThreadQuery({
      client,
      tweet,
      maxAncestorDepth: 10,
    });

  // Show loading state
  if (loadingAncestors || loadingReplies) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text fg={colors.muted}>
            Loading thread...
            {loadingAncestors && " (ancestors)"}
            {loadingReplies && " (replies)"}
          </text>
        </box>
      </box>
    );
  }

  // Show error state
  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text fg={colors.error}>Error: {error}</text>
        </box>
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text fg={colors.dim}>Press h or Esc to go back</text>
        </box>
      </box>
    );
  }

  return (
    <ThreadViewPrototype
      ancestors={ancestors}
      focusedTweet={tweet}
      replyTree={replyTree}
      focused={focused}
      onBack={onBack}
      onSelectTweet={onSelectTweet}
      showFooter={showFooter}
    />
  );
}
