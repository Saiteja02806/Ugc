import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { InstagramContentAccount } from "@/lib/analytics/instagram-content-insights";

type WallPerformanceDatabase = {
  public: {
    Functions: {
      record_wall_text_performance_observation_v1: {
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

let client: SupabaseClient<WallPerformanceDatabase> | null = null;

export async function recordInstagramWallTextPerformance(params: {
  accounts: InstagramContentAccount[];
  userId: string;
}) {
  const observations = params.accounts.flatMap((account) => {
    if (account.status !== "ready" || !account.lastSyncedAt) return [];
    return account.items.flatMap((item) =>
      item.contentType === "reel"
        ? [{
            observedAt: account.lastSyncedAt!,
            platformPostId: item.id,
            publishedAt: item.publishedAt,
            socialConnectionId: account.connectionId,
            viewCount: item.metrics.views,
          }]
        : [],
    );
  });
  const results = await mapWithConcurrency(observations, 8, async (observation) => {
    const { data, error } = await getClient().rpc(
      "record_wall_text_performance_observation_v1",
      {
        p_observed_at: observation.observedAt,
        p_platform: "instagram",
        p_platform_post_id: observation.platformPostId,
        p_published_at: observation.publishedAt,
        p_social_connection_id: observation.socialConnectionId,
        p_user_id: params.userId,
        p_view_count: observation.viewCount,
      },
    );
    if (error) {
      throw new Error(`Could not record Wall performance: ${error.message}`);
    }
    return data?.[0] ?? { evaluated: false, recorded: false };
  });
  return {
    evaluatedWallPosts: results.filter((result) => result.evaluated).length,
    matchedWallPosts: results.filter((result) => result.recorded).length,
    observedWallPosts: results.length,
  };
}

function getClient() {
  if (client) return client;
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Wall performance storage is not configured.");
  client = createClient<WallPerformanceDatabase>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
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
      const index = nextIndex++;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, worker),
  );
  return results;
}
