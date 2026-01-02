import { useKeyboard, useRenderer } from "@opentui/react";
import { useState, useCallback, useEffect, useRef } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData, UserData } from "@/api/types";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BookmarksScreen } from "@/screens/BookmarksScreen";
import { PostDetailScreen } from "@/screens/PostDetailScreen";
import { SplashScreen } from "@/screens/SplashScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";

const SPLASH_MIN_DISPLAY_MS = 500;

export type View = "timeline" | "bookmarks" | "post-detail";

/** Main views that can be navigated between with Tab (excludes post-detail) */
type MainView = Exclude<View, "post-detail">;

const VIEWS: MainView[] = ["timeline", "bookmarks"];

interface AppProps {
  client: TwitterClient;
  user: UserData;
}

export function App({ client, user: _user }: AppProps) {
  const renderer = useRenderer();
  const [currentView, setCurrentView] = useState<View>("timeline");
  const [postCount, setPostCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);

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
  // Track which main view to return to when leaving post-detail
  const [previousView, setPreviousView] = useState<MainView>("timeline");

  // Navigate to post detail view
  const handlePostSelect = useCallback(
    (post: TweetData) => {
      // Save current view so we can return to it
      if (currentView !== "post-detail") {
        setPreviousView(currentView as MainView);
      }
      setSelectedPost(post);
      setCurrentView("post-detail");
    },
    [currentView]
  );

  // Return from post detail to previous view
  const handleBackFromDetail = useCallback(() => {
    setCurrentView(previousView);
    setSelectedPost(null);
  }, [previousView]);

  useKeyboard((key) => {
    // Always allow quit, even during splash
    if (key.name === "q" || key.name === "escape") {
      // Don't quit during splash unless in timeline view (post-detail handles its own)
      if (showSplash || currentView !== "post-detail") {
        renderer.destroy();
        return;
      }
    }

    // Don't handle other keys during splash or post-detail
    if (showSplash || currentView === "post-detail") {
      return;
    }

    // Switch views on Tab
    if (key.name === "tab") {
      setCurrentView((prev) => {
        // Safe cast: we already checked currentView !== "post-detail" above
        const currentIndex = VIEWS.indexOf(prev as MainView);
        const nextIndex = (currentIndex + 1) % VIEWS.length;
        return VIEWS[nextIndex]!;
      });
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
      ) : (
        <Header
          currentView={currentView}
          postCount={currentView === "bookmarks" ? bookmarkCount : postCount}
        />
      )}

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
          />
        </box>

        {currentView === "post-detail" && selectedPost && (
          <PostDetailScreen
            tweet={selectedPost}
            focused={true}
            onBack={handleBackFromDetail}
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
          />
        </box>
      </box>

      {!showSplash && currentView !== "post-detail" && <Footer />}
    </box>
  );
}
