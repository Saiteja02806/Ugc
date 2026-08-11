import "server-only";

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

import { isBusinessProfileOnboardingComplete } from "./onboarding-access";
import type { BusinessLogoAsset } from "./logo";
import {
  BUSINESS_PROFILE_ONBOARDING_VERSION,
  PrimaryGoalsDraftSchema,
  PrimaryGoalsSchema,
  applyBusinessProfileOnboardingContext,
  applyPrimaryGoals,
  type BusinessProfileIntakeType,
  type BusinessProfileOnboardingContext,
  type PrimaryGoal,
  type PrimaryGoalsDraft,
  type PrimaryGoals,
} from "./schema";

const BUSINESS_PROFILES_TABLE = "business_profiles";
export const DEFAULT_BUSINESS_PROFILE_PROJECT_ID = "default-project";
const MUTABLE_ONBOARDING_STATUS_FILTER =
  `onboarding_status.eq.incomplete,and(onboarding_status.eq.completed,onboarding_version.lt.${BUSINESS_PROFILE_ONBOARDING_VERSION})`;

type BusinessProfileStatus = "failed" | "preparing";
type BusinessProfileOnboardingStatus = "completed" | "incomplete";

type BusinessProfileRow = {
  analysis_id: string | null;
  content_hash: string;
  context_json: WebsiteBusinessAnalysis;
  created_at: string;
  id: string;
  intake_type: BusinessProfileIntakeType;
  latest_generation_batch_id: string | null;
  logo_file_size_bytes: number | null;
  logo_height: number | null;
  logo_mime_type: string | null;
  logo_storage_key: string | null;
  logo_url: string | null;
  logo_width: number | null;
  onboarding_completed_at: string | null;
  onboarding_status: BusinessProfileOnboardingStatus;
  onboarding_version: number;
  preparation_error: string | null;
  preparation_status: BusinessProfileStatus;
  primary_goal: PrimaryGoal | null;
  primary_goals: PrimaryGoal[] | null;
  profile_version: number;
  project_id: string;
  source_context: string | null;
  source_url: string | null;
  trending_timezone: string | null;
  updated_at: string;
  user_id: string;
};

type BusinessProfileDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      business_profiles: {
        Insert: Partial<BusinessProfileRow> & Pick<BusinessProfileRow, "context_json" | "intake_type" | "user_id" | "content_hash">;
        Relationships: [];
        Row: BusinessProfileRow;
        Update: Partial<BusinessProfileRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type BusinessProfileRecord = {
  analysisId: string | null;
  context: WebsiteBusinessAnalysis;
  id: string;
  intakeType: BusinessProfileIntakeType;
  latestGenerationBatchId: string | null;
  logoFileSizeBytes: number | null;
  logoHeight: number | null;
  logoMimeType: string | null;
  logoStorageKey: string | null;
  logoUrl: string | null;
  logoWidth: number | null;
  onboardingCompletedAt: string | null;
  onboardingStatus: BusinessProfileOnboardingStatus;
  onboardingVersion: number;
  preparationError: string | null;
  preparationStatus: BusinessProfileStatus;
  primaryGoal: PrimaryGoal | null;
  primaryGoals: PrimaryGoals;
  profileVersion: number;
  projectId: string;
  trendingTimezone: string | null;
  userId: string;
};

let supabaseClient: SupabaseClient<BusinessProfileDatabase> | null = null;

export function getMissingBusinessProfileEnvVars() {
  const missing: string[] = [];
  if (!(process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing;
}

export async function getBusinessProfileForUser(userId: string) {
  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load business profile: ${error.message}`);
  return data ? mapProfile(data) : null;
}

export async function listBusinessProfilesForDailyReplenishment(params: {
  cursor?: string | null;
  limit: number;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit), 1), 200);
  let query = getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .select("*")
    .not("analysis_id", "is", null)
    .eq("onboarding_status", "completed")
    .gte("onboarding_version", BUSINESS_PROFILE_ONBOARDING_VERSION)
    .not("trending_timezone", "is", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (params.cursor) {
    query = query.gt("id", params.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Could not list business profiles for daily replenishment: ${error.message}`,
    );
  }

  return (data ?? []).map(mapProfile).filter(isBusinessProfileOnboardingComplete);
}

export async function updateBusinessProfileTrendingTimezone(params: {
  profileId: string;
  timezone: string;
}) {
  const { error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      trending_timezone: params.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.profileId);

  if (error) {
    throw new Error(`Could not save Trending timezone: ${error.message}`);
  }
}

export async function saveBusinessProfile(input: {
  analysis: WebsiteBusinessAnalysis;
  analysisId: string;
  intakeType: BusinessProfileIntakeType;
  sourceContext?: string | null;
  sourceUrl?: string | null;
  userId: string;
}) {
  const existing = await getBusinessProfileForUser(input.userId);
  const contentHash = hashAnalysis(input.analysis, input.intakeType);

  if (
    existing &&
    (existing.analysisId === input.analysisId ||
      contentHash === getStoredHash(existing))
  ) {
    return { changed: false, profile: existing };
  }

  const patch = {
    analysis_id: input.analysisId,
    content_hash: contentHash,
    context_json: input.analysis,
    intake_type: input.intakeType,
    onboarding_completed_at: null,
    onboarding_status: "incomplete" as const,
    onboarding_version: 0,
    preparation_error: null,
    preparation_status: "preparing" as const,
    source_context: input.sourceContext?.slice(0, 24_000) ?? null,
    source_url: input.sourceUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await getClient()
      .from(BUSINESS_PROFILES_TABLE)
      .update({ ...patch, profile_version: existing.profileVersion + 1 })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`Could not update business profile: ${error.message}`);
    return { changed: true, profile: mapProfile(data) };
  }

  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .insert({
      ...patch,
      profile_version: 1,
      project_id: DEFAULT_BUSINESS_PROFILE_PROJECT_ID,
      user_id: input.userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Could not save business profile: ${error.message}`);
  return { changed: true, profile: mapProfile(data) };
}

export async function completeBusinessProfileOnboarding(params: {
  primaryGoals: PrimaryGoals;
  profile: BusinessProfileRecord;
}) {
  return completeBusinessProfileOnboardingAttempt(params, true);
}

async function completeBusinessProfileOnboardingAttempt(
  params: {
    primaryGoals: PrimaryGoals;
    profile: BusinessProfileRecord;
  },
  retryOnConflict: boolean,
) {
  const primaryGoals = PrimaryGoalsSchema.parse(params.primaryGoals);
  const analysis = applyPrimaryGoals(
    params.profile.context,
    primaryGoals,
  );
  const contentHash = hashAnalysis(analysis, params.profile.intakeType);

  if (
    contentHash === getStoredHash(params.profile) &&
    isBusinessProfileOnboardingComplete(params.profile)
  ) {
    return params.profile;
  }

  const completedAt = new Date().toISOString();
  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      content_hash: contentHash,
      context_json: analysis,
      onboarding_completed_at: completedAt,
      onboarding_status: "completed",
      onboarding_version: BUSINESS_PROFILE_ONBOARDING_VERSION,
      primary_goal: primaryGoals[0],
      primary_goals: primaryGoals,
      profile_version: params.profile.profileVersion + 1,
      updated_at: completedAt,
    })
    .eq("id", params.profile.id)
    .eq("user_id", params.profile.userId)
    .or(MUTABLE_ONBOARDING_STATUS_FILTER)
    .eq("profile_version", params.profile.profileVersion)
    .select("*")
    .single();

  if (error) {
    const latestProfile = retryOnConflict
      ? await getLatestOnboardingProfileAfterConflict(params.profile, error)
      : null;

    if (latestProfile) {
      if (isBusinessProfileOnboardingComplete(latestProfile)) {
        return latestProfile;
      }

      return completeBusinessProfileOnboardingAttempt(
        { ...params, profile: latestProfile },
        false,
      );
    }

    throw new Error(`Could not complete business profile onboarding: ${error.message}`);
  }

  return mapProfile(data);
}

export async function saveBusinessProfileOnboardingGoalDraft(params: {
  primaryGoals: PrimaryGoalsDraft;
  profile: BusinessProfileRecord;
}) {
  return saveBusinessProfileOnboardingGoalDraftAttempt(params, true);
}

async function saveBusinessProfileOnboardingGoalDraftAttempt(
  params: {
    primaryGoals: PrimaryGoalsDraft;
    profile: BusinessProfileRecord;
  },
  retryOnConflict: boolean,
) {
  const primaryGoals = PrimaryGoalsDraftSchema.parse(params.primaryGoals);
  const updatedAt = new Date().toISOString();
  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      primary_goal: primaryGoals[0] ?? null,
      primary_goals: primaryGoals,
      updated_at: updatedAt,
    })
    .eq("id", params.profile.id)
    .eq("user_id", params.profile.userId)
    .or(MUTABLE_ONBOARDING_STATUS_FILTER)
    .eq("profile_version", params.profile.profileVersion)
    .select("*")
    .single();

  if (error) {
    const latestProfile = retryOnConflict
      ? await getLatestOnboardingProfileAfterConflict(params.profile, error)
      : null;

    if (latestProfile) {
      if (isBusinessProfileOnboardingComplete(latestProfile)) {
        return latestProfile;
      }

      return saveBusinessProfileOnboardingGoalDraftAttempt(
        { ...params, profile: latestProfile },
        false,
      );
    }

    throw new Error(`Could not save onboarding goals: ${error.message}`);
  }

  return mapProfile(data);
}

async function getLatestOnboardingProfileAfterConflict(
  profile: BusinessProfileRecord,
  error: { code?: string; message: string },
) {
  if (!isOnboardingWriteConflict(error)) {
    return null;
  }

  const latestProfile = await getBusinessProfileForUser(profile.userId);
  return latestProfile?.id === profile.id ? latestProfile : null;
}

function isOnboardingWriteConflict(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST116" ||
    error.message.includes("Cannot coerce the result to a single JSON object")
  );
}

export async function saveBusinessProfileOnboardingIdentity(params: {
  logo?: BusinessLogoAsset | null;
  onboardingContext: BusinessProfileOnboardingContext;
  profile: BusinessProfileRecord;
}) {
  const analysis = applyBusinessProfileOnboardingContext(
    params.profile.context,
    params.onboardingContext,
  );
  const updatedAt = new Date().toISOString();
  const logoPatch =
    params.logo === undefined
      ? {}
      : params.logo === null
        ? {
            logo_file_size_bytes: null,
            logo_height: null,
            logo_mime_type: null,
            logo_storage_key: null,
            logo_url: null,
            logo_width: null,
          }
        : {
            logo_file_size_bytes: params.logo.fileSizeBytes,
            logo_height: params.logo.height,
            logo_mime_type: params.logo.mimeType,
            logo_storage_key: params.logo.storageKey,
            logo_url: params.logo.url,
            logo_width: params.logo.width,
          };
  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      content_hash: hashAnalysis(analysis, params.profile.intakeType),
      context_json: analysis,
      ...logoPatch,
      profile_version: params.profile.profileVersion + 1,
      updated_at: updatedAt,
    })
    .eq("id", params.profile.id)
    .eq("user_id", params.profile.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save business identity: ${error.message}`);
  }

  return mapProfile(data);
}

export async function retryBusinessProfile(profile: BusinessProfileRecord) {
  const { data, error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      preparation_error: null,
      preparation_status: "preparing",
      profile_version: profile.profileVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select("*")
    .single();
  if (error) throw new Error(`Could not retry business profile: ${error.message}`);
  return mapProfile(data);
}

export async function updateBusinessProfilePreparation(params: {
  error?: string | null;
  generationBatchId?: string | null;
  profileId: string;
  status: BusinessProfileStatus;
}) {
  const { error } = await getClient()
    .from(BUSINESS_PROFILES_TABLE)
    .update({
      latest_generation_batch_id: params.generationBatchId ?? null,
      preparation_error: params.error?.slice(0, 1_000) ?? null,
      preparation_status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.profileId);
  if (error) throw new Error(`Could not update business profile preparation: ${error.message}`);
}

function getClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Business profile storage is not configured.");
  if (!supabaseClient) {
    supabaseClient = createClient<BusinessProfileDatabase>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseClient;
}

function hashAnalysis(analysis: WebsiteBusinessAnalysis, intakeType: BusinessProfileIntakeType) {
  return createHash("sha256")
    .update(JSON.stringify({ analysis, intakeType }))
    .digest("hex");
}

function getStoredHash(profile: BusinessProfileRecord) {
  return hashAnalysis(profile.context, profile.intakeType);
}

function mapProfile(row: BusinessProfileRow): BusinessProfileRecord {
  const primaryGoals = getStoredPrimaryGoals(row);

  return {
    analysisId: row.analysis_id,
    context: row.context_json,
    id: row.id,
    intakeType: row.intake_type,
    latestGenerationBatchId: row.latest_generation_batch_id,
    logoFileSizeBytes: row.logo_file_size_bytes ?? null,
    logoHeight: row.logo_height ?? null,
    logoMimeType: row.logo_mime_type ?? null,
    logoStorageKey: row.logo_storage_key ?? null,
    logoUrl: row.logo_url ?? null,
    logoWidth: row.logo_width ?? null,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    onboardingStatus: row.onboarding_status ?? "incomplete",
    onboardingVersion: row.onboarding_version ?? 0,
    preparationError: row.preparation_error,
    preparationStatus: row.preparation_status,
    primaryGoal: primaryGoals[0] ?? null,
    primaryGoals,
    profileVersion: row.profile_version,
    projectId: row.project_id,
    trendingTimezone: row.trending_timezone,
    userId: row.user_id,
  };
}

function getStoredPrimaryGoals(row: BusinessProfileRow): PrimaryGoals {
  const storedGoals = row.primary_goals?.length
    ? row.primary_goals
    : row.primary_goal
      ? [row.primary_goal]
      : [];
  const parsed = PrimaryGoalsSchema.safeParse(storedGoals);

  return parsed.success ? parsed.data : [];
}

export { isBusinessProfileOnboardingComplete } from "./onboarding-access";
