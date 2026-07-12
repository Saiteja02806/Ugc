import "server-only";

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  getCarouselGenerationStatusesByIds,
  listCarouselGenerationStatusesForUser,
  type CarouselGenerationRecord,
  type CarouselSlideRecord,
} from "@/lib/carousel/db";

const SUBSCRIPTION_ENTITLEMENTS_TABLE = "subscription_entitlements";
const USER_SUBSCRIPTION_PLANS_TABLE = "user_subscription_plans";
const USER_CAROUSEL_ASSIGNMENTS_TABLE = "user_carousel_assignments";
const DAILY_CAROUSEL_FEEDS_TABLE = "daily_carousel_feeds";
const DAILY_CAROUSEL_FEED_ITEMS_TABLE = "daily_carousel_feed_items";

const DEFAULT_PLAN_KEY = "pro";
const FALLBACK_TIMEZONE = "UTC";
const FRESH_CANDIDATE_SCAN_LIMIT = 50;

const ACTIVE_ASSIGNMENT_STATES = ["pending", "in_progress"] as const;

type AssignmentState =
  | "completed_saved"
  | "completed_scheduled"
  | "completed_skipped"
  | "failed"
  | "in_progress"
  | "pending";
type CompletionAction = "saved" | "scheduled" | "skipped";
export type TrendingFeedCompletionAction = CompletionAction;
type FeedItemSource = "carried" | "new";

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
  source: FeedItemSource;
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

type TrendingFeedDatabase = {
  public: {
    Functions: Record<string, never>;
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

export type TrendingFeedCarousel = {
  assignmentId: string;
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  feedItemId: string;
  feedPosition: number;
  feedSource: FeedItemSource;
  generationBatchId: string;
  projectId: string;
  readySlideCount: number;
  selectedAngle: string | null;
  slideCount: number;
  slides: Array<{
    headline: string;
    renderedUrl: string | null;
    slideNumber: number;
    slideType: string | null;
    status: "failed" | "processing" | "ready";
    subtext: string | null;
  }>;
  status: "completed" | "failed" | "processing";
  thumbnailUrl: string | null;
  updatedAt: string;
};

export type TrendingDailyFeed = {
  carousels: TrendingFeedCarousel[];
  entitlement: TrendingFeedEntitlement;
  feed: {
    assignedCount: number;
    id: string;
    localDate: string;
    pendingSlotCount: number;
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
  profile: BusinessProfileRecord;
  timezone?: string | null;
  userId: string;
}): Promise<TrendingDailyFeed> {
  const timezone = normalizeTimezone(params.timezone);
  const localDate = getLocalDateForTimezone(timezone);
  const entitlement = await getTrendingFeedEntitlement(params.userId);
  const feed = await upsertDailyFeed({
    entitlement,
    localDate,
    timezone,
    userId: params.userId,
  });
  let feedItems = await listFeedItems(feed.id);

  if (feedItems.length === 0) {
    await populateDailyFeed({
      entitlement,
      feed,
      localDate,
      profile: params.profile,
      userId: params.userId,
    });
    feedItems = await listFeedItems(feed.id);
  }

  return buildDailyFeedResponse({
    entitlement,
    feed,
    feedItems,
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
    .in("state", [...ACTIVE_ASSIGNMENT_STATES])
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
  entitlement: TrendingFeedEntitlement;
  feed: DailyCarouselFeedRow;
  localDate: string;
  profile: BusinessProfileRecord;
  userId: string;
}) {
  const carried = await listCarryAssignments({
    dailyLimit: params.entitlement.dailyCarouselLimit,
    localDate: params.localDate,
    profile: params.profile,
    userId: params.userId,
  });
  const remainingSlotCount = Math.max(
    params.entitlement.dailyCarouselLimit - carried.length,
    0,
  );
  const fresh = await createFreshAssignments({
    count: remainingSlotCount,
    localDate: params.localDate,
    profile: params.profile,
    userId: params.userId,
  });
  const selected = [
    ...carried.map((assignment) => ({
      assignment,
      carriedFromDate: assignment.lastAssignedLocalDate,
      source: "carried" as const,
    })),
    ...fresh.map((assignment) => ({
      assignment,
      carriedFromDate: null,
      source: "new" as const,
    })),
  ].slice(0, params.entitlement.dailyCarouselLimit);

  if (selected.length === 0) {
    return;
  }

  const feedItemRows: DailyCarouselFeedItemInsert[] = selected.map(
    ({ assignment, carriedFromDate, source }, index) => ({
      assignment_id: assignment.id,
      carried_from_date:
        source === "carried" && carriedFromDate ? carriedFromDate : null,
      feed_id: params.feed.id,
      position: index + 1,
      source,
    }),
  );
  const { error } = await getClient()
    .from(DAILY_CAROUSEL_FEED_ITEMS_TABLE)
    .insert(feedItemRows);

  if (error && !isUniqueViolation(error)) {
    throw new Error(`Could not create Trending feed items: ${error.message}`);
  }

  await updateAssignmentsLastAssignedDate(
    selected.map(({ assignment }) => assignment.id),
    params.localDate,
  );
}

async function buildDailyFeedResponse(params: {
  entitlement: TrendingFeedEntitlement;
  feed: DailyCarouselFeedRow;
  feedItems: DailyCarouselFeedItemRow[];
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

  await markAssignmentsShown(activeItems.map((item) => item.assignment.id));

  const statuses = await getCarouselGenerationStatusesByIds(
    activeItems.map((item) => item.assignment.carouselId),
  );
  const statusByCarouselId = new Map(
    statuses.map((status) => [status.generation.id, status]),
  );
  const carousels = activeItems
    .map(({ assignment, feedItem }) => {
      const status = statusByCarouselId.get(assignment.carouselId);

      if (!status || !isCompleteReadyCarousel(status)) {
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

  return {
    carousels,
    entitlement: params.entitlement,
    feed: {
      assignedCount: visibleFeedItems.length,
      id: params.feed.id,
      localDate: params.feed.local_date,
      pendingSlotCount: Math.max(
        params.entitlement.dailyCarouselLimit - visibleFeedItems.length,
        0,
      ),
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

async function upsertDailyFeed(params: {
  entitlement: TrendingFeedEntitlement;
  localDate: string;
  timezone: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from(DAILY_CAROUSEL_FEEDS_TABLE)
    .upsert(
      {
        daily_limit: params.entitlement.dailyCarouselLimit,
        local_date: params.localDate,
        plan_key: params.entitlement.planKey,
        status: "ready",
        timezone: params.timezone,
        user_id: params.userId,
      },
      {
        onConflict: "user_id,local_date",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not load today's Trending feed: ${error.message}`);
  }

  return data;
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
  dailyLimit: number;
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
    .order("created_at", { ascending: true })
    .limit(params.dailyLimit);

  if (error) {
    throw new Error(`Could not load unfinished Trending items: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => row.last_assigned_local_date !== params.localDate)
    .map(mapAssignment);
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
  const existingCarouselIds = new Set(
    existingAssignments.map((assignment) => assignment.carouselId),
  );
  const existingConceptFingerprints = new Set(
    existingAssignments
      .map((assignment) => assignment.conceptFingerprint)
      .filter((value): value is string => Boolean(value)),
  );
  const statuses = await listCarouselGenerationStatusesForUser({
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    limit: FRESH_CANDIDATE_SCAN_LIMIT,
    projectId: params.profile.projectId,
    userId: params.userId,
  });
  const freshStatuses = statuses.filter((status) => {
    if (existingCarouselIds.has(status.generation.id)) {
      return false;
    }

    if (!isCompleteReadyCarousel(status)) {
      return false;
    }

    return !existingConceptFingerprints.has(
      createConceptFingerprint(status.generation, status.slides),
    );
  });
  const selected = freshStatuses.slice(0, params.count);
  const assignments: UserCarouselAssignment[] = [];

  for (const status of selected) {
    const assignment = await insertFreshAssignment({
      generation: status.generation,
      localDate: params.localDate,
      slides: status.slides,
      userId: params.userId,
    });

    if (assignment && isActiveAssignmentState(assignment.state)) {
      assignments.push(assignment);
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
      concept_fingerprint: createConceptFingerprint(
        params.generation,
        params.slides,
      ),
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

      return existing;
    }

    throw new Error(`Could not assign Trending carousel: ${error.message}`);
  }

  return mapAssignment(data);
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
  const readySlides = getReadySlides(params.slides);

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

function isCompleteReadyCarousel(status: {
  generation: CarouselGenerationRecord;
  slides: CarouselSlideRecord[];
}) {
  return (
    status.generation.status === "completed" &&
    getReadySlides(status.slides).length === status.generation.slideCount
  );
}

function getReadySlides(slides: CarouselSlideRecord[]) {
  return slides
    .filter((slide) => slide.status === "ready" && Boolean(slide.renderedUrl))
    .sort((first, second) => first.slideNumber - second.slideNumber);
}

function createConceptFingerprint(
  generation: CarouselGenerationRecord,
  slides: CarouselSlideRecord[],
) {
  const normalized = [
    generation.categorySlug,
    generation.selectedAngle,
    ...slides.map((slide) => slide.headline),
    ...slides.map((slide) => slide.subtext),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256")
    .update(normalized || generation.id)
    .digest("hex");
}

function getCompletedState(action: CompletionAction): AssignmentState {
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

function getNowIso() {
  return new Date().toISOString();
}
