"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AudioApi } from "@/lib/audio/client";

type Selection = { voiceId: string | null };
export function useAudioVoiceSelection(uid: string, api: AudioApi, enabled = true) {
  const client = useQueryClient();
  const queryKey = ["audio-voice-selection", uid] as const;
  const writes = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey, enabled: Boolean(uid) && enabled, staleTime: 30_000, retry: false, refetchOnWindowFocus: true,
    queryFn: ({ signal }) => api<Selection>("/api/audio/selection", { signal }),
  });
  function select(voiceId: string) {
    if (!uid) return;
    const current = ++revision.current;
    setError(null);
    // Serialize changes so a slow earlier selection cannot win on the server.
    writes.current = writes.current.then(async () => {
      await client.cancelQueries({ queryKey });
      try {
        const result = await api<Selection>("/api/audio/selection", {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId }),
        });
        if (revision.current === current) {
          await client.cancelQueries({ queryKey });
          client.setQueryData(queryKey, result);
        }
      } catch (error) {
        if (revision.current === current) setError(error instanceof Error ? error.message : "Your voice could not be saved. Try Use It again.");
      }
    });
  }
  return { voiceId: query.data?.voiceId ?? null, select, loading: query.isFetching, error: error || (query.error instanceof Error ? query.error.message : null), refresh: () => void query.refetch() };
}
