/**
 * GraphQL query ID management
 * Re-exports from query-ids.json and runtime-query-ids.ts
 */

import type { OperationName } from "./types";

import queryIdsJson from "./query-ids.json" with { type: "json" };

export {
  runtimeQueryIds,
  createRuntimeQueryIdStore,
} from "./runtime-query-ids";
export type {
  RuntimeQueryIdSnapshot,
  RuntimeQueryIdSnapshotInfo,
  RuntimeQueryIdsOptions,
  RuntimeQueryIdStore,
} from "./runtime-query-ids";

/**
 * Fallback query IDs - used when runtime discovery fails
 */
export const FALLBACK_QUERY_IDS = {
  CreateTweet: "TAJw1rBsjAtdNgTdlo2oeg",
  CreateRetweet: "ojPdsZsimiJrUGLR1sjUtA",
  FavoriteTweet: "lI07N6Otwv1PhnEgXILM7A",
  UnfavoriteTweet: "ZYKSe-w7KEslx3JhSIk5LA",
  CreateBookmark: "aoDbu3RHznuiSkQ9aNM67Q",
  DeleteBookmark: "Wlmlj2-xzyS1GN3a6cj-mQ",
  TweetDetail: "97JF30KziU00483E_8elBA",
  SearchTimeline: "M1jEez78PEfVfbQLvlWMvQ",
  UserArticlesTweets: "8zBy9h4L90aDL02RsBcCFg",
  Bookmarks: "RV1g3b8n_SGOHwkqKYSCFw",
  BookmarkFolderTimeline: "k1EDbfGbnVjJ6SCvVbT6Og",
  HomeTimeline: "V7xdnRnvW6a8vIsMr9xK7A",
  HomeLatestTimeline: "zhX91JE87mWvfprhYE97xA",
  UserByScreenName: "7mjxD3-C6BxitPMVQ6w0-Q",
  UserTweets: "HuTx74BxAnezK1gWvYY7zg",
  BookmarkFoldersSlice: "i78YDd0Tza-dV4SYs58kRg",
  bookmarkTweetToFolder: "4KHZvvNbHNf07bsgnL9gWA",
  NotificationsTimeline: "Ev6UMJRROInk_RMH2oVbBg",
} as const;

/**
 * Target operations for query ID discovery
 */
export const TARGET_QUERY_ID_OPERATIONS = Object.keys(
  FALLBACK_QUERY_IDS
) as OperationName[];

/**
 * Combined query IDs from JSON file and fallbacks
 */
export const QUERY_IDS: Record<OperationName, string> = {
  ...FALLBACK_QUERY_IDS,
  ...(queryIdsJson as Partial<Record<OperationName, string>>),
};
