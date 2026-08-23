import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_TRENDING_CONTENT_MIX,
  type TrendingContentMix,
  validateTrendingContentMix,
} from "@/lib/trending/content-mix";
import type { TrendingFeedFormat } from "@/lib/trending/feed-items";

const CONTENT_MIX_TABLE = "trending_content_mix_preferences";
const DAILY_FEEDS_TABLE = "daily_trending_feeds";
const DAILY_SLOTS_TABLE = "daily_trending_feed_slots";
const ENTITLEMENTS_TABLE = "subscription_entitlements";
const USER_PLANS_TABLE = "user_subscription_plans";

export type TrendingPlanEntitlement = {
  dailyLimit: number;
  displayName: "Free" | "Growth" | "Starter";
  planKey: "creator" | "free" | "pro" | "ultra_pro";
};

export type TrendingContentMixPreference = {
  mix: TrendingContentMix;
  preferenceVersion: number;
  updatedAt: string | null;
};

export type DailyTrendingFeedRecord = {
  businessProfileId: string;
  businessProfileVersion: number;
  createdAt: string;
  dailyLimit: number;
  id: string;
  localDate: string;
  mix: TrendingContentMix;
  planDisplayName: string;
  planKey: string;
  preferenceVersion: number;
  status: "completed" | "failed" | "preparing" | "ready";
  timezone: string;
  updatedAt: string;
  userId: string;
};

export type DailyTrendingFeedSlotRecord = {
  assignmentId: string | null;
  feedId: string;
  format: TrendingFeedFormat;
  id: string;
  position: number;
  source: "carried" | "new";
  state: "decided" | "failed" | "planned" | "preparing" | "ready";
};

type DailyFeedRow = {
  business_profile_id: string;
  business_profile_version: number;
  carousel_percent: number;
  created_at: string;
  daily_limit: number;
  hook_video_percent: number;
  id: string;
  local_date: string;
  plan_display_name: string;
  plan_key: string;
  preference_version: number;
  status: DailyTrendingFeedRecord["status"];
  timezone: string;
  updated_at: string;
  user_id: string;
  wall_text_percent: number;
};

type DailySlotRow = {
  carousel_assignment_id: string | null;
  feed_id: string;
  format: TrendingFeedFormat;
  hook_video_assignment_id: string | null;
  id: string;
  position: number;
  source: "carried" | "new";
  state: DailyTrendingFeedSlotRecord["state"];
  wall_text_assignment_id: string | null;
};

let client: SupabaseClient | null = null;

export function getMissingUnifiedTrendingFeedEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function getTrendingPlanEntitlement(
  userId: string,
): Promise<TrendingPlanEntitlement> {
  const { data: activePlan, error: planError } = await getClient()
    .from(USER_PLANS_TABLE)
    .select("plan_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    throw new Error(`Could not load the active Trending plan: ${planError.message}`);
  }

  const requestedPlanKey = normalizePlanKey(
    activePlan?.plan_key ?? "free",
  );
  const { data: entitlement, error: entitlementError } = await getClient()
    .from(ENTITLEMENTS_TABLE)
    .select("daily_trending_limit,display_name,plan_key")
    .eq("plan_key", requestedPlanKey)
    .maybeSingle();

  if (entitlementError) {
    throw new Error(
      `Could not load the Trending plan allowance: ${entitlementError.message}`,
    );
  }

  const fallback = getFallbackEntitlement(requestedPlanKey);

  return {
    dailyLimit:
      requestedPlanKey === "free"
        ? fallback.dailyLimit
        : typeof entitlement?.daily_trending_limit === "number" &&
            entitlement.daily_trending_limit > 0
        ? Math.trunc(entitlement.daily_trending_limit)
        : fallback.dailyLimit,
    displayName: fallback.displayName,
    planKey: requestedPlanKey,
  };
}

export async function getTrendingContentMixPreference(
  userId: string,
): Promise<TrendingContentMixPreference> {
  const { data, error } = await getClient()
    .from(CONTENT_MIX_TABLE)
    .select("carousel_percent,hook_video_percent,preference_version,updated_at,wall_text_percent")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the Trending content mix: ${error.message}`);
  }

  if (!data) {
    return {
      mix: { ...DEFAULT_TRENDING_CONTENT_MIX },
      preferenceVersion: 1,
      updatedAt: null,
    };
  }

  const mix: TrendingContentMix = {
    carousel: data.carousel_percent,
    hook_video: data.hook_video_percent,
    wall_text: data.wall_text_percent,
  };

  if (!validateTrendingContentMix(mix)) {
    throw new Error("The saved Trending content mix is invalid.");
  }

  return {
    mix,
    preferenceVersion: data.preference_version,
    updatedAt: data.updated_at,
  };
}

export async function saveTrendingContentMixPreference(params: {
  mix: TrendingContentMix;
  userId: string;
}) {
  if (!validateTrendingContentMix(params.mix)) {
    throw new Error("The Trending content mix must total 100% and respect format limits.");
  }

  const { data, error } = await getClient().rpc(
    "save_trending_content_mix_preference",
    {
      p_carousel_percent: params.mix.carousel,
      p_hook_video_percent: params.mix.hook_video,
      p_user_id: params.userId,
      p_wall_text_percent: params.mix.wall_text,
    },
  );

  if (error || typeof data !== "number") {
    throw new Error(
      `Could not save the Trending content mix: ${error?.message ?? "No preference version was returned."}`,
    );
  }

  return {
    mix: params.mix,
    preferenceVersion: data,
    updatedAt: new Date().toISOString(),
  } satisfies TrendingContentMixPreference;
}

export async function ensureDailyTrendingFeedPlan(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  entitlement: TrendingPlanEntitlement;
  formats: TrendingFeedFormat[];
  localDate: string;
  preference: TrendingContentMixPreference;
  timezone: string;
  userId: string;
}) {
  const { data: feedId, error } = await getClient().rpc(
    "ensure_daily_trending_feed_plan",
    {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_carousel_percent: params.preference.mix.carousel,
      p_daily_limit: params.entitlement.dailyLimit,
      p_formats: params.formats,
      p_hook_video_percent: params.preference.mix.hook_video,
      p_local_date: params.localDate,
      p_plan_display_name: params.entitlement.displayName,
      p_plan_key: params.entitlement.planKey,
      p_preference_version: params.preference.preferenceVersion,
      p_timezone: params.timezone,
      p_user_id: params.userId,
      p_wall_text_percent: params.preference.mix.wall_text,
    },
  );

  if (error || typeof feedId !== "string") {
    throw new Error(
      `Could not reserve today's Trending feed: ${error?.message ?? "No feed ID was returned."}`,
    );
  }

  return getDailyTrendingFeed(feedId, params.userId);
}

export async function attachDailyTrendingAssignments(params: {
  carouselAssignmentIds: string[];
  feedId: string;
  hookVideoAssignmentIds: string[];
  wallTextAssignmentIds: string[];
}) {
  const { error } = await getClient().rpc(
    "attach_daily_trending_feed_assignments",
    {
      p_carousel_assignment_ids: params.carouselAssignmentIds,
      p_feed_id: params.feedId,
      p_hook_video_assignment_ids: params.hookVideoAssignmentIds,
      p_wall_text_assignment_ids: params.wallTextAssignmentIds,
    },
  );

  if (error) {
    throw new Error(`Could not attach ready Trending content: ${error.message}`);
  }
}

export async function markDailyTrendingFeedPreparationFailed(params: {
  feedId: string;
  message: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { error: feedError } = await getClient()
    .from(DAILY_FEEDS_TABLE)
    .update({
      last_error: params.message,
      status: "failed",
      updated_at: now,
    })
    .eq("id", params.feedId)
    .eq("user_id", params.userId);

  if (feedError) {
    throw new Error(
      `Could not record the failed Trending preparation: ${feedError.message}`,
    );
  }

  const { error: slotError } = await getClient()
    .from(DAILY_SLOTS_TABLE)
    .update({ state: "failed", updated_at: now })
    .eq("feed_id", params.feedId)
    .in("state", ["planned", "preparing"])
    .is("carousel_assignment_id", null)
    .is("hook_video_assignment_id", null)
    .is("wall_text_assignment_id", null);

  if (slotError) {
    throw new Error(
      `Could not record the failed Trending positions: ${slotError.message}`,
    );
  }
}

export async function getDailyTrendingFeed(feedId: string, userId: string) {
  const [feedResult, slotResult] = await Promise.all([
    getClient()
      .from(DAILY_FEEDS_TABLE)
      .select("*")
      .eq("id", feedId)
      .eq("user_id", userId)
      .single(),
    getClient()
      .from(DAILY_SLOTS_TABLE)
      .select("*")
      .eq("feed_id", feedId)
      .order("position", { ascending: true }),
  ]);

  if (feedResult.error) {
    throw new Error(`Could not load today's Trending feed: ${feedResult.error.message}`);
  }

  if (slotResult.error) {
    throw new Error(`Could not load today's Trending positions: ${slotResult.error.message}`);
  }

  return {
    feed: mapFeed(feedResult.data as DailyFeedRow),
    slots: (slotResult.data as DailySlotRow[]).map(mapSlot),
  };
}

export async function getDailyTrendingFeedForDate(params: {
  localDate: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(DAILY_FEEDS_TABLE)
    .select("id")
    .eq("user_id", params.userId)
    .eq("local_date", params.localDate)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not find today's Trending feed: ${error.message}`);
  }

  return data?.id
    ? getDailyTrendingFeed(data.id, params.userId)
    : null;
}

export async function replanDailyTrendingUnboundSlots(params: {
  feedId: string;
  formats: TrendingFeedFormat[];
  mix: TrendingContentMix;
  positions: number[];
  preferenceVersion: number;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "replan_daily_trending_unbound_slots",
    {
      p_carousel_percent: params.mix.carousel,
      p_feed_id: params.feedId,
      p_formats: params.formats,
      p_hook_video_percent: params.mix.hook_video,
      p_positions: params.positions,
      p_preference_version: params.preferenceVersion,
      p_user_id: params.userId,
      p_wall_text_percent: params.mix.wall_text,
    },
  );

  if (error) {
    throw new Error(`Could not update today's unfilled content mix: ${error.message}`);
  }

  return typeof data === "number" ? data : 0;
}

export async function markDailyTrendingSlotDecided(params: {
  assignmentId: string;
  format: TrendingFeedFormat;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "mark_daily_trending_feed_slot_decided",
    {
      p_assignment_id: params.assignmentId,
      p_format: params.format,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(`Could not finish the daily Trending position: ${error.message}`);
  }

  return typeof data === "string" ? data : null;
}

export function normalizeTrendingTimezone(value: string | null | undefined) {
  const timezone = value?.trim();

  if (!timezone || timezone.length > 100) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "UTC";
  }
}

export function getTrendingLocalDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day
    ? `${year}-${month}-${day}`
    : now.toISOString().slice(0, 10);
}

function normalizePlanKey(value: string): TrendingPlanEntitlement["planKey"] {
  const planKey = value.trim().toLowerCase();

  if (planKey === "creator" || planKey === "ultra_pro") {
    return planKey;
  }

  return planKey === "pro" ? "pro" : "free";
}

function getFallbackEntitlement(
  planKey: TrendingPlanEntitlement["planKey"],
): TrendingPlanEntitlement {
  if (planKey === "free") {
    return { dailyLimit: 10, displayName: "Free", planKey };
  }

  return planKey === "pro"
    ? { dailyLimit: 20, displayName: "Starter", planKey }
    : { dailyLimit: 50, displayName: "Growth", planKey };
}

function mapFeed(row: DailyFeedRow): DailyTrendingFeedRecord {
  return {
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    createdAt: row.created_at,
    dailyLimit: row.daily_limit,
    id: row.id,
    localDate: row.local_date,
    mix: {
      carousel: row.carousel_percent,
      hook_video: row.hook_video_percent,
      wall_text: row.wall_text_percent,
    },
    planDisplayName: row.plan_display_name,
    planKey: row.plan_key,
    preferenceVersion: row.preference_version,
    status: row.status,
    timezone: row.timezone,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function mapSlot(row: DailySlotRow): DailyTrendingFeedSlotRecord {
  return {
    assignmentId:
      row.carousel_assignment_id ??
      row.hook_video_assignment_id ??
      row.wall_text_assignment_id,
    feedId: row.feed_id,
    format: row.format,
    id: row.id,
    position: row.position,
    source: row.source,
    state: row.state,
  };
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function getClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Unified Trending feed storage is not configured.");
  }

  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}
