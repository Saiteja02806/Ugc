import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BackgroundJobsDatabase,
  BackgroundJobRow,
  BackgroundJobUpdate,
  CategoryImageAssetRow,
  CarouselContentPlanItemInsert,
  CarouselGenerationRow,
  CarouselGenerationUpdate,
  CarouselExperimentAssignmentRow,
  CarouselExperimentBatchRow,
  CarouselSlideInsert,
  GenerationProvider,
  ReservedCarouselRoleAssetRow,
  GenerationProviderOperationRow,
  Json,
  SocialPublishProviderOperationKind,
} from "../types.js";
import type {
  CarouselCreativeBrief,
  CarouselPlanningBrief,
  CarouselRecentAcceptedCopy,
} from "./carousel-content-plan.js";
import type { CarouselBusinessVisualProfileId } from "./carousel-business-visual-profile.js";
import type { CarouselStructureId } from "./carousel-structure.js";
import type { CarouselSlideImagePlan } from "./carousel-image-library-relevance.js";
import type { RenderWallTextVideoPayload } from "./render-engine.js";
import {
  getBroadAssetSourceCategorySlugsForProfile,
  isBroadAssetSourceAllowedForProfile,
  isBroadVisualBucketId,
} from "./carousel-broad-visual-bucket-taxonomy.js";

const BACKGROUND_JOBS_TABLE = "background_jobs";
const BUSINESS_PROFILES_TABLE = "business_profiles";
const CAROUSEL_CONTENT_PLAN_BRIEFS_TABLE = "carousel_content_plan_briefs";
const CAROUSEL_CONTENT_PLAN_ITEMS_TABLE = "carousel_content_plan_items";
const CAROUSEL_CONTENT_PLAN_RESERVATIONS_TABLE =
  "carousel_content_plan_reservations";
const CAROUSEL_CONTENT_PLANS_TABLE = "carousel_content_plans";
const CAROUSEL_GENERATIONS_TABLE = "carousel_generations";
const CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE =
  "carousel_experiment_assignments";
const CAROUSEL_EXPERIMENT_BATCHES_TABLE = "carousel_experiment_batches";
const CAROUSEL_SLIDES_TABLE = "carousel_slides";
const CATEGORY_IMAGE_ASSETS_TABLE = "category_image_assets";
const CATEGORY_IMAGE_ASSET_PAGE_SIZE = 1000;
const GENERATION_PROVIDER_OPERATIONS_TABLE = "generation_provider_operations";
const HOOK_VIDEO_DRAFTS_TABLE = "hook_video_drafts";
const INSTAGRAM_ANALYTICS_CONTENT_TABLE = "instagram_analytics_content";
const LIBRARY_CAROUSEL_SLIDES_TABLE = "library_carousel_slides";
const LIBRARY_ITEMS_TABLE = "library_items";
const MEDIA_ASSETS_TABLE = "media_assets";
const SCHEDULED_POSTS_TABLE = "scheduled_posts";
const SCHEDULED_POST_TARGETS_TABLE = "scheduled_post_targets";
const SOCIAL_CONNECTIONS_TABLE = "social_connections";
const SOCIAL_PUBLISH_OPERATIONS_TABLE = "social_publish_operations";
const TRENDING_CREATIVE_EDITS_TABLE = "trending_creative_edits";
const USER_WALL_TEXT_ASSIGNMENTS_TABLE = "user_wall_text_assignments";
const REACTION_CLIP_ASSETS_TABLE = "reaction_clip_assets";
const REACTION_BACKGROUND_ASSETS_TABLE = "reaction_background_assets";
const REACTION_CLIP_PRESENTATIONS_TABLE = "reaction_clip_presentations";
const REACTION_CREATIVES_TABLE = "reaction_creatives";
const USER_REACTION_ASSIGNMENTS_TABLE = "user_reaction_assignments";
const WALL_TEXT_CONTENT_PLAN_ITEMS_TABLE = "wall_text_content_plan_items";
const WALL_TEXT_CONTENT_PLANS_TABLE = "wall_text_content_plans";
const CLAIM_BACKGROUND_JOB_FUNCTION = "claim_background_job";
const CLAIM_SOCIAL_PUBLISH_OPERATION_FUNCTION =
  "claim_social_publish_operation_with_account_lane";
const INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION =
  "increment_category_image_asset_usage";
const VIDEO_RENDER_JOBS_TABLE = "video_render_jobs";
const WEBSITE_ANALYSES_TABLE = "website_analyses";

type ReactionGenerationRunRow = {
  brief_payload: Json | null;
  business_profile_id: string;
  business_profile_version: number;
  generation_context: Json;
  generation_job_id: string;
  id: string;
  project_id: string;
  requested_count: number;
  status: "completed" | "failed" | "partial" | "planning" | "queued" | "rendering";
  user_id: string;
};

type ReactionClipCatalogRow = {
  composition: string | null;
  duration_seconds: number;
  foreground_anchor: string | null;
  foreground_height_percent: number | null;
  has_alpha: boolean;
  id: string;
  reactions: string[];
  source_storage_key: string | null;
  status: "active" | "excluded" | "pending";
  subject_count: string | null;
};

type ReactionBackgroundCatalogRow = {
  context_tags: string[];
  foreground_placement: string | null;
  id: string;
  source_storage_key: string | null;
  status: "active" | "excluded" | "pending";
};

type ReactionGenerationItemRow = {
  background_asset_id: string;
  caption: string;
  clip_asset_id: string;
  content_json: Json;
  duration_seconds: number;
  id: string;
  preview_url: string | null;
  primary_reaction: string;
  reaction_assignment_id: string;
  reaction_creative_id: string;
  render_error: string | null;
  render_plan_json: Json;
  render_status: "failed" | "queued" | "ready" | "rendering";
  rendered_media_asset_id: string | null;
  slot_index: number;
  title: string;
};

export function createSupabaseJobStore(config: {
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
}) {
  const client = createClient<BackgroundJobsDatabase>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return new SupabaseJobStore(client);
}

export class SupabaseJobStore {
  constructor(private readonly client: SupabaseClient<BackgroundJobsDatabase>) {}

  async getJobById(jobId: string) {
    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read background job: ${error.message}`);
    }

    return data;
  }

  async claimJob(params: {
    claimToken: string;
    jobId: string;
    staleAfterSeconds: number;
    workerId: string;
  }) {
    const { data, error } = await this.client.rpc(
      CLAIM_BACKGROUND_JOB_FUNCTION,
      {
        p_claim_token: params.claimToken,
        p_job_id: params.jobId,
        p_stale_after_seconds: params.staleAfterSeconds,
        p_worker_id: params.workerId,
      },
    );

    if (error) {
      throw new Error(`Could not claim background job: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  async heartbeatJob(params: {
    claimToken: string;
    jobId: string;
  }) {
    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        last_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.jobId)
      .eq("claim_token", params.claimToken)
      .in("status", [
        "processing",
        "waiting_external_service",
        "rendering",
        "uploading_output",
        "cancel_requested",
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not heartbeat background job: ${error.message}`);
    }

    return Boolean(data);
  }

  async listDueSocialPublishJobIds(params: {
    limit: number;
    staleAfterSeconds: number;
  }) {
    const { data, error } = await this.client.rpc(
      "list_due_social_publish_jobs",
      {
        p_limit: params.limit,
        p_stale_after_seconds: params.staleAfterSeconds,
      },
    );

    if (error) {
      throw new Error(`Could not list due social publish jobs: ${error.message}`);
    }

    return (data ?? []).map((row) => row.job_id);
  }

  async reconcileSocialScheduleState(params: {
    limit: number;
    staleAfterSeconds: number;
  }) {
    const { data, error } = await this.client.rpc(
      "reconcile_social_schedule_state",
      {
        p_limit: params.limit,
        p_stale_after_seconds: params.staleAfterSeconds,
      },
    );

    if (error) {
      throw new Error(`Could not reconcile social schedules: ${error.message}`);
    }

    return data ?? 0;
  }

  async persistTrendingHookCopyGeneration(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    candidates: Json;
    generatorModel: string;
    jobId: string;
    promptVersion: string;
    selectionVersion: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "persist_trending_hook_copy_generation_v7",
      {
        p_business_profile_id: params.businessProfileId,
        p_business_profile_version: params.businessProfileVersion,
        p_candidates: params.candidates,
        p_generator_model: params.generatorModel,
        p_job_id: params.jobId,
        p_prompt_version: params.promptVersion,
        p_selection_version: params.selectionVersion,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not persist Trending Hook copy: ${error.message}`,
      );
    }

    return data ?? 0;
  }

  async getTrendingHookGenerationRunChunkProgress(params: {
    chunkId: string;
    jobId: string;
    runId: string;
  }) {
    const rpc = this.client.rpc.bind(this.client) as unknown as (
      fn: string,
      args: Record<string, Json>,
    ) => Promise<{
      data: Array<{
        accepted_count: number;
        already_persisted: boolean;
        completed_valid_count: number;
        remaining_valid_count: number;
        run_status: string;
      }> | null;
      error: { message: string } | null;
    }>;
    const { data, error } = await rpc(
      "get_trending_hook_generation_chunk_progress_v1",
      {
        p_chunk_id: params.chunkId,
        p_job_id: params.jobId,
        p_run_id: params.runId,
      },
    );

    if (error) {
      throw new Error(
        `Could not read Trending Hook generation run chunk: ${error.message}`,
      );
    }

    const result = data?.[0];

    if (!result) {
      throw new Error("Trending Hook generation run chunk returned no progress.");
    }

    return result;
  }

  async persistTrendingHookGenerationRunChunk(params: {
    appendOnly?: boolean;
    businessProfileId: string;
    businessProfileVersion: number;
    candidates: Json;
    chunkId: string;
    generatorModel: string;
    jobId: string;
    promptVersion: string;
    runId: string;
    selectionVersion: string;
    userId: string;
  }) {
    const rpc = this.client.rpc.bind(this.client) as unknown as (
      fn: string,
      args: Record<string, Json>,
    ) => Promise<{
      data: Array<{
        accepted_count: number;
        already_persisted: boolean;
        completed_valid_count: number;
        remaining_valid_count: number;
        run_status: string;
      }> | null;
      error: { message: string } | null;
    }>;
    const { data, error } = await rpc(
      params.appendOnly
        ? "persist_trending_hook_generation_chunk_v2"
        : "persist_trending_hook_generation_chunk_v1",
      {
        p_business_profile_id: params.businessProfileId,
        p_business_profile_version: params.businessProfileVersion,
        p_candidates: params.candidates,
        p_chunk_id: params.chunkId,
        p_generator_model: params.generatorModel,
        p_job_id: params.jobId,
        p_prompt_version: params.promptVersion,
        p_run_id: params.runId,
        p_selection_version: params.selectionVersion,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not persist Trending Hook generation run chunk: ${error.message}`,
      );
    }

    const result = data?.[0];

    if (!result) {
      throw new Error("Trending Hook generation run persistence returned no result.");
    }

    return result;
  }

  async failTrendingHookGenerationRunChunk(params: {
    errorMessage: string;
    jobId: string;
  }) {
    const rpc = this.client.rpc.bind(this.client) as unknown as (
      fn: string,
      args: Record<string, Json>,
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    const { data, error } = await rpc(
      "fail_trending_hook_generation_chunk_v1",
      {
        p_error_message: params.errorMessage,
        p_job_id: params.jobId,
      },
    );

    if (error) {
      throw new Error(
        `Could not recover failed Trending Hook generation run chunk: ${error.message}`,
      );
    }

    return data === true;
  }

  async persistValidatedHookCompositionGeneration(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    candidates: Json;
    demoAssetId: string;
    generatorModel: string;
    jobId: string;
    promptVersion: string;
    selectionVersion: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "persist_validated_hook_composition_generation_v7",
      {
        p_business_profile_id: params.businessProfileId,
        p_business_profile_version: params.businessProfileVersion,
        p_candidates: params.candidates,
        p_demo_asset_id: params.demoAssetId,
        p_generator_model: params.generatorModel,
        p_job_id: params.jobId,
        p_prompt_version: params.promptVersion,
        p_selection_version: params.selectionVersion,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not persist validated Hook compositions: ${error.message}`,
      );
    }

    return data ?? [];
  }

  async markCompleted(params: {
    claimToken: string;
    jobId: string;
    output: Record<string, Json | undefined>;
  }) {
    const { data, error } = await this.client.rpc("complete_background_job", {
      p_claim_token: params.claimToken,
      p_job_id: params.jobId,
      p_output: toJsonObject(params.output),
      p_output_reference: getStableOutputReference(params.output),
    });

    if (error) {
      throw new Error(`Could not complete background job: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  async claimTrendingFeedReconciliation(params: { sourceJobId: string }) {
    const { data, error } = await this.client.rpc(
      "claim_due_trending_feed_reconciliations",
      {
        p_limit: 1,
        p_source_job_id: params.sourceJobId,
      },
    );

    if (error) {
      throw new Error(
        `Could not claim durable Trending reconciliation work: ${error.message}`,
      );
    }

    return data?.[0] ?? null;
  }

  async completeTrendingFeedReconciliation(params: { sourceJobId: string }) {
    const { data, error } = await this.client.rpc(
      "complete_trending_feed_reconciliation",
      { p_source_job_id: params.sourceJobId },
    );

    if (error) {
      throw new Error(
        `Could not complete durable Trending reconciliation work: ${error.message}`,
      );
    }

    return data === true;
  }

  async rescheduleTrendingFeedReconciliation(params: {
    message: string;
    sourceJobId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "reschedule_trending_feed_reconciliation",
      {
        p_error_message: params.message,
        p_source_job_id: params.sourceJobId,
      },
    );

    if (error) {
      throw new Error(
        `Could not reschedule durable Trending reconciliation work: ${error.message}`,
      );
    }

    return data === true;
  }

  async reserveGenerationProviderOperation(params: {
    jobId: string;
    metadata?: Record<string, Json | undefined>;
    operationKey: string;
    provider: GenerationProvider;
    requestFingerprint: string;
  }): Promise<{
    operation: GenerationProviderOperationRow;
    shouldSubmit: boolean;
  }> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(GENERATION_PROVIDER_OPERATIONS_TABLE)
      .insert({
        job_id: params.jobId,
        metadata: toJsonObject(params.metadata ?? {}),
        operation_key: params.operationKey,
        provider: params.provider,
        request_fingerprint: params.requestFingerprint,
      })
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return { operation: data, shouldSubmit: true };
    }

    if (error && error.code !== "23505") {
      throw new Error(
        `Could not reserve provider generation: ${error.message}`,
      );
    }

    const existing = await this.getGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
    });

    if (!existing) {
      throw new Error("Provider generation reservation was not found.");
    }

    if (
      existing.provider !== params.provider ||
      existing.request_fingerprint !== params.requestFingerprint
    ) {
      throw new Error(
        "Provider generation reservation does not match this request.",
      );
    }

    if (existing.status === "failed" && existing.retry_allowed) {
      const { data: reset, error: resetError } = await this.client
        .from(GENERATION_PROVIDER_OPERATIONS_TABLE)
        .update({
          last_error_code: null,
          last_error_message: null,
          metadata: toJsonObject(params.metadata ?? {}),
          output_persisted_at: null,
          output_reference: null,
          output_url: null,
          provider_completed_at: null,
          provider_operation_id: null,
          retry_allowed: false,
          status: "reserved",
          submitted_at: null,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("status", "failed")
        .eq("retry_allowed", true)
        .select("*")
        .maybeSingle();

      if (resetError) {
        throw new Error(
          `Could not retry provider generation: ${resetError.message}`,
        );
      }

      if (reset) {
        return { operation: reset, shouldSubmit: true };
      }
    }

    return { operation: existing, shouldSubmit: false };
  }

  async getGenerationProviderOperation(params: {
    jobId: string;
    operationKey: string;
  }) {
    const { data, error } = await this.client
      .from(GENERATION_PROVIDER_OPERATIONS_TABLE)
      .select("*")
      .eq("job_id", params.jobId)
      .eq("operation_key", params.operationKey)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read provider generation: ${error.message}`);
    }

    return data;
  }

  async getLatestPersistedGenerationOperation(jobId: string) {
    const { data, error } = await this.client
      .from(GENERATION_PROVIDER_OPERATIONS_TABLE)
      .select("*")
      .eq("job_id", jobId)
      .in("status", ["provider_succeeded", "output_persisted"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not read persisted provider generation: ${error.message}`,
      );
    }

    return data;
  }

  async markGenerationProviderSubmitted(params: {
    jobId: string;
    operationKey: string;
    providerOperationId: string;
  }) {
    return this.updateGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
      patch: {
        provider_operation_id: params.providerOperationId.slice(0, 1_000),
        retry_allowed: false,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      },
      statuses: ["reserved", "submitted"],
    });
  }

  async markGenerationProviderSucceeded(params: {
    jobId: string;
    metadata?: Record<string, Json | undefined>;
    operationKey: string;
    outputUrl?: string;
    providerOperationId?: string;
  }) {
    return this.updateGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
      patch: {
        last_error_code: null,
        last_error_message: null,
        ...(params.metadata
          ? { metadata: toJsonObject(params.metadata) }
          : {}),
        output_url: params.outputUrl ?? null,
        provider_completed_at: new Date().toISOString(),
        ...(params.providerOperationId
          ? { provider_operation_id: params.providerOperationId.slice(0, 1_000) }
          : {}),
        retry_allowed: false,
        status: "provider_succeeded",
      },
      statuses: ["reserved", "submitted", "provider_succeeded"],
    });
  }

  async markGenerationOutputPersisted(params: {
    jobId: string;
    metadata?: Record<string, Json | undefined>;
    operationKey: string;
    outputReference: string;
    outputUrl: string;
  }) {
    return this.updateGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
      patch: {
        ...(params.metadata
          ? { metadata: toJsonObject(params.metadata) }
          : {}),
        output_persisted_at: new Date().toISOString(),
        output_reference: params.outputReference,
        output_url: params.outputUrl,
        retry_allowed: false,
        status: "output_persisted",
      },
      statuses: [
        "reserved",
        "submitted",
        "provider_succeeded",
        "output_persisted",
      ],
    });
  }

  async markGenerationProviderFailed(params: {
    errorCode: string;
    errorMessage: string;
    jobId: string;
    operationKey: string;
    retryAllowed: boolean;
  }) {
    return this.updateGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
      patch: {
        last_error_code: params.errorCode.slice(0, 120),
        last_error_message: params.errorMessage.slice(0, 1_000),
        retry_allowed: params.retryAllowed,
        status: "failed",
      },
      statuses: ["reserved", "submitted", "failed"],
    });
  }

  async markGenerationProviderSubmissionUncertain(params: {
    errorMessage: string;
    jobId: string;
    operationKey: string;
  }) {
    return this.updateGenerationProviderOperation({
      jobId: params.jobId,
      operationKey: params.operationKey,
      patch: {
        last_error_code: "provider_submission_uncertain",
        last_error_message: params.errorMessage.slice(0, 1_000),
        retry_allowed: false,
        status: "submission_uncertain",
      },
      statuses: ["reserved", "submission_uncertain"],
    });
  }

  private async updateGenerationProviderOperation(params: {
    jobId: string;
    operationKey: string;
    patch: BackgroundJobsDatabase["public"]["Tables"]["generation_provider_operations"]["Update"];
    statuses: GenerationProviderOperationRow["status"][];
  }) {
    const { data, error } = await this.client
      .from(GENERATION_PROVIDER_OPERATIONS_TABLE)
      .update({
        ...params.patch,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", params.jobId)
      .eq("operation_key", params.operationKey)
      .in("status", params.statuses)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update provider generation: ${error.message}`);
    }

    if (!data) {
      throw new Error("Provider generation state changed unexpectedly.");
    }

    return data;
  }

  async markFailed(params: {
    claimToken?: string;
    errorCode?: string;
    errorMessage: string;
    job: BackgroundJobRow;
  }) {
    const now = new Date().toISOString();

    if (params.claimToken) {
      return this.updateClaimedJob({
        claimToken: params.claimToken,
        jobId: params.job.id,
        patch: {
          attempt_count: params.job.attempt_count + 1,
          claim_token: null,
          error_code: params.errorCode?.slice(0, 120) || "JOB_FAILED",
          error_message: params.errorMessage.slice(0, 1_000),
          failed_at: now,
          next_attempt_at: null,
          stage: "failed",
          status: "failed",
          worker_execution_id: null,
        },
      });
    }

    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        attempt_count: params.job.attempt_count + 1,
        error_code: params.errorCode?.slice(0, 120) || "JOB_FAILED",
        error_message: params.errorMessage.slice(0, 1_000),
        failed_at: now,
        next_attempt_at: null,
        stage: "failed",
        status: "failed",
        updated_at: now,
      })
      .eq("id", params.job.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not fail queued background job: ${error.message}`);
    }

    return data;
  }

  async markRetrying(params: {
    claimToken: string;
    errorMessage: string;
    job: BackgroundJobRow;
    retryAt: string;
  }) {
    return this.updateClaimedJob({
      claimToken: params.claimToken,
      jobId: params.job.id,
      patch: {
        attempt_count: params.job.attempt_count + 1,
        claim_token: null,
        completed_at: null,
        error_code: null,
        error_message: params.errorMessage.slice(0, 1_000),
        failed_at: null,
        last_heartbeat_at: null,
        locked_at: null,
        next_attempt_at: params.retryAt,
        progress: null,
        stage: "queued",
        status: "queued",
        worker_execution_id: null,
        worker_id: null,
      },
    });
  }

  async updateJobStage(params: {
    claimToken: string;
    jobId: string;
    progress?: number | null;
    stage: string;
    status:
      | "processing"
      | "rendering"
      | "uploading_output"
      | "waiting_external_service";
  }) {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        last_heartbeat_at: now,
        progress: params.progress ?? null,
        stage: params.stage.slice(0, 120),
        status: params.status,
        updated_at: now,
      })
      .eq("id", params.jobId)
      .eq("claim_token", params.claimToken)
      .in("status", [
        "processing",
        "waiting_external_service",
        "rendering",
        "uploading_output",
      ])
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update background job stage: ${error.message}`);
    }

    return data;
  }

  async deferJob(params: {
    claimToken: string;
    errorMessage: string;
    job: BackgroundJobRow;
    retryAt: string;
  }) {
    return this.updateClaimedJob({
      claimToken: params.claimToken,
      jobId: params.job.id,
      patch: {
        claim_token: null,
        completed_at: null,
        error_code: null,
        error_message: params.errorMessage.slice(0, 1_000),
        failed_at: null,
        last_heartbeat_at: null,
        locked_at: null,
        next_attempt_at: params.retryAt,
        progress: null,
        stage: "queued",
        status: "queued",
        worker_execution_id: null,
        worker_id: null,
      },
    });
  }

  async markCancelled(params: {
    claimToken?: string;
    jobId: string;
  }) {
    const now = new Date().toISOString();
    let query = this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        claim_token: null,
        completed_at: now,
        error_code: null,
        error_message: null,
        locked_at: null,
        progress: null,
        stage: "cancelled",
        status: "cancelled",
        updated_at: now,
        worker_execution_id: null,
        worker_id: null,
      })
      .eq("id", params.jobId)
      .in("status", ["cancel_requested"]);

    if (params.claimToken) {
      query = query.eq("claim_token", params.claimToken);
    }

    const { data, error } = await query.select("*").maybeSingle();

    if (error) {
      throw new Error(`Could not cancel background job: ${error.message}`);
    }

    return data;
  }

  async markEditRenderRendering(renderId: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        started_at: now,
        status: "rendering",
        updated_at: now,
      })
      .eq("render_id", renderId)
      .in("status", ["queued", "rendering"])
      .select("render_id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not mark render as running: ${error.message}`);
    }

    if (data) {
      return { status: "rendering" as const };
    }

    const { data: terminalRender, error: terminalRenderError } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .select("status, output_s3_key, output_url")
      .eq("render_id", renderId)
      .maybeSingle();

    if (terminalRenderError) {
      throw new Error(
        `Could not inspect terminal edit render: ${terminalRenderError.message}`,
      );
    }

    if (
      terminalRender?.status === "completed" &&
      typeof terminalRender.output_s3_key === "string" &&
      terminalRender.output_s3_key.trim() &&
      typeof terminalRender.output_url === "string" &&
      terminalRender.output_url.trim()
    ) {
      return {
        key: terminalRender.output_s3_key,
        status: "completed" as const,
        url: terminalRender.output_url,
      };
    }

    throw new Error("Edited video render is already terminal.");
  }

  async markEditRenderCompleted(params: {
    key: string;
    projectId: string;
    renderId: string;
    sourceVideoId: string;
    url: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc("finalize_edit_render", {
      p_error_message: null,
      p_output_s3_key: params.key,
      p_output_url: params.url,
      p_project_id: params.projectId,
      p_render_id: params.renderId,
      p_source_video_id: params.sourceVideoId,
      p_terminal_status: "completed",
      p_user_id: params.userId,
    });

    if (error) {
      throw new Error(`Could not mark render as completed: ${error.message}`);
    }

    return data === true;
  }

  async markEditRenderFailed(params: {
    errorMessage: string;
    projectId: string;
    renderId: string;
    sourceVideoId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc("finalize_edit_render", {
      p_error_message: params.errorMessage,
      p_output_s3_key: null,
      p_output_url: null,
      p_project_id: params.projectId,
      p_render_id: params.renderId,
      p_source_video_id: params.sourceVideoId,
      p_terminal_status: "failed",
      p_user_id: params.userId,
    });

    if (error) {
      throw new Error(`Could not mark render as failed: ${error.message}`);
    }

    return data === true;
  }

  async markScheduleCombinationRenderStarted(params: {
    jobId: string;
    renderId: string;
    scheduleId: string;
    userId: string;
  }) {
    await this.patchScheduledPost({
      metadataPatch: {
        combinedRenderError: null,
        combinedRenderId: params.renderId,
        combinedRenderJobId: params.jobId,
        combinedRenderStatus: "rendering",
        finalScheduleError: null,
        finalScheduleFailedAt: null,
        finalScheduleStatus: null,
      },
      scheduleId: params.scheduleId,
      userId: params.userId,
    });
  }

  async markScheduleCombinationRenderCompleted(params: {
    autoFinalize: boolean;
    compositionFingerprint: string;
    demoVideoId: string;
    hookAudioAssetId: string | null;
    hookVideoId: string;
    key: string;
    mediaAssetId: string;
    projectId: string;
    ratio: "1:1" | "4:5" | "9:16" | "16:9";
    renderId: string;
    scheduleId: string;
    title: string;
    url: string;
    userId: string;
  }) {
    const now = new Date().toISOString();

    await this.saveMediaAsset({
      collection: "video",
      duration_seconds: null,
      file_name: null,
      file_size_bytes: null,
      height: null,
      id: params.mediaAssetId,
      metadata: {
        compositionFingerprint: params.compositionFingerprint,
        demoVideoId: params.demoVideoId,
        hookAudioAssetId: params.hookAudioAssetId,
        hookVideoId: params.hookVideoId,
        renderId: params.renderId,
        scheduleId: params.scheduleId,
      },
      mime_type: "video/mp4",
      parent_asset_id: isUuid(params.hookVideoId) ? params.hookVideoId : null,
      project_id: params.projectId,
      ratio: params.ratio,
      source_record_id: params.renderId,
      source_type: "combined_render",
      status: "ready",
      storage_key: params.key,
      thumbnail_url: null,
      title: params.title,
      updated_at: now,
      url: params.url,
      user_id: params.userId,
      width: null,
    });

    await this.patchScheduledPost({
      mediaAssetId: params.mediaAssetId,
      metadataPatch: {
        combinedCompositionFingerprint: params.compositionFingerprint,
        combinedDemoMediaId: params.demoVideoId,
        combinedHookAudioAssetId: params.hookAudioAssetId,
        combinedHookMediaId: params.hookVideoId,
        combinedMediaAssetId: params.mediaAssetId,
        combinedRenderError: null,
        combinedRenderId: params.renderId,
        combinedRenderStatus: "ready",
        combinedRenderedAt: now,
        combinedS3Key: params.key,
        combinedVideoUrl: params.url,
        finalScheduleError: null,
        finalScheduleFailedAt: null,
        finalScheduleRenderId: params.renderId,
        finalScheduleStartedAt: params.autoFinalize ? now : null,
        finalScheduleStatus: params.autoFinalize ? "finalizing" : null,
      },
      scheduleId: params.scheduleId,
      userId: params.userId,
    });
  }

  async markHookVideoLibraryRenderStarted(params: {
    draftId: string;
    jobId: string;
    renderId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(HOOK_VIDEO_DRAFTS_TABLE)
      .update({
        render_error: null,
        render_job_id: params.jobId,
        render_status: "rendering",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.draftId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not mark Hook video render started: ${error.message}`);
    }

    if (!data) {
      throw new Error("Hook video render request is stale.");
    }
  }

  async markHookVideoLibraryRenderCompleted(params: {
    compositionFingerprint: string;
    demoVideoId: string;
    draftId: string;
    hookAudioAssetId: string | null;
    hookVideoId: string;
    key: string;
    mediaAssetId: string;
    projectId: string;
    ratio: "1:1" | "4:5" | "9:16" | "16:9";
    renderId: string;
    title: string;
    url: string;
    userId: string;
  }) {
    const now = new Date().toISOString();

    await this.saveMediaAsset({
      collection: "video",
      duration_seconds: null,
      file_name: null,
      file_size_bytes: null,
      height: null,
      id: params.mediaAssetId,
      metadata: {
        compositionFingerprint: params.compositionFingerprint,
        demoVideoId: params.demoVideoId,
        hookAudioAssetId: params.hookAudioAssetId,
        hookVideoDraftId: params.draftId,
        hookVideoId: params.hookVideoId,
        libraryVisibility: "hook_videos_only",
        renderId: params.renderId,
      },
      mime_type: "video/mp4",
      parent_asset_id: params.hookVideoId,
      project_id: params.projectId,
      ratio: params.ratio,
      source_record_id: params.renderId,
      source_type: "combined_render",
      status: "ready",
      storage_key: params.key,
      thumbnail_url: null,
      title: params.title,
      updated_at: now,
      url: params.url,
      user_id: params.userId,
      width: null,
    });

    const { data, error } = await this.client
      .from(HOOK_VIDEO_DRAFTS_TABLE)
      .update({
        render_error: null,
        render_status: "ready",
        rendered_at: now,
        rendered_media_asset_id: params.mediaAssetId,
        rendered_video_url: params.url,
        updated_at: now,
      })
      .eq("id", params.draftId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not finish Hook video render: ${error.message}`);
    }

    if (!data) {
      throw new Error("Hook video render request is stale.");
    }
  }

  async markHookVideoLibraryRenderFailed(params: {
    draftId: string;
    errorMessage: string;
    renderId: string;
    userId: string;
  }) {
    const { error } = await this.client
      .from(HOOK_VIDEO_DRAFTS_TABLE)
      .update({
        render_error: params.errorMessage.slice(0, 500),
        render_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.draftId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"]);

    if (error) {
      throw new Error(`Could not mark Hook video render failed: ${error.message}`);
    }
  }

  async markWallTextRenderStarted(params: {
    assignmentId: string;
    jobId: string;
    renderId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(USER_WALL_TEXT_ASSIGNMENTS_TABLE)
      .update({
        render_error: null,
        render_job_id: params.jobId,
        render_status: "rendering",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.assignmentId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not mark Wall-text render started: ${error.message}`);
    }

    if (!data) {
      throw new Error("Wall-text render assignment is stale.");
    }
  }

  async markWallTextRenderCompleted(params: {
    assignmentId: string;
    attribution: RenderWallTextVideoPayload["attribution"];
    creativeEditId: string | null;
    creativeEditRevision: number | null;
    creativeId: string;
    durationSeconds: number;
    key: string;
    mediaAssetId: string;
    projectId: string;
    renderId: string;
    title: string;
    url: string;
    userId: string;
  }) {
    const now = new Date().toISOString();

    await this.saveMediaAsset({
      collection: "video",
      duration_seconds: params.durationSeconds,
      file_name: null,
      file_size_bytes: null,
      height: 1920,
      id: params.mediaAssetId,
      metadata: {
        assignmentId: params.assignmentId,
        contentHash: params.attribution.contentHash,
        creativeEditId: params.creativeEditId,
        creativeEditRevision: params.creativeEditRevision,
        creativeId: params.creativeId,
        editClassification: params.attribution.editClassification,
        formatId: params.attribution.formatId,
        formatLearningEligible: params.attribution.formatLearningEligible,
        formatVersion: params.attribution.formatVersion,
        instagramReelTemplateId: params.attribution.instagramReelTemplateId,
        renderId: params.renderId,
        selectionMode: params.attribution.selectionMode,
        selectionWeight: params.attribution.selectionWeight,
        selectorVersion: params.attribution.selectorVersion,
        sourceKind: params.attribution.sourceKind,
      },
      mime_type: "video/mp4",
      parent_asset_id: null,
      project_id: params.projectId,
      ratio: "9:16",
      source_record_id: params.renderId,
      source_type: "wall_text_render",
      status: "ready",
      storage_key: params.key,
      thumbnail_url: null,
      title: params.title,
      updated_at: now,
      url: params.url,
      user_id: params.userId,
      width: 1080,
    });

    const { data, error } = await this.client
      .from(USER_WALL_TEXT_ASSIGNMENTS_TABLE)
      .update({
        render_error: null,
        render_status: "ready",
        rendered_at: now,
        rendered_media_asset_id: params.mediaAssetId,
        updated_at: now,
      })
      .eq("id", params.assignmentId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not complete Wall-text render: ${error.message}`);
    }

    if (!data) {
      throw new Error("Wall-text render assignment changed before completion.");
    }
  }

  async hasPendingWallTextSchedules(params: {
    assignmentId: string;
    renderId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .select("id")
      .eq("user_id", params.userId)
      .eq("source_kind", "wall_text_pending")
      .eq("status", "draft")
      .contains("metadata", {
        wallTextAssignmentId: params.assignmentId,
        wallTextRenderId: params.renderId,
      })
      .limit(1);

    if (error) {
      throw new Error(
        `Could not check pending Wall-text schedules: ${error.message}`,
      );
    }

    return (data ?? []).length > 0;
  }

  async markWallTextRenderFailed(params: {
    assignmentId: string;
    errorMessage: string;
    renderId: string;
    userId: string;
  }) {
    const { error } = await this.client
      .from(USER_WALL_TEXT_ASSIGNMENTS_TABLE)
      .update({
        render_error: params.errorMessage.slice(0, 1_000),
        render_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.assignmentId)
      .eq("user_id", params.userId)
      .eq("render_id", params.renderId)
      .in("render_status", ["queued", "rendering"]);

    if (error) {
      throw new Error(`Could not mark Wall-text render failed: ${error.message}`);
    }

    await this.patchPendingWallTextSchedules({
      assignmentId: params.assignmentId,
      metadataPatch: {
        wallTextRenderError: params.errorMessage.slice(0, 500),
        wallTextRenderFailedAt: new Date().toISOString(),
        wallTextRenderStatus: "failed",
      },
      renderId: params.renderId,
      userId: params.userId,
    });
  }

  async markWallTextScheduleFinalizationFailed(params: {
    assignmentId: string;
    errorMessage: string;
    renderId: string;
    userId: string;
  }) {
    await this.patchWallTextSchedules({
      assignmentId: params.assignmentId,
      allowedStatuses: ["draft", "failed", "partially_failed"],
      metadataPatch: {
        finalScheduleError: params.errorMessage.slice(0, 500),
        finalScheduleErrorCode: "wall_text_finalization_delivery_failed",
        finalScheduleFailedAt: new Date().toISOString(),
        finalScheduleRenderId: params.renderId,
        finalScheduleStatus: "failed",
        wallTextRenderStatus: "ready",
      },
      renderId: params.renderId,
      userId: params.userId,
    });
  }

  async markScheduleCombinationFinalizationCompleted(params: {
    finalStatus: string;
    renderId: string;
    scheduleId: string;
    userId: string;
  }) {
    await this.patchScheduledPost({
      metadataPatch: {
        finalScheduleCompletedAt: new Date().toISOString(),
        finalScheduleError: null,
        finalScheduleFailedAt: null,
        finalScheduleRenderId: params.renderId,
        finalScheduleStatus: params.finalStatus,
      },
      scheduleId: params.scheduleId,
      userId: params.userId,
    });
  }

  async markScheduleCombinationFinalizationFailed(params: {
    errorMessage: string;
    renderId: string;
    scheduleId: string;
    userId: string;
  }) {
    await this.patchScheduledPost({
      metadataPatch: {
        finalScheduleError: params.errorMessage.slice(0, 500),
        finalScheduleFailedAt: new Date().toISOString(),
        finalScheduleRenderId: params.renderId,
        finalScheduleStatus: "failed",
      },
      scheduleId: params.scheduleId,
      userId: params.userId,
    });
  }

  async markScheduleCombinationRenderFailed(params: {
    errorMessage: string;
    renderId: string;
    scheduleId: string;
    userId: string;
  }) {
    await this.patchScheduledPost({
      metadataPatch: {
        combinedRenderError: params.errorMessage.slice(0, 500),
        combinedRenderId: params.renderId,
        combinedRenderStatus: "failed",
      },
      scheduleId: params.scheduleId,
      userId: params.userId,
    });
  }

  async getSocialPublishContext(params: {
    targetId: string;
    userId: string;
  }) {
    const { data: target, error: targetError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .select("*")
      .eq("id", params.targetId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (targetError) {
      throw new Error(`Could not load publish target: ${targetError.message}`);
    }

    if (!target) {
      throw new Error("Publish target was not found.");
    }

    const { data: post, error: postError } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .select("*")
      .eq("id", target.scheduled_post_id)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (postError) {
      throw new Error(`Could not load scheduled post: ${postError.message}`);
    }

    if (!post) {
      throw new Error("Scheduled post was not found.");
    }

    let media: BackgroundJobsDatabase["public"]["Tables"]["media_assets"]["Row"] | null = null;
    let carousel: {
      item: BackgroundJobsDatabase["public"]["Tables"]["library_items"]["Row"];
      slides: BackgroundJobsDatabase["public"]["Tables"]["library_carousel_slides"]["Row"][];
    } | null = null;

    if (post.source_kind === "library_item" && post.library_item_id) {
      const { data: item, error: itemError } = await this.client
        .from(LIBRARY_ITEMS_TABLE)
        .select("*")
        .eq("id", post.library_item_id)
        .eq("user_id", params.userId)
        .eq("source_type", "generated_carousel")
        .eq("media_type", "carousel")
        .eq("status", "ready")
        .is("deleted_at", null)
        .maybeSingle();

      if (itemError) {
        throw new Error(`Could not load scheduled carousel: ${itemError.message}`);
      }

      if (!item) {
        throw new Error("Scheduled carousel was not found.");
      }

      const { data: slides, error: slidesError } = await this.client
        .from(LIBRARY_CAROUSEL_SLIDES_TABLE)
        .select("*")
        .eq("library_item_id", item.id)
        .order("slide_number", { ascending: true });

      if (slidesError) {
        throw new Error(
          `Could not load scheduled carousel slides: ${slidesError.message}`,
        );
      }

      carousel = { item, slides: slides ?? [] };
    } else {
      if (!post.media_asset_id) {
        throw new Error("Scheduled post is missing final media.");
      }

      const { data: finalMedia, error: mediaError } = await this.client
        .from(MEDIA_ASSETS_TABLE)
        .select("*")
        .eq("id", post.media_asset_id)
        .eq("user_id", params.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (mediaError) {
        throw new Error(`Could not load final media: ${mediaError.message}`);
      }

      if (!finalMedia) {
        throw new Error("Final media was not found.");
      }

      media = finalMedia;
    }

    const { data: connection, error: connectionError } = await this.client
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select("*")
      .eq("id", target.social_connection_id)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (connectionError) {
      throw new Error(
        `Could not load social connection: ${connectionError.message}`,
      );
    }

    if (!connection) {
      throw new Error("Social connection was not found.");
    }

    return {
      carousel,
      connection,
      media,
      post,
      target,
    };
  }

  async getSocialPublishOperation(params: {
    targetId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(SOCIAL_PUBLISH_OPERATIONS_TABLE)
      .select("*")
      .eq("scheduled_post_target_id", params.targetId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load social publish operation: ${error.message}`);
    }

    return data;
  }

  async claimSocialPublishOperation(params: {
    claimToken: string;
    jobId: string;
    platform: "instagram" | "tiktok" | "youtube";
    staleAfterSeconds: number;
    targetId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      CLAIM_SOCIAL_PUBLISH_OPERATION_FUNCTION,
      {
        p_claim_token: params.claimToken,
        p_job_id: params.jobId,
        p_platform: params.platform,
        p_stale_after_seconds: params.staleAfterSeconds,
        p_target_id: params.targetId,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(`Could not claim social publish operation: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  async saveSocialPublishProviderOperation(params: {
    claimToken: string;
    metadata?: Json;
    operationId: string;
    providerOperationId: string;
    providerOperationKind: SocialPublishProviderOperationKind;
  }) {
    const { data, error } = await this.client
      .from(SOCIAL_PUBLISH_OPERATIONS_TABLE)
      .update({
        last_error_code: null,
        last_error_message: null,
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        provider_operation_id: params.providerOperationId.slice(0, 4_096),
        provider_operation_kind: params.providerOperationKind,
        status: "initialized",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.operationId)
      .eq("active_claim_token", params.claimToken)
      .neq("status", "published")
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not save provider publish operation: ${error.message}`);
    }

    return data;
  }

  async markSocialPublishOperationPublished(params: {
    claimToken: string;
    operationId: string;
    platformPostId: string;
    platformPostUrl: string | null;
  }) {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(SOCIAL_PUBLISH_OPERATIONS_TABLE)
      .update({
        active_claim_token: null,
        active_job_id: null,
        claimed_at: null,
        last_error_code: null,
        last_error_message: null,
        platform_post_id: params.platformPostId,
        platform_post_url: params.platformPostUrl,
        published_at: now,
        status: "published",
        updated_at: now,
      })
      .eq("id", params.operationId)
      .eq("active_claim_token", params.claimToken)
      .neq("status", "published")
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not complete social publish operation: ${error.message}`);
    }

    return data;
  }

  async releaseSocialPublishOperation(params: {
    claimToken: string;
    errorCode: string;
    errorMessage: string;
    metadata?: Json;
    operationId: string;
  }) {
    const { data, error } = await this.client
      .from(SOCIAL_PUBLISH_OPERATIONS_TABLE)
      .update({
        active_claim_token: null,
        active_job_id: null,
        claimed_at: null,
        last_error_code: params.errorCode,
        last_error_message: params.errorMessage.slice(0, 500),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.operationId)
      .eq("active_claim_token", params.claimToken)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not release social publish operation: ${error.message}`);
    }

    return Boolean(data);
  }

  async markSocialPublishTargetPublishing(params: {
    targetId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: target, error: targetError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .update({
        status: "publishing",
        updated_at: now,
      })
      .eq("id", params.targetId)
      .eq("user_id", params.userId)
      .select("scheduled_post_id")
      .maybeSingle();

    if (targetError) {
      throw new Error(
        `Could not mark publish target publishing: ${targetError.message}`,
      );
    }

    if (!target) {
      throw new Error("Publish target was not found.");
    }

    const { error: postError } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .update({
        status: "publishing",
        updated_at: now,
      })
      .eq("id", target.scheduled_post_id)
      .eq("user_id", params.userId);

    if (postError) {
      throw new Error(`Could not mark schedule publishing: ${postError.message}`);
    }
  }

  async markSocialPublishTargetRetrying(params: {
    errorCode: string;
    errorMessage: string;
    metadata?: Json;
    nextRetryAt: string;
    targetId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: target, error: targetError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .update({
        last_error_code: params.errorCode,
        last_error_message: params.errorMessage.slice(0, 500),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        next_retry_at: params.nextRetryAt,
        status: "publishing",
        updated_at: now,
      })
      .eq("id", params.targetId)
      .eq("user_id", params.userId)
      .eq("status", "publishing")
      .select("scheduled_post_id")
      .maybeSingle();

    if (targetError) {
      throw new Error(
        `Could not record publish retry: ${targetError.message}`,
      );
    }

    if (!target) {
      return false;
    }

    const { error: postError } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .update({
        last_error_code: params.errorCode,
        status: "publishing",
        updated_at: now,
      })
      .eq("id", target.scheduled_post_id)
      .eq("user_id", params.userId)
      .neq("status", "cancelled");

    if (postError) {
      throw new Error(`Could not record schedule retry: ${postError.message}`);
    }

    return true;
  }

  async markSocialPublishTargetPublished(params: {
    platformPostId: string;
    platformPostUrl: string | null;
    targetId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: target, error: targetError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .update({
        next_retry_at: null,
        platform_post_id: params.platformPostId,
        platform_post_url: params.platformPostUrl,
        published_at: now,
        status: "published",
        updated_at: now,
      })
      .eq("id", params.targetId)
      .eq("user_id", params.userId)
      .select("scheduled_post_id")
      .maybeSingle();

    if (targetError) {
      throw new Error(
        `Could not mark publish target published: ${targetError.message}`,
      );
    }

    if (!target) {
      throw new Error("Publish target was not found.");
    }

    await this.refreshScheduledPostStatus({
      fallbackStatus: "published",
      scheduledPostId: target.scheduled_post_id,
      userId: params.userId,
    });
  }

  async markSocialPublishTargetFailed(params: {
    errorCode: string;
    errorMessage: string;
    metadata?: Json;
    targetId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: target, error: targetError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .update({
        last_error_code: params.errorCode,
        last_error_message: params.errorMessage.slice(0, 500),
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
        next_retry_at: null,
        status: "failed",
        updated_at: now,
      })
      .eq("id", params.targetId)
      .eq("user_id", params.userId)
      .in("status", ["scheduling", "scheduled", "publishing"])
      .select("scheduled_post_id")
      .maybeSingle();

    if (targetError) {
      throw new Error(`Could not mark publish target failed: ${targetError.message}`);
    }

    if (!target) {
      return false;
    }

    await this.refreshScheduledPostStatus({
      errorCode: params.errorCode,
      fallbackStatus: "failed",
      scheduledPostId: target.scheduled_post_id,
      userId: params.userId,
    });

    return true;
  }

  async registerInstagramAnalyticsPublication(params: {
    accountName: string | null;
    accountUsername: string | null;
    caption: string | null;
    connectionId: string;
    contentType: "carousel" | "reel";
    platformPostId: string;
    platformPostUrl: string | null;
    publishedAt: string;
    userId: string;
  }) {
    const { error } = await this.client
      .from(INSTAGRAM_ANALYTICS_CONTENT_TABLE)
      .upsert(
        {
          account_name: params.accountName,
          account_username: params.accountUsername,
          caption: params.caption,
          comments: null,
          content_type: params.contentType,
          interactions: null,
          last_sync_error: null,
          likes: null,
          media_type:
            params.contentType === "carousel" ? "CAROUSEL_ALBUM" : "VIDEO",
          metrics_synced_at: null,
          permalink: params.platformPostUrl,
          platform_media_id: params.platformPostId,
          published_at: params.publishedAt,
          reach: null,
          saves: null,
          shares: null,
          social_connection_id: params.connectionId,
          thumbnail_synced_at: null,
          thumbnail_url: null,
          user_id: params.userId,
          views: null,
        },
        {
          ignoreDuplicates: true,
          onConflict: "user_id,social_connection_id,platform_media_id",
        },
      );

    if (error) {
      throw new Error(
        `Could not register Instagram analytics publication: ${error.message}`,
      );
    }
  }

  async markSocialPublishTargetActionRequired(params: {
    errorCode: string;
    errorMessage: string;
    metadata?: Json;
    targetId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "mark_social_publish_target_action_required",
      {
        p_error_code: params.errorCode,
        p_error_message: params.errorMessage,
        p_metadata: params.metadata ?? {},
        p_target_id: params.targetId,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not mark publish target action required: ${error.message}`,
      );
    }

    return data;
  }

  async claimSocialConnectionTokenRefresh(params: {
    claimToken: string;
    connectionId: string;
    staleAfterSeconds: number;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "claim_social_connection_token_refresh",
      {
        p_claim_token: params.claimToken,
        p_connection_id: params.connectionId,
        p_stale_after_seconds: params.staleAfterSeconds,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(`Could not claim social token refresh: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  async getSocialPublishAccountLane(params: {
    connectionId: string;
    platform: "instagram" | "tiktok" | "youtube";
  }) {
    const { data, error } = await this.client
      .from("social_publish_account_lanes")
      .select("*")
      .eq("platform", params.platform)
      .eq("social_connection_id", params.connectionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load social publish account lane: ${error.message}`);
    }

    return data;
  }

  async completeSocialConnectionTokenRefresh(params: {
    accessTokenCiphertext: string;
    claimToken: string;
    connectionId: string;
    expiresAt: string | null;
    refreshExpiresAt: string | null;
    refreshTokenCiphertext: string | null;
    scopes: string[];
    status: "connected" | "permission_missing";
    tokenType: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "complete_social_connection_token_refresh",
      {
        p_access_token_ciphertext: params.accessTokenCiphertext,
        p_claim_token: params.claimToken,
        p_connection_id: params.connectionId,
        p_expires_at: params.expiresAt,
        p_refresh_expires_at: params.refreshExpiresAt,
        p_refresh_token_ciphertext: params.refreshTokenCiphertext,
        p_scopes: params.scopes,
        p_status: params.status,
        p_token_type: params.tokenType,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(`Could not save social token refresh: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  async releaseSocialConnectionTokenRefresh(params: {
    claimToken: string;
    connectionId: string;
    errorCode: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "release_social_connection_token_refresh",
      {
        p_claim_token: params.claimToken,
        p_connection_id: params.connectionId,
        p_error_code: params.errorCode,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(`Could not release social token refresh: ${error.message}`);
    }

    return data;
  }

  async updateSocialConnectionAccessToken(params: {
    accessTokenCiphertext: string;
    connectionId: string;
    expiresAt: string | null;
    tokenType: string | null;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(SOCIAL_CONNECTIONS_TABLE)
      .update({
        access_token_ciphertext: params.accessTokenCiphertext,
        expires_at: params.expiresAt,
        last_error_code: null,
        status: "connected",
        token_type: params.tokenType,
        updated_at: now,
      })
      .eq("id", params.connectionId)
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(`Could not update social connection token: ${error.message}`);
    }
  }

  async getCarouselGeneration(carouselId: string) {
    const { data, error } = await this.client
      .from(CAROUSEL_GENERATIONS_TABLE)
      .select("*")
      .eq("id", carouselId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load carousel generation: ${error.message}`);
    }

    return data;
  }

  async getCarouselExperimentBatch(experimentBatchId: string) {
    const { data, error } = await this.client
      .from(CAROUSEL_EXPERIMENT_BATCHES_TABLE)
      .select("*")
      .eq("id", experimentBatchId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not load Carousel experiment batch: ${error.message}`,
      );
    }

    return data;
  }

  async getBusinessProfileForCarousel(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(BUSINESS_PROFILES_TABLE)
      .select("*")
      .eq("id", params.businessProfileId)
      .eq("user_id", params.userId)
      .eq("profile_version", params.businessProfileVersion)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not load the current business profile for Carousel generation: ${error.message}`,
      );
    }

    return data;
  }

  async getCarouselContentPlan(params: {
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(CAROUSEL_CONTENT_PLANS_TABLE)
      .select("*")
      .eq("id", params.planId)
      .eq("user_id", params.userId)
      .eq("generation_job_id", params.jobId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load Carousel content plan: ${error.message}`);
    }

    return data;
  }

  async listCarouselContentPlanItems(params: {
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(CAROUSEL_CONTENT_PLAN_ITEMS_TABLE)
      .select("*")
      .eq("plan_id", params.planId)
      .eq("user_id", params.userId)
      .order("sequence_index", { ascending: true });

    if (error) {
      throw new Error(
        `Could not load Carousel content-plan items: ${error.message}`,
      );
    }

    return data ?? [];
  }

  async listPriorCarouselContentPlanItems(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    periodStartDate: string;
    userId: string;
  }) {
    const { data: priorPlan, error: planError } = await this.client
      .from(CAROUSEL_CONTENT_PLANS_TABLE)
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

    return this.listCarouselContentPlanItems({
      planId: priorPlan.id,
      userId: params.userId,
    });
  }

  async getWallTextContentPlan(params: {
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(WALL_TEXT_CONTENT_PLANS_TABLE)
      .select("*")
      .eq("id", params.planId)
      .eq("user_id", params.userId)
      .eq("generation_job_id", params.jobId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load Wall-of-Text content plan: ${error.message}`);
    }
    return data;
  }

  async listWallTextContentPlanItems(params: {
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(WALL_TEXT_CONTENT_PLAN_ITEMS_TABLE)
      .select("*")
      .eq("plan_id", params.planId)
      .eq("user_id", params.userId)
      .order("sequence_index", { ascending: true });

    if (error) {
      throw new Error(
        `Could not load Wall-of-Text content-plan items: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async listPriorWallTextContentPlanItems(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    periodStartDate: string;
    userId: string;
  }) {
    const { data: priorPlan, error: planError } = await this.client
      .from(WALL_TEXT_CONTENT_PLANS_TABLE)
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
      throw new Error(
        `Could not load the prior Wall-of-Text content plan: ${planError.message}`,
      );
    }
    if (!priorPlan) return [];

    return this.listWallTextContentPlanItems({
      planId: priorPlan.id,
      userId: params.userId,
    });
  }

  async persistWallTextContentPlanBriefChunk(params: {
    briefs: Json;
    items: Json;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "persist_wall_text_content_plan_brief_chunk",
      {
        p_briefs: params.briefs,
        p_items: params.items,
        p_plan_id: params.planId,
        p_user_id: params.userId,
      },
    );
    if (error) {
      throw new Error(
        `Could not persist Wall-of-Text creative-brief chunk: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async completeWallTextContentPlanGeneration(params: {
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "complete_wall_text_content_plan_generation",
      {
        p_job_id: params.jobId,
        p_plan_id: params.planId,
        p_user_id: params.userId,
      },
    );
    if (error) {
      throw new Error(`Could not activate Wall-of-Text content plan: ${error.message}`);
    }
    return data;
  }

  async failWallTextContentPlanGeneration(params: {
    errorMessage: string;
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const { error } = await this.client
      .from(WALL_TEXT_CONTENT_PLANS_TABLE)
      .update({
        failed_at: new Date().toISOString(),
        failure_reason: params.errorMessage.slice(0, 1_000),
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.planId)
      .eq("user_id", params.userId)
      .eq("generation_job_id", params.jobId)
      .eq("status", "generating");
    if (error) {
      throw new Error(`Could not fail Wall-of-Text content plan: ${error.message}`);
    }
  }

  async getCarouselCreativeBrief(
    generation: CarouselGenerationRow,
  ): Promise<CarouselCreativeBrief> {
    if (
      !generation.business_profile_id ||
      generation.business_profile_version === null ||
      !generation.content_plan_id ||
      !generation.content_plan_item_id ||
      !generation.content_plan_reservation_id
    ) {
      throw new Error(
        "Carousel generation is missing its content-plan provenance.",
      );
    }

    const [{ data: plan, error: planError }, { data: item, error: itemError }] =
      await Promise.all([
        this.client
          .from(CAROUSEL_CONTENT_PLANS_TABLE)
          .select("*")
          .eq("id", generation.content_plan_id)
          .eq("user_id", generation.user_id)
          .eq("business_profile_id", generation.business_profile_id)
          .eq("business_profile_version", generation.business_profile_version)
          .eq("status", "active")
          .maybeSingle(),
        this.client
          .from(CAROUSEL_CONTENT_PLAN_ITEMS_TABLE)
          .select("*")
          .eq("id", generation.content_plan_item_id)
          .eq("plan_id", generation.content_plan_id)
          .eq("user_id", generation.user_id)
          .eq("reservation_token", generation.content_plan_reservation_id)
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
        ? await this.getCarouselPlanningBrief({
            briefId: item.creative_brief_id,
            planId: generation.content_plan_id,
            userId: generation.user_id,
          })
        : null);

    return {
      businessDescription: plan.business_description,
      contentPlanId: plan.id,
      contentPlanItemId: item.id,
      creativeSeed: item.creative_seed,
      emotion: item.emotion,
      planningBrief,
    };
  }

  async listRecentAcceptedCarouselCopy(params: {
    businessProfileId: string;
    excludeGenerationBatchId: string;
    limit?: number;
    userId: string;
  }): Promise<CarouselRecentAcceptedCopy[]> {
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 10);
    const { data: generations, error } = await this.client
      .from(CAROUSEL_GENERATIONS_TABLE)
      .select("*")
      .eq("business_profile_id", params.businessProfileId)
      .eq("user_id", params.userId)
      .eq("status", "completed")
      .neq("generation_batch_id", params.excludeGenerationBatchId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(
        `Could not load recent accepted Carousel generations: ${error.message}`,
      );
    }

    const rows = await Promise.all(
      (generations ?? []).map(async (generation) => {
        const slides = await this.listCarouselSlides(generation.id);

        return {
          contentPlanItemId: generation.content_plan_item_id,
          formatId: generation.content_format_id,
          generationId: generation.id,
          slides: slides
            .filter((slide) => slide.status === "ready")
            .map((slide) => ({
              ctaText: slide.cta_text,
              headline: slide.headline,
              slideNumber: slide.slide_number,
              subtext: slide.subtext,
            })),
          structureId: generation.structure_id,
        } satisfies CarouselRecentAcceptedCopy;
      }),
    );

    return rows.filter((row) => row.slides.length > 0);
  }

  async insertCarouselContentPlanItems(rows: CarouselContentPlanItemInsert[]) {
    if (rows.length === 0) return [];

    const { data, error } = await this.client
      .from(CAROUSEL_CONTENT_PLAN_ITEMS_TABLE)
      .insert(rows)
      .select("*");

    if (error) {
      throw new Error(
        `Could not persist Carousel content-plan items: ${error.message}`,
      );
    }

    return data ?? [];
  }

  async persistCarouselContentPlanBriefChunk(params: {
    briefs: Json;
    items: Json;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "persist_carousel_content_plan_brief_chunk",
      {
        p_briefs: params.briefs,
        p_items: params.items,
        p_plan_id: params.planId,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not persist Carousel creative-brief chunk: ${error.message}`,
      );
    }

    return data ?? [];
  }

  async completeCarouselContentPlanGeneration(params: {
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "complete_carousel_content_plan_generation",
      {
        p_job_id: params.jobId,
        p_plan_id: params.planId,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not activate Carousel content plan: ${error.message}`,
      );
    }

    return data;
  }

  async consumeCarouselContentPlanItem(params: {
    carouselGenerationId: string;
    planItemId: string;
    reservationToken: string;
    userId: string;
  }) {
    const { data, error } = await this.client.rpc(
      "consume_carousel_content_plan_item",
      {
        p_carousel_generation_id: params.carouselGenerationId,
        p_plan_item_id: params.planItemId,
        p_reservation_token: params.reservationToken,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not consume Carousel content-plan item: ${error.message}`,
      );
    }

    return data;
  }

  async releaseCarouselContentPlanReservationByToken(params: {
    reason: string;
    reservationToken: string;
    userId: string;
  }) {
    const { data: reservation, error: reservationError } = await this.client
      .from(CAROUSEL_CONTENT_PLAN_RESERVATIONS_TABLE)
      .select("*")
      .eq("id", params.reservationToken)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (reservationError) {
      throw new Error(
        `Could not load Carousel content-plan reservation: ${reservationError.message}`,
      );
    }

    if (!reservation || reservation.status !== "active") return 0;

    const { data, error } = await this.client.rpc(
      "release_carousel_content_plan_reservation",
      {
        p_release_reason: params.reason,
        p_reservation_key: reservation.reservation_key,
        p_user_id: params.userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not release Carousel content-plan reservation: ${error.message}`,
      );
    }

    return data ?? 0;
  }

  async failCarouselContentPlanGeneration(params: {
    errorMessage: string;
    jobId: string;
    planId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(CAROUSEL_CONTENT_PLANS_TABLE)
      .update({
        failed_at: now,
        failure_reason: params.errorMessage.slice(0, 1_000),
        status: "failed",
        updated_at: now,
      })
      .eq("id", params.planId)
      .eq("user_id", params.userId)
      .eq("generation_job_id", params.jobId)
      .eq("status", "generating");

    if (error) {
      throw new Error(
        `Could not fail Carousel content plan: ${error.message}`,
      );
    }
  }

  async listCarouselBatchContentHistory(params: {
    businessProfileId: string;
    excludeCarouselId: string;
    generationBatchId: string;
    limit?: number;
    structureId: CarouselStructureId;
  }) {
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 10);
    const { data, error } = await this.client
      .from(CAROUSEL_GENERATIONS_TABLE)
      .select("*")
      .eq("business_profile_id", params.businessProfileId)
      .eq("generation_batch_id", params.generationBatchId)
      .eq("structure_id", params.structureId)
      .neq("id", params.excludeCarouselId)
      .in("status", ["processing", "completed"])
      .not("content_topic_id", "is", null)
      .order("updated_at", { ascending: false })
      .order("candidate_index", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(
        `Could not load current Carousel batch content history: ${error.message}`,
      );
    }

    return data ?? [];
  }

  async getTrendingCarouselEdit(params: {
    editId: string;
    revision: number;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(TRENDING_CREATIVE_EDITS_TABLE)
      .select("*")
      .eq("id", params.editId)
      .eq("user_id", params.userId)
      .eq("format", "carousel")
      .eq("revision", params.revision)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load Trending Carousel edit: ${error.message}`);
    }

    return data;
  }

  async listCarouselSlides(carouselId: string) {
    const { data, error } = await this.client
      .from(CAROUSEL_SLIDES_TABLE)
      .select("*")
      .eq("carousel_generation_id", carouselId)
      .order("slide_number", { ascending: true });

    if (error) {
      throw new Error(`Could not load Carousel slides: ${error.message}`);
    }

    return data ?? [];
  }

  async markTrendingCarouselEditRendering(params: {
    editId: string;
    jobId: string;
    revision: number;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(TRENDING_CREATIVE_EDITS_TABLE)
      .update({
        render_error: null,
        render_status: "rendering",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.editId)
      .eq("user_id", params.userId)
      .eq("revision", params.revision)
      .eq("render_job_id", params.jobId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not mark Trending Carousel edit as rendering: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error("Trending Carousel edit render is stale.");
    }
  }

  async markTrendingCarouselEditReady(params: {
    editId: string;
    jobId: string;
    output: Json;
    revision: number;
    userId: string;
  }) {
    const { data, error } = await this.client
      .from(TRENDING_CREATIVE_EDITS_TABLE)
      .update({
        render_error: null,
        render_output_json: params.output,
        render_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.editId)
      .eq("user_id", params.userId)
      .eq("revision", params.revision)
      .eq("render_job_id", params.jobId)
      .in("render_status", ["queued", "rendering"])
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not complete Trending Carousel edit render: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error("Trending Carousel edit changed before render completion.");
    }
  }

  async markTrendingCarouselEditFailed(params: {
    editId: string;
    errorMessage: string;
    jobId: string;
    revision: number;
    userId: string;
  }) {
    const { error } = await this.client
      .from(TRENDING_CREATIVE_EDITS_TABLE)
      .update({
        render_error: params.errorMessage.slice(0, 1_000),
        render_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.editId)
      .eq("user_id", params.userId)
      .eq("revision", params.revision)
      .eq("render_job_id", params.jobId)
      .in("render_status", ["queued", "rendering"]);

    if (error) {
      throw new Error(
        `Could not fail Trending Carousel edit render: ${error.message}`,
      );
    }
  }

  async updateCarouselGeneration(
    carouselId: string,
    patch: CarouselGenerationUpdate,
  ) {
    const { error } = await this.client
      .from(CAROUSEL_GENERATIONS_TABLE)
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", carouselId);

    if (error) {
      throw new Error(`Could not update carousel generation: ${error.message}`);
    }
  }

  async updateCarouselExperimentAssignment(
    assignmentId: string,
    patch: Partial<CarouselExperimentAssignmentRow>,
  ) {
    const { error } = await this.client
      .from(CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", assignmentId);

    if (error) {
      throw new Error(`Could not update Carousel experiment assignment: ${error.message}`);
    }
  }

  async updateCarouselExperimentBatch(
    experimentBatchId: string,
    patch: Partial<CarouselExperimentBatchRow>,
  ) {
    const { error } = await this.client
      .from(CAROUSEL_EXPERIMENT_BATCHES_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", experimentBatchId);

    if (error) {
      throw new Error(`Could not update Carousel experiment batch: ${error.message}`);
    }
  }

  async takeOverCarouselExperimentBatchWithStructure2(params: {
    experimentBatchId: string;
    failureReason: string;
    planningAttemptCount: 2;
  }) {
    const { data, error } = await this.client.rpc(
      "take_over_carousel_experiment_batch_with_structure_2",
      {
        p_experiment_batch_id: params.experimentBatchId,
        p_failure_reason: params.failureReason,
        p_planning_attempt_count: params.planningAttemptCount,
      },
    );

    if (error) {
      throw new Error(
        `Could not resolve the Carousel batch to Structure 2: ${error.message}`,
      );
    }

    const batch = data?.[0] ?? null;
    if (
      !batch ||
      batch.requested_structure_id !== "structure_1" ||
      batch.structure_id !== "structure_2" ||
      batch.structure_resolution_mode !== "planning_fallback" ||
      batch.structure_planning_attempt_count !== 2
    ) {
      throw new Error(
        "Carousel Structure 2 takeover returned an invalid batch resolution.",
      );
    }

    return batch;
  }

  async getWebsiteAnalysisForCarousel(analysisId: string) {
    const { data, error } = await this.client
      .from(WEBSITE_ANALYSES_TABLE)
      .select("*")
      .eq("id", analysisId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load website analysis: ${error.message}`);
    }

    return data;
  }

  async listReadyCategoryImageAssets(params: {
    categorySlug: string;
    limit?: number;
    profileId?: CarouselBusinessVisualProfileId | null;
  }) {
    const requestedLimit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.max(Math.trunc(params.limit), 1)
        : null;
    const pageSize = Math.min(
      requestedLimit ?? CATEGORY_IMAGE_ASSET_PAGE_SIZE,
      CATEGORY_IMAGE_ASSET_PAGE_SIZE,
    );
    const rows: CategoryImageAssetRow[] = [];
    const categorySlugs = params.profileId
      ? getBroadAssetSourceCategorySlugsForProfile(
          params.profileId,
          params.categorySlug,
        )
      : [params.categorySlug];
    let from = 0;

    while (true) {
      const remaining =
        requestedLimit === null ? pageSize : requestedLimit - rows.length;

      if (remaining <= 0) {
        break;
      }

      const currentPageSize = Math.min(pageSize, remaining);
      const query = this.client
        .from(CATEGORY_IMAGE_ASSETS_TABLE)
        .select("*")
        .eq("status", "ready")
        .eq("subject_review_status", "approved")
        .eq("image_subject_class", "object-only")
        .eq("has_human", false)
        .eq("face_count", 0)
        .eq("person_count", 0)
        .is("runtime_exclusion_reason", null);
      const filteredQuery =
        categorySlugs.length === 1
          ? query.eq("category_slug", categorySlugs[0])
          : query.in("category_slug", categorySlugs);
      const { data, error } = await filteredQuery
        .order("usage_count", { ascending: true })
        .order("created_at", { ascending: false })
        .range(from, from + currentPageSize - 1);

      if (error) {
        throw new Error(`Could not list ready category images: ${error.message}`);
      }

      rows.push(...(data ?? []));

      if (!data || data.length < currentPageSize) {
        break;
      }

      from += currentPageSize;
    }

    return rows.filter((asset) => {
      if (!params.profileId || asset.category_slug === params.categorySlug) {
        return true;
      }

      return Boolean(
        asset.broad_visual_bucket &&
          isBroadVisualBucketId(asset.broad_visual_bucket) &&
          isBroadAssetSourceAllowedForProfile({
            broadBucketId: asset.broad_visual_bucket,
            primaryCategorySlug: params.categorySlug,
            profileId: params.profileId,
            sourceCategorySlug: asset.category_slug,
          }),
      );
    });
  }

  async reserveCarouselRoleAssets(params: {
    businessProfileId: string;
    carouselId: string;
    primaryCategorySlug: string;
    slidePlan: readonly CarouselSlideImagePlan[];
    useProductAsset?: boolean;
  }) {
    const { data, error } = await this.client.rpc(
      "reserve_carousel_role_assets_v2",
      {
        p_business_profile_id: params.businessProfileId,
        p_carousel_id: params.carouselId,
        p_primary_category_slug: params.primaryCategorySlug,
        p_slide_plan: params.slidePlan.map((slide) => ({
          asset_role: slide.assetRole,
          category_slug: slide.categorySlug,
          relevance_level: slide.relevanceLevel,
          relevance_reason: slide.relevanceReason,
          selection_type: slide.selectionType,
          slide_number: slide.slideNumber,
        })),
        p_use_product_asset: Boolean(params.useProductAsset),
      },
    );

    if (error) {
      throw new Error(`Could not reserve Carousel role images: ${error.message}`);
    }

    return (data ?? []) as ReservedCarouselRoleAssetRow[];
  }

  async upsertCarouselSlides(rows: CarouselSlideInsert[]) {
    if (rows.length === 0) {
      return;
    }

    const { error } = await this.client
      .from(CAROUSEL_SLIDES_TABLE)
      .upsert(rows, {
        onConflict: "carousel_generation_id,slide_number",
      });

    if (error) {
      throw new Error(`Could not store carousel slides: ${error.message}`);
    }
  }

  async incrementCategoryImageAssetUsage(assetIds: string[]) {
    const usedAssetIds = assetIds.filter(Boolean);

    if (usedAssetIds.length === 0) {
      return;
    }

    const { error } = await this.client.rpc(
      INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION,
      {
        asset_ids: usedAssetIds,
      },
    );

    if (error) {
      throw new Error(
        `Could not update category image usage counts: ${error.message}`,
      );
    }
  }

  async ensureReactionGenerationRun(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    generationContext: Json;
    generationJobId: string;
    projectId: string;
    requestKey: string;
    requestedCount: number;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("ensure_reaction_generation_run_v1", {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_generation_context: params.generationContext,
      p_generation_job_id: params.generationJobId,
      p_project_id: params.projectId,
      p_request_key: params.requestKey,
      p_requested_count: params.requestedCount,
      p_user_id: params.userId,
    });

    const run = data?.[0] ?? null;
    if (error || !run) {
      throw new Error(`Could not ensure Reaction generation run: ${error?.message ?? "no row returned"}`);
    }

    return run as ReactionGenerationRunRow;
  }

  async listActiveReactionCatalog() {
    const client = this.client;
    const [clipsResult, backgroundsResult] = await Promise.all([
      client
        .from(REACTION_CLIP_ASSETS_TABLE)
        .select("id,reactions,subject_count,composition,foreground_anchor,foreground_height_percent,has_alpha,status,source_storage_key,duration_seconds")
        .eq("status", "active")
        .eq("has_alpha", true),
      client
        .from(REACTION_BACKGROUND_ASSETS_TABLE)
        .select("id,context_tags,foreground_placement,status,source_storage_key")
        .eq("status", "active"),
    ]);

    if (clipsResult.error || backgroundsResult.error) {
      throw new Error(
        `Could not load active Reaction catalog: ${clipsResult.error?.message ?? backgroundsResult.error?.message}`,
      );
    }

    return {
      backgrounds: (backgroundsResult.data ?? []) as ReactionBackgroundCatalogRow[],
      clips: (clipsResult.data ?? []) as ReactionClipCatalogRow[],
    };
  }

  async getReactionClipPresentationHistory(userId: string) {
    const client = this.client;
    const { data, error } = await client
      .from(REACTION_CLIP_PRESENTATIONS_TABLE)
      .select("clip_asset_id,presented_at")
      .eq("user_id", userId)
      .order("presented_at", { ascending: false });

    if (error) {
      throw new Error(`Could not load Reaction presentation history: ${error.message}`);
    }

    const history = new Map<string, { lastShownAt: string | null; shownCount: number }>();
    for (const row of (data ?? []) as Array<{ clip_asset_id: string; presented_at: string }>) {
      const current = history.get(row.clip_asset_id) ?? { lastShownAt: null, shownCount: 0 };
      history.set(row.clip_asset_id, {
        lastShownAt: current.lastShownAt ?? row.presented_at,
        shownCount: current.shownCount + 1,
      });
    }
    return history;
  }

  async getReservedReactionClipIds(params: {
    businessProfileId: string;
    businessProfileVersion: number;
    userId: string;
  }) {
    const client = this.client;
    const { data: assignments, error: assignmentError } = await client
      .from(USER_REACTION_ASSIGNMENTS_TABLE)
      .select("reaction_creative_id")
      .eq("user_id", params.userId)
      .eq("business_profile_id", params.businessProfileId)
      .eq("business_profile_version", params.businessProfileVersion)
      .eq("state", "active");

    if (assignmentError) {
      throw new Error(`Could not load active Reaction reservations: ${assignmentError.message}`);
    }

    const creativeIds = (assignments ?? [])
      .map((assignment: { reaction_creative_id: string | null }) => assignment.reaction_creative_id)
      .filter((creativeId: string | null): creativeId is string => Boolean(creativeId));
    if (creativeIds.length === 0) return new Set<string>();

    const { data: creatives, error: creativeError } = await client
      .from(REACTION_CREATIVES_TABLE)
      .select("clip_asset_id")
      .eq("user_id", params.userId)
      .eq("business_profile_id", params.businessProfileId)
      .eq("business_profile_version", params.businessProfileVersion)
      .in("render_status", ["queued", "rendering", "preview_ready"])
      .in("id", creativeIds);

    if (creativeError) {
      throw new Error(`Could not load active Reaction reserved clips: ${creativeError.message}`);
    }

    return new Set(
      (creatives ?? [])
        .map((creative: { clip_asset_id: string | null }) => creative.clip_asset_id)
        .filter((clipAssetId: string | null): clipAssetId is string => Boolean(clipAssetId)),
    );
  }

  async persistReactionGenerationPlan(params: {
    briefPayload: Json;
    generationJobId: string;
    items: Json;
    runId: string;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("persist_reaction_generation_plan_v1", {
      p_brief_payload: params.briefPayload,
      p_generation_job_id: params.generationJobId,
      p_items: params.items,
      p_run_id: params.runId,
      p_user_id: params.userId,
    });
    if (error) {
      throw new Error(`Could not persist Reaction generation plan: ${error.message}`);
    }
    return (data ?? []) as ReactionGenerationItemRow[];
  }

  async saveReactionRenderedMedia(params: {
    creativeId: string;
    durationSeconds: number;
    fileSizeBytes: number;
    key: string;
    mediaAssetId: string;
    projectId: string;
    title: string;
    url: string;
    userId: string;
  }) {
    return this.saveMediaAsset({
      collection: "video",
      duration_seconds: params.durationSeconds,
      file_name: `${params.creativeId}.mp4`,
      file_size_bytes: params.fileSizeBytes,
      height: 1920,
      id: params.mediaAssetId,
      metadata: {
        format: "reaction",
        reactionCreativeId: params.creativeId,
      },
      mime_type: "video/mp4",
      parent_asset_id: null,
      project_id: params.projectId,
      ratio: "9:16",
      source_record_id: params.creativeId,
      source_type: "reaction_render",
      status: "ready",
      storage_key: params.key,
      thumbnail_url: null,
      title: params.title,
      updated_at: new Date().toISOString(),
      url: params.url,
      user_id: params.userId,
      width: 1080,
    });
  }

  async completeReactionGenerationItemRender(params: {
    generationJobId: string;
    itemId: string;
    mediaAssetId: string;
    previewUrl: string;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("complete_reaction_generation_item_render_v1", {
      p_generation_job_id: params.generationJobId,
      p_item_id: params.itemId,
      p_media_asset_id: params.mediaAssetId,
      p_preview_url: params.previewUrl,
      p_user_id: params.userId,
    });
    if (error || data !== true) {
      throw new Error(`Could not complete Reaction render item: ${error?.message ?? "stale item"}`);
    }
  }

  async failReactionGenerationItemRender(params: {
    errorMessage: string;
    generationJobId: string;
    itemId: string;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("fail_reaction_generation_item_render_v1", {
      p_error_message: params.errorMessage,
      p_generation_job_id: params.generationJobId,
      p_item_id: params.itemId,
      p_user_id: params.userId,
    });
    if (error || data !== true) {
      throw new Error(`Could not fail Reaction render item: ${error?.message ?? "stale item"}`);
    }
  }

  async completeReactionGenerationRun(params: {
    generationJobId: string;
    runId: string;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("complete_reaction_generation_run_v1", {
      p_generation_job_id: params.generationJobId,
      p_run_id: params.runId,
      p_user_id: params.userId,
    });
    const result = data?.[0] ?? null;
    if (error || !result) {
      throw new Error(`Could not complete Reaction generation run: ${error?.message ?? "no row returned"}`);
    }
    return result as { failed_count: number; ready_count: number; status: "completed" | "failed" | "partial" };
  }

  async failReactionGenerationRun(params: {
    errorMessage: string;
    generationJobId: string;
    userId: string;
  }) {
    const client = this.client;
    const { data, error } = await client.rpc("fail_reaction_generation_run_v1", {
      p_error_message: params.errorMessage,
      p_generation_job_id: params.generationJobId,
      p_user_id: params.userId,
    });
    if (error) {
      throw new Error(`Could not fail Reaction generation run: ${error.message}`);
    }
    return data === true;
  }

  private async getCarouselPlanningBrief(params: {
    briefId: string;
    planId: string;
    userId: string;
  }): Promise<CarouselPlanningBrief> {
    const { data, error } = await this.client
      .from(CAROUSEL_CONTENT_PLAN_BRIEFS_TABLE)
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

    return {
      audienceContext: data.audience_context,
      creativeSeed: data.creative_seed,
      emotionalTension: data.emotional_tension,
      humanMoment: data.human_moment,
      preferredFormatFamily: data.preferred_format_family,
      supportedAngle: data.supported_angle,
    };
  }

  private async updateClaimedJob(params: {
    claimToken: string;
    jobId: string;
    patch: BackgroundJobUpdate;
  }) {
    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        ...params.patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.jobId)
      .eq("claim_token", params.claimToken)
      .in("status", [
        "processing",
        "waiting_external_service",
        "rendering",
        "uploading_output",
      ])
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update background job: ${error.message}`);
    }

    return data;
  }

  private async patchPendingWallTextSchedules(params: {
    assignmentId: string;
    metadataPatch: Record<string, Json | undefined>;
    renderId: string;
    userId: string;
  }) {
    return this.patchWallTextSchedules({ ...params, onlyPending: true });
  }

  private async patchWallTextSchedules(params: {
    assignmentId: string;
    allowedStatuses?: Array<
      BackgroundJobsDatabase["public"]["Tables"]["scheduled_posts"]["Row"]["status"]
    >;
    metadataPatch: Record<string, Json | undefined>;
    onlyPending?: boolean;
    renderId: string;
    userId: string;
  }) {
    const filter = {
      wallTextAssignmentId: params.assignmentId,
      wallTextRenderId: params.renderId,
    };
    const { data, error } = params.onlyPending
      ? await this.client
          .from(SCHEDULED_POSTS_TABLE)
          .select("id,metadata")
          .eq("user_id", params.userId)
          .eq("source_kind", "wall_text_pending")
          .eq("status", "draft")
          .contains("metadata", filter)
      : params.allowedStatuses
        ? await this.client
            .from(SCHEDULED_POSTS_TABLE)
            .select("id,metadata")
            .eq("user_id", params.userId)
            .in("status", params.allowedStatuses)
            .contains("metadata", filter)
      : await this.client
          .from(SCHEDULED_POSTS_TABLE)
          .select("id,metadata")
          .eq("user_id", params.userId)
          .contains("metadata", filter);

    if (error) {
      throw new Error(
        `Could not load Wall-text schedules: ${error.message}`,
      );
    }

    const now = new Date().toISOString();

    await Promise.all(
      (data ?? []).map(async (schedule) => {
        const update = this.client
          .from(SCHEDULED_POSTS_TABLE)
          .update({
            metadata: toJsonObject({
              ...toJsonRecord(schedule.metadata),
              ...params.metadataPatch,
            }),
            updated_at: now,
          })
          .eq("id", schedule.id)
          .eq("user_id", params.userId);
        const { error: updateError } = params.onlyPending
          ? await update
              .eq("source_kind", "wall_text_pending")
              .eq("status", "draft")
          : params.allowedStatuses
            ? await update.in("status", params.allowedStatuses)
          : await update;

        if (updateError) {
          throw new Error(
            `Could not update Wall-text schedule: ${updateError.message}`,
          );
        }
      }),
    );
  }

  private async patchScheduledPost(params: {
    mediaAssetId?: string | null;
    metadataPatch: Record<string, Json | undefined>;
    scheduleId: string;
    userId: string;
  }) {
    const { data: current, error: readError } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .select("metadata")
      .eq("id", params.scheduleId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (readError) {
      throw new Error(`Could not read schedule metadata: ${readError.message}`);
    }

    if (!current) {
      throw new Error("Schedule was not found for render update.");
    }

    const patch: BackgroundJobsDatabase["public"]["Tables"]["scheduled_posts"]["Update"] = {
      metadata: toJsonObject({
        ...toJsonRecord(current.metadata),
        ...params.metadataPatch,
      }),
      updated_at: new Date().toISOString(),
    };

    if (params.mediaAssetId !== undefined) {
      patch.media_asset_id = params.mediaAssetId;
    }

    const { error } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .update(patch)
      .eq("id", params.scheduleId)
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(
        `Could not update schedule render metadata: ${error.message}`,
      );
    }
  }

  private async refreshScheduledPostStatus(params: {
    errorCode?: string;
    fallbackStatus: "failed" | "published";
    scheduledPostId: string;
    userId: string;
  }) {
    const { data: targets, error: readError } = await this.client
      .from(SCHEDULED_POST_TARGETS_TABLE)
      .select("status")
      .eq("scheduled_post_id", params.scheduledPostId)
      .eq("user_id", params.userId);

    if (readError) {
      throw new Error(`Could not read publish targets: ${readError.message}`);
    }

    const statuses = (targets ?? []).map((target) => target.status);
    const hasFailure =
      statuses.includes("failed") || statuses.includes("action_required");
    const allPublished =
      statuses.length > 0 && statuses.every((status) => status === "published");
    const hasPublished = statuses.includes("published");
    const hasPublishing = statuses.includes("publishing");
    const hasScheduled = statuses.some((status) =>
      ["draft", "scheduled", "scheduling"].includes(status),
    );
    const nextStatus = allPublished
      ? "published"
      : hasFailure && (hasPublished || hasPublishing || hasScheduled)
        ? "partially_failed"
        : hasFailure
          ? "failed"
          : hasPublishing
            ? "publishing"
            : hasScheduled
              ? "scheduled"
              : params.fallbackStatus;
    const now = new Date().toISOString();

    const { error: postError } = await this.client
      .from(SCHEDULED_POSTS_TABLE)
      .update({
        last_error_code: hasFailure ? (params.errorCode ?? null) : null,
        published_at: allPublished ? now : null,
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", params.scheduledPostId)
      .eq("user_id", params.userId);

    if (postError) {
      throw new Error(`Could not update schedule status: ${postError.message}`);
    }
  }

  private async saveMediaAsset(
    row: BackgroundJobsDatabase["public"]["Tables"]["media_assets"]["Insert"],
  ) {
    const { data: existing, error: readError } = await this.client
      .from(MEDIA_ASSETS_TABLE)
      .select("id")
      .eq("user_id", row.user_id)
      .eq("source_type", row.source_type)
      .eq("source_record_id", row.source_record_id ?? row.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) {
      throw new Error(`Could not find generated media asset: ${readError.message}`);
    }

    const operation = existing
      ? this.client.from(MEDIA_ASSETS_TABLE).update(row).eq("id", existing.id)
      : this.client.from(MEDIA_ASSETS_TABLE).insert(row);
    const { error } = await operation;

    if (error) {
      throw new Error(`Could not save generated media asset: ${error.message}`);
    }

    return existing?.id ?? row.id;
  }
}

function toJsonObject(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => {
      return entry[1] !== undefined;
    }),
  );
}

function getStableOutputReference(
  output: Record<string, Json | undefined>,
) {
  for (const field of [
    "mediaAssetId",
    "libraryItemId",
    "renderId",
    "videoId",
    "generationId",
    "key",
    "url",
  ]) {
    const value = output[field];

    if (typeof value === "string" && value.trim()) {
      return `${field}:${value.trim()}`.slice(0, 2_000);
    }
  }

  return null;
}

function toJsonRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function parseCarouselItemPrivateContext(
  value: Json | null,
): CarouselPlanningBrief | null {
  const record = value === null ? null : toJsonRecord(value);
  if (!record) return null;

  const requiredFields = [
    "audienceContext",
    "creativeSeed",
    "emotionalTension",
    "humanMoment",
    "preferredFormatFamily",
    "supportedAngle",
  ] as const;
  if (
    requiredFields.some(
      (field) => typeof record[field] !== "string" || !record[field]?.trim(),
    )
  ) {
    return null;
  }
  if (record.conceptLane !== undefined && typeof record.conceptLane !== "string") {
    return null;
  }

  return {
    audienceContext: record.audienceContext as string,
    ...(typeof record.conceptLane === "string"
      ? { conceptLane: record.conceptLane }
      : {}),
    creativeSeed: record.creativeSeed as string,
    emotionalTension: record.emotionalTension as string,
    humanMoment: record.humanMoment as string,
    preferredFormatFamily: record.preferredFormatFamily as string,
    supportedAngle: record.supportedAngle as string,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
