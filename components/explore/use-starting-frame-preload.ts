"use client";
import { useAuth } from "@/contexts/auth-context";
import { hookSourceSha256, prefetchHookStartingFrame } from "@/lib/explore/hook-starting-frame-client";
import type { RecreateReference } from "@/lib/explore/recreate-types";

/** Intent only: no mount-time catalogue fanout, inference, billing, or visible controls. */
export function useStartingFramePreload() {
  const { user, loading } = useAuth();
  return (reference: RecreateReference) => {
    if (loading || !user?.emailVerified || reference.format === "slideshow" ||
      new URLSearchParams(window.location.search).get("preview") === "1") return;
    const sourceSha256 = hookSourceSha256(reference.videoUrl) ?? reference.sourceSha256;
    if (!sourceSha256 || !/^[a-f0-9]{64}$/.test(sourceSha256)) return;
    void prefetchHookStartingFrame({ ownerId: user.uid, referenceId: reference.id, sourceSha256 });
  };
}
