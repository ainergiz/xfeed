import { useDialog, useDialogState } from "@opentui-ui/dialog/react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { appendFileSync, writeFileSync } from "node:fs";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// DEBUG: Demonstrating @opentui-ui/dialog hit grid bug
// See: https://github.com/ainergiz/xfeed/issues/204
// =============================================================================
const DEBUG_LOG = "/tmp/xfeed-dialog-bug.log";
writeFileSync(DEBUG_LOG, `=== Dialog Hit Grid Bug Debug Log ===\n\n`);

const debugLog = (msg: string) => {
  const timestamp = new Date().toISOString();
  appendFileSync(DEBUG_LOG, `${timestamp} ${msg}\n`);
};

/**
 * Debug hook to monitor DialogContainerRenderable state.
 * Logs the container's visibility and position to demonstrate the bug.
 */
function useDialogContainerDebug() {
  const renderer = useRenderer();
  const isDialogOpen = useDialogState((s) => s.isOpen);

  useEffect(() => {
    const container = renderer.root
      .getChildren()
      .find((c) => c.id === "dialog-container");

    if (container) {
      debugLog(`[DialogContainer] Found container:`);
      debugLog(`  - id: ${container.id}`);
      debugLog(`  - visible: ${container.visible}`);
      debugLog(`  - position: (${container.x}, ${container.y})`);
      debugLog(`  - size: ${container.width}x${container.height}`);
      debugLog(`  - isDialogOpen: ${isDialogOpen}`);
      debugLog(``);

      if (container.visible && !isDialogOpen) {
        debugLog(`[BUG] Container is VISIBLE but NO DIALOGS are open!`);
        debugLog(`      This blocks all mouse events to elements underneath.`);
        debugLog(
          `      The container covers the entire screen (${container.width}x${container.height})`
        );
        debugLog(`      and intercepts scroll/click events.`);
        debugLog(``);
      }
    } else {
      debugLog(`[DialogContainer] Container not found yet`);
    }
  }, [renderer, isDialogOpen]);
}

import type { XClient } from "@/api/client";
import type {
  BookmarkFolder,
  NotificationData,
  TweetData,
  UserData,
} from "@/api/types";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { clearBrowserPreference } from "@/config/loader";
import { useModal } from "@/contexts/ModalContext";
import {
  QueryProvider,
  TimelineScreenExperimental,
  useBookmarkMutation,
} from "@/experiments";
import { useActions } from "@/hooks/useActions";
import { useNavigation } from "@/hooks/useNavigation";
import { copyToClipboard } from "@/lib/clipboard";
import { DeleteFolderConfirmContent } from "@/modals/DeleteFolderConfirmModal";
// Dialog content components (for @opentui-ui/dialog)
import {
  ExitConfirmationContent,
  type ExitChoice,
} from "@/modals/ExitConfirmationModal";
import { BookmarksScreen } from "@/screens/BookmarksScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { PostDetailScreen } from "@/screens/PostDetailScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { ThreadScreen } from "@/screens/ThreadScreen";

const SPLASH_MIN_DISPLAY_MS = 500;

export type View =
  | "timeline"
  | "bookmarks"
  | "notifications"
  | "post-detail"
  | "thread"
  | "profile";

/** Main views that can be navigated between with Tab (excludes overlay views) */
const MAIN_VIEWS = ["timeline", "bookmarks", "notifications"] as const;

interface AppProps {
  client: XClient;
  user: UserData;
}

/**
 * App wrapper that provides QueryProvider context
 * The actual app content is in AppContent which can use TanStack Query hooks
 */
export function App({ client, user }: AppProps) {
  return (
    <QueryProvider>
      <AppContent client={client} user={user} />
    </QueryProvider>
  );
}

function AppContent({ client, user }: AppProps) {
  const renderer = useRenderer();

  // DEBUG: Monitor dialog container state to demonstrate bug
  useDialogContainerDebug();

  const { currentView, navigate, goBack, isMainView } = useNavigation<View>({
    initialView: "timeline",
    mainViews: MAIN_VIEWS,
  });
  const [postCount, setPostCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [bookmarkHasMore, setBookmarkHasMore] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showFooter, setShowFooter] = useState(true);

  // Modal context (legacy - will be removed after full migration)
  const { openModal, closeModal, isModalOpen } = useModal();

  // Dialog context (@opentui-ui/dialog)
  const dialog = useDialog();
  const isDialogOpen = useDialogState((s) => s.isOpen);

  // Combined check for any modal/dialog being open
  const isAnyModalOpen = isModalOpen || isDialogOpen;

  // Set up session expired callback
  useEffect(() => {
    client.setOnSessionExpired(() => {
      openModal("session-expired", {});
    });
  }, [client, openModal]);

  // State for bookmark folder selection (moved here for useActions integration)
  const [selectedBookmarkFolder, setSelectedBookmarkFolder] =
    useState<BookmarkFolder | null>(null);

  // TanStack Query mutation for bookmark operations with optimistic updates
  const bookmarkMutation = useBookmarkMutation({
    client,
    onSuccess: (message) => setActionMessage(message),
    onError: (error) => setActionMessage(`Error: ${error}`),
  });

  // Actions hook for like/bookmark mutations
  const { toggleLike, toggleBookmark, getState, initState } = useActions({
    client,
    onError: (error) => setActionMessage(`Error: ${error}`),
    onSuccess: (message) => setActionMessage(message),
    bookmarkMutation,
    currentFolderId: selectedBookmarkFolder?.id,
  });

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const initialLoadComplete = useRef(false);

  // Start minimum display timer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, SPLASH_MIN_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // Hide splash when both conditions are met
  useEffect(() => {
    if (minTimeElapsed && initialLoadComplete.current) {
      setShowSplash(false);
    }
  }, [minTimeElapsed]);

  // Track when posts are first received (legacy - updates post count in header)
  const handlePostCountChange = useCallback((count: number) => {
    setPostCount(count);
  }, []);

  // Track when initial timeline load completes (success or error)
  const handleInitialLoadComplete = useCallback(() => {
    if (!initialLoadComplete.current) {
      initialLoadComplete.current = true;
      if (minTimeElapsed) {
        setShowSplash(false);
      }
    }
  }, [minTimeElapsed]);

  // Track bookmark count separately
  const handleBookmarkCountChange = useCallback((count: number) => {
    setBookmarkCount(count);
  }, []);

  // Track bookmark hasMore state
  const handleBookmarkHasMoreChange = useCallback((hasMore: boolean) => {
    setBookmarkHasMore(hasMore);
  }, []);

  // Track notification counts
  const handleNotificationCountChange = useCallback((count: number) => {
    setNotificationCount(count);
  }, []);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadNotificationCount(count);
  }, []);

  // State for post detail view - stack to support navigating to replies
  const [postStack, setPostStack] = useState<TweetData[]>([]);
  const selectedPost = postStack[postStack.length - 1] ?? null;

  // Loading state for quote navigation
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Loading state for parent tweet navigation
  const [isLoadingParent, setIsLoadingParent] = useState(false);

  // State for thread view - the tweet whose thread we're viewing
  // Kept separate from selectedPost so thread state persists when viewing replies
  const [threadRootTweet, setThreadRootTweet] = useState<TweetData | null>(
    null
  );

  // Navigate to post detail view (from timeline, bookmarks, profile, or a reply)
  const handlePostSelect = useCallback(
    (post: TweetData) => {
      setPostStack((prev) => [...prev, post]);
      initState(post.id, post.favorited ?? false, post.bookmarked ?? false);
      navigate("post-detail");
    },
    [navigate, initState]
  );

  // Navigate to post detail from thread view (selecting a reply)
  const handlePostSelectFromThread = useCallback(
    (post: TweetData) => {
      setPostStack((prev) => [...prev, post]);
      initState(post.id, post.favorited ?? false, post.bookmarked ?? false);
      navigate("post-detail");
    },
    [navigate, initState]
  );

  // Navigate into a quoted tweet (fetch full data and push to stack)
  const handleQuoteSelect = useCallback(
    async (quotedTweet: TweetData) => {
      if (isLoadingQuote) return;

      // Prevent circular navigation (tweet already in stack)
      if (postStack.some((p) => p.id === quotedTweet.id)) {
        setActionMessage("Already viewing this tweet");
        return;
      }

      setIsLoadingQuote(true);
      try {
        // Fetch full tweet data (the embedded quote only has partial data)
        const result = await client.getTweet(quotedTweet.id);
        if (result.success && result.tweet) {
          setPostStack((prev) => [...prev, result.tweet!]);
          initState(
            result.tweet.id,
            result.tweet.favorited ?? false,
            result.tweet.bookmarked ?? false
          );
          // Push to navigation history to keep stacks in sync with handleBackFromDetail
          navigate("post-detail");
        } else {
          setActionMessage(result.error || "Could not load quoted tweet");
        }
      } finally {
        setIsLoadingQuote(false);
      }
    },
    [client, initState, isLoadingQuote, navigate, postStack]
  );

  // Navigate to parent tweet (fetch full data and push to stack, or go back if already in stack)
  const handleParentSelect = useCallback(
    async (parentTweet: TweetData) => {
      if (isLoadingParent) return;

      // Check if parent is already in the stack (user navigated from parent to reply)
      const parentIndex = postStack.findIndex((p) => p.id === parentTweet.id);
      if (parentIndex !== -1) {
        // Parent is in stack - go back to it by popping items off the stack
        const itemsToPop = postStack.length - 1 - parentIndex;
        for (let i = 0; i < itemsToPop; i++) {
          goBack();
        }
        setPostStack((prev) => prev.slice(0, parentIndex + 1));
        return;
      }

      setIsLoadingParent(true);
      try {
        // Fetch full tweet data (the displayed parent only has partial data)
        const result = await client.getTweet(parentTweet.id);
        if (result.success && result.tweet) {
          setPostStack((prev) => [...prev, result.tweet!]);
          initState(
            result.tweet.id,
            result.tweet.favorited ?? false,
            result.tweet.bookmarked ?? false
          );
          navigate("post-detail");
        } else {
          setActionMessage(result.error || "Could not load parent tweet");
        }
      } finally {
        setIsLoadingParent(false);
      }
    },
    [client, goBack, initState, isLoadingParent, navigate, postStack]
  );

  // Return from post detail to previous view
  const handleBackFromDetail = useCallback(() => {
    goBack();
    setPostStack((prev) => prev.slice(0, -1));
  }, [goBack]);

  // State for profile view (stack for nested profile navigation)
  const [profileStack, setProfileStack] = useState<string[]>([]);
  const profileUsername = profileStack[profileStack.length - 1] ?? null;

  // Navigate to profile view from post detail or another profile
  const handleProfileOpen = useCallback(
    (username: string) => {
      setProfileStack((prev) => [...prev, username]);
      navigate("profile");
    },
    [navigate]
  );

  // Navigate to thread view from post detail
  const handleThreadView = useCallback(() => {
    if (selectedPost) {
      setThreadRootTweet(selectedPost);
      navigate("thread");
    }
  }, [navigate, selectedPost]);

  // Return from thread view to post detail (clears thread state)
  const handleBackFromThread = useCallback(() => {
    goBack();
    setThreadRootTweet(null);
  }, [goBack]);

  // Return from profile to previous view (pops from profile stack)
  const handleBackFromProfile = useCallback(() => {
    goBack();
    setProfileStack((prev) => prev.slice(0, -1));
  }, [goBack]);

  // Handle post select from profile (view a user's tweet in detail)
  const handlePostSelectFromProfile = useCallback(
    (post: TweetData) => {
      setPostStack((prev) => [...prev, post]);
      initState(post.id, post.favorited ?? false, post.bookmarked ?? false);
      navigate("post-detail");
    },
    [navigate, initState]
  );

  // Open folder picker modal from post detail
  const handleMoveToFolder = useCallback(() => {
    if (!selectedPost) return;

    openModal("folder-picker", {
      client,
      tweet: selectedPost,
      onSelect: async (folderId: string, folderName: string) => {
        const result = await client.moveBookmarkToFolder(
          selectedPost.id,
          folderId
        );

        if (result.success) {
          setActionMessage(`Moved to "${folderName}"`);
        } else {
          setActionMessage(`Error: ${result.error}`);
        }

        closeModal();
      },
      onClose: closeModal,
    });
  }, [client, selectedPost, openModal, closeModal]);

  // Open bookmark folder selector modal
  const handleBookmarkFolderSelectorOpen = useCallback(() => {
    openModal("bookmark-folder-selector", {
      client,
      currentFolder: selectedBookmarkFolder,
      onSelect: (folder: BookmarkFolder | null) => {
        setSelectedBookmarkFolder(folder);
        closeModal();
      },
      onClose: closeModal,
    });
  }, [client, selectedBookmarkFolder, openModal, closeModal]);

  // Create new bookmark folder
  const handleCreateBookmarkFolder = useCallback(() => {
    openModal("folder-name-input", {
      mode: "create",
      onSubmit: async (name: string) => {
        const result = await client.createBookmarkFolder(name);
        if (result.success) {
          setActionMessage(`Created folder "${name}"`);
          closeModal();
        } else {
          throw new Error(result.error);
        }
      },
      onClose: closeModal,
    });
  }, [client, openModal, closeModal]);

  // Edit current bookmark folder
  const handleEditBookmarkFolder = useCallback(() => {
    if (!selectedBookmarkFolder) return;

    openModal("folder-name-input", {
      mode: "edit",
      initialName: selectedBookmarkFolder.name,
      onSubmit: async (name: string) => {
        const result = await client.editBookmarkFolder(
          selectedBookmarkFolder.id,
          name
        );
        if (result.success) {
          setSelectedBookmarkFolder(result.folder);
          setActionMessage(`Renamed folder to "${name}"`);
          closeModal();
        } else {
          throw new Error(result.error);
        }
      },
      onClose: closeModal,
    });
  }, [client, selectedBookmarkFolder, openModal, closeModal]);

  // Delete current bookmark folder
  const handleDeleteBookmarkFolder = useCallback(async () => {
    if (!selectedBookmarkFolder) return;

    const folderName = selectedBookmarkFolder.name;
    const folderId = selectedBookmarkFolder.id;

    const confirmed = await dialog.confirm({
      content: (ctx) => (
        <DeleteFolderConfirmContent
          {...ctx}
          folderName={folderName}
          onConfirm={async () => {
            const result = await client.deleteBookmarkFolder(folderId);
            if (!result.success) {
              throw new Error(result.error);
            }
          }}
        />
      ),
      unstyled: true,
    });

    if (confirmed) {
      setActionMessage(`Deleted folder "${folderName}"`);
      setSelectedBookmarkFolder(null);
    }
  }, [client, selectedBookmarkFolder, dialog]);

  // Show exit confirmation dialog using @opentui-ui/dialog
  const showExitConfirmation = useCallback(async () => {
    const result = await dialog.choice<ExitChoice>({
      content: (ctx) => <ExitConfirmationContent {...ctx} />,
      unstyled: true,
    });

    if (result === "logout") {
      clearBrowserPreference();
      renderer.destroy();
    } else if (result === "exit") {
      renderer.destroy();
    }
    // undefined = cancelled, do nothing
  }, [dialog, renderer]);

  // Handle notification select - navigate to tweet detail or profile based on type
  const handleNotificationSelect = useCallback(
    (notification: NotificationData) => {
      // If notification has a target tweet (like, retweet, reply), go to post detail
      if (notification.targetTweet) {
        setPostStack((prev) => [...prev, notification.targetTweet!]);
        initState(
          notification.targetTweet.id,
          notification.targetTweet.favorited ?? false,
          notification.targetTweet.bookmarked ?? false
        );
        navigate("post-detail");
        return;
      }

      // If notification is a follow (person_icon with fromUsers), go to profile
      if (
        notification.icon === "person_icon" &&
        notification.fromUsers &&
        notification.fromUsers.length > 0
      ) {
        const follower = notification.fromUsers[0];
        if (follower) {
          setProfileStack((prev) => [...prev, follower.username]);
          navigate("profile");
        }
        return;
      }

      // For system notifications, open URL in browser
      if (notification.url) {
        import("@/lib/media").then(({ openInBrowser }) => {
          openInBrowser(notification.url);
        });
      }
    },
    [navigate, initState]
  );

  useKeyboard((key) => {
    // Handle copy with 'c' - Cmd+C is intercepted by terminal
    if (key.name === "c") {
      const selection = renderer.getSelection();
      if (selection) {
        const text = selection.getSelectedText();
        if (text) {
          copyToClipboard(text).then((result) => {
            if (result.success) {
              setActionMessage("Copied to clipboard");
            }
          });
          return;
        }
      }
    }

    // Don't handle keys when modals/dialogs are showing - they handle their own keyboard
    if (isAnyModalOpen) {
      return;
    }

    // Always allow quit with 'q', even during splash
    if (key.name === "q") {
      if (showSplash || isMainView) {
        renderer.destroy();
        return;
      }
    }

    // Handle 'escape' key
    if (key.name === "escape") {
      // During splash, quit immediately
      if (showSplash) {
        renderer.destroy();
        return;
      }

      // In main views: navigate to timeline or show exit confirmation
      if (isMainView) {
        if (currentView === "timeline") {
          // On timeline: show exit confirmation
          showExitConfirmation();
        } else {
          // On bookmarks/notifications: go to timeline
          navigate("timeline");
        }
        return;
      }
      // Overlay views (post-detail, profile) handle their own escape
    }

    // Handle 'h' key for vim-style navigation (go back/left to home)
    if (key.name === "h") {
      if (isMainView) {
        if (currentView === "timeline") {
          // On timeline: show exit confirmation (same as escape)
          showExitConfirmation();
        } else {
          // On bookmarks/notifications: go to timeline
          navigate("timeline");
        }
        return;
      }
    }

    // Toggle footer visibility with '.' - works on all screens
    if (key.sequence === ".") {
      setShowFooter((prev) => !prev);
      return;
    }

    // Don't handle other keys during splash
    if (showSplash) {
      return;
    }

    // Global navigation with number keys - works from anywhere
    if (key.name === "1") {
      // Clear overlay state and go to timeline
      setPostStack([]);
      setProfileStack([]);
      setThreadRootTweet(null);
      navigate("timeline");
      return;
    }

    if (key.name === "2") {
      // Clear overlay state and go to bookmarks
      setPostStack([]);
      setProfileStack([]);
      setThreadRootTweet(null);
      navigate("bookmarks");
      return;
    }

    if (key.name === "3") {
      // Clear overlay state and go to notifications
      setPostStack([]);
      setProfileStack([]);
      setThreadRootTweet(null);
      navigate("notifications");
      return;
    }

    // Don't handle other keys during overlay views
    if (!isMainView) {
      return;
    }

    // Go to notifications with 'n'
    if (key.name === "n") {
      navigate("notifications");
    }

    // Go to own profile with 'p'
    if (key.name === "p") {
      setProfileStack((prev) => [...prev, user.username]);
      navigate("profile");
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
      }}
    >
      {showSplash ? (
        <SplashScreen />
      ) : isMainView ? (
        <Header
          currentView={currentView}
          postCount={
            currentView === "bookmarks"
              ? bookmarkCount
              : currentView === "notifications"
                ? notificationCount
                : postCount
          }
          hasMore={currentView === "bookmarks" ? bookmarkHasMore : false}
          unreadNotificationCount={unreadNotificationCount}
        />
      ) : null}

      {/* Content area - always mount TimelineScreen to preserve state */}
      <box
        style={{
          flexGrow: 1,
          // Hide during splash but keep mounted
          height: showSplash ? 0 : undefined,
          overflow: showSplash ? "hidden" : undefined,
        }}
      >
        {/* TanStack Query experiment: TimelineScreenExperimental */}
        <box
          style={{
            flexGrow: currentView === "timeline" ? 1 : 0,
            height: currentView === "timeline" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          <TimelineScreenExperimental
            client={client}
            focused={
              currentView === "timeline" && !showSplash && !isAnyModalOpen
            }
            onPostCountChange={handlePostCountChange}
            onInitialLoadComplete={handleInitialLoadComplete}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            getActionState={getState}
            initActionState={initState}
          />
        </box>

        {currentView === "post-detail" && selectedPost && (
          <PostDetailScreen
            client={client}
            tweet={selectedPost}
            focused={!isAnyModalOpen}
            onBack={handleBackFromDetail}
            onProfileOpen={handleProfileOpen}
            onLike={() => toggleLike(selectedPost)}
            onBookmark={() => toggleBookmark(selectedPost)}
            onMoveToFolder={handleMoveToFolder}
            isLiked={getState(selectedPost.id).liked}
            isBookmarked={getState(selectedPost.id).bookmarked}
            isJustLiked={getState(selectedPost.id).justLiked}
            isJustBookmarked={getState(selectedPost.id).justBookmarked}
            onReplySelect={handlePostSelect}
            getActionState={getState}
            onThreadView={handleThreadView}
            onQuoteSelect={handleQuoteSelect}
            isLoadingQuote={isLoadingQuote}
            onParentSelect={handleParentSelect}
            isLoadingParent={isLoadingParent}
            showFooter={showFooter}
          />
        )}

        {/* Keep ThreadScreen mounted to preserve state, hide when not active */}
        <box
          style={{
            flexGrow: currentView === "thread" ? 1 : 0,
            height: currentView === "thread" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          {threadRootTweet && (
            <ThreadScreen
              client={client}
              tweet={threadRootTweet}
              focused={currentView === "thread"}
              onBack={handleBackFromThread}
              onSelectTweet={handlePostSelectFromThread}
              showFooter={showFooter}
            />
          )}
        </box>

        {/* Keep ProfileScreen mounted to preserve state, hide when not active */}
        <box
          style={{
            flexGrow: currentView === "profile" ? 1 : 0,
            height: currentView === "profile" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          {profileUsername && (
            <ProfileScreen
              client={client}
              username={profileUsername}
              currentUser={user}
              focused={currentView === "profile"}
              onBack={handleBackFromProfile}
              onPostSelect={handlePostSelectFromProfile}
              onProfileOpen={handleProfileOpen}
              onLike={toggleLike}
              onBookmark={toggleBookmark}
              getActionState={getState}
              initActionState={initState}
              showFooter={showFooter}
            />
          )}
        </box>

        {/* Keep BookmarksScreen mounted to preserve state, hide when not active */}
        <box
          style={{
            flexGrow: currentView === "bookmarks" ? 1 : 0,
            height: currentView === "bookmarks" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          <BookmarksScreen
            client={client}
            focused={
              currentView === "bookmarks" && !showSplash && !isAnyModalOpen
            }
            selectedFolder={selectedBookmarkFolder}
            onFolderPickerOpen={handleBookmarkFolderSelectorOpen}
            onPostCountChange={handleBookmarkCountChange}
            onHasMoreChange={handleBookmarkHasMoreChange}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            getActionState={getState}
            initActionState={initState}
            onCreateFolder={handleCreateBookmarkFolder}
            onEditFolder={handleEditBookmarkFolder}
            onDeleteFolder={handleDeleteBookmarkFolder}
          />
        </box>

        {/* Keep NotificationsScreen mounted to preserve state, hide when not active */}
        <box
          style={{
            flexGrow: currentView === "notifications" ? 1 : 0,
            height: currentView === "notifications" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          <NotificationsScreen
            client={client}
            focused={
              currentView === "notifications" && !showSplash && !isAnyModalOpen
            }
            onNotificationCountChange={handleNotificationCountChange}
            onUnreadCountChange={handleUnreadCountChange}
            onNotificationSelect={handleNotificationSelect}
          />
        </box>
      </box>

      {!showSplash && isMainView && <Footer visible={showFooter} />}
    </box>
  );
}
