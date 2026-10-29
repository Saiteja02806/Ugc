"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { getConnectionRevision } from "@/lib/social/connection-revision";
import type { SocialConnection } from "@/lib/social/types";

export type SocialAccountPictureSource = Pick<SocialConnection, "id" | "platform" | "platformAccountName" | "platformAccountUsername"> &
  Partial<Pick<SocialConnection, "connectedAt" | "authorizationRevision" | "profilePictureUrl">>;

export function useSocialAccountPicture(connection: SocialAccountPictureSource) {
  const { user } = useAuth();
  const owner = user?.uid ?? "";
  const managed = connection.platform === "instagram" || connection.platform === "tiktok";
  const picture = useQuery({
    queryKey: ["account", owner, "social-profile-picture", connection.id,
      getConnectionRevision({ connectedAt: connection.connectedAt ?? "", authorizationRevision: connection.authorizationRevision }), connection.profilePictureUrl],
    enabled: Boolean(owner && managed),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(owner);
      bounded.throwIfAborted();
      if (!token) throw new Error("Sign in to load account photos.");
      const response = await fetch(`/api/social/connections/${encodeURIComponent(connection.id)}/picture`, {
        cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded,
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Account photo is unavailable.");
      const blob = await response.blob();
      bounded.throwIfAborted();
      // Cache a small data URL rather than retain object URLs after unmount.
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const abort = () => { reader.abort(); reject(bounded.reason); };
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read account photo."));
        reader.onloadend = () => bounded.removeEventListener("abort", abort);
        bounded.addEventListener("abort", abort, { once: true });
        reader.readAsDataURL(blob);
      });
    }, signal),
  });
  return managed ? picture.data ?? undefined : connection.profilePictureUrl ?? undefined;
}
