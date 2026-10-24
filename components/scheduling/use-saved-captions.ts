"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requestSavedCaptions } from "@/lib/scheduling/saved-captions-client";
import { type SavedCaptionLibrary } from "@/lib/scheduling/saved-captions";

export function useSavedCaptions(ownerId: string | null, enabled: boolean) {
  const client = useQueryClient();
  const key = ["saved-post-captions", ownerId];
  const query = useQuery({ queryKey: key, enabled: Boolean(ownerId && enabled), queryFn: ({ signal }) => requestSavedCaptions(ownerId!, undefined, signal),
    staleTime: 60_000, gcTime: 5 * 60_000, retry: false });
  const [state, setState] = useState<{ owner: string | null; pending: boolean; error: string | null }>({ owner: ownerId, pending: false, error: null });
  const session = useRef({ ownerId, enabled });
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Hide old-account results immediately and fence writes that finish after navigation.
  useLayoutEffect(() => { session.current = { ownerId, enabled }; }, [ownerId, enabled]);
  async function change(update: (library: SavedCaptionLibrary) => SavedCaptionLibrary) {
    if (!ownerId || !enabled || lock.current) return false;
    const current = client.getQueryData<SavedCaptionLibrary>(key);
    if (!current || query.isError || state.owner === ownerId && state.error) return false;
    lock.current = true; setState({ owner: ownerId, pending: true, error: null });
    const active = () => alive.current && session.current.ownerId === ownerId && session.current.enabled;
    try {
      const next = update(current);
      if (next === current) return true;
      const saved = await requestSavedCaptions(ownerId, next);
      // Cache only under the original owner, never under the newly selected account.
      client.setQueryData(key, saved);
      return active();
    } catch (error) {
      if (active()) setState({ owner: ownerId, pending: true, error: error instanceof Error ? error.message : "Could not save this caption." });
      // A lost response may have committed. Read the latest revision before another edit.
      try { client.setQueryData(key, await requestSavedCaptions(ownerId)); }
      catch { await client.invalidateQueries({ queryKey: key, refetchType: "none" }); }
      return false;
    } finally {
      lock.current = false;
      // A workflow tab may be inactive while its save finishes. Clear the old
      // operation's spinner even then, without touching a newer owner's state.
      if (alive.current) setState(previous => previous.owner === ownerId ? { ...previous, pending: false } : previous);
    }
  }
  return { library: ownerId ? query.data : undefined, loading: enabled && Boolean(ownerId) && query.isPending, pending: state.owner === ownerId && state.pending,
    error: state.owner === ownerId && state.error || (query.isError ? "Saved captions could not load. You can still write a caption for this post." : null),
    available: Boolean(ownerId && enabled && query.data && !query.isError && !(state.owner === ownerId && state.error)), change, retry: () => { void query.refetch().then(result => { if (alive.current && session.current.ownerId === ownerId && !result.error) setState({ owner: ownerId, pending: false, error: null }); }); } };
}
