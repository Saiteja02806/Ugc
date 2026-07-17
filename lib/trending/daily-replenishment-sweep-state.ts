import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DailyCarouselReplenishmentSweepStatus = "active" | "completed";

type DailyCarouselReplenishmentSweepStateRow = {
  cursor: string | null;
  cycle_id: string;
  status: DailyCarouselReplenishmentSweepStatus;
};

type DailyCarouselReplenishmentSweepDatabase = {
  public: {
    Functions: {
      advance_daily_carousel_replenishment_cycle: {
        Args: {
          p_completed: boolean;
          p_cycle_id: string;
          p_expected_cursor: string | null;
          p_next_cursor: string | null;
        };
        Returns: DailyCarouselReplenishmentSweepStateRow[];
      };
      claim_daily_carousel_replenishment_cycle: {
        Args: {
          p_requested_cycle_id: string;
        };
        Returns: DailyCarouselReplenishmentSweepStateRow[];
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

export type DailyCarouselReplenishmentSweepState = {
  cursor: string | null;
  cycleId: string;
  status: DailyCarouselReplenishmentSweepStatus;
};

let sweepStateSupabaseClient:
  | SupabaseClient<DailyCarouselReplenishmentSweepDatabase>
  | null = null;

export async function claimDailyCarouselReplenishmentCycle(
  requestedCycleId: string,
) {
  const { data, error } = await getClient().rpc(
    "claim_daily_carousel_replenishment_cycle",
    { p_requested_cycle_id: requestedCycleId },
  );

  if (error) {
    throw new Error(
      `Could not claim the daily Carousel replenishment cycle: ${error.message}`,
    );
  }

  return mapSweepState(data?.[0]);
}

export async function advanceDailyCarouselReplenishmentCycle(params: {
  completed: boolean;
  cycleId: string;
  expectedCursor: string | null;
  nextCursor: string | null;
}) {
  const { data, error } = await getClient().rpc(
    "advance_daily_carousel_replenishment_cycle",
    {
      p_completed: params.completed,
      p_cycle_id: params.cycleId,
      p_expected_cursor: params.expectedCursor,
      p_next_cursor: params.nextCursor,
    },
  );

  if (error) {
    throw new Error(
      `Could not advance the daily Carousel replenishment cycle: ${error.message}`,
    );
  }

  return mapSweepState(data?.[0]);
}

function mapSweepState(
  row: DailyCarouselReplenishmentSweepStateRow | undefined,
): DailyCarouselReplenishmentSweepState {
  if (
    !row ||
    !row.cycle_id ||
    (row.status !== "active" && row.status !== "completed")
  ) {
    throw new Error(
      "Daily Carousel replenishment returned an invalid sweep checkpoint.",
    );
  }

  return {
    cursor: row.cursor,
    cycleId: row.cycle_id,
    status: row.status,
  };
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Daily Carousel replenishment sweep storage is not configured.",
    );
  }

  if (!sweepStateSupabaseClient) {
    sweepStateSupabaseClient =
      createClient<DailyCarouselReplenishmentSweepDatabase>(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
  }

  return sweepStateSupabaseClient;
}
