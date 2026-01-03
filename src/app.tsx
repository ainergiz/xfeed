import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TwitterClient } from "@/api/client";
import type { NotificationData, TweetData, UserData } from "@/api/types";

import { ExitConfirmationModal } from "@/components/ExitConfirmationModal";
import { FolderPicker } from "@/components/FolderPicker";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";
import { useActions } from "@/hooks/useActions";
import { useNavigation } from "@/hooks/useNavigation";
import { BookmarksScreen } from "@/screens/BookmarksScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { PostDetailScreen } from "@/screens/PostDetailScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { ThreadScreen } from "@/screens/ThreadScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";

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
  client: TwitterClient;
  user: UserData;
}

export function App({ client, user: _user }: AppProps) {
  const renderer = useRenderer();
  const { currentView, navigate, goBack, cycleNext, isMainView } =
    useNavigation<View>({
      initialView: "timeline",
      mainViews: MAIN_VIEWS,
    });
  const [postCount, setPostCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showFooter, setShowFooter] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Set up session expired callback
  useEffect(() => {
    client.setOnSessionExpired(() => {
      setSessionExpired(true);
    });
  }, [client]);

  // Actions hook for like/bookmark mutations
  const { toggleLike, toggleBookmark, getState, initState } = useActions({
    client,
    onError: (error) => setActionMessage(`Error: ${error}`),
    onSuccess: (message) => setActionMessage(message),
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
  const hasReceivedPosts = useRef(false);

  // Start minimum display timer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, SPLASH_MIN_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // Hide splash when both conditions are met
  useEffect(() => {
    if (minTimeElapsed && hasReceivedPosts.current) {
      setShowSplash(false);
    }
  }, [minTimeElapsed]);

  // Track when posts are first received
  const handlePostCountChange = useCallback(
    (count: number) => {
      setPostCount(count);
      if (count > 0 && !hasReceivedPosts.current) {
        hasReceivedPosts.current = true;
        if (minTimeElapsed) {
          setShowSplash(false);
        }
      }
    },
    [minTimeElapsed]
  );

  // Track bookmark count separately
  const handleBookmarkCountChange = useCallback((count: number) => {
    setBookmarkCount(count);
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

  // Return from post detail to previous view
  const handleBackFromDetail = useCallback(() => {
    goBack();
    setPostStack((prev) => prev.slice(0, -1));
  }, [goBack]);

  // State for profile view
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // Navigate to profile view from post detail
  const handleProfileOpen = useCallback(
    (username: string) => {
      setProfileUsername(username);
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

  // Return from profile to previous view
  const handleBackFromProfile = useCallback(() => {
    goBack();
    setProfileUsername(null);
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

  // State for folder picker modal
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // State for exit confirmation modal
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  // Open folder picker from post detail
  const handleMoveToFolder = useCallback(() => {
    setShowFolderPicker(true);
  }, []);

  // Handle folder selection
  const handleFolderSelect = useCallback(
    async (folderId: string, folderName: string) => {
      if (!selectedPost) return;

      const result = await client.moveBookmarkToFolder(
        selectedPost.id,
        folderId
      );

      if (result.success) {
        setActionMessage(`Moved to "${folderName}"`);
      } else {
        setActionMessage(`Error: ${result.error}`);
      }

      setShowFolderPicker(false);
    },
    [client, selectedPost]
  );

  // Close folder picker
  const handleFolderPickerClose = useCallback(() => {
    setShowFolderPicker(false);
  }, []);

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
          setProfileUsername(follower.username);
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
    // Don't handle keys when exit confirmation modal is showing
    if (showExitConfirmation) {
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
          setShowExitConfirmation(true);
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
          setShowExitConfirmation(true);
        } else {
          // On bookmarks/notifications: go to timeline
          navigate("timeline");
        }
        return;
      }
    }

    // Don't handle other keys during splash or overlay views
    if (showSplash || !isMainView) {
      return;
    }

    // Switch views on Tab
    if (key.name === "tab") {
      cycleNext();
    }

    // Go to notifications with 'n'
    if (key.name === "n") {
      navigate("notifications");
    }

    // Toggle footer visibility with '?'
    if (key.sequence === "?") {
      setShowFooter((prev) => !prev);
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
        {/* Keep TimelineScreen mounted to preserve state, hide when not active */}
        <box
          style={{
            flexGrow: currentView === "timeline" ? 1 : 0,
            height: currentView === "timeline" ? "100%" : 0,
            overflow: "hidden",
          }}
        >
          <TimelineScreen
            client={client}
            focused={currentView === "timeline" && !showSplash}
            onPostCountChange={handlePostCountChange}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            getActionState={getState}
            initActionState={initState}
            actionMessage={actionMessage}
          />
        </box>

        {currentView === "post-detail" && selectedPost && (
          <>
            <PostDetailScreen
              client={client}
              tweet={selectedPost}
              focused={!showFolderPicker}
              onBack={handleBackFromDetail}
              onProfileOpen={handleProfileOpen}
              onLike={() => toggleLike(selectedPost)}
              onBookmark={() => toggleBookmark(selectedPost)}
              onMoveToFolder={handleMoveToFolder}
              isLiked={getState(selectedPost.id).liked}
              isBookmarked={getState(selectedPost.id).bookmarked}
              actionMessage={actionMessage}
              onReplySelect={handlePostSelect}
              getActionState={getState}
              onThreadView={handleThreadView}
            />
            {showFolderPicker && (
              <box
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <FolderPicker
                  client={client}
                  tweet={selectedPost}
                  onSelect={handleFolderSelect}
                  onClose={handleFolderPickerClose}
                  focused={true}
                />
              </box>
            )}
          </>
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
              focused={currentView === "profile"}
              onBack={handleBackFromProfile}
              onPostSelect={handlePostSelectFromProfile}
              onLike={toggleLike}
              onBookmark={toggleBookmark}
              getActionState={getState}
              initActionState={initState}
              actionMessage={actionMessage}
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
            focused={currentView === "bookmarks" && !showSplash}
            onPostCountChange={handleBookmarkCountChange}
            onPostSelect={handlePostSelect}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            getActionState={getState}
            initActionState={initState}
            actionMessage={actionMessage}
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
            focused={currentView === "notifications" && !showSplash}
            onNotificationCountChange={handleNotificationCountChange}
            onUnreadCountChange={handleUnreadCountChange}
            onNotificationSelect={handleNotificationSelect}
            actionMessage={actionMessage}
          />
        </box>
      </box>

      {!showSplash && isMainView && showFooter && <Footer />}

      {/* Exit confirmation modal */}
      {showExitConfirmation && (
        <box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <ExitConfirmationModal
            focused={true}
            onConfirm={() => renderer.destroy()}
            onCancel={() => setShowExitConfirmation(false)}
          />
        </box>
      )}

      {/* Session expired modal overlay */}
      {sessionExpired && <SessionExpiredModal />}
    </box>
  );
}
