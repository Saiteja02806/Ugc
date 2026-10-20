"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AudioApi } from "@/lib/audio/client";

type Bookmarks = { voiceIds: string[] };

export function useAudioBookmarks(uid: string, api: AudioApi) {
  const client = useQueryClient();
  const queryKey = ["audio-voice-bookmarks", uid] as const;
  const pending = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const query = useQuery({
    queryKey, enabled: Boolean(uid), staleTime: 30_000, retry: false, refetchOnWindowFocus: true,
    queryFn: ({ signal }) => api<Bookmarks>("/api/audio/bookmarks", { signal }),
  });

  async function toggle(voiceId: string) {
    if (!uid || pending.current.has(voiceId)) return;
    pending.current.add(voiceId); setPendingIds(new Set(pending.current)); setSaveError(null);
    try {
      // A stale read cannot overwrite a save. Other voices can save independently.
      if (client.getQueryData<Bookmarks>(queryKey)) await client.cancelQueries({ queryKey });
      // A failed initial read must not leave every bookmark permanently disabled.
      const current = client.getQueryData<Bookmarks>(queryKey) ?? await client.fetchQuery<Bookmarks>({
        queryKey, queryFn: ({ signal }) => api<Bookmarks>("/api/audio/bookmarks", { signal }),
      });
      const bookmarked = !current.voiceIds.includes(voiceId);
      await api("/api/audio/bookmarks", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, bookmarked }),
      });
      client.setQueryData<Bookmarks>(queryKey, current => ({
        voiceIds: bookmarked
          ? [voiceId, ...(current?.voiceIds ?? []).filter(id => id !== voiceId)]
          : (current?.voiceIds ?? []).filter(id => id !== voiceId),
      }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your bookmark could not be saved. Try again.");
    } finally {
      pending.current.delete(voiceId); setPendingIds(new Set(pending.current));
    }
  }

  function refresh() {
    if (!pending.current.size) { setSaveError(null); void query.refetch(); }
  }

  return {
    ids: new Set(query.data?.voiceIds ?? []), pendingIds,
    loading: query.isPending, ready: Boolean(query.data),
    error: saveError || (query.error instanceof Error ? query.error.message : null),
    toggle, refresh,
  };
}
