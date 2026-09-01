import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  CAROUSEL_CONTENT_PLAN_MODEL,
  CAROUSEL_CONTENT_PLAN_PROMPT_VERSION,
  CAROUSEL_CONTENT_PLAN_TARGET_COUNT,
  buildCarouselBusinessDescription,
  buildCarouselPlanningContext,
  type CarouselPlanningContext,
} from "@/lib/carousel/content-plan";
import type { BusinessProfileRecord } from "@/lib/business-profiles/db";

const CONTENT_PLANS_TABLE = "carousel_content_plans";
const CONTENT_PLAN_ITEMS_TABLE = "carousel_content_plan_items";
const DEFAULT_RESERVATION_TTL_SECONDS = 21_600;

export type CarouselContentPlanStatus =
  | "active"
  | "exhausted"
  | "failed"
  | "generating"
  | "superseded";

type CarouselContentPlanRow = {
  activated_at: string | null;
  business_description: string;
  business_profile_id: string;
  business_profile_version: number;
  created_at: string;
  exhausted_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  generation_attempt: number;
  generation_completed_at: string | null;
  generation_job_id: string | null;
  generation_started_at: string | null;
  id: string;
  period_end_date: string;
  period_start_date: string;
  plan_version: number;
  planner_model: string;
  planner_prompt_version: string;
  planning_context: CarouselPlanningContext;
  project_id: string;
  schema_version: number;
  status: CarouselContentPlanStatus;
  superseded_at: string | null;
  superseded_by_plan_id: string | null;
  target_item_count: number;
  timezone: string;
  updated_at: string;
  user_id: string;
};

export type CarouselContentPlanRecord = {
  businessDescription: string;
  businessProfileId: string;
  businessProfileVersion: number;
  generationAttempt: number;
  generationJobId: string | null;
  id: string;
  periodEndDate: string;
  periodStartDate: string;
  planVersion: number;
  projectId: string;
  status: CarouselContentPlanStatus;
  targetItemCount: number;
  timezone: string;
  userId: string;
};

type CarouselContentPlanItemRow = {
  consumed_at: string | null;
  consumed_by_carousel_generation_id: string | null;
  creative_brief_id: string | null;
  created_at: string;
  creative_seed: string;
  day_number: number;
  day_slot_index: number;
  emotion: string;
  id: string;
  plan_id: string;
  private_context: CarouselItemPrivateContext | null;
  reservation_expires_at: string | null;
  reservation_key: string | null;
  reservation_token: string | null;
  reserved_at: string | null;
  reserved_by_job_id: string | null;
  retired_at: string | null;
  retirement_reason: string | null;
  seed_fingerprint: string;
  sequence_index: number;
  status: "available" | "consumed" | "planned" | "reserved" | "retired";
  updated_at: string;
  user_id: string;
};

type CarouselItemPrivateContext = {
  audienceContext?: unknown;
  conceptLane?: unknown;
  creativeSeed?: unknown;
  emotionalTension?: unknown;
  humanMoment?: unknown;
  preferredFormatFamily?: unknown;
  supportedAngle?: unknown;
};

type CarouselPlanningBrief = {
  audienceContext: string;
  conceptLane?: string;
  creativeSeed: string;
  emotionalTension: string;
  humanMoment: string;
  preferredFormatFamily: string;
  supportedAngle: string;
};

type CarouselContentPlanBriefRow = {
  audience_context: string;
  creative_seed: string;
  emotional_tension: string;
  human_moment: string;
  id: string;
  plan_id: string;
  preferred_format_family: string;
  supported_angle: string;
  user_id: string;
};

export type ReservedCarouselContentPlanItem = {
  creativeSeed: string;
  dayNumber: number;
  emotion: string;
  id: string;
  planId: string;
  reservationKey: string;
  reservationToken: string;
  sequenceIndex: number;
};

type CarouselContentPlanDatabase = {
  public: {
    Functions: {
      attach_carousel_content_plan_generation_job: {
        Args: { p_job_id: string; p_plan_id: string; p_user_id: string };
        Returns: CarouselContentPlanRow;
      };
      ensure_carousel_content_plan: {
        Args: {
          p_business_description: string;
          p_planning_context: CarouselPlanningContext;
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_planner_model: string;
          p_planner_prompt_version: string;
          p_project_id: string;
          p_target_item_count: number;
          p_timezone: string;
          p_user_id: string;
        };
        Returns: CarouselContentPlanRow;
      };
      attach_carousel_content_plan_items_to_job: {
        Args: {
          p_job_id: string;
          p_plan_item_ids: string[];
          p_reservation_token: string;
          p_user_id: string;
        };
        Returns: CarouselContentPlanItemRow[];
      };
      release_carousel_content_plan_reservation: {
        Args: {
          p_release_reason: string;
          p_reservation_key: string;
          p_user_id: string;
        };
        Returns: number;
      };
      reserve_carousel_content_plan_items: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_requested_count: number;
          p_reservation_key: string;
          p_reservation_ttl_seconds: number;
          p_user_id: string;
        };
        Returns: CarouselContentPlanItemRow[];
      };
    };
    Tables: {
      carousel_content_plan_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CarouselContentPlanItemRow;
        Update: Partial<CarouselContentPlanItemRow>;
      };
      carousel_content_plan_briefs: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CarouselContentPlanBriefRow;
        Update: Partial<CarouselContentPlanBriefRow>;
      };
      carousel_content_plans: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CarouselContentPlanRow;
        Update: Partial<CarouselContentPlanRow>;
      };
    };
    Views: Record<string, never>;
  };
};

let client: SupabaseClient<CarouselContentPlanDatabase> | null = null;

export async function ensureCurrentCarouselContentPlan(params: {
  profile: BusinessProfileRecord;
  timezone: string;
}) {
  const { data, error } = await getClient().rpc(
    "ensure_carousel_content_plan",
    {
      p_business_description: buildCarouselBusinessDescription(
        params.profile.context,
      ),
      p_planning_context: buildCarouselPlanningContext(params.profile.context),
      p_business_profile_id: params.profile.id,
      p_business_profile_version: params.profile.profileVersion,
      p_planner_model: CAROUSEL_CONTENT_PLAN_MODEL,
      p_planner_prompt_version: CAROUSEL_CONTENT_PLAN_PROMPT_VERSION,
      p_project_id: params.profile.projectId,
      p_target_item_count: CAROUSEL_CONTENT_PLAN_TARGET_COUNT,
      p_timezone: params.timezone,
      p_user_id: params.profile.userId,
    },
  );

  if (error) {
    throw new Error(`Could not ensure Carousel content plan: ${error.message}`);
  }

  return mapPlan(data);
}

export async function attachCarouselContentPlanGenerationJob(params: {
  jobId: string;
  planId: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "attach_carousel_content_plan_generation_job",
    {
      p_job_id: params.jobId,
      p_plan_id: params.planId,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Could not attach Carousel content-plan job: ${error.message}`,
    );
  }

  return mapPlan(data);
}

export async function getCarouselContentPlan(planId: string) {
  const { data, error } = await getClient()
    .from(CONTENT_PLANS_TABLE)
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Carousel content plan: ${error.message}`);
  }

  return data ? mapPlan(data) : null;
}

export async function listPriorCarouselContentPlanItems(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  periodStartDate: string;
  userId: string;
}) {
  const { data: priorPlan, error: planError } = await getClient()
    .from(CONTENT_PLANS_TABLE)
    .select("id")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .lt("period_end_date", params.periodStartDate)
    .order("period_end_date", { ascending: false })
    .order("plan_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    throw new Error(`Could not load the prior Carousel content plan: ${planError.message}`);
  }
  if (!priorPlan) return [];

  const { data: items, error: itemsError } = await getClient()
    .from(CONTENT_PLAN_ITEMS_TABLE)
    .select("*")
    .eq("plan_id", priorPlan.id)
    .eq("user_id", params.userId)
    .order("sequence_index", { ascending: true });

  if (itemsError) {
    throw new Error(
      `Could not load prior Carousel content-plan items: ${itemsError.message}`,
    );
  }

  return items ?? [];
}

export async function getCarouselCreativeBriefForGeneration(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  contentPlanId: string;
  contentPlanItemId: string;
  contentPlanReservationId: string;
  userId: string;
}) {
  const [{ data: plan, error: planError }, { data: item, error: itemError }] =
    await Promise.all([
      getClient()
        .from(CONTENT_PLANS_TABLE)
        .select("*")
        .eq("id", params.contentPlanId)
        .eq("user_id", params.userId)
        .eq("business_profile_id", params.businessProfileId)
        .eq("business_profile_version", params.businessProfileVersion)
        .eq("status", "active")
        .maybeSingle(),
      getClient()
        .from(CONTENT_PLAN_ITEMS_TABLE)
        .select("*")
        .eq("id", params.contentPlanItemId)
        .eq("plan_id", params.contentPlanId)
        .eq("user_id", params.userId)
        .eq("reservation_token", params.contentPlanReservationId)
        .eq("status", "reserved")
        .maybeSingle(),
    ]);

  if (planError) {
    throw new Error(`Could not load Carousel content plan: ${planError.message}`);
  }
  if (itemError) {
    throw new Error(
      `Could not load Carousel content-plan item: ${itemError.message}`,
    );
  }
  if (!plan || !item) {
    throw new Error(
      "Carousel content-plan provenance is stale, inactive, or no longer reserved.",
    );
  }

  const itemPlanningBrief = parseCarouselItemPrivateContext(item.private_context);
  if (item.private_context !== null && !itemPlanningBrief) {
    throw new Error("Carousel content-plan item has invalid private writing context.");
  }
  const planningBrief =
    itemPlanningBrief ??
    (item.creative_brief_id
      ? await getCarouselPlanningBrief({
          briefId: item.creative_brief_id,
          planId: params.contentPlanId,
          userId: params.userId,
        })
      : null);

  return {
    businessDescription: plan.business_description,
    creativeSeed: item.creative_seed,
    emotion: item.emotion,
    planningBrief,
  };
}

async function getCarouselPlanningBrief(params: {
  briefId: string;
  planId: string;
  userId: string;
}): Promise<CarouselPlanningBrief> {
  const { data, error } = await getClient()
    .from("carousel_content_plan_briefs")
    .select("*")
    .eq("id", params.briefId)
    .eq("plan_id", params.planId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Carousel creative brief: ${error.message}`);
  }
  if (!data) {
    throw new Error("Carousel creative brief provenance is unavailable.");
  }

  const planningBrief = parseCarouselItemPrivateContext({
    audienceContext: data.audience_context,
    creativeSeed: data.creative_seed,
    emotionalTension: data.emotional_tension,
    humanMoment: data.human_moment,
    preferredFormatFamily: data.preferred_format_family,
    supportedAngle: data.supported_angle,
  });

  if (!planningBrief) {
    throw new Error("Carousel creative brief has invalid private writing context.");
  }

  return planningBrief;
}

function parseCarouselItemPrivateContext(
  value: CarouselItemPrivateContext | null,
): CarouselPlanningBrief | null {
  if (!value) return null;
  const audienceContext = getRequiredPrivateContextString(value.audienceContext);
  const creativeSeed = getRequiredPrivateContextString(value.creativeSeed);
  const emotionalTension = getRequiredPrivateContextString(value.emotionalTension);
  const humanMoment = getRequiredPrivateContextString(value.humanMoment);
  const preferredFormatFamily = getRequiredPrivateContextString(
    value.preferredFormatFamily,
  );
  const supportedAngle = getRequiredPrivateContextString(value.supportedAngle);

  if (
    !audienceContext ||
    !creativeSeed ||
    !emotionalTension ||
    !humanMoment ||
    !preferredFormatFamily ||
    !supportedAngle ||
    (value.conceptLane !== undefined && typeof value.conceptLane !== "string")
  ) {
    return null;
  }

  return {
    audienceContext,
    ...(typeof value.conceptLane === "string"
      ? { conceptLane: value.conceptLane }
      : {}),
    creativeSeed,
    emotionalTension,
    humanMoment,
    preferredFormatFamily,
    supportedAngle,
  };
}

function getRequiredPrivateContextString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function reserveCarouselContentPlanItems(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  requestedCount: number;
  reservationKey: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "reserve_carousel_content_plan_items",
    {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_requested_count: params.requestedCount,
      p_reservation_key: params.reservationKey,
      p_reservation_ttl_seconds: DEFAULT_RESERVATION_TTL_SECONDS,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(`Could not reserve Carousel content ideas: ${error.message}`);
  }

  return (data ?? []).map(mapReservedItem);
}

export async function attachCarouselContentPlanItemsToJob(params: {
  jobId: string;
  planItemIds: string[];
  reservationToken: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "attach_carousel_content_plan_items_to_job",
    {
      p_job_id: params.jobId,
      p_plan_item_ids: params.planItemIds,
      p_reservation_token: params.reservationToken,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Could not attach Carousel content ideas to the writer job: ${error.message}`,
    );
  }

  return (data ?? []).map(mapReservedItem);
}

export async function releaseCarouselContentPlanReservation(params: {
  reason: string;
  reservationKey: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "release_carousel_content_plan_reservation",
    {
      p_release_reason: params.reason,
      p_reservation_key: params.reservationKey,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Could not release Carousel content ideas: ${error.message}`,
    );
  }

  return data ?? 0;
}

function mapPlan(row: CarouselContentPlanRow): CarouselContentPlanRecord {
  return {
    businessDescription: row.business_description,
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    generationAttempt: row.generation_attempt,
    generationJobId: row.generation_job_id,
    id: row.id,
    periodEndDate: row.period_end_date,
    periodStartDate: row.period_start_date,
    planVersion: row.plan_version,
    projectId: row.project_id,
    status: row.status,
    targetItemCount: row.target_item_count,
    timezone: row.timezone,
    userId: row.user_id,
  };
}

function mapReservedItem(
  row: CarouselContentPlanItemRow,
): ReservedCarouselContentPlanItem {
  if (!row.reservation_key || !row.reservation_token) {
    throw new Error("Carousel content-plan item is not reserved.");
  }

  return {
    creativeSeed: row.creative_seed,
    dayNumber: row.day_number,
    emotion: row.emotion,
    id: row.id,
    planId: row.plan_id,
    reservationKey: row.reservation_key,
    reservationToken: row.reservation_token,
    sequenceIndex: row.sequence_index,
  };
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Carousel content-plan storage is not configured.");
  }

  if (!client) {
    client = createClient<CarouselContentPlanDatabase>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}
