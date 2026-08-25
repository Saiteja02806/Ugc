import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  WALL_TEXT_CONTENT_PLAN_MODEL,
  WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION,
  WALL_TEXT_CONTENT_PLAN_TARGET_COUNT,
  buildWallTextContentPlanDescription,
  buildWallTextPlanningContext,
  type WallTextPlanningContext,
} from "@/lib/trending/wall-text-content-plan";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type WallTextContentPlanRow = {
  business_description: string;
  business_profile_id: string;
  business_profile_version: number;
  generation_job_id: string | null;
  id: string;
  period_end_date: string;
  period_start_date: string;
  plan_version: number;
  planner_model: string;
  planner_prompt_version: string;
  planning_context: WallTextPlanningContext;
  project_id: string;
  status: "active" | "failed" | "generating" | "superseded";
  target_item_count: number;
  timezone: string;
  user_id: string;
};

type WallTextContentPlanDatabase = {
  public: {
    Functions: {
      attach_wall_text_content_plan_generation_job: {
        Args: { p_job_id: string; p_plan_id: string; p_user_id: string };
        Returns: WallTextContentPlanRow;
      };
      ensure_wall_text_content_plan: {
        Args: {
          p_business_description: string;
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_planner_model: string;
          p_planner_prompt_version: string;
          p_planning_context: WallTextPlanningContext;
          p_project_id: string;
          p_target_item_count: number;
          p_timezone: string;
          p_user_id: string;
        };
        Returns: WallTextContentPlanRow;
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

export type WallTextContentPlan = {
  businessDescription: string;
  businessProfileId: string;
  businessProfileVersion: number;
  generationJobId: string | null;
  id: string;
  periodEndDate: string;
  periodStartDate: string;
  planVersion: number;
  plannerModel: string;
  plannerPromptVersion: string;
  planningContext: WallTextPlanningContext;
  projectId: string;
  status: WallTextContentPlanRow["status"];
  targetItemCount: number;
  timezone: string;
  userId: string;
};

let client: SupabaseClient<WallTextContentPlanDatabase> | null = null;

export async function ensureCurrentWallTextContentPlan(params: {
  profile: BusinessProfileRecord;
}) {
  const { data, error } = await getClient().rpc("ensure_wall_text_content_plan", {
    p_business_description: buildWallTextContentPlanDescription(
      params.profile.context,
    ),
    p_business_profile_id: params.profile.id,
    p_business_profile_version: params.profile.profileVersion,
    p_planner_model: WALL_TEXT_CONTENT_PLAN_MODEL,
    p_planner_prompt_version: WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION,
    p_planning_context: buildWallTextPlanningContext(params.profile.context),
    p_project_id: params.profile.projectId,
    p_target_item_count: WALL_TEXT_CONTENT_PLAN_TARGET_COUNT,
    p_timezone: params.profile.trendingTimezone ?? "UTC",
    p_user_id: params.profile.userId,
  });

  if (error) {
    throw new Error(`Could not ensure Wall-of-Text content plan: ${error.message}`);
  }

  return mapPlan(data);
}

export async function attachWallTextContentPlanGenerationJob(params: {
  jobId: string;
  planId: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "attach_wall_text_content_plan_generation_job",
    {
      p_job_id: params.jobId,
      p_plan_id: params.planId,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Could not attach Wall-of-Text content-plan job: ${error.message}`,
    );
  }

  return mapPlan(data);
}

function getClient() {
  if (client) return client;

  const url =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!url || !serviceRoleKey) {
    throw new Error("Wall-of-Text content-plan storage is not configured.");
  }

  client = createClient<WallTextContentPlanDatabase>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

function mapPlan(row: WallTextContentPlanRow): WallTextContentPlan {
  return {
    businessDescription: row.business_description,
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    generationJobId: row.generation_job_id,
    id: row.id,
    periodEndDate: row.period_end_date,
    periodStartDate: row.period_start_date,
    planVersion: row.plan_version,
    plannerModel: row.planner_model,
    plannerPromptVersion: row.planner_prompt_version,
    planningContext: row.planning_context,
    projectId: row.project_id,
    status: row.status,
    targetItemCount: row.target_item_count,
    timezone: row.timezone,
    userId: row.user_id,
  };
}

export type { Json };
