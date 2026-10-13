"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkGenerationDiscoveries, generationDiscoveryKey, readGenerationDiscoveries, type PendingGeneration, type RecoveredGeneration } from "@/lib/ai-studio/pending-generation";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";

/** Initial hydration and explicit checks are read-only; there is no polling. */
export function useGenerationDiscovery({ ownerId, kind, scope, enabled, onRecovered }: {
  ownerId: string | null; kind: PendingGeneration["kind"]; scope: string; enabled: boolean;
  onRecovered: (result: RecoveredGeneration, input: Record<string, unknown>) => void;
}) {
  const identity = ownerId ? generationDiscoveryKey(ownerId, kind, scope) : "signed-out";
  const active = useRef<string | null>(null), working = useRef(new Set<string>());
  const [state, setState] = useState({ identity: "", available: false, checking: false, error: null as string | null });
  const check = useCallback(async () => {
    if (!enabled || !ownerId || active.current !== identity || working.current.has(identity)) return;
    working.current.add(identity);
    const assertActive = () => { if (active.current !== identity) throw new Error("This account's generation recovery is no longer active."); };
    try {
      const records = readGenerationDiscoveries(localStorage.getItem(identity), ownerId, kind, scope);
      if (!records.length) { setState({ identity, available: false, checking: false, error: null }); return; }
      setState({ identity, available: true, checking: true, error: null });
      const token = await withReadDeadline(() => getCurrentUserIdToken(ownerId)); assertActive();
      if (!token) throw new Error("Sign in to check earlier generations.");
      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to recover generations safely.");
      const result = await checkGenerationDiscoveries({ ownerId, kind, scope, token, storage: localStorage, locks: navigator.locks, fetch, assertActive, acknowledge: onRecovered });
      assertActive();
      // Notify the account-scoped stored-job observers without changing the URL
      // or selecting an older output as the foreground generation.
      window.dispatchEvent(new Event("storage"));
      setState({ identity, available: (result?.remaining ?? records.length) > 0, checking: false, error: null });
    } catch (error) {
      if (active.current === identity) setState({ identity, available: true, checking: false, error: error instanceof Error ? error.message : "Could not check earlier generations." });
    } finally { working.current.delete(identity); }
  }, [enabled, ownerId, kind, scope, identity, onRecovered]);
  useEffect(() => {
    active.current = enabled ? identity : null;
    let stopped = false;
    void Promise.resolve().then(() => { if (!stopped) void check(); });
    return () => { stopped = true; active.current = null; };
  }, [enabled, identity, check]);
  // Newly archived partial batches become discoverable after an explicit
  // submission as well as after reload. This event only exposes the control.
  useEffect(() => {
    if (!enabled || !ownerId) return;
    const update = () => {
      try {
        const available = readGenerationDiscoveries(localStorage.getItem(identity), ownerId, kind, scope).length > 0;
        setState(previous => ({ ...previous, identity, available }));
      } catch { setState({ identity, available: true, checking: false, error: "The earlier generation records could not be verified. They are preserved." }); }
    };
    window.addEventListener("storage", update);
    window.addEventListener("ugc-background-job-url-change", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("ugc-background-job-url-change", update); };
  }, [enabled, ownerId, kind, scope, identity]);
  return state.identity === identity ? { ...state, check } : { available: false, checking: false, error: null, check };
}
