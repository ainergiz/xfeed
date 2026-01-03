/**
 * BookmarksScreen - Displays the user's bookmarked posts
 * Includes error handling with ErrorBanner for rate limits, auth expiry, etc.
 * Supports viewing all bookmarks or a specific folder.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect } from "react";

import type { XClient } from "@/api/client";
import type { BookmarkFolder, TweetData } from "@/api/types";
import type { TweetActionState } from "@/hooks/useActions";

import { ErrorBanner } from "@/components/ErrorBanner";
import { PostList } from "@/components/PostList";
import { useBookmarksQuery } from "@/experiments";
import { colors } from "@/lib/colors";

interface BookmarksScreenProps {
  client: XClient;
  focused?: boolean;
  /** Currently selected folder (null = all bookmarks) */
  selectedFolder?: BookmarkFolder | null;
  /** Called when user wants to open the folder picker (press 'f') */
  onFolderPickerOpen?: () => void;
  onPostCountChange?: (count: number) => void;
  onHasMoreChange?: (hasMore: boolean) => void;
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
}

interface ScreenHeaderProps {
  folderName?: string | null;
}

function ScreenHeader({ folderName }: ScreenHeaderProps) {
  const title = folderName ?? "All Bookmarks";
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
      <text fg={colors.primary}>
        <b>{title}</b>
      </text>
      <text fg={colors.dim}> (f to switch folders)</text>
    </box>
  );
}

export function BookmarksScreen({
  client,
  focused = false,
  selectedFolder,
  onFolderPickerOpen,
  onPostCountChange,
  onHasMoreChange,
  onPostSelect,
  onLike,
  onBookmark,
  getActionState,
  initActionState,
}: BookmarksScreenProps) {
  const {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refresh,
    fetchNextPage,
  } = useBookmarksQuery({ client, folderId: selectedFolder?.id });

  // Report post count to parent
  useEffect(() => {
    onPostCountChange?.(posts.length);
  }, [posts.length, onPostCountChange]);

  // Report hasMore state to parent
  useEffect(() => {
    onHasMoreChange?.(hasNextPage);
  }, [hasNextPage, onHasMoreChange]);

  // Handle keyboard shortcuts
  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "r") {
      refresh();
    }

    // Open folder picker with 'f'
    if (key.name === "f") {
      onFolderPickerOpen?.();
    }
  });

  const folderName = selectedFolder?.name ?? null;

  if (isLoading) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader folderName={folderName} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>Loading bookmarks...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader folderName={folderName} />
        <ErrorBanner error={error} onRetry={refresh} retryDisabled={false} />
      </box>
    );
  }

  if (posts.length === 0) {
    return (
      <box style={{ flexDirection: "column", height: "100%" }}>
        <ScreenHeader folderName={folderName} />
        <box style={{ padding: 2, flexGrow: 1 }}>
          <text fg={colors.muted}>
            {selectedFolder
              ? "No bookmarks in this folder. Press r to refresh."
              : "No bookmarks yet. Press r to refresh."}
          </text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <ScreenHeader folderName={folderName} />
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
