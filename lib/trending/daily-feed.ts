import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  updateBusinessProfileTrendingTimezone,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import {
  getAutoCarouselGenerationStatusPageForUser,
  getCarouselGenerationsByBatchId,
  getCarouselGenerationStatusesByIds,
  type AutoCarouselGenerationStatusPageCursor,
  type CarouselGenerationRecord,
  type CarouselSlideRecord,
  type Json,
} from "@/lib/carousel/db";
import {
  enqueueProcessingCarouselCandidates,
  prepareDailyBusinessProfileCarousels,
} from "@/lib/carousel/prepare-business-profile";
import { shouldDeliverCarouselJobMessage } from "@/lib/jobs/background-job-delivery-logic";
import { getBackgroundJobsByIds } from "@/lib/jobs/background-jobs";
import {
  createVisibleCarouselConceptFingerprint,
  isVisibleCarouselConceptFingerprint,
} from "@/lib/trending/carousel-concept-fingerprint";
import {
  getReadySlidesForCurrentStorage,
  isCompleteReadyCarouselForCurrentStorage,
} from "@/lib/trending/carousel-storage-readiness";
import {
  getDailyFeedTopUpPlan,
  getOrCreatePersistedDailyFeed,
  getTrendingDailyFeedState,
  partitionRuntimeSafeAssignments,
  type TrendingDailyFeedState,
} from "@/lib/trending/daily-feed-logic";
import {
  canExtendDailyCarouselRefill,
  getDailyCarouselRefillPlan,
  selectAssignableDailyCarouselCandidates,
} from "@/lib/trending/daily-replenishment-logic";
import type {
  TrendingCarouselSourceRecord,
  TrendingFeedItemSource,
} from "@/lib/trending/feed-items";

const SUBSCRIPTION_ENTITLEMENTS_TABLE = "subscription_entitlements";
const USER_SUBSCRIPTION_PLANS_TABLE = "user_subscription_plans";
const USER_CAROUSEL_ASSIGNMENTS_TABLE = "user_carousel_assignments";
const DAILY_CAROUSEL_FEEDS_TABLE = "daily_carousel_feeds";
const DAILY_CAROUSEL_FEED_ITEMS_TABLE = "daily_carousel_feed_items";
const DAILY_CAROUSEL_REFILL_BATCHES_TABLE = "daily_carousel_refill_batches";

const DEFAULT_PLAN_KEY = "pro";
const FALLBACK_TIMEZONE = "UTC";
const CAROUSEL_INVENTORY_PAGE_SIZE = 50;

const ACTIVE_ASSIGNMENT_STATES = ["pending", "in_progress"] as const;

type AssignmentState =
  | "accepted"
  | "completed_saved"
  | "completed_scheduled"
  | "completed_skipped"
  | "failed"
  | "in_progress"
  | "pending";
type CompletionAction = "accepted" | "saved" | "scheduled" | "skipped";
export type TrendingFeedCompletionAction = Exclude<
  CompletionAction,
  "accepted"
>;
type SubscriptionEntitlementRow = {
  created_at: string;
  daily_carousel_limit: number;
  display_name: string;
  is_active: boolean;
  plan_key: string;
  updated_at: string;
};

type UserSubscriptionPlanRow = {
  created_at: string;
  id: string;
  is_active: boolean;
  plan_key: string;
  source: "billing" | "manual" | "system";
  updated_at: string;
  user_id: string;
};

type UserCarouselAssignmentRow = {
  business_profile_id: string | null;
  business_profile_version: number | null;
  carousel_id: string;
  completed_at: string | null;
  completion_action: CompletionAction | null;
  concept_fingerprint: string | null;
  created_at: string;
  first_assigned_at: string;
  first_assigned_local_date: string | null;
  first_shown_at: string | null;
  id: string;
  last_assigned_local_date: string | null;
  project_id: string;
  state: AssignmentState;
  updated_at: string;
  user_id: string;
};

type DailyCarouselFeedRow = {
  created_at: string;
  daily_limit: number;
  id: string;
  local_date: string;
  plan_key: string;
  status: "failed" | "preparing" | "ready";
  timezone: string;
  updated_at: string;
  user_id: string;
};

type DailyCarouselFeedItemRow = {
  assignment_id: string;
  carried_from_date: string | null;
  created_at: string;
  feed_id: string;
  id: string;
  position: number;
  source: TrendingFeedItemSource;
};

type DailyCarouselRefillBatchRow = {
  business_profile_id: string;
  business_profile_version: number;
  created_at: string;
  feed_id: string;
  generation_batch_id: string;
  id: string;
  local_date: string;
  requested_count: number;
  updated_at: string;
  user_id: string;
};

type UserCarouselAssignmentInsert = Partial<UserCarouselAssignmentRow> &
  Pick<
    UserCarouselAssignmentRow,
    | "carousel_id"
    | "first_assigned_local_date"
    | "last_assigned_local_date"
    | "project_id"
    | "state"
    | "user_id"
  >;

type DailyCarouselFeedInsert = Pick<
  DailyCarouselFeedRow,
  "daily_limit" | "local_date" | "plan_key" | "status" | "timezone" | "user_id"
>;

type DailyCarouselFeedItemInsert = Pick<
  DailyCarouselFeedItemRow,
  "assignment_id" | "carried_from_date" | "feed_id" | "position" | "source"
>;

type DailyCarouselRefillBatchInsert = Pick<
  DailyCarouselRefillBatchRow,
  | "business_profile_id"
  | "business_profile_version"
  | "feed_id"
  | "generation_batch_id"
  | "local_date"
  | "requested_count"
  | "user_id"
>;

type TrendingFeedDatabase = {
  public: {
    Functions: {
      assert_business_profile_version_current: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_user_id: string;
        };
        Returns: null;
      };
      insert_daily_carousel_feed_items_if_profile_current: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_items: Json;
          p_user_id: string;
        };
        Returns: DailyCarouselFeedItemRow[];
      };
      reserve_daily_carousel_refill_batch_if_profile_current: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_feed_id: string;
          p_requested_count: number;
          p_user_id: string;
        };
        Returns: DailyCarouselRefillBatchRow;
      };
    };
    Tables: {
      daily_carousel_feed_items: {
        Insert: DailyCarouselFeedItemInsert;
        Relationships: [];
        Row: DailyCarouselFeedItemRow;
        Update: Partial<DailyCarouselFeedItemRow>;
      };
      daily_carousel_feeds: {
        Insert: DailyCarouselFeedInsert;
        Relationships: [];
        Row: DailyCarouselFeedRow;
        Update: Partial<DailyCarouselFeedRow>;
      };
      daily_carousel_refill_batches: {
        Insert: DailyCarouselRefillBatchInsert;
        Relationships: [];
        Row: DailyCarouselRefillBatchRow;
        Update: Partial<DailyCarouselRefillBatchRow>;
      };
      subscription_entitlements: {
        Insert: Partial<SubscriptionEntitlementRow> &
          Pick<
            SubscriptionEntitlementRow,
            "daily_carousel_limit" | "display_name" | "plan_key"
          >;
        Relationships: [];
        Row: SubscriptionEntitlementRow;
        Update: Partial<SubscriptionEntitlementRow>;
      };
      user_carousel_assignments: {
        Insert: UserCarouselAssignmentInsert;
        Relationships: [];
        Row: UserCarouselAssignmentRow;
        Update: Partial<UserCarouselAssignmentRow>;
      };
      user_subscription_plans: {
        Insert: Partial<UserSubscriptionPlanRow> &
          Pick<UserSubscriptionPlanRow, "plan_key" | "user_id">;
        Relationships: [];
        Row: UserSubscriptionPlanRow;
        Update: Partial<UserSubscriptionPlanRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type TrendingFeedEntitlement = {
  dailyCarouselLimit: number;
  planKey: string;
};

export type TrendingFeedProfile = {
  error?: string | null;
  id?: string;
  state: "failed" | "missing" | "preparing" | "ready";
};

export type TrendingFeedCarousel = TrendingCarouselSourceRecord;

export type TrendingDailyFeed = {
  carousels: TrendingFeedCarousel[];
  entitlement: TrendingFeedEntitlement;
  feed: {
    assignedCount: number;
    id: string;
    localDate: string;
    pendingSlotCount: number;
    state: TrendingDailyFeedState;
    timezone: string;
  };
};

let trendingFeedSupabaseClient:
  | SupabaseClient<TrendingFeedDatabase>
  | null = null;

export function getMissingTrendingFeedEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function ensureTrendingDailyFeed(params: {
  dailyLimitOverride?: number;
  markItemsShown?: boolean;
  profile: BusinessProfileRecord;
  throwOnRefillError?: boolean;
  timezone?: string | null;
  userId: string;
}): Promise<TrendingDailyFeed> {
  const timezone = normalizeTimezone(params.timezone);

  if (params.profile.trendingTimezone !== timezone) {
    await updateBusinessProfileTrendingTimezone({
      profileId: params.profile.id,
      timezone,
    });
  }

  const localDate = getLocalDateForTimezone(timezone);
  const currentEntitlement = await getTrendingFeedEntitlement(params.userId);
  const requestedDailyLimit = params.dailyLimitOverride === undefined
    ? currentEntitlement.dailyCarouselLimit
    : Math.max(Math.trunc(params.dailyLimitOverride), 1);
  const requestedEntitlement = {
    ...currentEntitlement,
    dailyCarouselLimit: requestedDailyLimit,
  };
  let feed = await getOrCreateDailyFeed({
    entitlement: requestedEntitlement,
    localDate,
    timezone,
    userId: params.userId,
  });

  // The legacy Carousel feed remains the inventory source for unified daily
  // positions. An existing row may have been snapshotted with the old limit of
  // 10 before a Growth mix asks for 12 or 13 Carousels. Only raise that
  // internal inventory ceiling; never lower it or replace already assigned
  // content.
  if (
    params.dailyLimitOverride !== undefined &&
    feed.daily_limit < requestedDailyLimit
  ) {
    const { data: expandedFeed, error: expandError } = await getClient()
      .from(DAILY_CAROUSEL_FEEDS_TABLE)
      .update({ daily_limit: requestedDailyLimit })
      .eq("id", feed.id)
      .lt("daily_limit", requestedDailyLimit)
      .select("*")
      .maybeSingle();

    if (expandError) {
      throw new Error(
        `Could not expand today's Carousel inventory: ${expandError.message}`,
      );
    }

    if (expandedFeed) {
      feed = expandedFeed;
    }
  }
  const entitlement = {
    dailyCarouselLimit: feed.daily_limit,
    planKey: feed.plan_key,
  };
  let feedItems = await listFeedItems(feed.id);
  const topUpPlan = getDailyFeedTopUpPlan({
    dailyLimit: entitlement.dailyCarouselLimit,
    existingPositions: feedItems.map((item) => item.position),
  });

  if (topUpPlan.remainingSlotCount > 0) {
    await populateDailyFeed({
      existingFeedItems: feedItems,
      feed,
      localDate,
      profile: params.profile,
      userId: params.userId,
    });
    feedItems = await listFeedItems(feed.id);
  }

  if (feedItems.length < entitlement.dailyCarouselLimit) {
    await reconcileDailyCarouselRefill({
      feed,
      feedItems,
      localDate,
      profile: params.profile,
      userId: params.userId,
    }).catch((error) => {
      console.error("Could not reconcile daily Carousel inventory:", error);

      if (params.throwOnRefillError) {
        throw error;
      }
    });
  }

  return buildDailyFeedResponse({
    entitlement,
    feed,
    feedItems,
    markItemsShown: params.markItemsShown !== false,
    profile: params.profile,
    userId: params.userId,
  });
}

export async function completeTrendingFeedAssignment(params: {
  action: TrendingFeedCompletionAction;
  assignmentId: string;
  userId: string;
}) {
  const state = getCompletedState(params.action);
  const now = getNowIso();
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .update({
      completed_at: now,
      completion_action: params.action,
      state,
      updated_at: now,
    })
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .in(
      "state",
      params.action === "skipped"
        ? [...ACTIVE_ASSIGNMENT_STATES]
        : [...ACTIVE_ASSIGNMENT_STATES, "accepted"],
    )
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not complete Trending carousel: ${error.message}`);
  }

  if (data) {
    return mapAssignment(data);
  }

  const existing = await getAssignmentForUser({
    assignmentId: params.assignmentId,
    userId: params.userId,
  });

  if (!existing) {
    return null;
  }

  return existing;
}

async function populateDailyFeed(params: {
  existingFeedItems: DailyCarouselFeedItemRow[];
  feed: DailyCarouselFeedRow;
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const existingAssignmentIds = params.existingFeedItems.map(
    (item) => item.assignment_id,
  );

  if (existingAssignmentIds.length > 0) {
    // Repairs the only non-atomic boundary in feed population: a prior request
    // may have committed feed items and failed before advancing assignment
    // carry metadata.
    await updateAssignmentsLastAssignedDate(
      existingAssignmentIds,
      params.localDate,
    );
  }

  const topUpPlan = getDailyFeedTopUpPlan({
    dailyLimit: params.feed.daily_limit,
    existingPositions: params.existingFeedItems.map((item) => item.position),
  });

  if (topUpPlan.remainingSlotCount === 0) {
    return;
  }

  const [currentDayOrphans, carryCandidates] = await Promise.all([
    listUnpersistedCurrentDayAssignments({
      existingAssignmentIds,
      localDate: params.localDate,
      profile: params.profile,
      userId: params.userId,
    }),
    listCarryAssignments({
      localDate: params.localDate,
      profile: params.profile,
      userId: params.userId,
    }),
  ]);
  const existingAssignmentIdSet = new Set(existingAssignmentIds);
  const candidateAssignments = [
    ...currentDayOrphans,
    ...carryCandidates.filter(
      (assignment) => !existingAssignmentIdSet.has(assignment.id),
    ),
  ];
  const carryStatuses = await getCarouselGenerationStatusesByIds(
    candidateAssignments.map((assignment) => assignment.carouselId),
  );
  const runtimeSafeCarouselIds = new Set(
    carryStatuses
      .filter(isCompleteReadyCarouselForCurrentStorage)
      .map((status) => status.generation.id),
  );
  const { invalid: invalidCarries, valid: validCarries } =
    partitionRuntimeSafeAssignments({
      assignments: candidateAssignments,
      getCarouselId: (assignment) => assignment.carouselId,
      runtimeSafeCarouselIds,
    });

  await markAssignmentsFailed(
    invalidCarries.map((assignment) => assignment.id),
  );

  const orphanIds = new Set(
    currentDayOrphans.map((assignment) => assignment.id),
  );
  const recovered = validCarries
    .filter((assignment) => orphanIds.has(assignment.id))
    .slice(0, topUpPlan.remainingSlotCount);
  const carried = validCarries
    .filter((assignment) => !orphanIds.has(assignment.id))
    .slice(0, topUpPlan.remainingSlotCount - recovered.length);
  const remainingSlotCount = Math.max(
    topUpPlan.remainingSlotCount - recovered.length - carried.length,
    0,
  );
  const fresh = await createFreshAssignments({
    count: remainingSlotCount,
    localDate: params.localDate,
    profile: params.profile,
    userId: params.userId,
  });
  const selected = [
    ...recovered.map((assignment) => ({
      assignment,
      carriedFromDate: null,
      source: "new" as const,
    })),
    ...carried.map((assignment) => ({
      assignment,
      carriedFromDate: assignment.lastAssignedLocalDate,
      source: "carried" as const,
    })),
    ...fresh.map(({ assignment }) => ({
      assignment,
      carriedFromDate: null,
      source: "new" as const,
    })),
  ].slice(0, topUpPlan.remainingSlotCount);

  if (selected.length === 0) {
    return;
  }

  const feedItemRows: DailyCarouselFeedItemInsert[] = selected.map(
    ({ assignment, carriedFromDate, source }, index) => {
      const position = topUpPlan.availablePositions[index];

      if (!position) {
        throw new Error("Could not reserve a Trending feed position.");
      }

      return {
        assignment_id: assignment.id,
        carried_from_date:
          source === "carried" && carriedFromDate ? carriedFromDate : null,
        feed_id: params.feed.id,
        position,
        source,
      };
    },
  );
  const { error } = await getClient().rpc(
    "insert_daily_carousel_feed_items_if_profile_current",
    {
      p_business_profile_id: params.profile.id,
      p_business_profile_version: params.profile.profileVersion,
      p_items: feedItemRows as Json,
      p_user_id: params.userId,
    },
  );

  if (error) {
    if (isBusinessProfileVersionChangedError(error)) {
      await markAssignmentsFailed(
        fresh
          .filter(({ created }) => created)
          .map(({ assignment }) => assignment.id),
      );
      throw new Error(
        "The business profile changed while preparing this Trending feed. Refresh to use the latest profile.",
      );
    }

    if (!isUniqueViolation(error)) {
      throw new Error(`Could not create Trending feed items: ${error.message}`);
    }

    return;
  }

  await updateAssignmentsLastAssignedDate(
    selected.map(({ assignment }) => assignment.id),
    params.localDate,
  );
}

async function reconcileDailyCarouselRefill(params: {
  feed: DailyCarouselFeedRow;
  feedItems: DailyCarouselFeedItemRow[];
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  let refillBatch = await findDailyCarouselRefillBatch({
    feedId: params.feed.id,
    profile: params.profile,
  });
  let existingBatchCandidates = refillBatch
    ? await getCarouselGenerationsByBatchId(refillBatch.generation_batch_id)
    : [];
  const viableInventory = await getViableUnassignedCarouselInventory({
    localDate: params.localDate,
    minimumTotalCount: Math.max(
      params.feed.daily_limit - params.feedItems.length,
      0,
    ),
    profile: params.profile,
    userId: params.userId,
  });

  if (viableInventory.generationsNeedingDelivery.length > 0) {
    await assertBusinessProfileVersionCurrent({
      profile: params.profile,
      userId: params.userId,
    });
    await enqueueProcessingCarouselCandidates(
      viableInventory.generationsNeedingDelivery,
      params.profile,
      { throwOnFailure: true },
    );
  }

  const plan = getDailyCarouselRefillPlan({
    dailyLimit: params.feed.daily_limit,
    existingBatchCandidateCount: existingBatchCandidates.length,
    existingRequestedCount: refillBatch?.requested_count ?? 0,
    feedItemCount: params.feedItems.length,
    viableUnassignedGenerationCount: viableInventory.totalCount,
  });

  if (plan.requestedBatchCandidateCount === 0) {
    return;
  }

  const mayExtendForRepair = canExtendDailyCarouselRefill({
    currentRequestedCount: refillBatch?.requested_count ?? 0,
    hasExistingBatch: Boolean(refillBatch),
    lastUpdatedAt: refillBatch?.updated_at ?? null,
    requestedCount: plan.requestedBatchCandidateCount,
  });
  const requestedCount = mayExtendForRepair
    ? plan.requestedBatchCandidateCount
    : refillBatch?.requested_count ?? 0;

  if (requestedCount === 0) {
    return;
  }

  refillBatch = await reserveDailyCarouselRefillBatch({
    feed: params.feed,
    profile: params.profile,
    requestedCount,
    userId: params.userId,
  });
  existingBatchCandidates = await getCarouselGenerationsByBatchId(
    refillBatch.generation_batch_id,
  );

  if (
    existingBatchCandidates.length >= refillBatch.requested_count &&
    existingBatchCandidates.every(
      (generation) =>
        generation.status !== "processing" || Boolean(generation.triggerRunId),
    )
  ) {
    return;
  }

  await prepareDailyBusinessProfileCarousels({
    generationBatchId: refillBatch.generation_batch_id,
    localDate: params.localDate,
    originDailyFeedId: params.feed.id,
    profile: params.profile,
    targetCandidateCount: refillBatch.requested_count,
  });
}

async function getViableUnassignedCarouselInventory(params: {
  localDate: string;
  minimumTotalCount: number;
  profile: BusinessProfileRecord;
  requireProcessingCandidate?: boolean;
  userId: string;
}) {
  const existingAssignments = await listAllAssignmentsForUser(params.userId);
  const assignedCarouselIds = new Set(
    existingAssignments.map((assignment) => assignment.carouselId),
  );
  const reservedConceptFingerprints =
    await getExistingVisibleConceptFingerprints(existingAssignments);
  const generationsNeedingDelivery: CarouselGenerationRecord[] = [];
  let completedCount = 0;
  let cursor: AutoCarouselGenerationStatusPageCursor | null = null;
  let processingCount = 0;

  do {
    const page = await getAutoCarouselGenerationStatusPageForUser({
      availableOnOrBeforeLocalDate: params.localDate,
      businessProfileId: params.profile.id,
      businessProfileVersion: params.profile.profileVersion,
      cursor,
      limit: CAROUSEL_INVENTORY_PAGE_SIZE,
      projectId: params.profile.projectId,
      statuses:
        params.requireProcessingCandidate && params.minimumTotalCount <= 0
          ? ["processing"]
          : ["completed", "processing"],
      userId: params.userId,
    });
    const jobs = await getBackgroundJobsByIds(
      page.statuses
        .map((status) => status.generation.triggerRunId)
        .filter((jobId): jobId is string => Boolean(jobId)),
    );
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const completedStatuses = selectAssignableCompletedCarouselStatuses({
      assignedCarouselIds,
      existingConceptFingerprints: reservedConceptFingerprints,
      localDate: params.localDate,
      statuses: page.statuses,
    });

    completedCount += completedStatuses.length;
    for (const status of completedStatuses) {
      reservedConceptFingerprints.add(
        createVisibleCarouselConceptFingerprint(status.slides),
      );
    }

    const processingStatuses = page.statuses.filter((status) => {
      if (
        status.generation.status !== "processing" ||
        !status.generation.triggerRunId ||
        assignedCarouselIds.has(status.generation.id)
      ) {
        return false;
      }

      const job = jobById.get(status.generation.triggerRunId);

      return !job || job.status === "queued" || job.status === "processing";
    });

    processingCount += processingStatuses.length;
    generationsNeedingDelivery.push(
      ...processingStatuses
        .filter((status) => {
          const job = status.generation.triggerRunId
            ? jobById.get(status.generation.triggerRunId)
            : null;

          return !job || shouldDeliverCarouselJobMessage({ job });
        })
        .map((status) => status.generation),
    );

    cursor = page.nextCursor;
  } while (
    cursor &&
    (completedCount + processingCount <
      Math.max(Math.trunc(params.minimumTotalCount), 0) ||
      (params.requireProcessingCandidate && processingCount === 0))
  );

  return {
    completedCount,
    generationsNeedingDelivery,
    processingCount,
    totalCount: completedCount + processingCount,
  };
}

async function findDailyCarouselRefillBatch(params: {
  feedId: string;
  profile: BusinessProfileRecord;
}) {
  const { data, error } = await getClient()
    .from(DAILY_CAROUSEL_REFILL_BATCHES_TABLE)
    .select("*")
    .eq("feed_id", params.feedId)
    .eq("business_profile_id", params.profile.id)
    .eq("business_profile_version", params.profile.profileVersion)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load daily Carousel refill: ${error.message}`);
  }

  return data ?? null;
}

async function reserveDailyCarouselRefillBatch(params: {
  feed: DailyCarouselFeedRow;
  profile: BusinessProfileRecord;
  requestedCount: number;
  userId: string;
}): Promise<DailyCarouselRefillBatchRow> {
  const { data, error } = await getClient().rpc(
    "reserve_daily_carousel_refill_batch_if_profile_current",
    {
      p_business_profile_id: params.profile.id,
      p_business_profile_version: params.profile.profileVersion,
      p_feed_id: params.feed.id,
      p_requested_count: params.requestedCount,
      p_user_id: params.userId,
    },
  );

  if (error) {
    if (isBusinessProfileVersionChangedError(error)) {
      throw new Error(
        "The business profile changed while reserving daily Carousel refill inventory. Refresh to use the latest profile.",
      );
    }

    throw new Error(`Could not reserve daily Carousel refill: ${error.message}`);
  }

  if (!data) {
    throw new Error("Could not reserve daily Carousel refill.");
  }

  assertDailyCarouselRefillOwnership({
    feed: params.feed,
    profile: params.profile,
    refillBatch: data,
    userId: params.userId,
  });

  return data;
}

async function assertBusinessProfileVersionCurrent(params: {
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const { error } = await getClient().rpc(
    "assert_business_profile_version_current",
    {
      p_business_profile_id: params.profile.id,
      p_business_profile_version: params.profile.profileVersion,
      p_user_id: params.userId,
    },
  );

  if (!error) {
    return;
  }

  if (isBusinessProfileVersionChangedError(error)) {
    throw new Error(
      "The business profile changed while preparing daily Carousel inventory. Refresh to use the latest profile.",
    );
  }

  throw new Error(`Could not validate business profile version: ${error.message}`);
}

function assertDailyCarouselRefillOwnership(params: {
  feed: DailyCarouselFeedRow;
  profile: BusinessProfileRecord;
  refillBatch: DailyCarouselRefillBatchRow;
  userId: string;
}) {
  if (
    params.refillBatch.feed_id !== params.feed.id ||
    params.refillBatch.local_date !== params.feed.local_date ||
    params.refillBatch.user_id !== params.userId ||
    params.refillBatch.business_profile_id !== params.profile.id ||
    params.refillBatch.business_profile_version !== params.profile.profileVersion
  ) {
    throw new Error("Daily Carousel refill ownership does not match its feed.");
  }
}

async function buildDailyFeedResponse(params: {
  entitlement: TrendingFeedEntitlement;
  feed: DailyCarouselFeedRow;
  feedItems: DailyCarouselFeedItemRow[];
  markItemsShown: boolean;
  profile: BusinessProfileRecord;
  userId: string;
}): Promise<TrendingDailyFeed> {
  const visibleFeedItems = params.feedItems.slice(
    0,
    params.entitlement.dailyCarouselLimit,
  );
  const assignments = await listAssignmentsByIds(
    visibleFeedItems.map((item) => item.assignment_id),
  );
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const itemsWithAssignments = visibleFeedItems
    .map((feedItem) => ({
      assignment: assignmentById.get(feedItem.assignment_id),
      feedItem,
    }))
    .filter(
      (
        item,
      ): item is {
        assignment: UserCarouselAssignment;
        feedItem: DailyCarouselFeedItemRow;
      } => Boolean(item.assignment),
    );
  const activeItems = itemsWithAssignments.filter((item) =>
    isActiveAssignmentState(item.assignment.state),
  );
  const statuses = await getCarouselGenerationStatusesByIds(
    activeItems.map((item) => item.assignment.carouselId),
  );
  const statusByCarouselId = new Map(
    statuses.map((status) => [status.generation.id, status]),
  );
  const runtimeReadyItems = activeItems.filter(({ assignment }) => {
    const status = statusByCarouselId.get(assignment.carouselId);

    return Boolean(status && isCompleteReadyCarouselForCurrentStorage(status));
  });

  if (params.markItemsShown) {
    await markAssignmentsShown(
      runtimeReadyItems.map((item) => item.assignment.id),
    );
  }

  const carousels = runtimeReadyItems
    .map(({ assignment, feedItem }) => {
      const status = statusByCarouselId.get(assignment.carouselId);

      if (!status) {
        return null;
      }

      return toTrendingFeedCarousel({
        assignment,
        feedItem,
        generation: status.generation,
        slides: status.slides,
      });
    })
    .filter((carousel): carousel is TrendingFeedCarousel => Boolean(carousel));
  const pendingSlotCount = Math.max(
    params.entitlement.dailyCarouselLimit - visibleFeedItems.length,
    0,
  );
  const completedAssignmentCount = itemsWithAssignments.filter((item) =>
    isCompletedAssignmentState(item.assignment.state),
  ).length;
  const hasProcessingCandidates =
    pendingSlotCount > 0
      ? (
          await getViableUnassignedCarouselInventory({
            localDate: params.feed.local_date,
            minimumTotalCount: 0,
            profile: params.profile,
            requireProcessingCandidate: true,
            userId: params.userId,
          })
        ).processingCount > 0
      : false;

  return {
    carousels,
    entitlement: params.entitlement,
    feed: {
      assignedCount: visibleFeedItems.length,
      id: params.feed.id,
      localDate: params.feed.local_date,
      pendingSlotCount,
      state: getTrendingDailyFeedState({
        activeCarouselCount: carousels.length,
        completedAssignmentCount,
        hasProcessingCandidates,
        pendingSlotCount,
      }),
      timezone: params.feed.timezone,
    },
  };
}

type UserCarouselAssignment = {
  businessProfileId: string | null;
  businessProfileVersion: number | null;
  carouselId: string;
  completedAt: string | null;
  completionAction: CompletionAction | null;
  conceptFingerprint: string | null;
  createdAt: string;
  firstAssignedAt: string;
  firstAssignedLocalDate: string | null;
  firstShownAt: string | null;
  id: string;
  lastAssignedLocalDate: string | null;
  projectId: string;
  state: AssignmentState;
  updatedAt: string;
  userId: string;
};

async function getTrendingFeedEntitlement(
  userId: string,
): Promise<TrendingFeedEntitlement> {
  const activePlan = await getActiveUserPlan(userId);
  const requestedPlanKey =
    activePlan?.plan_key ??
    process.env.DEFAULT_TRENDING_PLAN_KEY?.trim() ??
    DEFAULT_PLAN_KEY;
  const entitlement = await getEntitlementByPlanKey(requestedPlanKey);

  if (entitlement) {
    return entitlement;
  }

  const fallback = await getFirstActiveEntitlement();

  if (!fallback) {
    throw new Error("Trending subscription entitlements are not configured.");
  }

  return fallback;
}

async function getActiveUserPlan(userId: string) {
  const { data, error } = await getClient()
    .from(USER_SUBSCRIPTION_PLANS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load user subscription plan: ${error.message}`);
  }

  return data ?? null;
}

async function getEntitlementByPlanKey(
  planKey: string,
): Promise<TrendingFeedEntitlement | null> {
  const { data, error } = await getClient()
    .from(SUBSCRIPTION_ENTITLEMENTS_TABLE)
    .select("*")
    .eq("plan_key", planKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load subscription entitlement: ${error.message}`);
  }

  return data ? mapEntitlement(data) : null;
}

async function getFirstActiveEntitlement() {
  const { data, error } = await getClient()
    .from(SUBSCRIPTION_ENTITLEMENTS_TABLE)
    .select("*")
    .eq("is_active", true)
    .order("daily_carousel_limit", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load subscription entitlements: ${error.message}`);
  }

  return data ? mapEntitlement(data) : null;
}

async function getOrCreateDailyFeed(params: {
  entitlement: TrendingFeedEntitlement;
  localDate: string;
  timezone: string;
  userId: string;
}) {
  const findExisting = () =>
    findDailyFeed({
      localDate: params.localDate,
      userId: params.userId,
    });

  return getOrCreatePersistedDailyFeed({
    findExisting,
    create: async () => {
      const { data, error } = await getClient()
        .from(DAILY_CAROUSEL_FEEDS_TABLE)
        .insert({
          daily_limit: params.entitlement.dailyCarouselLimit,
          local_date: params.localDate,
          plan_key: params.entitlement.planKey,
          status: "ready",
          timezone: params.timezone,
          user_id: params.userId,
        })
        .select("*")
        .single();

      if (!error) {
        return data;
      }

      if (isUniqueViolation(error)) {
        const racedFeed = await findExisting();

        if (racedFeed) {
          return racedFeed;
        }
      }

      throw new Error(`Could not create today's Trending feed: ${error.message}`);
    },
  });
}

async function findDailyFeed(params: {
  localDate: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(DAILY_CAROUSEL_FEEDS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("local_date", params.localDate)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load today's Trending feed: ${error.message}`);
  }

  return data ?? null;
}

async function listFeedItems(feedId: string) {
  const { data, error } = await getClient()
    .from(DAILY_CAROUSEL_FEED_ITEMS_TABLE)
    .select("*")
    .eq("feed_id", feedId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(`Could not load Trending feed items: ${error.message}`);
  }

  return data ?? [];
}

async function listCarryAssignments(params: {
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("project_id", params.profile.projectId)
    .eq("business_profile_id", params.profile.id)
    .eq("business_profile_version", params.profile.profileVersion)
    .in("state", [...ACTIVE_ASSIGNMENT_STATES])
    .order("first_assigned_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load unfinished Trending items: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => row.last_assigned_local_date !== params.localDate)
    .map(mapAssignment);
}

async function listUnpersistedCurrentDayAssignments(params: {
  existingAssignmentIds: string[];
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("project_id", params.profile.projectId)
    .eq("business_profile_id", params.profile.id)
    .eq("business_profile_version", params.profile.profileVersion)
    .eq("last_assigned_local_date", params.localDate)
    .in("state", [...ACTIVE_ASSIGNMENT_STATES])
    .order("first_assigned_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Could not recover unpersisted Trending items: ${error.message}`,
    );
  }

  const persistedAssignmentIds = new Set(params.existingAssignmentIds);

  return (data ?? [])
    .filter((row) => !persistedAssignmentIds.has(row.id))
    .map(mapAssignment);
}

type AutoCarouselGenerationStatus = Awaited<
  ReturnType<typeof getAutoCarouselGenerationStatusPageForUser>
>["statuses"][number];

function selectAssignableCompletedCarouselStatuses(params: {
  assignedCarouselIds: ReadonlySet<string>;
  existingConceptFingerprints: ReadonlySet<string>;
  localDate: string;
  statuses: readonly AutoCarouselGenerationStatus[];
}) {
  const statusByCarouselId = new Map(
    params.statuses.map((status) => [status.generation.id, status]),
  );
  const selected = selectAssignableDailyCarouselCandidates({
    assignedCarouselIds: [...params.assignedCarouselIds],
    candidates: params.statuses.map((status) => ({
      availableOnLocalDate: status.generation.availableOnLocalDate,
      carouselId: status.generation.id,
      conceptFingerprint: isCompleteReadyCarouselForCurrentStorage(status)
        ? createVisibleCarouselConceptFingerprint(status.slides)
        : null,
      generationSource: status.generation.generationSource,
      runtimeReady: isCompleteReadyCarouselForCurrentStorage(status),
    })),
    existingConceptFingerprints: [...params.existingConceptFingerprints],
    localDate: params.localDate,
  });

  return selected
    .map((candidate) => statusByCarouselId.get(candidate.carouselId))
    .filter(
      (status): status is AutoCarouselGenerationStatus => Boolean(status),
    );
}

async function listAssignableCompletedCarouselStatuses(params: {
  count: number;
  existingAssignments: readonly UserCarouselAssignment[];
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const assignedCarouselIds = new Set(
    params.existingAssignments.map((assignment) => assignment.carouselId),
  );
  const reservedConceptFingerprints =
    await getExistingVisibleConceptFingerprints(params.existingAssignments);
  const selected: AutoCarouselGenerationStatus[] = [];
  let cursor: AutoCarouselGenerationStatusPageCursor | null = null;

  do {
    const page = await getAutoCarouselGenerationStatusPageForUser({
      availableOnOrBeforeLocalDate: params.localDate,
      businessProfileId: params.profile.id,
      businessProfileVersion: params.profile.profileVersion,
      cursor,
      limit: CAROUSEL_INVENTORY_PAGE_SIZE,
      projectId: params.profile.projectId,
      statuses: ["completed"],
      userId: params.userId,
    });
    const remainingCount = Math.max(params.count - selected.length, 0);
    const pageSelection = selectAssignableCompletedCarouselStatuses({
      assignedCarouselIds,
      existingConceptFingerprints: reservedConceptFingerprints,
      localDate: params.localDate,
      statuses: page.statuses,
    }).slice(0, remainingCount);

    selected.push(...pageSelection);
    for (const status of pageSelection) {
      reservedConceptFingerprints.add(
        createVisibleCarouselConceptFingerprint(status.slides),
      );
    }

    cursor = page.nextCursor;
  } while (cursor && selected.length < params.count);

  return selected;
}

async function getExistingVisibleConceptFingerprints(
  assignments: readonly UserCarouselAssignment[],
) {
  const fingerprints = new Set(
    assignments
      .map((assignment) => assignment.conceptFingerprint)
      .filter((value): value is string => Boolean(value)),
  );
  const legacyAssignments = assignments.filter(
    (assignment) =>
      !isVisibleCarouselConceptFingerprint(assignment.conceptFingerprint),
  );

  for (let offset = 0; offset < legacyAssignments.length; offset += 50) {
    const assignmentPage = legacyAssignments.slice(offset, offset + 50);
    const statusPage = await getCarouselGenerationStatusesByIds(
      assignmentPage.map((assignment) => assignment.carouselId),
    );

    for (const status of statusPage) {
      if (status.slides.length > 0) {
        fingerprints.add(
          createVisibleCarouselConceptFingerprint(status.slides),
        );
      }
    }
  }

  return fingerprints;
}

async function createFreshAssignments(params: {
  count: number;
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  if (params.count <= 0) {
    return [];
  }

  const existingAssignments = await listAllAssignmentsForUser(params.userId);
  const freshStatuses = await listAssignableCompletedCarouselStatuses({
    count: params.count,
    existingAssignments,
    localDate: params.localDate,
    profile: params.profile,
    userId: params.userId,
  });
  const assignments: Array<{
    assignment: UserCarouselAssignment;
    created: boolean;
  }> = [];

  for (const status of freshStatuses) {
    const result = await insertFreshAssignment({
      generation: status.generation,
      localDate: params.localDate,
      slides: status.slides,
      userId: params.userId,
    });

    if (
      result?.assignment &&
      isActiveAssignmentState(result.assignment.state)
    ) {
      assignments.push(result);
    }
  }

  return assignments;
}

async function insertFreshAssignment(params: {
  generation: CarouselGenerationRecord;
  localDate: string;
  slides: CarouselSlideRecord[];
  userId: string;
}) {
  const now = getNowIso();
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .insert({
      business_profile_id: params.generation.businessProfileId,
      business_profile_version: params.generation.businessProfileVersion,
      carousel_id: params.generation.id,
      concept_fingerprint: createVisibleCarouselConceptFingerprint(params.slides),
      first_assigned_at: now,
      first_assigned_local_date: params.localDate,
      last_assigned_local_date: params.localDate,
      project_id: params.generation.projectId,
      state: "pending",
      updated_at: now,
      user_id: params.userId,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const existing = await getAssignmentByCarouselId({
        carouselId: params.generation.id,
        userId: params.userId,
      });

      return existing
        ? {
            assignment: existing,
            created: false,
          }
        : null;
    }

    throw new Error(`Could not assign Trending carousel: ${error.message}`);
  }

  return {
    assignment: mapAssignment(data),
    created: true,
  };
}

async function listAllAssignmentsForUser(userId: string) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Could not load Trending assignments: ${error.message}`);
  }

  return (data ?? []).map(mapAssignment);
}

async function listAssignmentsByIds(assignmentIds: string[]) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.filter(Boolean)));

  if (uniqueAssignmentIds.length === 0) {
    return [];
  }

  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .in("id", uniqueAssignmentIds);

  if (error) {
    throw new Error(`Could not load Trending assignments: ${error.message}`);
  }

  const assignments = (data ?? []).map(mapAssignment);
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );

  return uniqueAssignmentIds
    .map((assignmentId) => assignmentById.get(assignmentId))
    .filter(
      (assignment): assignment is UserCarouselAssignment =>
        Boolean(assignment),
    );
}

async function getAssignmentForUser(params: {
  assignmentId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Trending assignment: ${error.message}`);
  }

  return data ? mapAssignment(data) : null;
}

async function getAssignmentByCarouselId(params: {
  carouselId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("carousel_id", params.carouselId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Trending assignment: ${error.message}`);
  }

  return data ? mapAssignment(data) : null;
}

async function updateAssignmentsLastAssignedDate(
  assignmentIds: string[],
  localDate: string,
) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.filter(Boolean)));

  if (uniqueAssignmentIds.length === 0) {
    return;
  }

  const { error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .update({
      last_assigned_local_date: localDate,
      updated_at: getNowIso(),
    })
    .in("id", uniqueAssignmentIds);

  if (error) {
    throw new Error(`Could not update Trending assignments: ${error.message}`);
  }
}

async function markAssignmentsFailed(assignmentIds: string[]) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.filter(Boolean)));

  if (uniqueAssignmentIds.length === 0) {
    return;
  }

  const { error } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .update({
      state: "failed",
      updated_at: getNowIso(),
    })
    .in("id", uniqueAssignmentIds)
    .in("state", [...ACTIVE_ASSIGNMENT_STATES]);

  if (error) {
    throw new Error(`Could not invalidate unsafe Trending items: ${error.message}`);
  }
}

async function markAssignmentsShown(assignmentIds: string[]) {
  const uniqueAssignmentIds = Array.from(new Set(assignmentIds.filter(Boolean)));

  if (uniqueAssignmentIds.length === 0) {
    return;
  }

  const now = getNowIso();
  const { error: stateError } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .update({
      state: "in_progress",
      updated_at: now,
    })
    .in("id", uniqueAssignmentIds)
    .eq("state", "pending");

  if (stateError) {
    throw new Error(`Could not mark Trending items shown: ${stateError.message}`);
  }

  const { error: shownError } = await getClient()
    .from(USER_CAROUSEL_ASSIGNMENTS_TABLE)
    .update({
      first_shown_at: now,
      updated_at: now,
    })
    .in("id", uniqueAssignmentIds)
    .is("first_shown_at", null);

  if (shownError) {
    throw new Error(`Could not mark Trending items shown: ${shownError.message}`);
  }
}

function toTrendingFeedCarousel(params: {
  assignment: UserCarouselAssignment;
  feedItem: DailyCarouselFeedItemRow;
  generation: CarouselGenerationRecord;
  slides: CarouselSlideRecord[];
}): TrendingFeedCarousel {
  const readySlides = getReadySlidesForCurrentStorage(params.slides);

  return {
    assignmentId: params.assignment.id,
    candidateIndex: params.generation.candidateIndex,
    carouselId: params.generation.id,
    categorySlug: params.generation.categorySlug,
    feedItemId: params.feedItem.id,
    feedPosition: params.feedItem.position,
    feedSource: params.feedItem.source,
    generationBatchId: params.generation.generationBatchId,
    projectId: params.generation.projectId,
    readySlideCount: readySlides.length,
    selectedAngle: params.generation.selectedAngle,
    slideCount: params.generation.slideCount,
    slides: params.slides.map((slide) => ({
      headline: slide.headline,
      renderedUrl: slide.renderedUrl,
      slideNumber: slide.slideNumber,
      slideType: slide.slideType,
      status: slide.status,
      subtext: slide.subtext,
    })),
    status: params.generation.status,
    thumbnailUrl: readySlides[0]?.renderedUrl ?? null,
    updatedAt: params.generation.updatedAt,
  };
}

function getCompletedState(
  action: TrendingFeedCompletionAction,
): AssignmentState {
  switch (action) {
    case "saved":
      return "completed_saved";
    case "scheduled":
      return "completed_scheduled";
    case "skipped":
      return "completed_skipped";
  }
}

function isActiveAssignmentState(state: AssignmentState) {
  return state === "pending" || state === "in_progress";
}

function isCompletedAssignmentState(state: AssignmentState) {
  return (
    state === "accepted" ||
    state === "completed_saved" ||
    state === "completed_scheduled" ||
    state === "completed_skipped"
  );
}

function mapEntitlement(
  row: SubscriptionEntitlementRow,
): TrendingFeedEntitlement {
  return {
    dailyCarouselLimit: row.daily_carousel_limit,
    planKey: row.plan_key,
  };
}

function mapAssignment(row: UserCarouselAssignmentRow): UserCarouselAssignment {
  return {
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    carouselId: row.carousel_id,
    completedAt: row.completed_at,
    completionAction: row.completion_action,
    conceptFingerprint: row.concept_fingerprint,
    createdAt: row.created_at,
    firstAssignedAt: row.first_assigned_at,
    firstAssignedLocalDate: row.first_assigned_local_date,
    firstShownAt: row.first_shown_at,
    id: row.id,
    lastAssignedLocalDate: row.last_assigned_local_date,
    projectId: row.project_id,
    state: row.state,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function normalizeTimezone(value: string | null | undefined) {
  const timezone = value?.trim();

  if (!timezone || timezone.length > 80) {
    return FALLBACK_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function getLocalDateForTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ""
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function getClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Trending feed Supabase storage is not configured.");
  }

  if (!trendingFeedSupabaseClient) {
    trendingFeedSupabaseClient = createClient<TrendingFeedDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return trendingFeedSupabaseClient;
}

function isUniqueViolation(error: { code?: string }) {
  return error.code === "23505";
}

function isBusinessProfileVersionChangedError(error: { message?: string }) {
  return error.message?.includes("business_profile_version_changed") ?? false;
}

function getNowIso() {
  return new Date().toISOString();
}
