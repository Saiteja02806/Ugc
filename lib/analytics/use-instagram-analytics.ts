"use client";

import { useAnalyticsResource } from "./use-analytics-resource";
import { getConnectionsRevision } from "@/lib/social/connection-revision";
import type { SocialConnection } from "@/lib/social/types";
import type { InstagramInsightsAccount } from "./instagram-insights";
import type { InstagramContentAccount } from "./instagram-content-insights";
import { ANALYTICS_SNAPSHOT_READ_STALE_MS } from "./freshness-policy";

export function useInstagramAnalytics(params: {
  owner: string; connections: SocialConnection[]; days: 7 | 30 | 90; enabled: boolean; refreshRequest: number;
}) {
  const base = { ...params, revision: getConnectionsRevision(params.connections), platform: "instagram", staleTime: ANALYTICS_SNAPSHOT_READ_STALE_MS };
  const insights = useAnalyticsResource<{ accounts: InstagramInsightsAccount[]; days: number }>({ ...base, url: "/api/analytics/instagram/insights" });
  const content = useAnalyticsResource<{ accounts: InstagramContentAccount[]; days: number }>({ ...base, url: "/api/analytics/instagram/content" });
  return { insights, content };
}
