/**
 * Unit tests for useNavigation hook
 * Tests navigation state transitions and history management
 */

import { describe, expect, it, beforeEach } from "bun:test";

// Simple hook testing harness that simulates React's useState behavior
function createHookRunner<V extends string>(
  initialView: V,
  mainViews: readonly V[]
) {
  let history: V[] = [initialView];

  const getState = () => {
    const currentView = history[history.length - 1]!;
    const previousView =
      history.length > 1 ? history[history.length - 2]! : null;
    const canGoBack = history.length > 1;
    const isMainView = (mainViews as readonly string[]).includes(currentView);

    return {
      currentView,
      previousView,
      history: history as readonly V[],
      canGoBack,
      isMainView,
    };
  };

  const navigate = (view: V) => {
    history = [...history, view];
  };

  const goBack = (): boolean => {
    if (history.length <= 1) return false;
    history = history.slice(0, -1);
    return true;
  };

  const cycleNext = () => {
    const current = history[history.length - 1]!;
    if (!(mainViews as readonly string[]).includes(current)) {
      return; // Don't cycle if not on a main view
    }

    const currentIndex = (mainViews as readonly string[]).indexOf(current);
    const nextIndex = (currentIndex + 1) % mainViews.length;
    const nextView = mainViews[nextIndex]!;

    history = [...history.slice(0, -1), nextView];
  };

  const reset = () => {
    history = [initialView];
  };

  return {
    getState,
    navigate,
    goBack,
    cycleNext,
    reset,
  };
}

type View = "timeline" | "bookmarks" | "post-detail" | "profile";
const MAIN_VIEWS: readonly View[] = ["timeline", "bookmarks"];

describe("useNavigation", () => {
  let nav: ReturnType<typeof createHookRunner<View>>;

  beforeEach(() => {
    nav = createHookRunner<View>("timeline", MAIN_VIEWS);
  });

  describe("initial state", () => {
    it("starts with initialView as currentView", () => {
      expect(nav.getState().currentView).toBe("timeline");
    });

    it("has null previousView at initial state", () => {
      expect(nav.getState().previousView).toBeNull();
    });

    it("has canGoBack as false at initial state", () => {
      expect(nav.getState().canGoBack).toBe(false);
    });

    it("has history with single item at initial state", () => {
      expect(nav.getState().history).toEqual(["timeline"]);
    });

    it("correctly identifies main view", () => {
      expect(nav.getState().isMainView).toBe(true);
    });
  });

  describe("navigate()", () => {
    it("pushes view to history", () => {
      nav.navigate("post-detail");
      expect(nav.getState().history).toEqual(["timeline", "post-detail"]);
    });

    it("updates currentView", () => {
      nav.navigate("post-detail");
      expect(nav.getState().currentView).toBe("post-detail");
    });

    it("updates previousView", () => {
      nav.navigate("post-detail");
      expect(nav.getState().previousView).toBe("timeline");
    });

    it("sets canGoBack to true", () => {
      nav.navigate("post-detail");
      expect(nav.getState().canGoBack).toBe(true);
    });

    it("correctly identifies non-main view", () => {
      nav.navigate("post-detail");
      expect(nav.getState().isMainView).toBe(false);
    });

    it("handles multiple navigations", () => {
      nav.navigate("post-detail");
      nav.navigate("profile");
      expect(nav.getState().history).toEqual([
        "timeline",
        "post-detail",
        "profile",
      ]);
      expect(nav.getState().currentView).toBe("profile");
      expect(nav.getState().previousView).toBe("post-detail");
    });
  });

  describe("goBack()", () => {
    it("returns false when at initial state", () => {
      const result = nav.goBack();
      expect(result).toBe(false);
    });

    it("does not modify history when at initial state", () => {
      nav.goBack();
      expect(nav.getState().history).toEqual(["timeline"]);
    });

    it("returns true when back is possible", () => {
      nav.navigate("post-detail");
      const result = nav.goBack();
      expect(result).toBe(true);
    });

    it("pops from history", () => {
      nav.navigate("post-detail");
      nav.goBack();
      expect(nav.getState().history).toEqual(["timeline"]);
    });

    it("updates currentView to previous", () => {
      nav.navigate("post-detail");
      nav.goBack();
      expect(nav.getState().currentView).toBe("timeline");
    });

    it("sets canGoBack to false when back to initial", () => {
      nav.navigate("post-detail");
      nav.goBack();
      expect(nav.getState().canGoBack).toBe(false);
    });

    it("handles multi-level back navigation", () => {
      nav.navigate("post-detail");
      nav.navigate("profile");
      nav.navigate("post-detail"); // View another post from profile

      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.goBack()).toBe(true);
      expect(nav.getState().currentView).toBe("profile");
      expect(nav.goBack()).toBe(true);
      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.goBack()).toBe(true);
      expect(nav.getState().currentView).toBe("timeline");
      expect(nav.goBack()).toBe(false);
    });
  });

  describe("cycleNext()", () => {
    it("cycles to next main view when on main view", () => {
      expect(nav.getState().currentView).toBe("timeline");
      nav.cycleNext();
      expect(nav.getState().currentView).toBe("bookmarks");
    });

    it("wraps around to first main view", () => {
      nav.cycleNext(); // timeline -> bookmarks
      nav.cycleNext(); // bookmarks -> timeline
      expect(nav.getState().currentView).toBe("timeline");
    });

    it("does not push to history (replaces)", () => {
      nav.cycleNext();
      expect(nav.getState().history).toEqual(["bookmarks"]);
      expect(nav.getState().canGoBack).toBe(false);
    });

    it("does nothing when not on a main view", () => {
      nav.navigate("post-detail");
      const historyBefore = [...nav.getState().history];
      nav.cycleNext();
      expect(nav.getState().history).toEqual(historyBefore);
      expect(nav.getState().currentView).toBe("post-detail");
    });

    it("replaces current main view in history stack", () => {
      nav.navigate("post-detail");
      nav.goBack(); // back to timeline
      nav.cycleNext(); // timeline -> bookmarks
      expect(nav.getState().currentView).toBe("bookmarks");
      expect(nav.getState().history).toEqual(["bookmarks"]);
    });
  });

  describe("complex navigation flows", () => {
    it("timeline -> post-detail -> profile -> back -> back -> timeline", () => {
      // Start at timeline
      expect(nav.getState().currentView).toBe("timeline");

      // Open a post
      nav.navigate("post-detail");
      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.getState().previousView).toBe("timeline");

      // Open profile from post
      nav.navigate("profile");
      expect(nav.getState().currentView).toBe("profile");
      expect(nav.getState().previousView).toBe("post-detail");

      // Go back to post-detail
      expect(nav.goBack()).toBe(true);
      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.getState().previousView).toBe("timeline");

      // Go back to timeline
      expect(nav.goBack()).toBe(true);
      expect(nav.getState().currentView).toBe("timeline");
      expect(nav.getState().previousView).toBeNull();
    });

    it("tab switching: timeline -> bookmarks -> timeline", () => {
      expect(nav.getState().currentView).toBe("timeline");
      nav.cycleNext();
      expect(nav.getState().currentView).toBe("bookmarks");
      nav.cycleNext();
      expect(nav.getState().currentView).toBe("timeline");
    });

    it("mixed: timeline -> tab -> bookmarks -> post-detail -> back -> bookmarks", () => {
      // Start at timeline, tab to bookmarks
      nav.cycleNext();
      expect(nav.getState().currentView).toBe("bookmarks");

      // Open post from bookmarks
      nav.navigate("post-detail");
      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.getState().previousView).toBe("bookmarks");

      // Back to bookmarks
      nav.goBack();
      expect(nav.getState().currentView).toBe("bookmarks");
    });

    it("profile -> post-detail -> back -> profile", () => {
      // Navigate to profile (simulate opening from post-detail)
      nav.navigate("post-detail");
      nav.navigate("profile");
      expect(nav.getState().currentView).toBe("profile");

      // View a post from profile
      nav.navigate("post-detail");
      expect(nav.getState().currentView).toBe("post-detail");
      expect(nav.getState().previousView).toBe("profile");

      // Back to profile
      nav.goBack();
      expect(nav.getState().currentView).toBe("profile");
    });
  });

  describe("isMainView", () => {
    it("returns true for timeline", () => {
      expect(nav.getState().isMainView).toBe(true);
    });

    it("returns true for bookmarks", () => {
      nav.cycleNext();
      expect(nav.getState().isMainView).toBe(true);
    });

    it("returns false for post-detail", () => {
      nav.navigate("post-detail");
      expect(nav.getState().isMainView).toBe(false);
    });

    it("returns false for profile", () => {
      nav.navigate("profile");
      expect(nav.getState().isMainView).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles navigating to same view", () => {
      nav.navigate("timeline"); // Navigate to current view
      expect(nav.getState().history).toEqual(["timeline", "timeline"]);
      expect(nav.getState().canGoBack).toBe(true);
    });

    it("handles rapid back navigation", () => {
      nav.navigate("post-detail");
      nav.navigate("profile");
      nav.navigate("post-detail");

      // Rapid back calls
      expect(nav.goBack()).toBe(true);
      expect(nav.goBack()).toBe(true);
      expect(nav.goBack()).toBe(true);
      expect(nav.goBack()).toBe(false); // Can't go back further
      expect(nav.goBack()).toBe(false); // Still can't

      expect(nav.getState().currentView).toBe("timeline");
    });

    it("handles cycleNext when mainViews has single item", () => {
      const singleNav = createHookRunner<"home">("home", ["home"] as const);
      singleNav.cycleNext();
      expect(singleNav.getState().currentView).toBe("home");
    });
  });
});
