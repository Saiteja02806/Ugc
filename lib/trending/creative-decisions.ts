import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { TrendingFeedFormat } from "@/lib/trending/feed-items";

export type TrendingCreativeDecision = "accepted" | "rejected";

type TrendingCreativeDecisionRow = {
  assignment_id: string;
  created_at: string;
  creative_id: string;
  decided_at: string;
  decision: TrendingCreativeDecision;
  format: TrendingFeedFormat;
  id: string;
  user_id: string;
};

type TrendingCreativeDecisionDatabase = {
  public: {
    Functions: {
      record_trending_creative_decision: {
        Args: {
          p_assignment_id: string;
          p_creative_id: string;
          p_decision: TrendingCreativeDecision;
          p_format: TrendingFeedFormat;
          p_user_id: string;
        };
        Returns: TrendingCreativeDecisionRow[];
      };
    };
    Tables: {
      trending_creative_decisions: {
        Insert: Partial<TrendingCreativeDecisionRow> &
          Pick<
            TrendingCreativeDecisionRow,
            | "assignment_id"
            | "creative_id"
            | "decision"
            | "format"
            | "user_id"
          >;
        Relationships: [];
        Row: TrendingCreativeDecisionRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

let trendingDecisionClient: SupabaseClient<TrendingCreativeDecisionDatabase> | null =
  null;

export function getMissingTrendingDecisionEnvVars() {
  return [
    !process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : null,
    !process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : null,
  ].filter((value): value is string => Boolean(value));
}

export async function recordTrendingCreativeDecision(params: {
  assignmentId: string;
  creativeId: string;
  decision: TrendingCreativeDecision;
  format: TrendingFeedFormat;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "record_trending_creative_decision",
    {
      p_assignment_id: params.assignmentId,
      p_creative_id: params.creativeId,
      p_decision: params.decision,
      p_format: params.format,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(`Could not save the Trending decision: ${error.message}`);
  }

  const row = data?.[0];

  if (!row) {
    throw new Error("The Trending decision was not saved.");
  }

  return {
    assignmentId: row.assignment_id,
    creativeId: row.creative_id,
    decidedAt: row.decided_at,
    decision: row.decision,
    format: row.format,
    id: row.id,
    userId: row.user_id,
  };
}

function getClient() {
  if (trendingDecisionClient) {
    return trendingDecisionClient;
  }

  const missing = getMissingTrendingDecisionEnvVars();

  if (missing.length > 0) {
    throw new Error(
      `Missing Trending decision environment variables: ${missing.join(", ")}`,
    );
  }

  trendingDecisionClient = createClient<TrendingCreativeDecisionDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return trendingDecisionClient;
}
