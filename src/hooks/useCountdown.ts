/**
 * useCountdown - Hook for managing countdown timers
 * Used for rate limit cooldowns and other timed UI states
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCountdownResult {
  /** Current countdown value in seconds */
  countdown: number;
  /** Whether the countdown is currently active (countdown > 0) */
  isActive: boolean;
  /** Start a new countdown with the given number of seconds */
  start: (seconds: number) => void;
  /** Stop the countdown and reset to 0 */
  stop: () => void;
}

export function useCountdown(initialSeconds = 0): UseCountdownResult {
  const [countdown, setCountdown] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCountdown(0);
  }, []);

  const start = useCallback((seconds: number) => {
    // Clear any existing countdown
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (seconds <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(seconds);

    // Start new countdown
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  return {
    countdown,
    isActive: countdown > 0,
    start,
    stop,
  };
}
