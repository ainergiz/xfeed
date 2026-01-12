import { useDialog, useDialogState } from "@opentui-ui/dialog/react";
import { ToasterRenderable, toast } from "@opentui-ui/toast";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import {
  QueryProvider,
  TimelineScreenExperimental,
  useBookmarkMutation,
} from "@/experiments";
import { useActions } from "@/hooks/useActions";
import { useNavigation } from "@/hooks/useNavigation";
import { copyToClipboard } from "@/lib/clipboard";
import { BookmarkFolderSelectorContent } from "@/modals/BookmarkFolderSelector";
import { DeleteFolderConfirmContent } from "@/modals/DeleteFolderConfirmModal";
import { ExitConfirmationContent } from "@/modals/ExitConfirmationModal";
import { FolderNameInputContent } from "@/modals/FolderNameInputModal";
import {
  FolderPickerContent,
  type FolderPickerResult,
} from "@/modals/FolderPicker";
import { SessionExpiredContent } from "@/modals/SessionExpiredModal";
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
  const { currentView, navigate, goBack, isMainView } = useNavigation<View>({
    initialView: "timeline",
    mainViews: MAIN_VIEWS,
  });
  const [postCount, setPostCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [bookmarkHasMore, setBookmarkHasMore] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showFooter, setShowFooter] = useState(true);

  // Dialog system (@opentui-ui/dialog)
  const dialog = useDialog();
  const isDialogOpen = useDialogState((s) => s.isOpen);

  // Toast system (@opentui-ui/toast) - top-right position
  useEffect(() => {
    const toaster = new ToasterRenderable(renderer, {
      position: "top-right",
      stackingMode: "stack",
      visibleToasts: 5,
      offset: { top: 1, right: 1 },
      toastOptions: {
        duration: 3000,
        style: {
          backgroundColor: "#1e1e2e",
          foregroundColor: "#cdd6f4",
          borderColor: "#313244",
          mutedColor: "#6c7086",
        },
        success: { style: { borderColor: "#a6e3a1" } },
        error: { style: { borderColor: "#f38ba8" } },
      },
    });
    renderer.root.add(toaster);
    return () => toaster.destroy();
  }, [renderer]);

  // Set up session expired callback
  useEffect(() => {
    client.setOnSessionExpired(() => {
      dialog.alert({
        content: (ctx) => (
          <SessionExpiredContent
            dismiss={ctx.dismiss}
            dialogId={ctx.dialogId}
          />
        ),
        unstyled: true,
      });
    });
  }, [client, dialog]);

  // State for bookmark folder selection (moved here for useActions integration)
  const [selectedBookmarkFolder, setSelectedBookmarkFolder] =
    useState<BookmarkFolder | null>(null);

  // TanStack Query mutation for bookmark operations with optimistic updates
  const bookmarkMutation = useBookmarkMutation({
    client,
    onSuccess: (message) => toast.success(message),
    onError: (error) => toast.error(error),
  });

  // Actions hook for like/bookmark mutations
  const { toggleLike, toggleBookmark, getState, initState } = useActions({
    client,
    onError: (error) => toast.error(error),
    onSuccess: (message) => toast.success(message),
    bookmarkMutation,
    currentFolderId: selectedBookmarkFolder?.id,
  });

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
        toast.info("Already viewing this tweet");
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
          toast.error(result.error || "Could not load quoted tweet");
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
          toast.error(result.error || "Could not load parent tweet");
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

  // Open folder picker dialog from post detail
  const handleMoveToFolder = useCallback(async () => {
    if (!selectedPost) return;

    const result = await dialog.choice<FolderPickerResult>({
      content: (ctx) => (
        <FolderPickerContent
          client={client}
          resolve={ctx.resolve}
          dismiss={ctx.dismiss}
          dialogId={ctx.dialogId}
        />
      ),
      unstyled: true,
    });

    // undefined means dismissed
    if (!result) return;

    const moveResult = await client.moveBookmarkToFolder(
      selectedPost.id,
      result.folderId
    );

    if (moveResult.success) {
      toast.success(`Moved to "${result.folderName}"`);
    } else {
      toast.error(moveResult.error);
    }
  }, [client, selectedPost, dialog]);

  // Open bookmark folder selector dialog
  const handleBookmarkFolderSelectorOpen = useCallback(async () => {
    const folder = await dialog.choice<BookmarkFolder | null>({
      content: (ctx) => (
        <BookmarkFolderSelectorContent
          client={client}
          currentFolder={selectedBookmarkFolder}
          resolve={ctx.resolve}
          dismiss={ctx.dismiss}
          dialogId={ctx.dialogId}
        />
      ),
      unstyled: true,
    });

    // undefined means dismissed, don't change selection
    if (folder !== undefined) {
      setSelectedBookmarkFolder(folder);
    }
  }, [client, selectedBookmarkFolder, dialog]);

  // Create new bookmark folder
  const handleCreateBookmarkFolder = useCallback(async () => {
    const name = await dialog.prompt<string>({
      content: (ctx) => (
        <FolderNameInputContent
          mode="create"
          onSubmit={async (folderName) => {
            const result = await client.createBookmarkFolder(folderName);
            if (!result.success) {
              throw new Error(result.error);
            }
          }}
          resolve={ctx.resolve}
          dismiss={ctx.dismiss}
          dialogId={ctx.dialogId}
        />
      ),
      unstyled: true,
    });

    // undefined means dismissed
    if (name) {
      toast.success(`Created folder "${name}"`);
    }
  }, [client, dialog]);

  // Edit current bookmark folder
  const handleEditBookmarkFolder = useCallback(async () => {
    if (!selectedBookmarkFolder) return;

    const name = await dialog.prompt<string>({
      content: (ctx) => (
        <FolderNameInputContent
          mode="edit"
          initialName={selectedBookmarkFolder.name}
          onSubmit={async (folderName) => {
            const result = await client.editBookmarkFolder(
              selectedBookmarkFolder.id,
              folderName
            );
            if (result.success) {
              setSelectedBookmarkFolder(result.folder);
            } else {
              throw new Error(result.error);
            }
          }}
          resolve={ctx.resolve}
          dismiss={ctx.dismiss}
          dialogId={ctx.dialogId}
        />
      ),
      unstyled: true,
    });

    // undefined means dismissed
    if (name) {
      toast.success(`Renamed folder to "${name}"`);
    }
  }, [client, selectedBookmarkFolder, dialog]);

  // Delete current bookmark folder
  const handleDeleteBookmarkFolder = useCallback(async () => {
    if (!selectedBookmarkFolder) return;

    const confirmed = await dialog.confirm({
      content: (ctx) => (
        <DeleteFolderConfirmContent
          folderName={selectedBookmarkFolder.name}
          onConfirm={async () => {
            const result = await client.deleteBookmarkFolder(
              selectedBookmarkFolder.id
            );
            if (result.success) {
              toast.success(`Deleted folder "${selectedBookmarkFolder.name}"`);
              setSelectedBookmarkFolder(null);
            } else {
              throw new Error(result.error);
            }
          }}
          resolve={ctx.resolve}
          dismiss={ctx.dismiss}
          dialogId={ctx.dialogId}
        />
      ),
      unstyled: true,
    });

    // Dialog was dismissed without confirming
    if (!confirmed) return;
  }, [client, selectedBookmarkFolder, dialog]);

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

  // Show exit confirmation dialog
  const showExitConfirmation = useCallback(() => {
    dialog
      .choice<"logout" | "exit">({
        content: (ctx) => (
          <ExitConfirmationContent
            resolve={ctx.resolve}
            dismiss={ctx.dismiss}
            dialogId={ctx.dialogId}
          />
        ),
        unstyled: true,
      })
      .then((choice) => {
        if (choice === "logout") {
          clearBrowserPreference();
          renderer.destroy();
        } else if (choice === "exit") {
          renderer.destroy();
        }
        // undefined = cancelled, do nothing
      });
  }, [dialog, renderer]);

  useKeyboard((key) => {
    // Handle copy with 'c' - Cmd+C is intercepted by terminal
    if (key.name === "c") {
      const selection = renderer.getSelection();
      if (selection) {
        const text = selection.getSelectedText();
        if (text) {
          copyToClipboard(text).then((result) => {
            if (result.success) {
              toast.success("Copied to clipboard");
            }
          });
          return;
        }
      }
    }

    // Don't handle keys when modals are showing - they handle their own keyboard
    if (isDialogOpen) {
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

    // Toggle footer visibility with '.' - works on all screens
    if (key.sequence === ".") {
      setShowFooter((prev) => !prev);
      return;
    }

    // Don't handle other keys during splash
    if (showSplash) {
      return;
    }

    // Tab cycling for main screens - works from anywhere
    if (key.name === "tab") {
      // Clear overlay state
      setPostStack([]);
      setProfileStack([]);
      setThreadRootTweet(null);

      // Find current position and cycle
      const currentIdx = MAIN_VIEWS.indexOf(
        currentView as (typeof MAIN_VIEWS)[number]
      );
      if (currentIdx === -1) {
        // From overlay view, go to timeline
        navigate("timeline");
      } else if (key.shift) {
        // Shift+Tab: cycle backward
        const prevIdx =
          (currentIdx - 1 + MAIN_VIEWS.length) % MAIN_VIEWS.length;
        const prevView = MAIN_VIEWS[prevIdx];
        if (prevView) navigate(prevView);
      } else {
        // Tab: cycle forward
        const nextIdx = (currentIdx + 1) % MAIN_VIEWS.length;
        const nextView = MAIN_VIEWS[nextIdx];
        if (nextView) navigate(nextView);
      }
      return;
    }

    // Don't handle other keys during overlay views
    if (!isMainView) {
      return;
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
          visible={currentView === "timeline"}
          style={{
            flexGrow: 1,
            height: "100%",
          }}
        >
          <TimelineScreenExperimental
            client={client}
            focused={currentView === "timeline" && !showSplash && !isDialogOpen}
            onPostCountChange={handlePostCountChange}
            onInitialLoadComplete={handleInitialLoadComplete}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            onProfileOpen={handleProfileOpen}
            getActionState={getState}
            initActionState={initState}
          />
        </box>

        {currentView === "post-detail" && selectedPost && (
          <PostDetailScreen
            client={client}
            tweet={selectedPost}
            focused={!isDialogOpen}
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
          visible={currentView === "thread"}
          style={{
            flexGrow: 1,
            height: "100%",
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
          visible={currentView === "profile"}
          style={{
            flexGrow: 1,
            height: "100%",
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
          visible={currentView === "bookmarks"}
          style={{
            flexGrow: 1,
            height: "100%",
          }}
        >
          <BookmarksScreen
            client={client}
            focused={
              currentView === "bookmarks" && !showSplash && !isDialogOpen
            }
            selectedFolder={selectedBookmarkFolder}
            onFolderPickerOpen={handleBookmarkFolderSelectorOpen}
            onPostCountChange={handleBookmarkCountChange}
            onHasMoreChange={handleBookmarkHasMoreChange}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            onProfileOpen={handleProfileOpen}
            getActionState={getState}
            initActionState={initState}
            onCreateFolder={handleCreateBookmarkFolder}
            onEditFolder={handleEditBookmarkFolder}
            onDeleteFolder={handleDeleteBookmarkFolder}
          />
        </box>

        {/* Keep NotificationsScreen mounted to preserve state, hide when not active */}
        <box
          visible={currentView === "notifications"}
          style={{
            flexGrow: 1,
            height: "100%",
          }}
        >
          <NotificationsScreen
            client={client}
            focused={
              currentView === "notifications" && !showSplash && !isDialogOpen
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
