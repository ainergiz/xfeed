/**
 * Navigation hook with history stack support
 * Provides view navigation, back navigation, and tab cycling for main views
 */

import { useState, useCallback } from "react";

export interface UseNavigationOptions<V extends string> {
  /** Initial view to display */
  initialView: V;
  /** Main views that can be cycled with Tab (excludes overlay views) */
  mainViews: readonly V[];
}

export interface UseNavigationResult<V extends string> {
  /** Currently active view */
  currentView: V;
  /** Previous view in history (null if at initial) */
  previousView: V | null;
  /** Full navigation history (readonly) */
  history: readonly V[];

  /** Navigate to a new view (pushes to history stack) */
  navigate: (view: V) => void;
  /** Go back to previous view (returns true if successful, false if at initial) */
  goBack: () => boolean;
  /** Cycle to next main view (replaces current view, only works when on a main view) */
  cycleNext: () => void;

  /** Whether back navigation is possible */
  canGoBack: boolean;
  /** Whether current view is one of the main views */
  isMainView: boolean;
}

/**
 * Hook for managing navigation state with history support
 *
 * @example
 * ```tsx
 * const { currentView, navigate, goBack, cycleNext } = useNavigation({
 *   initialView: "timeline",
 *   mainViews: ["timeline", "bookmarks"],
 * });
 *
 * // Navigate to detail view
 * navigate("post-detail");
 *
 * // Go back
 * goBack();
 *
 * // Cycle between main views (Tab key)
 * cycleNext();
 * ```
 */
export function useNavigation<V extends string>(
  options: UseNavigationOptions<V>
): UseNavigationResult<V> {
  const { initialView, mainViews } = options;
  const [history, setHistory] = useState<V[]>([initialView]);

  const currentView = history[history.length - 1]!;
  const previousView = history.length > 1 ? history[history.length - 2]! : null;
  const canGoBack = history.length > 1;
  const isMainView = (mainViews as readonly string[]).includes(currentView);

  const navigate = useCallback((view: V) => {
    setHistory((prev) => [...prev, view]);
  }, []);

  const goBack = useCallback((): boolean => {
    if (history.length <= 1) return false;
    setHistory((prev) => prev.slice(0, -1));
    return true;
  }, [history.length]);

  const cycleNext = useCallback(() => {
    setHistory((prev) => {
      const current = prev[prev.length - 1]!;
      if (!(mainViews as readonly string[]).includes(current)) {
        return prev; // Don't cycle if not on a main view
      }

      const currentIndex = (mainViews as readonly string[]).indexOf(current);
      const nextIndex = (currentIndex + 1) % mainViews.length;
      const nextView = mainViews[nextIndex]!;

      // Replace current view (don't push to history)
      return [...prev.slice(0, -1), nextView];
    });
  }, [mainViews]);

  return {
    currentView,
    previousView,
    history,
    navigate,
    goBack,
    cycleNext,
    canGoBack,
    isMainView,
  };
}
