import { useKeyboard, useRenderer } from "@opentui/react";
import { useState, useCallback } from "react";

import type { TwitterClient } from "@/api/client";
import type { TweetData, UserData } from "@/api/types";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PostDetailScreen } from "@/screens/PostDetailScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";

export type View = "timeline" | "bookmarks" | "post-detail";

const VIEWS: View[] = ["timeline", "bookmarks"];

interface AppProps {
  client: TwitterClient;
  user: UserData;
}

export function App({ client, user: _user }: AppProps) {
  const renderer = useRenderer();
  const [currentView, setCurrentView] = useState<View>("timeline");
  const [postCount, setPostCount] = useState(0);

  // State for post detail view
  const [selectedPost, setSelectedPost] = useState<TweetData | null>(null);

  // Navigate to post detail view
  const handlePostSelect = useCallback((post: TweetData) => {
    setSelectedPost(post);
    setCurrentView("post-detail");
  }, []);

  // Return from post detail to timeline
  const handleBackFromDetail = useCallback(() => {
    setCurrentView("timeline");
    setSelectedPost(null);
  }, []);

  useKeyboard((key) => {
    // Only handle app-level keys when not in post-detail view
    // Post detail handles its own Escape/back navigation
    if (currentView === "post-detail") {
      return;
    }

    // Quit on q or Escape
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy();
      return;
    }

    // Switch views on Tab
    if (key.name === "tab") {
      setCurrentView((prev: View) => {
        const currentIndex = VIEWS.indexOf(prev);
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
      <Header currentView={currentView} postCount={postCount} />

      {/* Content area */}
      <box
        style={{
          flexGrow: 1,
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
            focused={currentView === "timeline"}
            onPostCountChange={setPostCount}
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

        {currentView === "bookmarks" && (
          <box style={{ padding: 2 }}>
            <text fg="#888888">Bookmarks view coming soon...</text>
          </box>
        )}
      </box>

      {currentView !== "post-detail" && <Footer />}
    </box>
  );
}
