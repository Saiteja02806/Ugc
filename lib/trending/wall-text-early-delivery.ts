import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfileForUser, type BusinessProfileRecord } from "@/lib/business-profiles/db";
import { FreeTrialAccessError } from "@/lib/billing/free-trial";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getBackgroundJobById } from "@/lib/jobs/background-jobs";
import { ensureWallTextContentPlanGeneration } from "@/lib/trending/wall-text-content-plan-generation-job";
import { enqueueTrendingWallTextRefill, getTrendingWallTextFeedProvider } from "@/lib/trending/trending-wall-text-feed";
import {
  attachDailyTrendingAssignments,
  getDailyTrendingFeed,
  getDailyTrendingFeedForDate,
  getTrendingLocalDate,
  getTrendingPlanEntitlement,
} from "@/lib/trending/unified-daily-feed-db";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";
import { WALL_TEXT_FINAL_LAYOUT_VERSION, WALL_TEXT_GENERATOR_VERSION } from "@/lib/trending/wall-text-types";

type Publication = {
  id: string;
  plan_id: string;
  user_id: string;
  claim_token: string;
  item_count: number;
};
type Admission = { kind: "disabled" | "planning" | "ready" } | { kind: "job"; jobId: string };
let client: SupabaseClient | undefined;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Wall-of-text early delivery storage is not configured.");
  return client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function admitWallTextDailyDelivery(params: {
  dailyFeedId: string;
  planId: string;
  profile: BusinessProfileRecord;
  requestedCount: number;
}) {
  const { data, error } = await getClient().rpc("admit_wall_text_daily_delivery", {
    p_business_profile_id: params.profile.id,
    p_business_profile_version: params.profile.profileVersion,
    p_feed_id: params.dailyFeedId,
    p_generator_version: WALL_TEXT_GENERATOR_VERSION,
    p_layout_version: WALL_TEXT_FINAL_LAYOUT_VERSION,
    p_plan_id: params.planId,
    p_requested_count: params.requestedCount,
    p_user_id: params.profile.userId,
  });
  if (error) throw new Error(`Could not admit Wall-of-text daily delivery: ${error.message}`);
  const result = data as Admission;
  if (result.kind !== "job") return result;
  const job = await getBackgroundJobById(result.jobId);
  if (!job || job.userId !== params.profile.userId) throw new Error("Wall-of-text delivery job was not found.");
  return { kind: "job" as const, job: await dispatchQueuedBackgroundJobForRecovery(job) };
}

/** The same durable event is handled here from the worker and the recovery scan. */
export async function reconcileWallTextPlanPublications(params: { planId?: string; limit?: number } = {}) {
  const { data, error } = await getClient().rpc("claim_wall_text_plan_publications", {
    p_limit: params.limit ?? 10,
    p_plan_id: params.planId ?? null,
  });
  if (error) throw new Error(`Could not claim Wall-of-text publications: ${error.message}`);
  const results = [];
  for (const event of (data ?? []) as Publication[]) {
    let failure: string | null = null;
    try {
      await reconcilePublication(event);
    } catch (error) {
      failure = error instanceof Error ? error.message : "Wall-of-text publication reconciliation failed.";
    }
    const { data: acknowledged, error: finishError } = await getClient().rpc("finish_wall_text_plan_publication", {
      p_id: event.id, p_claim_token: event.claim_token, p_error: failure,
    });
    if (finishError) throw new Error(`Could not acknowledge Wall-of-text publication: ${finishError.message}`);
    results.push({ publicationId: event.id, itemCount: event.item_count, acknowledged, error: failure });
  }
  return results;
}

async function reconcilePublication(event: Publication) {
  if (!isWallTextEnabled()) return;
  const { data: plan, error } = await getClient().from("wall_text_content_plans")
    .select("business_profile_id,business_profile_version,status")
    .eq("id", event.plan_id).eq("user_id", event.user_id).maybeSingle();
  if (error) throw new Error(`Could not load published Wall plan: ${error.message}`);
  const profile = await getBusinessProfileForUser(event.user_id);
  if (!plan || plan.status === "superseded" || !profile?.trendingTimezone ||
    profile.id !== plan.business_profile_id || profile.profileVersion !== plan.business_profile_version) return;
  try {
    await getTrendingPlanEntitlement(event.user_id);
  } catch (error) {
    if (error instanceof FreeTrialAccessError) return;
    throw error;
  }
  const existing = await getDailyTrendingFeedForDate({
    localDate: getTrendingLocalDate(profile.trendingTimezone), userId: event.user_id,
  });
  if (!existing || existing.feed.businessProfileId !== profile.id ||
    existing.feed.businessProfileVersion !== profile.profileVersion) return;
  const wallSlots = existing.slots.filter(slot => slot.format === "wall_text");
  if (!wallSlots.some(slot => slot.state !== "decided" && !slot.assignmentId)) return;
  const provider = await getTrendingWallTextFeedProvider(profile, {
    pinnedAssignmentIds: wallSlots.flatMap(slot => slot.assignmentId ? [slot.assignmentId] : []),
  });
  await attachDailyTrendingAssignments({
    feedId: existing.feed.id, carouselAssignmentIds: [], hookVideoAssignmentIds: [],
    reactionAssignmentIds: [], wallTextAssignmentIds: provider.items.map(item => item.assignmentId),
  });
  const current = await getDailyTrendingFeed(existing.feed.id, event.user_id);
  const missing = current.slots.filter(slot => slot.format === "wall_text" &&
    slot.state !== "decided" && !slot.assignmentId).length;
  if (missing === 0) return;
  await enqueueTrendingWallTextRefill(profile, {
    dailyFeedId: current.feed.id,
    recoveryKey: current.feed.wallTextRetryKey ?? current.feed.id,
    targetActive: provider.items.length + missing,
  });
}

export async function resumeIncompleteWallTextPlans(limit = 10) {
  const { data, error } = await getClient().rpc("list_wall_text_plans_needing_resume", { p_limit: limit });
  if (error) throw new Error(`Could not list incomplete Wall-of-text plans: ${error.message}`);
  const results = [];
  for (const row of data ?? []) {
    try {
      const profile = await getBusinessProfileForUser(row.user_id);
      if (!profile || profile.id !== row.business_profile_id || profile.profileVersion !== row.business_profile_version) continue;
      const plan = await ensureWallTextContentPlanGeneration({ profile });
      results.push({ planId: plan.id, status: plan.status, generationAttempt: plan.generationAttempt });
    } catch (error) {
      results.push({ planId: row.plan_id, error: error instanceof Error ? error.message : "Plan resume failed." });
    }
  }
  return results;
}
