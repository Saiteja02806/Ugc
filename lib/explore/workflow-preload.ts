"use client";

import type { QueryClient } from "@tanstack/react-query";
import {
  BUSINESS_PROFILE_GATE_GC_TIME_MS,
  BUSINESS_PROFILE_GATE_STALE_TIME_MS,
  fetchBusinessProfileGate,
  getBusinessProfileGateQueryKey,
} from "@/lib/business-profiles/profile-gate-query";
import { fetchRecreateReferences } from "@/lib/explore/reference-catalog-client";

export function getPreloadWorkflow(destination: string | null) {
  switch (destination?.replace(/\/$/, "")) {
    case "/explore/slideshows": return "slideshow";
    case "/explore/hook-video": return "hook";
    case "/explore/wall-of-text": return "wall_text";
    default: return null;
  }
}

/** Read-only preparation. It neither renders a guarded page nor admits generation. */
export async function preloadExploreWorkflow({
  destination, localPreview, loading, user, queryClient, loadComposer,
}: {
  destination: string | null;
  localPreview: boolean;
  loading: boolean;
  user: { uid: string; emailVerified: boolean } | null;
  queryClient: QueryClient;
  loadComposer: (workflow: "slideshow" | "hook" | "wall_text") => Promise<unknown>;
}) {
  const workflow = getPreloadWorkflow(destination);
  if (!workflow || localPreview || loading || !user?.emailVerified) return;
  const ownerId = user.uid;
  // Match the mounted consumers exactly: React Query shares fresh and in-flight
  // reads. A failed speculative read remains retryable on normal navigation.
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: getBusinessProfileGateQueryKey(ownerId),
      queryFn: ({ signal }) => fetchBusinessProfileGate(ownerId, signal),
      staleTime: BUSINESS_PROFILE_GATE_STALE_TIME_MS,
      gcTime: BUSINESS_PROFILE_GATE_GC_TIME_MS,
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: ["recreate-references", 4, ownerId],
      queryFn: ({ signal }) => fetchRecreateReferences(signal, ownerId),
      staleTime: 30 * 60_000,
      gcTime: 60 * 60_000,
      retry: false,
    }),
    // Queue this independently; a module failure must not suppress either read.
    Promise.resolve().then(() => loadComposer(workflow)),
  ]);
}
