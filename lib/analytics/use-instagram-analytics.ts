"use client";

import { useAnalyticsResource } from "./use-analytics-resource";
import { getConnectionsRevision } from "@/lib/social/connection-revision";
import type { SocialConnection } from "@/lib/social/types";
import type { InstagramInsightsAccount } from "./instagram-insights";
import type { InstagramContentAccount } from "./instagram-content-insights";

export function useInstagramAnalytics(params: {
  owner: string; connections: SocialConnection[]; days: 7 | 30 | 90; enabled: boolean; refreshRequest: number;
}) {
  const base = { ...params, revision: getConnectionsRevision(params.connections), platform: "instagram", staleTime: 30 * 60_000 };
  const insights = useAnalyticsResource<{ accounts: InstagramInsightsAccount[]; days: number }>({ ...base, url: "/api/analytics/instagram/insights" });
  const content = useAnalyticsResource<{ accounts: InstagramContentAccount[]; days: number }>({ ...base, url: "/api/analytics/instagram/content" });
  return { insights, content };
}
