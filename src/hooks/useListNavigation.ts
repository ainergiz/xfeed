/**
 * Vim-style list navigation hook
 * Provides j/k navigation, g/G jump to top/bottom, Enter to select
 */

import { useKeyboard } from "@opentui/react";
import { useState, useCallback } from "react";

export interface UseListNavigationOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Callback when Enter is pressed on current selection */
  onSelect?: (index: number) => void;
  /** Whether this component should handle keyboard input */
  enabled?: boolean;
}

export interface UseListNavigationResult {
  /** Currently selected index */
  selectedIndex: number;
  /** Set the selected index directly */
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  /** Move selection up by one */
  moveUp: () => void;
  /** Move selection down by one */
  moveDown: () => void;
  /** Jump to first item */
  jumpToTop: () => void;
  /** Jump to last item */
  jumpToBottom: () => void;
}

export function useListNavigation({
  itemCount,
  onSelect,
  enabled = true,
}: UseListNavigationOptions): UseListNavigationResult {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const clampIndex = useCallback(
    (index: number): number => {
      if (itemCount === 0) return 0;
      return Math.max(0, Math.min(index, itemCount - 1));
    },
    [itemCount]
  );

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => clampIndex(prev - 1));
  }, [clampIndex]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => clampIndex(prev + 1));
  }, [clampIndex]);

  const jumpToTop = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  const jumpToBottom = useCallback(() => {
    setSelectedIndex(clampIndex(itemCount - 1));
  }, [clampIndex, itemCount]);

  // Memoize the exposed setSelectedIndex to prevent re-render loops
  // when used in useEffect dependency arrays
  const setSelectedIndexClamped = useCallback(
    (indexOrFn: number | ((prev: number) => number)) => {
      if (typeof indexOrFn === "function") {
        setSelectedIndex((prev) => clampIndex(indexOrFn(prev)));
      } else {
        setSelectedIndex(clampIndex(indexOrFn));
      }
    },
    [clampIndex]
  );

  useKeyboard((key) => {
    if (!enabled || itemCount === 0) return;

    switch (key.name) {
      case "j":
      case "down":
        moveDown();
        break;
      case "k":
      case "up":
        moveUp();
        break;
      case "g":
        // g = top, G (shift+g) = bottom
        // OpenTUI reports shift+g as "G" (uppercase)
        jumpToTop();
        break;
      case "G":
        jumpToBottom();
        break;
      case "return":
        onSelect?.(selectedIndex);
        break;
    }
  });

  // Ensure selected index stays in bounds when itemCount changes
  const safeSelectedIndex = clampIndex(selectedIndex);
  if (safeSelectedIndex !== selectedIndex) {
    setSelectedIndex(safeSelectedIndex);
  }

  return {
    selectedIndex: safeSelectedIndex,
    setSelectedIndex: setSelectedIndexClamped,
    moveUp,
    moveDown,
    jumpToTop,
    jumpToBottom,
  };
}
