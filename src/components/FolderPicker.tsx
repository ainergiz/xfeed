/**
 * FolderPicker - Modal component for selecting a bookmark folder
 *
 * Displays a list of bookmark folders with vim-style navigation.
 * Used for moving bookmarked tweets into folders.
 */

import { useKeyboard } from "@opentui/react";

import type { TwitterClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { useBookmarkFolders } from "@/hooks/useBookmarkFolders";
import { useListNavigation } from "@/hooks/useListNavigation";

const X_BLUE = "#1DA1F2";

interface FolderPickerProps {
  client: TwitterClient;
  /** The tweet being moved */
  tweet: TweetData;
  /** Called when a folder is selected */
  onSelect: (folderId: string, folderName: string) => Promise<void>;
  /** Called when picker is dismissed (Esc) */
  onClose: () => void;
  /** Whether the picker is focused (should handle keyboard) */
  focused?: boolean;
}

export function FolderPicker({
  client,
  tweet: _tweet,
  onSelect,
  onClose,
  focused = true,
}: FolderPickerProps) {
  const { folders, loading, error } = useBookmarkFolders({ client });

  const { selectedIndex } = useListNavigation({
    itemCount: folders.length,
    enabled: focused && !loading && folders.length > 0,
    onSelect: async (index) => {
      const folder = folders[index];
      if (folder) {
        await onSelect(folder.id, folder.name);
      }
    },
  });

  useKeyboard((key) => {
    if (!focused) return;
    if (key.name === "escape") {
      onClose();
    }
  });

  // Loading state
  if (loading) {
    return (
      <box
        style={{
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
        backgroundColor="#000000"
        opacity={0.8}
      >
        <box
          style={{
            flexDirection: "column",
            padding: 2,
            minWidth: 30,
          }}
        >
          <box
            style={{
              borderStyle: "rounded",
              borderColor: "#444444",
              padding: 1,
            }}
            backgroundColor="#000000"
          >
            <box style={{ paddingBottom: 1 }}>
              <text fg={X_BLUE}>Move to folder</text>
            </box>
            <text fg="#888888">Loading folders...</text>
            <box style={{ paddingTop: 1 }}>
              <text fg="#666666">Esc</text>
              <text fg="#444444"> cancel</text>
            </box>
          </box>
        </box>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box
        style={{
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
        backgroundColor="#000000"
        opacity={0.8}
      >
        <box
          style={{
            flexDirection: "column",
            padding: 2,
            minWidth: 30,
          }}
        >
          <box
            style={{
              borderStyle: "rounded",
              borderColor: "#E0245E",
              padding: 1,
            }}
            backgroundColor="#000000"
          >
            <box style={{ paddingBottom: 1 }}>
              <text fg={X_BLUE}>Move to folder</text>
            </box>
            <text fg="#E0245E">Error: {error}</text>
            <box style={{ paddingTop: 1 }}>
              <text fg="#666666">Esc</text>
              <text fg="#444444"> close</text>
            </box>
          </box>
        </box>
      </box>
    );
  }

  // No folders state
  if (folders.length === 0) {
    return (
      <box
        style={{
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
        backgroundColor="#000000"
        opacity={0.8}
      >
        <box
          style={{
            flexDirection: "column",
            padding: 2,
            minWidth: 30,
          }}
        >
          <box
            style={{
              borderStyle: "rounded",
              borderColor: "#444444",
              padding: 1,
            }}
            backgroundColor="#000000"
          >
            <box style={{ paddingBottom: 1 }}>
              <text fg={X_BLUE}>Move to folder</text>
            </box>
            <text fg="#888888">No folders yet.</text>
            <text fg="#666666">Create folders on x.com</text>
            <box style={{ paddingTop: 1 }}>
              <text fg="#666666">Esc</text>
              <text fg="#444444"> close</text>
            </box>
          </box>
        </box>
      </box>
    );
  }

  // Folder list
  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
      backgroundColor="#000000"
      opacity={0.8}
    >
      <box
        style={{
          flexDirection: "column",
          padding: 2,
          minWidth: 30,
          maxWidth: 50,
        }}
      >
        <box
          style={{
            borderStyle: "rounded",
            borderColor: "#444444",
            padding: 1,
          }}
          backgroundColor="#000000"
        >
          <box style={{ paddingBottom: 1 }}>
            <text fg={X_BLUE}>Move to folder</text>
          </box>

          {folders.map((folder, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box key={folder.id} style={{ flexDirection: "row" }}>
                <text fg={isSelected ? X_BLUE : "#888888"}>
                  {isSelected ? "> " : "  "}
                  {folder.name}
                </text>
              </box>
            );
          })}

          <box style={{ paddingTop: 1, flexDirection: "row" }}>
            <text fg="#666666">j/k</text>
            <text fg="#444444"> nav </text>
            <text fg="#666666">Enter</text>
            <text fg="#444444"> select </text>
            <text fg="#666666">Esc</text>
            <text fg="#444444"> cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
