import { useKeyboard, useRenderer } from "@opentui/react";
import { useState, useCallback, useEffect, useRef } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData, UserData } from "@/api/types";

import { FolderPicker } from "@/components/FolderPicker";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useActions } from "@/hooks/useActions";
import { useNavigation } from "@/hooks/useNavigation";
import { BookmarksScreen } from "@/screens/BookmarksScreen";
import { PostDetailScreen } from "@/screens/PostDetailScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";

const SPLASH_MIN_DISPLAY_MS = 500;

export type View = "timeline" | "bookmarks" | "post-detail" | "profile";

/** Main views that can be navigated between with Tab (excludes overlay views) */
const MAIN_VIEWS = ["timeline", "bookmarks"] as const;

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
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  // State for post detail view
  const [selectedPost, setSelectedPost] = useState<TweetData | null>(null);

  // Navigate to post detail view (from timeline, bookmarks, or profile)
  const handlePostSelect = useCallback(
    (post: TweetData) => {
      setSelectedPost(post);
      initState(post.id, post.favorited ?? false, post.bookmarked ?? false);
      navigate("post-detail");
    },
    [navigate, initState]
  );

  // Return from post detail to previous view
  const handleBackFromDetail = useCallback(() => {
    goBack();
    setSelectedPost(null);
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

  // Return from profile to previous view
  const handleBackFromProfile = useCallback(() => {
    goBack();
    setProfileUsername(null);
  }, [goBack]);

  // Handle post select from profile (view a user's tweet in detail)
  const handlePostSelectFromProfile = useCallback(
    (post: TweetData) => {
      setSelectedPost(post);
      initState(post.id, post.favorited ?? false, post.bookmarked ?? false);
      navigate("post-detail");
    },
    [navigate, initState]
  );

  // State for folder picker modal
  const [showFolderPicker, setShowFolderPicker] = useState(false);

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

  useKeyboard((key) => {
    // Always allow quit, even during splash
    if (key.name === "q" || key.name === "escape") {
      // Don't quit during splash unless in main view (post-detail and profile handle their own)
      if (showSplash || isMainView) {
        renderer.destroy();
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
          postCount={currentView === "bookmarks" ? bookmarkCount : postCount}
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

        {currentView === "profile" && profileUsername && (
          <ProfileScreen
            client={client}
            username={profileUsername}
            focused={true}
            onBack={handleBackFromProfile}
            onPostSelect={handlePostSelectFromProfile}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            getActionState={getState}
            initActionState={initState}
            actionMessage={actionMessage}
          />
        )}

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
      </box>

      {!showSplash && isMainView && <Footer />}
    </box>
  );
}
