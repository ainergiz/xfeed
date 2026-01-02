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
  TweetDetail: "97JF30KziU00483E_8elBA",
  SearchTimeline: "M1jEez78PEfVfbQLvlWMvQ",
  UserArticlesTweets: "8zBy9h4L90aDL02RsBcCFg",
  Bookmarks: "RV1g3b8n_SGOHwkqKYSCFw",
  HomeTimeline: "HCosKfLNW1AcOo3la3mMgg",
  HomeLatestTimeline: "zhX91JE87mWvfprhYE97xA",
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
