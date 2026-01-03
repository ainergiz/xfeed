/**
 * Bookmark and Like action mutations
 *
 * The mutations are implemented in the XClient class.
 * This file re-exports the hook for convenient access.
 *
 * @see src/api/client.ts - likeTweet, unlikeTweet, createBookmark, deleteBookmark
 * @see src/hooks/useActions.ts - useActions hook
 */

export { useActions } from "@/hooks/useActions";
export type {
  UseActionsOptions,
  UseActionsResult,
  TweetActionState,
} from "@/hooks/useActions";
