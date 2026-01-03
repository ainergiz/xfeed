/**
 * TanStack Query Experiment Entry Point
 *
 * This file provides the QueryClientProvider wrapper for the experimental
 * TanStack Query-based timeline.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { createQueryClient } from "./query-client";

// Singleton query client (create once per app lifecycle)
let queryClientInstance: ReturnType<typeof createQueryClient> | null = null;

function getQueryClient() {
  if (!queryClientInstance) {
    queryClientInstance = createQueryClient();
  }
  return queryClientInstance;
}

/**
 * Provider wrapper for TanStack Query
 * Wrap your app root with this to enable TanStack Query hooks
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  // Use state to ensure stable reference across re-renders
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Re-export components for external use
export { TimelineScreenExperimental } from "./TimelineScreenExperimental";
export { useTimelineQuery } from "./use-timeline-query";
export { usePostDetailQuery } from "./use-post-detail-query";
export { useProfileQuery } from "./use-profile-query";
export { createQueryClient, queryKeys } from "./query-client";
