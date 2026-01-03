/**
 * ThreadScreen - Full thread view with visual hierarchy
 *
 * Experimental screen for Issue #80.
 * Shows ancestor chain, focused tweet, and reply tree with collapse/expand.
 *
 * @experimental
 */

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { ThreadViewPrototype } from "@/components/ThreadView.prototype";
import { useThread } from "@/hooks/useThread.prototype";

interface ThreadScreenProps {
  client: XClient;
  tweet: TweetData;
  focused?: boolean;
  onBack?: () => void;
  onSelectTweet?: (tweet: TweetData) => void;
}

export function ThreadScreen({
  client,
  tweet,
  focused = false,
  onBack,
  onSelectTweet,
}: ThreadScreenProps) {
  const { ancestors, replyTree, loadingAncestors, loadingReplies, error } =
    useThread({
      client,
      tweet,
      maxAncestorDepth: 10,
    });

  // Show loading state
  if (loadingAncestors || loadingReplies) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text fg="#888888">
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
          <text fg="#E0245E">Error: {error}</text>
        </box>
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text fg="#666666">Press h or Esc to go back</text>
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
    />
  );
}
