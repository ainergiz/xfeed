/**
 * PreferencesContext - Provides user preferences to the component tree
 *
 * Preferences are loaded once at startup from ~/.config/xfeed/preferences.toml
 * and remain immutable during the session. Restart xfeed to pick up changes.
 *
 * Usage:
 *   const { preferences } = usePreferences();
 *   const defaultTab = preferences.timeline.default_tab;
 */

import { createContext, useContext, type ReactNode } from "react";

import type { UserPreferences } from "@/config/preferences-types";

// ============================================================================
// Context Definition
// ============================================================================

/** Context value exposed to consumers */
export interface PreferencesContextValue {
  /** User preferences (loaded at startup, immutable during session) */
  preferences: UserPreferences;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// ============================================================================
// PreferencesProvider Component
// ============================================================================

interface PreferencesProviderProps {
  preferences: UserPreferences;
  children: ReactNode;
}

/**
 * Provider that makes user preferences available to the component tree.
 *
 * Preferences are loaded once at startup in index.tsx and passed here.
 * They are immutable during the session (restart to pick up changes).
 */
export function PreferencesProvider({
  preferences,
  children,
}: PreferencesProviderProps) {
  const contextValue: PreferencesContextValue = {
    preferences,
  };

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
}

// ============================================================================
// usePreferences Hook
// ============================================================================

/**
 * Hook to access user preferences.
 * @throws Error if used outside PreferencesProvider
 */
export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
