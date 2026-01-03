/**
 * FolderPicker - Modal component for selecting a bookmark folder
 *
 * Displays a list of bookmark folders with vim-style navigation.
 * Used for moving bookmarked tweets into folders.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";

import type { XClient } from "@/api/client";
import type { TweetData } from "@/api/types";

import { useBookmarkFolders } from "@/hooks/useBookmarkFolders";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";

interface FolderPickerProps {
  client: XClient;
  /** The tweet being moved */
  tweet: TweetData;
  /** Called when a folder is selected */
  onSelect: (folderId: string, folderName: string) => Promise<void>;
  /** Called when picker is dismissed (Esc) */
  onClose: () => void;
  /** Whether the picker is focused (should handle keyboard) */
  focused?: boolean;
}

const MAX_VISIBLE_FOLDERS = 10;

export function FolderPicker({
  client,
  tweet: _tweet,
  onSelect,
  onClose,
  focused = true,
}: FolderPickerProps) {
  const { folders, loading, error } = useBookmarkFolders({ client });
  const [windowStart, setWindowStart] = useState(0);

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

  // Keep selected item within the visible window
  useEffect(() => {
    if (folders.length === 0) return;

    const windowEnd = windowStart + MAX_VISIBLE_FOLDERS - 1;

    // If selection is below the window, shift window down
    if (selectedIndex > windowEnd) {
      setWindowStart(selectedIndex - MAX_VISIBLE_FOLDERS + 1);
    }
    // If selection is above the window, shift window up
    else if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    }
  }, [selectedIndex, windowStart, folders.length]);

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
              <text fg={colors.primary}>Move to folder</text>
            </box>
            <text fg={colors.muted}>Loading folders...</text>
            <box style={{ paddingTop: 1 }}>
              <text fg={colors.dim}>Esc</text>
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
              borderColor: colors.error,
              padding: 1,
            }}
            backgroundColor="#000000"
          >
            <box style={{ paddingBottom: 1 }}>
              <text fg={colors.primary}>Move to folder</text>
            </box>
            <text fg={colors.error}>Error: {error}</text>
            <box style={{ paddingTop: 1 }}>
              <text fg={colors.dim}>Esc</text>
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
              <text fg={colors.primary}>Move to folder</text>
            </box>
            <text fg={colors.muted}>No folders yet.</text>
            <text fg={colors.dim}>Create folders on x.com</text>
            <box style={{ paddingTop: 1 }}>
              <text fg={colors.dim}>Esc</text>
              <text fg="#444444"> close</text>
            </box>
          </box>
        </box>
      </box>
    );
  }

  // Calculate visible folders window
  const hasMoreAbove = windowStart > 0;
  const hasMoreBelow = windowStart + MAX_VISIBLE_FOLDERS < folders.length;
  const visibleFolders = folders.slice(
    windowStart,
    windowStart + MAX_VISIBLE_FOLDERS
  );

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
            flexDirection: "column",
            borderStyle: "rounded",
            borderColor: "#444444",
            padding: 1,
          }}
          backgroundColor="#000000"
        >
          <box style={{ paddingBottom: 1, flexDirection: "row" }}>
            <text fg={colors.primary}>Move to folder</text>
            <text fg={colors.dim}> ({folders.length} folders)</text>
          </box>

          {hasMoreAbove ? (
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}> ↑ more</text>
            </box>
          ) : null}

          {visibleFolders.map((folder, visibleIndex) => {
            const actualIndex = windowStart + visibleIndex;
            const isSelected = actualIndex === selectedIndex;
            return (
              <box key={folder.id} style={{ flexDirection: "row" }}>
                <text fg={isSelected ? colors.primary : colors.muted}>
                  {isSelected ? "> " : "  "}
                  {folder.name}
                </text>
              </box>
            );
          })}

          {hasMoreBelow ? (
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}> ↓ more</text>
            </box>
          ) : null}

          <box style={{ paddingTop: 1, flexDirection: "row" }}>
            <text fg={colors.dim}>j/k</text>
            <text fg="#444444"> nav </text>
            <text fg={colors.dim}>Enter</text>
            <text fg="#444444"> select </text>
            <text fg={colors.dim}>Esc</text>
            <text fg="#444444"> cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
