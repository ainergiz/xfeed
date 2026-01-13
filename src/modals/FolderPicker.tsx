/**
 * FolderPicker - Modal component for selecting a bookmark folder
 *
 * Uses @opentui-ui/dialog for async dialog management.
 * Displays a list of bookmark folders with vim-style navigation.
 * Used for moving bookmarked tweets into folders.
 */

import {
  useDialogKeyboard,
  type ChoiceContext,
} from "@opentui-ui/dialog/react";
import { useEffect, useState } from "react";

import type { XClient } from "@/api/client";

import { useBookmarkFolders } from "@/hooks/useBookmarkFolders";
import { useListNavigation } from "@/hooks/useListNavigation";
import { colors } from "@/lib/colors";

const MAX_VISIBLE_FOLDERS = 5;

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

/** Result type for folder picker - returns { folderId, folderName } */
export interface FolderPickerResult {
  folderId: string;
  folderName: string;
}

/** Props for FolderPickerContent (used with dialog.choice) */
export interface FolderPickerContentProps extends ChoiceContext<FolderPickerResult> {
  /** XClient instance for fetching folders */
  client: XClient;
}

/**
 * Content component for folder picker dialog.
 * Use with dialog.choice<FolderPickerResult>().
 */
export function FolderPickerContent({
  client,
  resolve,
  dismiss,
  dialogId,
}: FolderPickerContentProps) {
  const { folders, loading, error } = useBookmarkFolders({ client });
  const [windowStart, setWindowStart] = useState(0);

  const { selectedIndex } = useListNavigation({
    itemCount: folders.length,
    enabled: !loading && !error && folders.length > 0,
    onSelect: (index) => {
      const folder = folders[index];
      if (folder) {
        resolve({ folderId: folder.id, folderName: folder.name });
      }
    },
  });

  // Keyboard navigation via dialog
  useDialogKeyboard((key) => {
    if (key.name === "escape") {
      dismiss();
    }
  }, dialogId);

  // Keep selected item within the visible window
  useEffect(() => {
    if (folders.length === 0) return;

    const windowEnd = windowStart + MAX_VISIBLE_FOLDERS - 1;

    if (selectedIndex > windowEnd) {
      setWindowStart(selectedIndex - MAX_VISIBLE_FOLDERS + 1);
    } else if (selectedIndex < windowStart) {
      setWindowStart(selectedIndex);
    }
  }, [selectedIndex, windowStart, folders.length]);

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
            <b>Move to Folder</b>
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
            <b>Move to Folder</b>
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

  // No folders state
  if (folders.length === 0) {
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
            <b>Move to Folder</b>
          </text>
        </box>
        <box
          backgroundColor={dialogColors.bgDark}
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="column"
          gap={1}
        >
          <text fg={dialogColors.textSecondary}>No folders yet.</text>
          <text fg={dialogColors.textMuted}>Create folders on x.com</text>
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

  // Calculate visible folders window
  const hasMoreAbove = windowStart > 0;
  const hasMoreBelow = windowStart + MAX_VISIBLE_FOLDERS < folders.length;
  const visibleFolders = folders.slice(
    windowStart,
    windowStart + MAX_VISIBLE_FOLDERS
  );

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
          <b>Move to Folder</b>
        </text>
        <text fg={dialogColors.textMuted}>({folders.length} folders)</text>
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

        {visibleFolders.map((folder, visibleIndex) => {
          const actualIndex = windowStart + visibleIndex;
          const isSelected = actualIndex === selectedIndex;
          return (
            <text
              key={folder.id}
              fg={
                isSelected
                  ? dialogColors.textPrimary
                  : dialogColors.textSecondary
              }
              bg={isSelected ? dialogColors.bgHover : undefined}
            >
              {isSelected ? " › " : "   "}
              {folder.name}
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
