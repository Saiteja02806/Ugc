"use client";

import type { QueryClient } from "@tanstack/react-query";

import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import { INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS } from "@/lib/analytics/instagram-freshness";

type InstagramAnalyticsQueryKind = "content" | "insights";

export function getInstagramAnalyticsQueryKey(
  accountId: string,
  kind: InstagramAnalyticsQueryKind,
  days: 7 | 30 | 90,
) {
  return ["account", accountId, "analytics", "instagram", kind, days] as const;
}

export async function loadInstagramAnalyticsQuery(params: {
  accountId: string;
  days: 7 | 30 | 90;
  force?: boolean;
  idempotencyKey?: string;
  kind: InstagramAnalyticsQueryKind;
  onBackgroundError?: (error: Error) => void;
  onBackgroundOutput?: (output: unknown) => void;
  queryClient: QueryClient;
  token: string;
}) {
  const queryKey = getInstagramAnalyticsQueryKey(
    params.accountId,
    params.kind,
    params.days,
  );

  return params.queryClient.fetchQuery({
    gcTime: INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS,
    queryFn: ({ signal }) =>
      runAnalyticsBackgroundSync({
        body: {
          days: params.days,
          ...(params.force ? { force: true } : {}),
        },
        idempotencyKey: params.idempotencyKey,
        onBackgroundError: params.onBackgroundError,
        onBackgroundOutput: (output) => {
          if (output !== null && output !== undefined) {
            params.queryClient.setQueryData(queryKey, output);
          }
          params.onBackgroundOutput?.(output);
        },
        signal,
        token: params.token,
        url: `/api/analytics/instagram/${params.kind}`,
      }),
    queryKey,
    retry: false,
    staleTime: params.force ? 0 : INSTAGRAM_ANALYTICS_BROWSER_CACHE_MS,
  });
}
