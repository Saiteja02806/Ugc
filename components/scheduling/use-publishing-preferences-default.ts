"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_PUBLISHING_PREFERENCES, type PublishingPreferences } from "@/lib/scheduling/publishing-preferences";
import { requestPublishingPreferences } from "@/lib/scheduling/publishing-preferences-client";

type RequestSession = { accountId: string | null; enabled: boolean; retryVersion: number };

export function usePublishingPreferencesDefault(accountId: string | null, enabled = true) {
  const [retryVersion, setRetryVersion] = useState(0);
  const session = useMemo(() => ({ accountId, enabled, retryVersion }), [accountId, enabled, retryVersion]);
  const retry = useCallback(() => setRetryVersion((current) => current + 1), []);
  const [result, setResult] = useState<{
    session: RequestSession;
    preferences: PublishingPreferences;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session.enabled || !session.accountId) return;
    const controller = new AbortController();
    void requestPublishingPreferences(undefined, controller.signal)
      .then((preferences) => {
        if (!controller.signal.aborted) setResult({ session, preferences, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({
            session,
            preferences: DEFAULT_PUBLISHING_PREFERENCES,
            error: "Your publishing defaults could not load. Retry before publishing.",
          });
        }
      });
    return () => controller.abort();
  }, [session]);

  // Settings opens separately to preserve this post. Returning reloads defaults.
  useEffect(() => {
    if (!enabled || !accountId || typeof window === "undefined") return;
    window.addEventListener("focus", retry);
    return () => window.removeEventListener("focus", retry);
  }, [accountId, enabled, retry]);

  // Closing, reopening or changing accounts immediately invalidates the old
  // result, even before the next effect runs. Late requests cannot replace it.
  const current = result?.session === session ? result : null;
  return {
    ...DEFAULT_PUBLISHING_PREFERENCES,
    ...current?.preferences,
    error: current?.error ?? null,
    loading: Boolean(enabled && accountId && !current),
    retry,
  };
}
