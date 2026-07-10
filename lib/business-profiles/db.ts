import "server-only";

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

import type { BusinessProfileIntakeType } from "./schema";

const BUSINESS_PROFILES_TABLE = "business_profiles";
export const DEFAULT_BUSINESS_PROFILE_PROJECT_ID = "default-project";

type BusinessProfileStatus = "failed" | "preparing";

type BusinessProfileRow = {
  analysis_id: string | null;
  content_hash: string;
  context_json: WebsiteBusinessAnalysis;
  created_at: string;
  id: string;
  intake_type: BusinessProfileIntakeType;
  latest_generation_batch_id: string | null;
  preparation_error: string | null;
  preparation_status: BusinessProfileStatus;
  profile_version: number;
  project_id: string;
  source_context: string | null;
  source_url: string | null;
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
  preparationError: string | null;
  preparationStatus: BusinessProfileStatus;
  profileVersion: number;
  projectId: string;
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

  if (existing && contentHash === getStoredHash(existing)) {
    return { changed: false, profile: existing };
  }

  const patch = {
    analysis_id: input.analysisId,
    content_hash: contentHash,
    context_json: input.analysis,
    intake_type: input.intakeType,
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
  return {
    analysisId: row.analysis_id,
    context: row.context_json,
    id: row.id,
    intakeType: row.intake_type,
    latestGenerationBatchId: row.latest_generation_batch_id,
    preparationError: row.preparation_error,
    preparationStatus: row.preparation_status,
    profileVersion: row.profile_version,
    projectId: row.project_id,
    userId: row.user_id,
  };
}
