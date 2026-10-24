"use client";

import { useAuth } from "@/contexts/auth-context";
import type { SocialConnection } from "@/lib/social/types";
import { getConnectionsRevision } from "@/lib/social/connection-revision";
import { useAnalyticsResource } from "./use-analytics-resource";
import { ANALYTICS_SNAPSHOT_READ_STALE_MS } from "./freshness-policy";

export function useSocialAnalytics(platform: "youtube" | "tiktok", connections: SocialConnection[], refreshRequest: number) {
  const { user } = useAuth();
  const query = useAnalyticsResource<{ accounts: unknown[] }>({
    owner: user?.uid ?? "", platform, revision: getConnectionsRevision(connections),
    url: platform === "youtube" ? "/api/analytics/youtube/channel" : "/api/analytics/tiktok/videos",
    enabled: connections.length > 0, refreshRequest, staleTime: ANALYTICS_SNAPSHOT_READ_STALE_MS,
  });
  return { ...query, hasRefreshed: Boolean(query.output?.accounts.length) || (!query.refreshing && !query.loading && Boolean(query.output)) };
}
