/**
 * PostList - Scrollable list of posts with vim-style navigation
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useEffect, useRef } from "react";

import type { TweetData } from "@/api/types";

import { PostCard } from "@/components/PostCard";
import { useListNavigation } from "@/hooks/useListNavigation";

interface PostListProps {
  posts: TweetData[];
  focused?: boolean;
  onPostSelect?: (post: TweetData) => void;
  onSelectedIndexChange?: (index: number) => void;
}

/**
 * Generate element ID from tweet ID for scroll targeting
 */
function getPostCardId(tweetId: string): string {
  return `post-${tweetId}`;
}

export function PostList({
  posts,
  focused = false,
  onPostSelect,
  onSelectedIndexChange,
}: PostListProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  // Save scroll position so we can restore when refocused
  const savedScrollTop = useRef(0);
  const wasFocused = useRef(focused);

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

  const { selectedIndex } = useListNavigation({
    itemCount: posts.length,
    enabled: focused,
    onSelect: (index) => {
      const post = posts[index];
      if (post) {
        // Save scroll position SYNCHRONOUSLY before callback triggers re-render
        // This must happen before any state change that would cause height: 0
        if (scrollRef.current) {
          savedScrollTop.current = scrollRef.current.scrollTop;
        }
        onPostSelect?.(post);
      }
    },
  });

  // Notify parent of selection changes (e.g., for collapsible headers)
  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [selectedIndex, onSelectedIndexChange]);

  // Scroll to keep selected item visible with context (scroll margin)
  // Similar to Vim's scrolloff - keeps items visible above/below selection
  useEffect(() => {
    const scrollbox = scrollRef.current;
    if (!scrollbox || posts.length === 0) return;

    // Find the selected element by tweet ID
    const selectedPost = posts[selectedIndex];
    if (!selectedPost) return;

    const targetId = getPostCardId(selectedPost.id);
    const target = scrollbox
      .getChildren()
      .find((child) => child.id === targetId);
    if (!target) return;

    // Calculate the element's position relative to the scrollbox viewport
    const relativeY = target.y - scrollbox.y;
    const viewportHeight = scrollbox.viewport.height;

    // Asymmetric scroll margins - selected item biased towards top of viewport
    // Small top margin (keeps selection near top), large bottom margin (shows more below)
    const topMargin = Math.max(1, Math.floor(viewportHeight / 10)); // ~10% from top
    const bottomMargin = Math.max(4, Math.floor(viewportHeight / 3)); // ~33% from bottom

    // First item: always scroll to absolute top
    if (selectedIndex === 0) {
      scrollbox.scrollTo(0);
      return;
    }

    // Last item: always scroll to absolute bottom
    if (selectedIndex === posts.length - 1) {
      scrollbox.scrollTo(scrollbox.scrollHeight);
      return;
    }

    // If element is too close to bottom, scroll up so it's in upper portion
    if (relativeY + target.height > viewportHeight - bottomMargin) {
      scrollbox.scrollBy(
        relativeY + target.height - viewportHeight + bottomMargin
      );
    }
    // If element is too close to top, scroll down to add small margin
    else if (relativeY < topMargin) {
      scrollbox.scrollBy(relativeY - topMargin);
    }
  }, [selectedIndex, posts.length]);

  if (posts.length === 0) {
    return (
      <box style={{ padding: 2 }}>
        <text fg="#888888">No posts to display</text>
      </box>
    );
  }

  return (
    <scrollbox
      ref={scrollRef}
      focused={focused}
      style={{
        flexGrow: 1,
        height: "100%",
      }}
    >
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          id={getPostCardId(post.id)}
          post={post}
          isSelected={index === selectedIndex}
        />
      ))}
    </scrollbox>
  );
}
