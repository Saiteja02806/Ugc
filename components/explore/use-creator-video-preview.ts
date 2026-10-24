"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { canAccessCreatorAccounts } from "@/lib/explore/creator-account-access";
import { withReadDeadline } from "@/lib/http/read-deadline";

/** Keep private MP4s authenticated and browser-local, without downloading them
 * before a card is hovered/focused or its full preview is opened. */
export function useCreatorVideoPreview(source: string | undefined, interested: boolean, interestDelayMs = 0) {
  const { user } = useAuth();
  const privateSource = source?.startsWith("/api/explore/creator-media/") === true;
  const owner = user?.uid;
  const allowed = canAccessCreatorAccounts(user);
  const [loaded, setLoaded] = useState<{ source: string; owner: string; url: string; active: { current: boolean } } | null>(null);
  const [failure, setFailure] = useState<{ source: string; owner: string } | null>(null);
  const retained = Boolean(loaded?.active.current && loaded.owner === owner && loaded.source === source);
  const shouldLoad = interested || retained;
  useEffect(() => {
    if (!privateSource || !source || !shouldLoad || !owner || !allowed) return;
    const controller = new AbortController(), active = { current: true };
    let local: string | undefined;
    const selected = source, currentOwner = owner;
    const load = () => { void withReadDeadline(async signal => {
      const token = await getCurrentUserIdToken(currentOwner);
      signal.throwIfAborted();
      if (!token) throw new Error("Sign in to preview this video.");
      const response = await fetch(selected, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal });
      if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "video/mp4") throw new Error("Video preview unavailable.");
      const blob = await response.blob();
      if (!active.current) return;
      local = URL.createObjectURL(blob);
      setLoaded({ source: selected, owner: currentOwner, url: local, active });
      setFailure(null);
    }, controller.signal).catch(() => {
      if (active.current) setFailure({ source: selected, owner: currentOwner });
    }); };
    // Ignore a pointer crossing a card while dismissing the account menu.
    // An explicitly opened preview passes zero and begins immediately.
    const timer = interestDelayMs > 0 ? setTimeout(load, interestDelayMs) : undefined;
    if (!timer) load();
    return () => { active.current = false; if (timer) clearTimeout(timer); controller.abort(); if (local) URL.revokeObjectURL(local); };
  }, [privateSource, source, shouldLoad, owner, allowed, interestDelayMs]);
  if (!privateSource) return { url: source, loading: false, failed: false };
  const url = allowed && loaded?.active.current && loaded.owner === owner && loaded.source === source ? loaded.url : undefined;
  const failed = Boolean(allowed && failure && failure.owner === owner && failure.source === source);
  return { url, loading: interested && allowed && !url && !failed, failed };
}
