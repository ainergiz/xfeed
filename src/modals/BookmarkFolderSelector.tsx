/**
 * BookmarkFolderSelectorContent - Dialog content for selecting which bookmark folder to view
 *
 * Displays "All Bookmarks" followed by user's folders with vim-style navigation.
 * Used for switching between bookmark views.
 *
 * Uses @opentui-ui/dialog for async dialog management.
 */

import {
  useDialogKeyboard,
  type ChoiceContext,
} from "@opentui-ui/dialog/react";
import { useEffect, useState } from "react";

import type { XClient } from "@/api/client";
import type { BookmarkFolder } from "@/api/types";

import { useBookmarkFolders } from "@/hooks/useBookmarkFolders";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";

/** Choice type for bookmark folder selector - null means "All Bookmarks" */
export type BookmarkFolderChoice = BookmarkFolder | null;

/** Props for BookmarkFolderSelectorContent (used with dialog.choice) */
export interface BookmarkFolderSelectorContentProps extends ChoiceContext<BookmarkFolderChoice> {
  client: XClient;
  /** Currently selected folder (null = all bookmarks) */
  currentFolder?: BookmarkFolder | null;
}

const MAX_VISIBLE_ITEMS = 5;

// Dialog colors (Catppuccin-inspired)
const dialogColors = {
  bgDark: "#1e1e2e",
  bgPanel: "#181825",
  bgHover: "#313244",
  textPrimary: "#cdd6f4",
  textSecondary: "#bac2de",
  textMuted: "#6c7086",
  accent: "#89b4fa",
};

/**
 * Content component for bookmark folder selection dialog.
 * Use with dialog.choice<BookmarkFolder | null>().
 */
export function BookmarkFolderSelectorContent({
  client,
  currentFolder,
  resolve,
  dismiss,
  dialogId,
}: BookmarkFolderSelectorContentProps) {
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
    enabled: !loading && itemCount > 0,
    onSelect: (index) => {
      const item = items[index];
      resolve(item ?? null);
    },
  });

  useDialogKeyboard((key) => {
    if (key.name === "escape") {
      dismiss();
    }
  }, dialogId);

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
      <box flexDirection="column">
        <box
          backgroundColor={dialogColors.bgPanel}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          gap={1}
        >
          <text fg={dialogColors.accent}>📁</text>
          <text fg={dialogColors.textPrimary}>
            <b>Select Folder</b>
          </text>
        </box>
        <box
          backgroundColor={dialogColors.bgDark}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={dialogColors.textMuted}>Loading folders...</text>
        </box>
        <box
          backgroundColor={dialogColors.bgPanel}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          gap={2}
        >
          <text fg={dialogColors.textMuted}>Esc</text>
          <text fg={dialogColors.textSecondary}>cancel</text>
        </box>
      </box>
    );
  }

  // Error state
  if (error) {
    return (
      <box flexDirection="column">
        <box
          backgroundColor={dialogColors.bgPanel}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          gap={1}
        >
          <text fg={dialogColors.accent}>📁</text>
          <text fg={dialogColors.textPrimary}>
            <b>Select Folder</b>
          </text>
        </box>
        <box
          backgroundColor={dialogColors.bgDark}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
        >
          <text fg={colors.error}>Error: {error}</text>
        </box>
        <box
          backgroundColor={dialogColors.bgPanel}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          gap={2}
        >
          <text fg={dialogColors.textMuted}>Esc</text>
          <text fg={dialogColors.textSecondary}>close</text>
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

  const title = isViewingAllBookmarks ? "Switch to Folder" : "Switch View";

  return (
    <box flexDirection="column">
      {/* Header */}
      <box
        backgroundColor={dialogColors.bgPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        gap={1}
      >
        <text fg={dialogColors.accent}>📁</text>
        <text fg={dialogColors.textPrimary}>
          <b>{title}</b>
        </text>
        <text fg={dialogColors.textMuted}>({itemCount} options)</text>
      </box>

      {/* Content */}
      <box
        backgroundColor={dialogColors.bgDark}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
      >
        {hasMoreAbove ? <text fg={dialogColors.textMuted}>↑ more</text> : null}

        {visibleItems.map((item, visibleIndex) => {
          const actualIndex = windowStart + visibleIndex;
          const isSelected = actualIndex === selectedIndex;
          const isAllBookmarks = item === null;
          const label = isAllBookmarks ? "All Bookmarks" : item.name;

          return (
            <text
              key={isAllBookmarks ? "all" : item.id}
              fg={
                isSelected
                  ? dialogColors.textPrimary
                  : dialogColors.textSecondary
              }
              bg={isSelected ? dialogColors.bgHover : undefined}
            >
              {isSelected ? " › " : "   "}
              {label}
              {"  "}
            </text>
          );
        })}

        {hasMoreBelow ? <text fg={dialogColors.textMuted}>↓ more</text> : null}
      </box>

      {/* Footer */}
      <box
        backgroundColor={dialogColors.bgPanel}
        paddingLeft={3}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        gap={2}
      >
        <text fg={dialogColors.textMuted}>j/k</text>
        <text fg={dialogColors.textSecondary}>nav</text>
        <text fg={dialogColors.textMuted}>Enter</text>
        <text fg={dialogColors.textSecondary}>select</text>
        <text fg={dialogColors.textMuted}>Esc</text>
        <text fg={dialogColors.textSecondary}>cancel</text>
      </box>
    </box>
  );
}
