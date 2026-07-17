import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BackgroundJobsDatabase,
  BackgroundJobRow,
  BackgroundJobUpdate,
  CategoryImageAssetRow,
  CarouselGenerationUpdate,
  CarouselSlideInsert,
  Json,
  SocialPublishProviderOperationKind,
} from "../types.js";
import type { CarouselBusinessVisualProfileId } from "./carousel-business-visual-profile.js";
import {
  getBroadAssetSourceCategorySlugsForProfile,
  isBroadAssetSourceAllowedForProfile,
  isBroadVisualBucketId,
} from "./carousel-broad-visual-bucket-taxonomy.js";

const BACKGROUND_JOBS_TABLE = "background_jobs";
const CAROUSEL_GENERATIONS_TABLE = "carousel_generations";
const CAROUSEL_SLIDES_TABLE = "carousel_slides";
const CATEGORY_IMAGE_ASSETS_TABLE = "category_image_assets";
const CATEGORY_IMAGE_ASSET_PAGE_SIZE = 1000;
const DEMO_VIDEOS_TABLE = "demo_videos";
const EDITABLE_VIDEOS_TABLE = "editable_videos";
const LIBRARY_CAROUSEL_SLIDES_TABLE = "library_carousel_slides";
const LIBRARY_ITEMS_TABLE = "library_items";
const MEDIA_ASSETS_TABLE = "media_assets";
const SCHEDULED_POSTS_TABLE = "scheduled_posts";
const SCHEDULED_POST_TARGETS_TABLE = "scheduled_post_targets";
const SOCIAL_CONNECTIONS_TABLE = "social_connections";
const SOCIAL_PUBLISH_OPERATIONS_TABLE = "social_publish_operations";
const CLAIM_BACKGROUND_JOB_FUNCTION = "claim_background_job";
const CLAIM_SOCIAL_PUBLISH_OPERATION_FUNCTION =
  "claim_social_publish_operation";
const INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION =
  "increment_category_image_asset_usage";
const VIDEO_RENDER_JOBS_TABLE = "video_render_jobs";
const WEBSITE_ANALYSES_TABLE = "website_analyses";

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
      .eq("status", "processing")
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

  async markCompleted(params: {
    claimToken: string;
    jobId: string;
    output: Record<string, Json | undefined>;
  }) {
    const now = new Date().toISOString();

    const job = await this.updateClaimedJob({
      claimToken: params.claimToken,
      jobId: params.jobId,
      patch: {
        claim_token: null,
        completed_at: now,
        error_message: null,
        next_attempt_at: null,
        output_json: toJsonObject(params.output),
        status: "completed",
      },
    });

    if (job) {
      await this.registerGeneratedMediaAsset(job, params.output);
    }

    return job;
  }

  async markFailed(params: {
    claimToken?: string;
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
          completed_at: now,
          error_message: params.errorMessage.slice(0, 1_000),
          next_attempt_at: null,
          status: "failed",
        },
      });
    }

    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        attempt_count: params.job.attempt_count + 1,
        completed_at: now,
        error_message: params.errorMessage.slice(0, 1_000),
        next_attempt_at: null,
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
        error_message: params.errorMessage.slice(0, 1_000),
        last_heartbeat_at: null,
        locked_at: null,
        next_attempt_at: params.retryAt,
        status: "queued",
        worker_id: null,
      },
    });
  }

  async markEditRenderRendering(renderId: string) {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        started_at: now,
        status: "rendering",
        updated_at: now,
      })
      .eq("render_id", renderId);

    if (error) {
      throw new Error(`Could not mark render as running: ${error.message}`);
    }
  }

  async markEditRenderCompleted(params: {
    key: string;
    projectId: string;
    renderId: string;
    sourceVideoId: string;
    url: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: completedRenderJob, error: renderJobError } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        completed_at: now,
        error_message: null,
        output_s3_key: params.key,
        output_url: params.url,
        status: "completed",
        updated_at: now,
      })
      .eq("render_id", params.renderId)
      .select("draft_json")
      .maybeSingle();

    if (renderJobError) {
      throw new Error(
        `Could not mark render as completed: ${renderJobError.message}`,
      );
    }

    const renderDraft = completedRenderJob?.draft_json;
    const { data: editableVideo, error: editableVideoReadError } =
      await this.client
        .from(EDITABLE_VIDEOS_TABLE)
        .select("draft_json")
        .eq("user_id", params.userId)
        .eq("project_id", params.projectId)
        .eq("source_video_id", params.sourceVideoId)
        .eq("latest_render_id", params.renderId)
        .is("deleted_at", null)
        .maybeSingle();

    if (editableVideoReadError) {
      throw new Error(
        `Could not load editable video before marking it rendered: ${editableVideoReadError.message}`,
      );
    }

    const draftIsCurrent = areJsonValuesEqual(
      editableVideo?.draft_json,
      renderDraft,
    );
    const { error: editableVideoError } = await this.client
      .from(EDITABLE_VIDEOS_TABLE)
      .update({
        rendered_video_url: params.url,
        status: draftIsCurrent ? "rendered" : "draft",
        ...(draftIsCurrent ? { updated_at: now } : {}),
      })
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("source_video_id", params.sourceVideoId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null);

    if (editableVideoError) {
      throw new Error(
        `Could not mark editable video as rendered: ${editableVideoError.message}`,
      );
    }

    await this.markDemoRenderCompletedIfPresent({
      projectId: params.projectId,
      renderDraft,
      renderId: params.renderId,
      sourceVideoId: params.sourceVideoId,
      url: params.url,
      userId: params.userId,
    });
  }

  async markEditRenderFailed(params: {
    errorMessage: string;
    projectId: string;
    renderId: string;
    sourceVideoId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { data: failedRenderJob, error: renderJobError } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        completed_at: now,
        error_message: params.errorMessage.slice(0, 1_000),
        status: "failed",
        updated_at: now,
      })
      .eq("render_id", params.renderId)
      .select("draft_json")
      .maybeSingle();

    if (renderJobError) {
      throw new Error(
        `Could not mark render as failed: ${renderJobError.message}`,
      );
    }

    const { data: editableVideo, error: editableVideoReadError } =
      await this.client
        .from(EDITABLE_VIDEOS_TABLE)
        .select("draft_json")
        .eq("user_id", params.userId)
        .eq("project_id", params.projectId)
        .eq("source_video_id", params.sourceVideoId)
        .eq("latest_render_id", params.renderId)
        .is("deleted_at", null)
        .maybeSingle();

    if (editableVideoReadError) {
      throw new Error(
        `Could not load editable video before marking render failed: ${editableVideoReadError.message}`,
      );
    }

    const draftIsCurrent = areJsonValuesEqual(
      editableVideo?.draft_json,
      failedRenderJob?.draft_json,
    );
    const { error: editableVideoError } = await this.client
      .from(EDITABLE_VIDEOS_TABLE)
      .update({
        status: draftIsCurrent ? "failed" : "draft",
        ...(draftIsCurrent ? { updated_at: now } : {}),
      })
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("source_video_id", params.sourceVideoId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null);

    if (editableVideoError) {
      throw new Error(
        `Could not mark editable video render as failed: ${editableVideoError.message}`,
      );
    }

    await this.markDemoRenderFailedIfPresent({
      ...params,
      renderDraft: failedRenderJob?.draft_json,
    });
  }

  private async markDemoRenderCompletedIfPresent(params: {
    projectId: string;
    renderDraft: Json | undefined;
    renderId: string;
    sourceVideoId: string;
    url: string;
    userId: string;
  }) {
    const { data: demoVideo, error: demoVideoReadError } = await this.client
      .from(DEMO_VIDEOS_TABLE)
      .select("draft_json")
      .eq("id", params.sourceVideoId)
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (demoVideoReadError) {
      throw new Error(`Could not load demo before marking render completed: ${demoVideoReadError.message}`);
    }

    if (!demoVideo) {
      return;
    }

    const draftIsCurrent = areJsonValuesEqual(
      demoVideo.draft_json,
      params.renderDraft,
    );
    const { error } = await this.client
      .from(DEMO_VIDEOS_TABLE)
      .update({
        error_message: null,
        latest_render_id: params.renderId,
        rendered_video_url: params.url,
        status: draftIsCurrent ? "rendered" : "draft",
        ...(draftIsCurrent ? { updated_at: new Date().toISOString() } : {}),
      })
      .eq("id", params.sourceVideoId)
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Could not mark demo render completed: ${error.message}`);
    }
  }

  private async markDemoRenderFailedIfPresent(params: {
    errorMessage: string;
    projectId: string;
    renderDraft: Json | undefined;
    renderId: string;
    sourceVideoId: string;
    userId: string;
  }) {
    const { data: demoVideo, error: demoVideoReadError } = await this.client
      .from(DEMO_VIDEOS_TABLE)
      .select("draft_json")
      .eq("id", params.sourceVideoId)
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (demoVideoReadError) {
      throw new Error(`Could not load demo before marking render failed: ${demoVideoReadError.message}`);
    }

    if (!demoVideo) {
      return;
    }

    const draftIsCurrent = areJsonValuesEqual(
      demoVideo.draft_json,
      params.renderDraft,
    );
    const { error } = await this.client
      .from(DEMO_VIDEOS_TABLE)
      .update({
        error_message: params.errorMessage.slice(0, 1_000),
        latest_render_id: params.renderId,
        status: draftIsCurrent ? "failed" : "draft",
        ...(draftIsCurrent ? { updated_at: new Date().toISOString() } : {}),
      })
      .eq("id", params.sourceVideoId)
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("latest_render_id", params.renderId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Could not mark demo render failed: ${error.message}`);
    }
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
      .eq("status", "processing")
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update background job: ${error.message}`);
    }

    return data;
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

  private async registerGeneratedMediaAsset(
    job: BackgroundJobRow,
    output: Record<string, Json | undefined>,
  ) {
    if (!job.user_id || !["generate_avatar", "generate_hook_video", "generate_image"].includes(job.job_type)) {
      return;
    }

    const key = getString(output.key);
    const url = getString(output.url);

    if (!key || !url) {
      return;
    }

    const isVideo = job.job_type === "generate_hook_video";
    await this.saveMediaAsset({
      collection: isVideo ? "video" : "image",
      duration_seconds: getNumber(output.durationSeconds),
      file_name: null,
      file_size_bytes: null,
      height: getInteger(output.height),
      id: crypto.randomUUID(),
      metadata: {
        backgroundJobId: job.id,
        jobType: job.job_type,
      },
      mime_type: isVideo ? "video/mp4" : "image/png",
      parent_asset_id: null,
      project_id: job.project_id,
      ratio: getRatio(output.ratio ?? getObjectValue(job.input_json, "aspectRatio")),
      source_record_id: job.id,
      source_type: isVideo ? "generated_video" : "generated_image",
      status: "ready",
      storage_key: key,
      thumbnail_url: isVideo ? getString(output.thumbnailUrl) : url,
      title: isVideo
        ? "Generated influencer video"
        : job.job_type === "generate_avatar"
          ? "Generated influencer image"
          : "Generated image",
      updated_at: new Date().toISOString(),
      url,
      user_id: job.user_id,
      width: getInteger(output.width),
    });
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
  }
}

function toJsonObject(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => {
      return entry[1] !== undefined;
    }),
  );
}

function toJsonRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function getInteger(value: Json | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function getRatio(value: Json | undefined) {
  return value === "9:16" || value === "1:1" || value === "4:5" || value === "16:9" ? value : "other";
}

function areJsonValuesEqual(first: Json | undefined, second: Json | undefined) {
  return stableJsonString(first) === stableJsonString(second);
}

function stableJsonString(value: Json | undefined) {
  return JSON.stringify(normalizeJsonValue(value));
}

function normalizeJsonValue(value: Json | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry): entry is [string, Json] => entry[1] !== undefined)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)]),
    );
  }

  return value ?? null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getObjectValue(value: Json, key: string) {
  return value && typeof value === "object" && !Array.isArray(value) ? value[key] : undefined;
}
