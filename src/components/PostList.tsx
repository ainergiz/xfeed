/**
 * PostList - Scrollable list of posts with vim-style navigation
 */

import type { ScrollBoxRenderable } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useEffect, useRef } from "react";

import type { TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { PostCard } from "@/components/PostCard";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";

interface PostListProps {
  posts: TweetData[];
  focused?: boolean;
  onPostSelect?: (post: TweetData) => void;
  onSelectedIndexChange?: (index: number) => void;
  /** Called when user presses 'l' to toggle like on selected post */
  onLike?: (post: TweetData) => void;
  /** Called when user presses 'b' to toggle bookmark on selected post */
  onBookmark?: (post: TweetData) => void;
  /** Get current action state for a tweet */
  getActionState?: (tweetId: string) => TweetActionState;
  /** Initialize action state from API data */
  initActionState?: (
    tweetId: string,
    liked: boolean,
    bookmarked: boolean
  ) => void;
  /** Called when user scrolls near the bottom to load more posts */
  onLoadMore?: () => void;
  /** Whether more posts are currently being loaded */
  loadingMore?: boolean;
  /** Whether there are more posts available to load */
  hasMore?: boolean;
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
  onLike,
  onBookmark,
  getActionState,
  initActionState,
  onLoadMore,
  loadingMore = false,
  hasMore = true,
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

  // Handle like/bookmark keyboard shortcuts
  useKeyboard((key) => {
    if (!focused || posts.length === 0) return;

    const currentPost = posts[selectedIndex];
    if (!currentPost) return;

    if (key.name === "l") {
      onLike?.(currentPost);
    } else if (key.name === "b") {
      onBookmark?.(currentPost);
    }
  });

  // Initialize action state for all posts from API data
  useEffect(() => {
    if (!initActionState) return;

    for (const post of posts) {
      initActionState(
        post.id,
        post.favorited ?? false,
        post.bookmarked ?? false
      );
    }
  }, [posts, initActionState]);

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

  // Trigger load more when approaching the end of the list
  useEffect(() => {
    if (!onLoadMore || loadingMore || !hasMore || posts.length === 0) return;

    // Load more when within 5 items of the end
    const threshold = 5;
    if (selectedIndex >= posts.length - threshold) {
      onLoadMore();
    }
  }, [selectedIndex, posts.length, onLoadMore, loadingMore, hasMore]);

  if (posts.length === 0) {
    return (
      <box style={{ padding: 2 }}>
        <text fg={colors.muted}>No posts to display</text>
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
      {posts.map((post, index) => {
        const actionState = getActionState?.(post.id);
        return (
          <PostCard
            key={post.id}
            id={getPostCardId(post.id)}
            post={post}
            isSelected={index === selectedIndex}
            isLiked={actionState?.liked}
            isBookmarked={actionState?.bookmarked}
            isJustLiked={actionState?.justLiked}
            isJustBookmarked={actionState?.justBookmarked}
          />
        );
      })}
      {loadingMore ? (
        <box style={{ padding: 1, paddingLeft: 2 }}>
          <text fg={colors.muted}>Loading more posts...</text>
        </box>
      ) : null}
      {!hasMore && posts.length > 0 ? (
        <box style={{ padding: 1, paddingLeft: 2 }}>
          <text fg={colors.dim}>No more posts</text>
        </box>
      ) : null}
    </scrollbox>
  );
}
