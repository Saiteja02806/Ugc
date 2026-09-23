"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import type { SocialConnection } from "@/lib/social/types";
import { preserveSavedSocialAnalytics } from "@/lib/analytics/social-snapshot-policy";

export function useSocialAnalytics(platform: "youtube" | "tiktok", connections: SocialConnection[], refreshRequest: number) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const force = useRef(false);
  const handledRequest = useRef(refreshRequest);
  const queryKey = ["account", user?.uid, "analytics", platform,
    connections.map((c) => `${c.id}:${c.connectedAt}:${c.status}`).sort().join("|")];
  const query = useQuery({
    queryKey,
    enabled: Boolean(user && connections.length),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await getCurrentUserIdToken(user?.uid);
      if (!token) throw new Error("Sign in before viewing analytics.");
      const requestedForce = force.current;
      force.current = false;
      setBackgroundError(null);
      const output = await runAnalyticsBackgroundSync({
        pollIntervalMs: 2_000,
        token, body: { force: requestedForce },
        url: platform === "youtube" ? "/api/analytics/youtube/channel" : "/api/analytics/tiktok/videos",
        onRefreshingChange: setBackgroundRefreshing,
        onBackgroundOutput: (output) => client.setQueryData(queryKey, (previous: unknown) => preserveSavedSocialAnalytics(previous, output)),
        onBackgroundError: (error) => setBackgroundError(error.message),
      });
      return preserveSavedSocialAnalytics(client.getQueryData(queryKey), output);
    },
  });
  const { refetch } = query;
  useEffect(() => {
    if (handledRequest.current === refreshRequest) return;
    handledRequest.current = refreshRequest;
    if (refreshRequest === 0) return;
    force.current = true;
    void refetch({ cancelRefetch: false });
  }, [refreshRequest, refetch]);
  return {
    output: query.data,
    error: backgroundError ?? query.error?.message ?? null,
    hasRefreshed: query.isFetched,
    refreshing: query.isFetching || backgroundRefreshing,
  };
}
