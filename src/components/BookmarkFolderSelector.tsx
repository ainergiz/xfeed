/**
 * BookmarkFolderSelector - Modal for selecting which bookmark folder to view
 *
 * Displays "All Bookmarks" followed by user's folders with vim-style navigation.
 * Used for switching between bookmark views.
 * Structure matches FolderPicker exactly.
 */

import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";

import type { XClient } from "@/api/client";
import type { BookmarkFolder } from "@/api/types";

import { useBookmarkFolders } from "@/hooks/useBookmarkFolders";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";

interface BookmarkFolderSelectorProps {
  client: XClient;
  /** Currently selected folder (null = all bookmarks) */
  currentFolder?: BookmarkFolder | null;
  /** Called when a folder is selected (null = all bookmarks) */
  onSelect: (folder: BookmarkFolder | null) => void;
  /** Called when picker is dismissed (Esc) */
  onClose: () => void;
  /** Whether the picker is focused (should handle keyboard) */
  focused?: boolean;
}

const MAX_VISIBLE_ITEMS = 10;

export function BookmarkFolderSelector({
  client,
  currentFolder,
  onSelect,
  onClose,
  focused = true,
}: BookmarkFolderSelectorProps) {
  const { folders, loading, error } = useBookmarkFolders({ client });
  const [windowStart, setWindowStart] = useState(0);

  // Items: "All Bookmarks" (null) + folders
  // We use null to represent "All Bookmarks", and BookmarkFolder for actual folders
  const itemCount = folders.length + 1; // +1 for "All Bookmarks"

  // Find initial index for current folder
  const getInitialIndex = () => {
    if (!currentFolder) return 0; // "All Bookmarks"
    const folderIndex = folders.findIndex((f) => f.id === currentFolder.id);
    return folderIndex >= 0 ? folderIndex + 1 : 0; // +1 because index 0 is "All Bookmarks"
  };

  const { selectedIndex, setSelectedIndex } = useListNavigation({
    itemCount,
    enabled: focused && !loading && itemCount > 0,
    onSelect: (index) => {
      if (index === 0) {
        onSelect(null); // "All Bookmarks"
      } else {
        const folder = folders[index - 1];
        if (folder) {
          onSelect(folder);
        }
      }
    },
  });

  // Set initial selection to current folder when folders load
  useEffect(() => {
    if (folders.length > 0) {
      setSelectedIndex(getInitialIndex());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length > 0]);

  useKeyboard((key) => {
    if (!focused) return;
    if (key.name === "escape") {
      onClose();
    }
  });

  // Keep selected item within the visible window
  useEffect(() => {
    if (itemCount === 0) return;

    const windowEnd = windowStart + MAX_VISIBLE_ITEMS - 1;

    if (selectedIndex > windowEnd) {
      setWindowStart(selectedIndex - MAX_VISIBLE_ITEMS + 1);
    } else if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    }
  }, [selectedIndex, windowStart, itemCount]);

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
              <text fg={colors.primary}>Select folder</text>
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
              <text fg={colors.primary}>Select folder</text>
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

  // Calculate visible window
  const hasMoreAbove = windowStart > 0;
  const hasMoreBelow = windowStart + MAX_VISIBLE_ITEMS < itemCount;

  // Build visible items: indices from windowStart to windowStart + MAX_VISIBLE_ITEMS
  const visibleIndices: number[] = [];
  for (
    let i = windowStart;
    i < Math.min(windowStart + MAX_VISIBLE_ITEMS, itemCount);
    i++
  ) {
    visibleIndices.push(i);
  }

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
          <box style={{ paddingBottom: 1, flexDirection: "row" }}>
            <text fg={colors.primary}>Select folder</text>
            <text fg={colors.dim}> ({folders.length} folders)</text>
          </box>

          {hasMoreAbove ? (
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}> ↑ more</text>
            </box>
          ) : null}

          {visibleIndices.map((index) => {
            const isSelected = index === selectedIndex;
            const isAllBookmarks = index === 0;
            const folder = isAllBookmarks ? null : folders[index - 1];
            const label = isAllBookmarks
              ? "All Bookmarks"
              : (folder?.name ?? "");
            const isCurrent = isAllBookmarks
              ? !currentFolder
              : folder?.id === currentFolder?.id;

            return (
              <box
                key={isAllBookmarks ? "all" : folder?.id}
                style={{ flexDirection: "row" }}
              >
                <text fg={isSelected ? colors.primary : colors.muted}>
                  {isSelected ? "> " : "  "}
                  {label}
                  {isCurrent ? " •" : ""}
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
