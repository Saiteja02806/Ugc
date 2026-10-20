import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { AudioBootstrap } from "./types.ts";

type AudioLibraryOptions = {
  userId: string | null;
  load: (signal: AbortSignal) => Promise<AudioBootstrap>;
};

/** Keep account data in memory across routes; stale reads refresh without hiding it. */
export function audioLibraryQueryOptions({ userId, load }: AudioLibraryOptions) {
  return queryOptions({
    queryKey: ["audio-library", userId] as const,
    enabled: Boolean(userId),
    queryFn: ({ signal }) => load(signal),
    staleTime: 30_000,
    gcTime: 60 * 60 * 1_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** Mutations and manual refresh must not reuse a still-fresh, pre-change snapshot. */
export async function refreshAudioLibrary(client: QueryClient, options: AudioLibraryOptions) {
  if (!options.userId) throw new Error("Your session is still loading. Try again shortly.");
  const query = audioLibraryQueryOptions(options);
  await client.cancelQueries({ queryKey: query.queryKey, exact: true });
  return client.fetchQuery({ ...query, staleTime: 0 });
}
