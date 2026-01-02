import { useKeyboard, useRenderer } from "@opentui/react";
import { useState } from "react";

import type { TwitterClient } from "@/api/client";
import type { UserData } from "@/api/types";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export type View = "timeline" | "bookmarks";

const VIEWS: View[] = ["timeline", "bookmarks"];

interface AppProps {
  client: TwitterClient;
  user: UserData;
}

export function App({ client: _client, user }: AppProps) {
  const renderer = useRenderer();
  const [currentView, setCurrentView] = useState<View>("timeline");

  useKeyboard((key) => {
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
      <Header currentView={currentView} />

      {/* Content area - placeholder for now */}
      <box
        style={{
          flexGrow: 1,
          padding: 1,
        }}
      >
        <text fg="#888888">
          {currentView === "timeline"
            ? `Timeline view coming soon... (@${user.username})`
            : "Bookmarks view coming soon..."}
        </text>
      </box>

      <Footer />
    </box>
  );
}
