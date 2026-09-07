import { queryOptions } from "@tanstack/react-query";

import type { ExploreVideoReference } from "./hook-video-types.ts";

export type ExploreSection = "hook" | "wall_text";

export type ExploreVideoLibrary = {
  items: ExploreVideoReference[];
  preview: ExploreVideoReference | null;
};

export function exploreVideoLibraryQueryOptions({
  userId,
  section,
  load,
}: {
  userId: string | null;
  section: ExploreSection;
  load: (signal: AbortSignal) => Promise<ExploreVideoLibrary>;
}) {
  return queryOptions({
    enabled: Boolean(userId),
    queryKey: ["explore-video-library", userId, section] as const,
    queryFn: ({ signal }) => load(signal),
    staleTime: 30 * 60 * 1_000,
    gcTime: 60 * 60 * 1_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
