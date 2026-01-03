/**
 * ThreadView Prototype - Native thread display with visual hierarchy
 *
 * This is an experimental component for Issue #80.
 * It demonstrates a tree-based thread visualization approach.
 *
 * @experimental
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect, useMemo } from "react";

import type { TweetData } from "@/api/types";

import { colors } from "@/lib/colors";
import { formatRelativeTime, truncateText } from "@/lib/format";

const SELECTED_BG = "#2a2a3e";

// Tree drawing characters
const TREE = {
  vertical: "│",
  branch: "├─",
  lastBranch: "└─",
  space: "  ",
} as const;

/**
 * Node in the thread tree structure
 */
export interface ThreadNode {
  tweet: TweetData;
  children: ThreadNode[];
  collapsed: boolean;
  depth: number;
}

interface ThreadViewProps {
  /** Chain of ancestor tweets leading to focused tweet (oldest first) */
  ancestors: TweetData[];
  /** The main focused tweet */
  focusedTweet: TweetData;
  /** Root node of the reply tree */
  replyTree: ThreadNode | null;
  /** Whether this component has keyboard focus */
  focused?: boolean;
  /** Called when user wants to go back */
  onBack?: () => void;
  /** Called when user selects a tweet to view in detail */
  onSelectTweet?: (tweet: TweetData) => void;
}

/**
 * Build a tree structure from a flat list of tweets
 */
export function buildThreadTree(
  tweets: TweetData[],
  rootId: string
): ThreadNode | null {
  if (tweets.length === 0) return null;

  const map = new Map<string, ThreadNode>();

  // Create nodes for all tweets
  for (const tweet of tweets) {
    map.set(tweet.id, {
      tweet,
      children: [],
      collapsed: false,
      depth: 0,
    });
  }

  // Find root candidates (tweets with no parent in our set, or the explicit root)
  const roots: ThreadNode[] = [];

  // Build parent-child relationships
  for (const tweet of tweets) {
    const node = map.get(tweet.id);
    if (!node) continue;

    if (tweet.inReplyToStatusId && map.has(tweet.inReplyToStatusId)) {
      // Has parent in our set - add as child
      const parent = map.get(tweet.inReplyToStatusId);
      if (parent) {
        parent.children.push(node);
        node.depth = parent.depth + 1;
      }
    } else {
      // No parent in set - this is a root
      roots.push(node);
    }
  }

  // Sort children by creation time
  for (const node of map.values()) {
    node.children.sort((a, b) => {
      const aTime = a.tweet.createdAt ? Date.parse(a.tweet.createdAt) : 0;
      const bTime = b.tweet.createdAt ? Date.parse(b.tweet.createdAt) : 0;
      return aTime - bTime;
    });
  }

  // Return the root that matches rootId, or first root
  return map.get(rootId) ?? roots[0] ?? null;
}

/**
 * Flatten tree into navigable list (respecting collapsed state)
 */
function flattenTree(node: ThreadNode | null): ThreadNode[] {
  if (!node) return [];

  const result: ThreadNode[] = [node];

  if (!node.collapsed) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }

  return result;
}

/**
 * Compact post card for tree view - shows minimal info
 */
/** Generate element ID for thread nodes (for scroll targeting) */
function getNodeId(tweetId: string): string {
  return `thread-node-${tweetId}`;
}

function CompactPostCard({
  tweet,
  isSelected,
  isFocused,
  prefix,
}: {
  tweet: TweetData;
  isSelected: boolean;
  isFocused: boolean;
  prefix: string;
}) {
  const timeAgo = formatRelativeTime(tweet.createdAt);
  const truncatedText = truncateText(tweet.text, 2);

  return (
    <box
      id={getNodeId(tweet.id)}
      style={{
        flexDirection: "column",
        backgroundColor: isFocused
          ? colors.selectedBg
          : isSelected
            ? SELECTED_BG
            : undefined,
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: 1,
      }}
    >
      <box style={{ flexDirection: "row" }}>
        <text fg={colors.dim}>{prefix}</text>
        <text fg={isSelected ? colors.primary : colors.muted}>
          {isSelected ? ">" : " "}
        </text>
        <text fg={colors.primary}>@{tweet.author.username}</text>
        <text fg={colors.dim}> · {timeAgo}</text>
      </box>
      <box style={{ paddingLeft: prefix.length + 2 }}>
        <text fg={isFocused ? "#ffffff" : "#cccccc"}>{truncatedText}</text>
      </box>
      {/* Stats line for focused tweet */}
      {isFocused && (
        <box style={{ paddingLeft: prefix.length + 2, marginTop: 1 }}>
          <text fg={colors.muted}>
            {tweet.replyCount ?? 0} replies · {tweet.retweetCount ?? 0} reposts
            · {tweet.likeCount ?? 0} likes
          </text>
        </box>
      )}
    </box>
  );
}

/**
 * Ancestor chain display - shows path to focused tweet
 */
function AncestorChain({ ancestors }: { ancestors: TweetData[] }) {
  if (ancestors.length === 0) return null;

  return (
    <box
      style={{
        borderStyle: "rounded",
        borderColor: "#444444",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ marginBottom: 1 }}>
        <text fg={colors.dim}>Thread context:</text>
      </box>
      {ancestors.map((tweet, idx) => {
        const isLast = idx === ancestors.length - 1;
        const prefix = isLast ? TREE.lastBranch : TREE.branch;
        const verticalLine = idx < ancestors.length - 1 ? TREE.vertical : "";

        return (
          <box key={tweet.id} style={{ flexDirection: "column" }}>
            <box style={{ flexDirection: "row" }}>
              <text fg="#555555">{prefix}</text>
              <text fg={colors.primary}>@{tweet.author.username}</text>
              <text fg={colors.dim}>
                {" "}
                · {formatRelativeTime(tweet.createdAt)}
              </text>
            </box>
            <box style={{ flexDirection: "row" }}>
              <text fg="#555555">{verticalLine} </text>
              <text fg={colors.muted}>{truncateText(tweet.text, 2)}</text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

/**
 * Recursive tree renderer
 */
function TreeNode({
  node,
  isLast,
  parentPrefix,
  selectedId,
  focusedId,
}: {
  node: ThreadNode;
  isLast: boolean;
  parentPrefix: string;
  selectedId: string | null;
  focusedId: string;
}) {
  const isSelected = node.tweet.id === selectedId;
  const isFocused = node.tweet.id === focusedId;

  // Build prefix for this node
  const ownPrefix =
    node.depth === 0 ? "" : isLast ? TREE.lastBranch : TREE.branch;

  // Build prefix for children (continuation lines)
  const childPrefix =
    node.depth === 0
      ? ""
      : parentPrefix + (isLast ? TREE.space : TREE.vertical + " ");

  return (
    <box style={{ flexDirection: "column" }}>
      <CompactPostCard
        tweet={node.tweet}
        isSelected={isSelected}
        isFocused={isFocused}
        prefix={parentPrefix + ownPrefix}
      />
      {node.children.map((child, idx) => (
        <TreeNode
          key={child.tweet.id}
          node={child}
          isLast={idx === node.children.length - 1}
          parentPrefix={childPrefix}
          selectedId={selectedId}
          focusedId={focusedId}
        />
      ))}
    </box>
  );
}

/**
 * Main ThreadView component
 */
export function ThreadViewPrototype({
  ancestors,
  focusedTweet,
  replyTree,
  focused = false,
  onBack,
  onSelectTweet,
}: ThreadViewProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const savedScrollTop = useRef(0);
  const wasFocused = useRef(focused);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [treeState, setTreeState] = useState<ThreadNode | null>(replyTree);

  // Restore scroll position when gaining focus
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox) return;

    // Only restore when gaining focus (not losing)
    if (!wasFocused.current && focused && savedScrollTop.current > 0) {
      scrollbox.scrollTo(savedScrollTop.current);
    }

    wasFocused.current = focused;
  }, [focused]);

  // Reset tree state when replyTree changes
  useEffect(() => {
    setTreeState(replyTree);
    setSelectedIndex(0);
  }, [replyTree]);

  // Flatten tree for navigation
  const flatNodes = useMemo(
    () => (treeState ? flattenTree(treeState) : []),
    [treeState]
  );

  const selectedNode = flatNodes[selectedIndex];
  const selectedId = selectedNode?.tweet.id ?? null;

  // Scroll selected item into view when selection changes
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox || !selectedNode || flatNodes.length === 0) return;

    const targetId = getNodeId(selectedNode.tweet.id);

    // Recursive search for nested elements
    const findChildById = (
      children: {
        id?: string;
        y: number;
        height: number;
        getChildren?: () => unknown[];
      }[],
      id: string
    ): { y: number; height: number } | null => {
      for (const child of children) {
        if (child.id === id) {
          return child;
        }
        if (typeof child.getChildren === "function") {
          const nested = child.getChildren() as typeof children;
          const found = findChildById(nested, id);
          if (found) return found;
        }
      }
      return null;
    };

    const children = scrollbox.getChildren() as {
      id?: string;
      y: number;
      height: number;
      getChildren?: () => unknown[];
    }[];
    const target = findChildById(children, targetId);
    if (!target) return;

    // Calculate position relative to scrollbox viewport
    const relativeY = target.y - scrollbox.y;
    const viewportHeight = scrollbox.viewport.height;

    // Scroll margins (vim-style scrolloff)
    const topMargin = Math.max(1, Math.floor(viewportHeight / 10));
    const bottomMargin = Math.max(4, Math.floor(viewportHeight / 3));

    // First item: scroll to top
    if (selectedIndex === 0) {
      scrollbox.scrollTo(0);
      return;
    }

    // Last item: scroll to bottom
    if (selectedIndex === flatNodes.length - 1) {
      scrollbox.scrollTo(scrollbox.scrollHeight);
      return;
    }

    // Keep element visible with margins
    if (relativeY + target.height > viewportHeight - bottomMargin) {
      // Element below viewport - scroll down
      scrollbox.scrollBy(
        relativeY + target.height - viewportHeight + bottomMargin
      );
    } else if (relativeY < topMargin) {
      // Element above viewport - scroll up
      scrollbox.scrollBy(relativeY - topMargin);
    }
  }, [selectedIndex, selectedNode, flatNodes.length]);

  // Keyboard navigation - simplified: j/k nav, Enter select, h/Esc back
  useKeyboard((key) => {
    if (!focused) return;

    switch (key.name) {
      case "escape":
      case "h":
      case "backspace":
        onBack?.();
        break;

      case "j":
      case "down":
        if (selectedIndex < flatNodes.length - 1) {
          setSelectedIndex((prev) => prev + 1);
        }
        break;

      case "k":
      case "up":
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        }
        break;

      case "return":
        if (selectedNode) {
          // Save scroll position before navigating away
          if (scrollRef.current) {
            savedScrollTop.current = scrollRef.current.scrollTop;
          }
          onSelectTweet?.(selectedNode.tweet);
        }
        break;
    }
  });

  // Header
  const header = (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
      }}
    >
      <text fg={colors.muted}>Thread View</text>
      <text fg={colors.dim}> · </text>
      <text fg={colors.primary}>{flatNodes.length}</text>
      <text fg={colors.dim}> tweets</text>
    </box>
  );

  // Footer with keyboard hints
  const footer = (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        flexDirection: "row",
      }}
    >
      <text fg="#ffffff">j/k</text>
      <text fg={colors.dim}> nav </text>
      <text fg="#ffffff">Enter</text>
      <text fg={colors.dim}> view </text>
      <text fg="#ffffff">h/Esc</text>
      <text fg={colors.dim}> back</text>
    </box>
  );

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      {header}
      <scrollbox
        ref={scrollRef}
        focused={focused}
        style={{ flexGrow: 1, height: "100%" }}
      >
        {/* Ancestor chain */}
        <AncestorChain ancestors={ancestors} />

        {/* Focused tweet (always shown prominently) */}
        <box
          style={{
            borderStyle: "single",
            borderColor: colors.primary,
            marginBottom: 1,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <box style={{ flexDirection: "row" }}>
            <text fg={colors.primary}>@{focusedTweet.author.username}</text>
            <text fg="#ffffff"> · {focusedTweet.author.name}</text>
          </box>
          <box style={{ marginTop: 1 }}>
            <text fg="#ffffff">{focusedTweet.text}</text>
          </box>
          <box style={{ marginTop: 1 }}>
            <text fg={colors.muted}>
              {focusedTweet.replyCount ?? 0} replies ·{" "}
              {focusedTweet.retweetCount ?? 0} reposts ·{" "}
              {focusedTweet.likeCount ?? 0} likes
            </text>
          </box>
        </box>

        {/* Reply tree */}
        {treeState && treeState.children.length > 0 && (
          <box style={{ marginTop: 1 }}>
            <box style={{ paddingLeft: 1, marginBottom: 1 }}>
              <text fg="#ffffff">Replies</text>
              <text fg={colors.dim}> ({flatNodes.length})</text>
            </box>
            {treeState.children.map((child, idx) => (
              <TreeNode
                key={child.tweet.id}
                node={child}
                isLast={idx === treeState.children.length - 1}
                parentPrefix=""
                selectedId={selectedId}
                focusedId={focusedTweet.id}
              />
            ))}
          </box>
        )}

        {/* No replies message */}
        {(!treeState || treeState.children.length === 0) && (
          <box style={{ paddingLeft: 1, marginTop: 1 }}>
            <text fg={colors.dim}>No replies yet</text>
          </box>
        )}
      </scrollbox>
      {footer}
    </box>
  );
}
