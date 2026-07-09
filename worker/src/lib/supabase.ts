import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BackgroundJobsDatabase,
  BackgroundJobRow,
  BackgroundJobUpdate,
  CategoryImageAssetRow,
  CarouselGenerationUpdate,
  CarouselSlideInsert,
  Json,
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
const EDITABLE_VIDEOS_TABLE = "editable_videos";
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

  async markProcessing(params: {
    jobId: string;
    workerId: string;
  }) {
    const now = new Date().toISOString();

    return this.updateJob(params.jobId, {
      last_heartbeat_at: now,
      locked_at: now,
      started_at: now,
      status: "processing",
      worker_id: params.workerId,
    });
  }

  async markCompleted(params: {
    jobId: string;
    output: Record<string, Json | undefined>;
  }) {
    const now = new Date().toISOString();

    return this.updateJob(params.jobId, {
      completed_at: now,
      error_message: null,
      output_json: toJsonObject(params.output),
      status: "completed",
    });
  }

  async markFailed(params: {
    errorMessage: string;
    job: BackgroundJobRow;
  }) {
    const now = new Date().toISOString();

    return this.updateJob(params.job.id, {
      attempt_count: params.job.attempt_count + 1,
      completed_at: now,
      error_message: params.errorMessage.slice(0, 1_000),
      status: "failed",
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
    const { error: renderJobError } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        completed_at: now,
        error_message: null,
        output_s3_key: params.key,
        output_url: params.url,
        status: "completed",
        updated_at: now,
      })
      .eq("render_id", params.renderId);

    if (renderJobError) {
      throw new Error(
        `Could not mark render as completed: ${renderJobError.message}`,
      );
    }

    const { error: editableVideoError } = await this.client
      .from(EDITABLE_VIDEOS_TABLE)
      .update({
        rendered_video_url: params.url,
        status: "rendered",
        updated_at: now,
      })
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("source_video_id", params.sourceVideoId)
      .eq("latest_render_id", params.renderId);

    if (editableVideoError) {
      throw new Error(
        `Could not mark editable video as rendered: ${editableVideoError.message}`,
      );
    }
  }

  async markEditRenderFailed(params: {
    errorMessage: string;
    projectId: string;
    renderId: string;
    sourceVideoId: string;
    userId: string;
  }) {
    const now = new Date().toISOString();
    const { error: renderJobError } = await this.client
      .from(VIDEO_RENDER_JOBS_TABLE)
      .update({
        completed_at: now,
        error_message: params.errorMessage.slice(0, 1_000),
        status: "failed",
        updated_at: now,
      })
      .eq("render_id", params.renderId);

    if (renderJobError) {
      throw new Error(
        `Could not mark render as failed: ${renderJobError.message}`,
      );
    }

    const { error: editableVideoError } = await this.client
      .from(EDITABLE_VIDEOS_TABLE)
      .update({
        status: "failed",
        updated_at: now,
      })
      .eq("user_id", params.userId)
      .eq("project_id", params.projectId)
      .eq("source_video_id", params.sourceVideoId)
      .eq("latest_render_id", params.renderId);

    if (editableVideoError) {
      throw new Error(
        `Could not mark editable video render as failed: ${editableVideoError.message}`,
      );
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

  private async updateJob(jobId: string, patch: BackgroundJobUpdate) {
    const { data, error } = await this.client
      .from(BACKGROUND_JOBS_TABLE)
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update background job: ${error.message}`);
    }

    return data;
  }
}

function toJsonObject(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => {
      return entry[1] !== undefined;
    }),
  );
}
