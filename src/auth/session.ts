/**
 * Session state management for handling expired auth.
 */

export type SessionStatus = "valid" | "expired" | "refreshing";

export interface SessionState {
  status: SessionStatus;
}

/**
 * Create initial valid session state.
 */
export function createValidSession(): SessionState {
  return { status: "valid" };
}

/**
 * Create expired session state.
 */
export function createExpiredSession(): SessionState {
  return { status: "expired" };
}

/**
 * Create refreshing session state.
 */
export function createRefreshingSession(): SessionState {
  return { status: "refreshing" };
}
