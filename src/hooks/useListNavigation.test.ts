/**
 * Unit tests for useListNavigation hook
 * Tests vim-style list navigation with j/k and boundary clamping
 */

import { describe, expect, it, beforeEach } from "bun:test";

/**
 * Simple harness that simulates useListNavigation behavior
 * without requiring React's hook system
 */
function createListNavRunner(itemCount: number) {
  let selectedIndex = 0;
  let currentItemCount = itemCount;

  const clampIndex = (index: number): number => {
    if (currentItemCount === 0) return 0;
    return Math.max(0, Math.min(index, currentItemCount - 1));
  };

  const moveUp = () => {
    selectedIndex = clampIndex(selectedIndex - 1);
  };

  const moveDown = () => {
    selectedIndex = clampIndex(selectedIndex + 1);
  };

  const jumpToTop = () => {
    selectedIndex = 0;
  };

  const jumpToBottom = () => {
    selectedIndex = clampIndex(currentItemCount - 1);
  };

  const setItemCount = (count: number) => {
    currentItemCount = count;
    // Clamp selected index to new bounds (like the hook does)
    selectedIndex = clampIndex(selectedIndex);
  };

  return {
    getSelectedIndex: () => selectedIndex,
    getItemCount: () => currentItemCount,
    moveUp,
    moveDown,
    jumpToTop,
    jumpToBottom,
    setItemCount,
  };
}

describe("useListNavigation", () => {
  describe("basic navigation with small list", () => {
    let nav: ReturnType<typeof createListNavRunner>;

    beforeEach(() => {
      nav = createListNavRunner(5);
    });

    it("starts at index 0", () => {
      expect(nav.getSelectedIndex()).toBe(0);
    });

    it("moveDown increments index", () => {
      nav.moveDown();
      expect(nav.getSelectedIndex()).toBe(1);
    });

    it("moveUp decrements index", () => {
      nav.moveDown();
      nav.moveDown();
      nav.moveUp();
      expect(nav.getSelectedIndex()).toBe(1);
    });

    it("moveUp at index 0 stays at 0", () => {
      nav.moveUp();
      expect(nav.getSelectedIndex()).toBe(0);
    });

    it("moveDown at last index stays at last", () => {
      // Move to end (index 4 for 5 items)
      for (let i = 0; i < 10; i++) {
        nav.moveDown();
      }
      expect(nav.getSelectedIndex()).toBe(4);
    });

    it("jumpToTop goes to index 0", () => {
      nav.moveDown();
      nav.moveDown();
      nav.jumpToTop();
      expect(nav.getSelectedIndex()).toBe(0);
    });

    it("jumpToBottom goes to last index", () => {
      nav.jumpToBottom();
      expect(nav.getSelectedIndex()).toBe(4);
    });
  });

  describe("navigation with 11 items (folder picker case)", () => {
    let nav: ReturnType<typeof createListNavRunner>;

    beforeEach(() => {
      nav = createListNavRunner(11);
    });

    it("can navigate to index 10 (11th item)", () => {
      // Navigate down 10 times to reach index 10
      for (let i = 0; i < 10; i++) {
        nav.moveDown();
      }
      expect(nav.getSelectedIndex()).toBe(10);
    });

    it("cannot go past index 10", () => {
      for (let i = 0; i < 15; i++) {
        nav.moveDown();
      }
      expect(nav.getSelectedIndex()).toBe(10);
    });

    it("jumpToBottom reaches index 10", () => {
      nav.jumpToBottom();
      expect(nav.getSelectedIndex()).toBe(10);
    });

    it("can navigate back up from index 10", () => {
      nav.jumpToBottom();
      nav.moveUp();
      expect(nav.getSelectedIndex()).toBe(9);
    });
  });

  describe("empty list handling", () => {
    it("returns 0 when list is empty", () => {
      const nav = createListNavRunner(0);
      expect(nav.getSelectedIndex()).toBe(0);
    });

    it("moveDown on empty list stays at 0", () => {
      const nav = createListNavRunner(0);
      nav.moveDown();
      expect(nav.getSelectedIndex()).toBe(0);
    });

    it("jumpToBottom on empty list stays at 0", () => {
      const nav = createListNavRunner(0);
      nav.jumpToBottom();
      expect(nav.getSelectedIndex()).toBe(0);
    });
  });

  describe("itemCount changes (simulating loading)", () => {
    let nav: ReturnType<typeof createListNavRunner>;

    beforeEach(() => {
      // Start with empty list (loading state)
      nav = createListNavRunner(0);
    });

    it("handles transition from 0 to 11 items", () => {
      expect(nav.getSelectedIndex()).toBe(0);

      // Items load
      nav.setItemCount(11);

      // Now should be able to navigate
      nav.moveDown();
      expect(nav.getSelectedIndex()).toBe(1);
    });

    it("can reach all 11 items after loading", () => {
      nav.setItemCount(11);

      for (let i = 0; i < 10; i++) {
        nav.moveDown();
      }
      expect(nav.getSelectedIndex()).toBe(10);
    });

    it("clamps index when itemCount decreases", () => {
      nav.setItemCount(11);
      nav.jumpToBottom(); // index 10

      nav.setItemCount(5);
      expect(nav.getSelectedIndex()).toBe(4); // clamped to new max
    });
  });
});

describe("window scrolling logic", () => {
  const MAX_VISIBLE = 10;

  /**
   * Calculate window start based on selected index
   * Mirrors the useEffect in FolderPicker
   */
  function calculateWindowStart(
    selectedIndex: number,
    currentWindowStart: number,
    itemCount: number
  ): number {
    if (itemCount === 0) return currentWindowStart;

    const windowEnd = currentWindowStart + MAX_VISIBLE - 1;

    // If selection is below the window, shift window down
    if (selectedIndex > windowEnd) {
      return selectedIndex - MAX_VISIBLE + 1;
    }
    // If selection is above the window, shift window up
    if (selectedIndex < currentWindowStart) {
      return selectedIndex;
    }

    return currentWindowStart;
  }

  it("window stays at 0 for first 10 items", () => {
    let windowStart = 0;

    for (let i = 0; i <= 9; i++) {
      windowStart = calculateWindowStart(i, windowStart, 11);
      expect(windowStart).toBe(0);
    }
  });

  it("window scrolls to 1 when selecting index 10", () => {
    let windowStart = 0;

    // Navigate to index 10
    windowStart = calculateWindowStart(10, windowStart, 11);
    expect(windowStart).toBe(1);
  });

  it("window shows indices 1-10 after scrolling", () => {
    let windowStart = 0;
    windowStart = calculateWindowStart(10, windowStart, 11);

    // Verify visible range
    const visibleStart = windowStart;
    const visibleEnd = windowStart + MAX_VISIBLE - 1;

    expect(visibleStart).toBe(1);
    expect(visibleEnd).toBe(10);
  });

  it("window scrolls back up when navigating to index 0", () => {
    let windowStart = 1; // After scrolling down

    windowStart = calculateWindowStart(0, windowStart, 11);
    expect(windowStart).toBe(0);
  });

  it("handles single item list", () => {
    const windowStart = calculateWindowStart(0, 0, 1);
    expect(windowStart).toBe(0);
  });

  it("handles exactly MAX_VISIBLE items", () => {
    let windowStart = 0;

    // With exactly 10 items, should never need to scroll
    for (let i = 0; i <= 9; i++) {
      windowStart = calculateWindowStart(i, windowStart, 10);
      expect(windowStart).toBe(0);
    }
  });
});
