import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_TRIAL_CONTENT_DAYS,
  FREE_TRIAL_DAILY_CONTENT_PIECES,
  FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT,
  getFreeTrialDaysRemaining,
  resolveFreeTrialStatus,
  type FreeTrialStatus,
} from "@/lib/billing/free-trial-policy";

export {
  FREE_TRIAL_CONTENT_DAYS,
  FREE_TRIAL_DAILY_CONTENT_PIECES,
  FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT,
} from "@/lib/billing/free-trial-policy";
export type { FreeTrialStatus } from "@/lib/billing/free-trial-policy";

const FREE_TRIAL_ENTITLEMENTS_TABLE = "free_trial_entitlements";
const FREE_TRIAL_SCHEDULE_USAGE_TABLE = "free_trial_instagram_schedule_usage";
const DAILY_TRENDING_FEEDS_TABLE = "daily_trending_feeds";

export type FreeTrialEntitlement = {
  contentDaysLimit: number;
  contentDaysRemaining: number;
  contentDaysUsed: number;
  dailyContentPieces: number;
  daysRemaining: number;
  expiresAt: string | null;
  instagramSchedulesLimit: number;
  instagramSchedulesRemaining: number;
  instagramSchedulesUsed: number;
  startedAt: string | null;
  status: FreeTrialStatus;
};

export class FreeTrialAccessError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "free_trial_content_expired"
      | "free_trial_content_days_exhausted"
      | "free_trial_schedule_expired"
      | "free_trial_schedule_limit_reached",
  ) {
    super(message);
    this.name = "FreeTrialAccessError";
  }

  get status() {
    return 402;
  }
}

let client: SupabaseClient | null = null;

export async function getFreeTrialEntitlement(
  userId: string,
): Promise<FreeTrialEntitlement> {
  if (!userId.trim()) {
    return unavailableFreeTrialEntitlement();
  }

  const db = getClient();
  const [trialResult, usageResult] = await Promise.all([
    db
      .from(FREE_TRIAL_ENTITLEMENTS_TABLE)
      .select(
        "content_days_limit,daily_content_pieces,expires_at,instagram_schedule_limit,started_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from(FREE_TRIAL_SCHEDULE_USAGE_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (trialResult.error) {
    throw new Error(`Could not load free trial access: ${trialResult.error.message}`);
  }

  if (usageResult.error) {
    throw new Error(
      `Could not load free trial schedule usage: ${usageResult.error.message}`,
    );
  }

  const trial = trialResult.data;
  const contentDaysUsed = trial?.started_at
    ? await getContentDaysUsed({
        startedAt: trial.started_at,
        userId,
      })
    : 0;
  const status = resolveFreeTrialStatus({
    expiresAt: trial?.expires_at,
    startedAt: trial?.started_at,
  });
  const contentDaysLimit = positiveInteger(
    trial?.content_days_limit,
    FREE_TRIAL_CONTENT_DAYS,
  );
  const contentDaysRemaining =
    status === "active" ? Math.max(contentDaysLimit - contentDaysUsed, 0) : 0;
  const usage = Math.max(0, usageResult.count ?? 0);
  const scheduleLimit = positiveInteger(
    trial?.instagram_schedule_limit,
    FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT,
  );

  return {
    contentDaysLimit,
    contentDaysRemaining,
    contentDaysUsed,
    dailyContentPieces:
      contentDaysRemaining > 0
        ? positiveInteger(
            trial?.daily_content_pieces,
            FREE_TRIAL_DAILY_CONTENT_PIECES,
          )
        : 0,
    daysRemaining:
      status === "active"
        ? getFreeTrialDaysRemaining({ expiresAt: trial?.expires_at })
        : 0,
    expiresAt: trial?.expires_at ?? null,
    instagramSchedulesLimit: scheduleLimit,
    instagramSchedulesRemaining:
      status === "active" ? Math.max(scheduleLimit - usage, 0) : 0,
    instagramSchedulesUsed: usage,
    startedAt: trial?.started_at ?? null,
    status,
  };
}

export async function assertFreeTrialContentAccess(userId: string) {
  const activeSubscription = await getActivePaidSubscription(userId);

  if (activeSubscription) {
    return {
      paid: true as const,
      planKey:
        activeSubscription.planKey === "growth" ? "growth" : "starter",
      trial: null,
    };
  }

  const trial = await getFreeTrialEntitlement(userId);

  if (trial.status !== "active") {
    throw new FreeTrialAccessError(
      "Your 3-day free trial has ended. Upgrade to generate more content.",
      "free_trial_content_expired",
    );
  }

  if (trial.contentDaysRemaining <= 0) {
    throw new FreeTrialAccessError(
      "Your 3-day free trial content allowance has been used. Upgrade to generate more content.",
      "free_trial_content_days_exhausted",
    );
  }

  return { paid: false as const, planKey: null, trial };
}

export async function assertFreeTrialInstagramSchedulingAccess(userId: string) {
  if (await getActivePaidSubscription(userId)) {
    return;
  }

  const trial = await getFreeTrialEntitlement(userId);

  if (trial.status !== "active") {
    throw new FreeTrialAccessError(
      "Your 3-day free trial has ended. Upgrade to schedule another Instagram post.",
      "free_trial_schedule_expired",
    );
  }

  if (trial.instagramSchedulesRemaining <= 0) {
    throw new FreeTrialAccessError(
      "Your free trial allows up to 5 Instagram posts in total, including future dates. Upgrade to schedule more.",
      "free_trial_schedule_limit_reached",
    );
  }
}

export function unavailableFreeTrialEntitlement(): FreeTrialEntitlement {
  return {
    contentDaysLimit: FREE_TRIAL_CONTENT_DAYS,
    contentDaysRemaining: 0,
    contentDaysUsed: 0,
    dailyContentPieces: 0,
    daysRemaining: 0,
    expiresAt: null,
    instagramSchedulesLimit: FREE_TRIAL_INSTAGRAM_SCHEDULE_LIMIT,
    instagramSchedulesRemaining: 0,
    instagramSchedulesUsed: 0,
    startedAt: null,
    status: "unavailable",
  };
}

function getClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase is not configured for free-trial access.");
  }

  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

async function getActivePaidSubscription(userId: string) {
  const { data, error } = await getClient()
    .from("billing_subscriptions")
    .select("plan_key")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load subscription access: ${error.message}`);
  }

  return data
    ? {
        planKey:
          data.plan_key === "growth" ? ("growth" as const) : ("starter" as const),
      }
    : null;
}

async function getContentDaysUsed(params: {
  startedAt: string;
  userId: string;
}) {
  const { count, error } = await getClient()
    .from(DAILY_TRENDING_FEEDS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .gte("created_at", params.startedAt);

  if (error) {
    throw new Error(`Could not load free trial content usage: ${error.message}`);
  }

  return Math.max(0, count ?? 0);
}

function positiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}
