import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { InstagramContentAccount } from "@/lib/analytics/instagram-content-insights";
import type { TikTokAnalyticsAccount } from "@/lib/analytics/tiktok";
import {
  deriveHookPerformanceSignals,
  getInstagramHookPerformanceObservations,
  getTikTokHookPerformanceObservations,
  type HookPerformancePatternAggregate,
  type HookPerformanceObservationInput,
} from "@/lib/trending/hook-performance-logic";
import type { TrendingHookPerformanceSignals } from "@/lib/trending/trending-hook-copy-contract";

type HookPerformanceDatabase = {
  public: {
    Functions: {
      record_hook_performance_observation: {
        Args: {
          p_metrics: Record<string, boolean | number | string | null>;
          p_observed_at: string;
          p_platform: "instagram" | "tiktok";
          p_platform_post_id: string;
          p_social_connection_id: string;
          p_user_id: string;
        };
        Returns: { recorded: boolean }[];
      };
      get_hook_performance_pattern_aggregates: {
        Args: {
          p_business_profile_id: string;
          p_user_id: string;
        };
        Returns: Array<{
          attributed_sales_amount: number | string | null;
          attributed_sales_currency: string | null;
          average_watch_time_seconds: number | string | null;
          campaign_purpose: string | null;
          completion_rate: number | string | null;
          conversion_count: number | string | null;
          observed_post_count: number | string;
          pattern_id: string | null;
          save_count: number | string | null;
          share_count: number | string | null;
          view_count: number | string | null;
        }>;
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

let hookPerformanceClient: SupabaseClient<HookPerformanceDatabase> | null = null;

export async function recordInstagramHookPerformance(params: {
  accounts: InstagramContentAccount[];
  userId: string;
}) {
  return recordHookPerformanceObservations({
    observations: getInstagramHookPerformanceObservations(params.accounts),
    userId: params.userId,
  });
}

export async function recordTikTokHookPerformance(params: {
  accounts: TikTokAnalyticsAccount[];
  userId: string;
}) {
  return recordHookPerformanceObservations({
    observations: getTikTokHookPerformanceObservations(params.accounts),
    userId: params.userId,
  });
}

/**
 * Learning is intentionally best-effort. A missing migration or unavailable
 * analytics table must never stop a person from generating a Hook; it simply
 * means the generator receives no learned preference yet.
 */
export async function getHookPerformanceSignals(params: {
  businessProfileId: string;
  userId: string;
}): Promise<TrendingHookPerformanceSignals> {
  try {
    const { data, error } = await getHookPerformanceClient().rpc(
      "get_hook_performance_pattern_aggregates",
      {
        p_business_profile_id: params.businessProfileId,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return deriveHookPerformanceSignals(
      (data ?? []).map(mapPatternAggregate),
    );
  } catch (error) {
    console.warn(
      "Hook performance preferences are unavailable; generating without them:",
      error,
    );
    return {};
  }
}

async function recordHookPerformanceObservations(params: {
  observations: HookPerformanceObservationInput[];
  userId: string;
}) {
  const results = await mapWithConcurrency(
    params.observations,
    8,
    async (observation) => {
      const { data, error } = await getHookPerformanceClient().rpc(
        "record_hook_performance_observation",
        {
          p_metrics: {
            attributedSalesAmount: observation.attributedSalesAmount,
            attributedSalesCurrency: observation.attributedSalesCurrency,
            averageWatchTimeSeconds: observation.averageWatchTimeSeconds,
            clickCount: observation.clickCount,
            commentCount: observation.commentCount,
            completionRate: observation.completionRate,
            conversionCount: observation.conversionCount,
            interactionCount: observation.interactionCount,
            likeCount: observation.likeCount,
            reachCount: observation.reachCount,
            saveCount: observation.saveCount,
            shareCount: observation.shareCount,
            viewCount: observation.viewCount,
            watchTimeSeconds: observation.watchTimeSeconds,
          },
          p_observed_at: observation.observedAt,
          p_platform: observation.platform,
          p_platform_post_id: observation.platformPostId,
          p_social_connection_id: observation.socialConnectionId,
          p_user_id: params.userId,
        },
      );

      if (error) {
        throw new Error(
          `Could not record published Hook performance: ${error.message}`,
        );
      }

      return data?.[0]?.recorded === true;
    },
  );

  return {
    matchedHookPosts: results.filter(Boolean).length,
    observedPlatformPosts: results.length,
  };
}

function mapPatternAggregate(
  row: HookPerformanceDatabase["public"]["Functions"]["get_hook_performance_pattern_aggregates"]["Returns"][number],
): HookPerformancePatternAggregate {
  return {
    attributedSalesAmount: toFiniteNumber(row.attributed_sales_amount),
    attributedSalesCurrency: row.attributed_sales_currency,
    averageWatchTimeSeconds: toFiniteNumber(row.average_watch_time_seconds),
    campaignPurpose: row.campaign_purpose,
    completionRate: toFiniteNumber(row.completion_rate),
    conversionCount: toFiniteNumber(row.conversion_count),
    observedPostCount: toFiniteNumber(row.observed_post_count) ?? -1,
    patternId: row.pattern_id,
    saveCount: toFiniteNumber(row.save_count),
    shareCount: toFiniteNumber(row.share_count),
    viewCount: toFiniteNumber(row.view_count),
  };
}

function toFiniteNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getHookPerformanceClient() {
  if (hookPerformanceClient) {
    return hookPerformanceClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Hook performance storage requires the Supabase service configuration.",
    );
  }

  hookPerformanceClient = createClient<HookPerformanceDatabase>(
    url,
    serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  return hookPerformanceClient;
}

async function mapWithConcurrency<Input, Output>(
  values: Input[],
  concurrency: number,
  mapper: (value: Input) => Promise<Output>,
) {
  const results = new Array<Output>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      const value = values[index];
      nextIndex += 1;

      if (value !== undefined) {
        results[index] = await mapper(value);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(values.length, 1)) },
      worker,
    ),
  );

  return results;
}
