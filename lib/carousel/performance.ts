import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { InstagramContentAccount } from "@/lib/analytics/instagram-content-insights";
import {
  deriveCarouselPerformanceSignals,
  getInstagramCarouselPerformanceObservations,
  type CarouselPerformanceAggregate,
  type CarouselPerformanceObservationInput,
  type CarouselPerformanceSignals,
} from "@/lib/carousel/performance-logic";
import type { CarouselStructureId } from "@/lib/carousel/structure";
import { deriveCarouselStructure2PerformanceSignals } from "@/lib/carousel/structure-2-performance";
import type { CarouselStructure2PerformanceSignals } from "@/lib/carousel/structure-2-selector";

type CarouselPerformanceDatabase = {
  public: {
    Functions: {
      get_carousel_performance_aggregates: {
        Args: {
          p_business_profile_id: string;
          p_structure_id: CarouselStructureId;
          p_user_id: string;
        };
        Returns: Array<{
          average_view_count: number | string | null;
          baseline_median_view_count: number | string | null;
          content_format_id: string | null;
          evaluated_post_count: number | string;
          hook_family_id: string | null;
          median_view_count: number | string | null;
          scope: "format" | "format_hook";
          view_standard_deviation: number | string | null;
        }>;
      };
      record_carousel_performance_observation: {
        Args: {
          p_observed_at: string;
          p_platform: "instagram";
          p_platform_post_id: string;
          p_published_at: string;
          p_social_connection_id: string;
          p_user_id: string;
          p_view_count: number | null;
        };
        Returns: Array<{ evaluated: boolean; recorded: boolean }>;
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

let performanceClient: SupabaseClient<CarouselPerformanceDatabase> | null = null;

export async function recordInstagramCarouselPerformance(params: {
  accounts: InstagramContentAccount[];
  userId: string;
}) {
  const observations = getInstagramCarouselPerformanceObservations(
    params.accounts,
  );
  const results = await mapWithConcurrency(
    observations,
    8,
    (observation) => recordCarouselPerformanceObservation({
      observation,
      userId: params.userId,
    }),
  );

  return {
    evaluatedCarouselPosts: results.filter((result) => result.evaluated).length,
    matchedCarouselPosts: results.filter((result) => result.recorded).length,
    observedCarouselPosts: results.length,
  };
}

/**
 * Performance learning is best-effort. Missing analytics permission or an
 * unapplied migration must not stop controlled Carousel generation.
 */
export async function getCarouselPerformanceSignals(params: {
  businessProfileId: string;
  structureId: CarouselStructureId;
  userId: string;
}): Promise<CarouselPerformanceSignals> {
  try {
    const { data, error } = await getPerformanceClient().rpc(
      "get_carousel_performance_aggregates",
      {
        p_business_profile_id: params.businessProfileId,
        p_structure_id: params.structureId,
        p_user_id: params.userId,
      },
    );

    if (error) throw new Error(error.message);

    return deriveCarouselPerformanceSignals(
      (data ?? []).map(mapPerformanceAggregate),
    );
  } catch (error) {
    console.warn(
      "Carousel performance preferences are unavailable; using controlled rotation:",
      error,
    );
    return {};
  }
}

export async function getCarouselStructure2PerformanceSignals(params: {
  businessProfileId: string;
  userId: string;
}): Promise<CarouselStructure2PerformanceSignals> {
  try {
    const { data, error } = await getPerformanceClient().rpc(
      "get_carousel_performance_aggregates",
      {
        p_business_profile_id: params.businessProfileId,
        p_structure_id: "structure_2",
        p_user_id: params.userId,
      },
    );

    if (error) throw new Error(error.message);

    return deriveCarouselStructure2PerformanceSignals(
      (data ?? []).map(mapPerformanceAggregate),
    );
  } catch (error) {
    console.warn(
      "Carousel Structure 2 performance preferences are unavailable; using its controlled rotation:",
      error,
    );
    return {};
  }
}

async function recordCarouselPerformanceObservation(params: {
  observation: CarouselPerformanceObservationInput;
  userId: string;
}) {
  const { data, error } = await getPerformanceClient().rpc(
    "record_carousel_performance_observation",
    {
      p_observed_at: params.observation.observedAt,
      p_platform: params.observation.platform,
      p_platform_post_id: params.observation.platformPostId,
      p_published_at: params.observation.publishedAt,
      p_social_connection_id: params.observation.socialConnectionId,
      p_user_id: params.userId,
      p_view_count: params.observation.viewCount,
    },
  );

  if (error) {
    throw new Error(
      `Could not record published Carousel performance: ${error.message}`,
    );
  }

  return {
    evaluated: data?.[0]?.evaluated === true,
    recorded: data?.[0]?.recorded === true,
  };
}

function mapPerformanceAggregate(
  row: CarouselPerformanceDatabase["public"]["Functions"]["get_carousel_performance_aggregates"]["Returns"][number],
): CarouselPerformanceAggregate {
  return {
    averageViewCount: toFiniteNumber(row.average_view_count),
    baselineMedianViewCount: toFiniteNumber(
      row.baseline_median_view_count,
    ),
    contentFormatId: row.content_format_id,
    evaluatedPostCount: toFiniteNumber(row.evaluated_post_count) ?? -1,
    hookFamilyId: row.hook_family_id,
    medianViewCount: toFiniteNumber(row.median_view_count),
    scope: row.scope,
    viewStandardDeviation: toFiniteNumber(row.view_standard_deviation),
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

function getPerformanceClient() {
  if (performanceClient) return performanceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Carousel performance storage requires the Supabase service configuration.",
    );
  }

  performanceClient = createClient<CarouselPerformanceDatabase>(
    url,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return performanceClient;
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

      if (value !== undefined) results[index] = await mapper(value);
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
