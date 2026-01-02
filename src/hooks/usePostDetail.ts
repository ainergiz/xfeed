/**
 * usePostDetail - Hook for managing single post detail view state
 * Accepts initial tweet data from timeline for immediate display
 */

import type { TweetData } from "@/api/types";

export interface UsePostDetailOptions {
  /** Initial tweet data (passed from timeline for immediate display) */
  tweet: TweetData;
}

export interface UsePostDetailResult {
  /** The tweet data */
  tweet: TweetData;
}

export function usePostDetail({
  tweet,
}: UsePostDetailOptions): UsePostDetailResult {
  // For now, just return the passed tweet data
  // Future: could add refresh capability, thread fetching, etc.
  return {
    tweet,
  };
}
