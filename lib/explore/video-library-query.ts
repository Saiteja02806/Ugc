import { queryOptions } from "@tanstack/react-query";

import type { ExploreVideoReference } from "./hook-video-types.ts";
import { isRemovedWallTextReference } from "./recreate-types.ts";

function visibleLibrary(library: ExploreVideoLibrary): ExploreVideoLibrary {
  const items = library.items.filter(item => !isRemovedWallTextReference(item.id));
  const preview = library.preview && isRemovedWallTextReference(library.preview.id)
    ? items[0] ?? null : library.preview;
  return { ...library, items, preview };
}

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
    queryKey: [section === "wall_text" ? "explore-video-library-v3" : "explore-video-library", userId, section] as const,
    queryFn: ({ signal }) => load(signal),
    select: section === "wall_text" ? visibleLibrary : undefined,
    staleTime: 30 * 60 * 1_000,
    gcTime: 60 * 60 * 1_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
