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

const MAX_VISIBLE_ITEMS = 5;

export function BookmarkFolderSelector({
  client,
  currentFolder,
  onSelect,
  onClose,
  focused = true,
}: BookmarkFolderSelectorProps) {
  const { folders, loading, error } = useBookmarkFolders({ client });
  const [windowStart, setWindowStart] = useState(0);

  // Build selectable items: exclude the current view
  // If viewing "All Bookmarks" (currentFolder is null/undefined), only show folders
  // If viewing a folder, show "All Bookmarks" + other folders (excluding current)
  const isViewingAllBookmarks = !currentFolder;

  // Filter folders to exclude the current one (if any)
  const selectableFolders = currentFolder
    ? folders.filter((f) => f.id !== currentFolder.id)
    : folders;

  // Build the items list: null represents "All Bookmarks"
  const items: (BookmarkFolder | null)[] = isViewingAllBookmarks
    ? selectableFolders // Only folders when viewing All Bookmarks
    : [null, ...selectableFolders]; // All Bookmarks + other folders

  const itemCount = items.length;

  const { selectedIndex } = useListNavigation({
    itemCount,
    enabled: focused && !loading && itemCount > 0,
    onSelect: (index) => {
      const item = items[index];
      onSelect(item ?? null);
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

  // Get visible items slice
  const visibleItems = items.slice(
    windowStart,
    windowStart + MAX_VISIBLE_ITEMS
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
            borderStyle: "rounded",
            borderColor: "#444444",
            padding: 1,
          }}
          backgroundColor="#000000"
        >
          <box style={{ paddingBottom: 1, flexDirection: "row" }}>
            <text fg={colors.primary}>
              {isViewingAllBookmarks ? "Switch to folder" : "Switch view"}
            </text>
            <text fg={colors.dim}> ({itemCount} options)</text>
          </box>

          {hasMoreAbove ? (
            <box style={{ flexDirection: "row" }}>
              <text fg={colors.dim}> ↑ more</text>
            </box>
          ) : null}

          {visibleItems.map((item, visibleIndex) => {
            const actualIndex = windowStart + visibleIndex;
            const isSelected = actualIndex === selectedIndex;
            const isAllBookmarks = item === null;
            const label = isAllBookmarks ? "All Bookmarks" : item.name;

            return (
              <box
                key={isAllBookmarks ? "all" : item.id}
                style={{ flexDirection: "row" }}
              >
                <text fg={isSelected ? colors.primary : colors.muted}>
                  {isSelected ? "> " : "  "}
                  {label}
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
