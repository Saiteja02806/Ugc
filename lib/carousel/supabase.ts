import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CATEGORY_IMAGE_ASSETS_TABLE = "category_image_assets";
const MAX_PEXELS_ID_LOOKUP_SIZE = 120;

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type CategoryImageAssetScope = "category" | "shared";
type CategoryImageAssetSourceProvider = "local" | "pexels";
type CategoryImageAssetVariant =
  | "canonical"
  | "cropped_only"
  | "derived_crop"
  | "duplicate"
  | "flat"
  | "preview";

type CategoryImageAssetRow = {
  asset_scope: CategoryImageAssetScope;
  asset_variant: CategoryImageAssetVariant;
  avg_color: string | null;
  base_s3_key: string;
  base_url: string;
  best_for_slide_types: Json;
  broad_visual_bucket: string | null;
  bucket_taxonomy_version: string | null;
  bucket_type: "universal" | "vertical" | null;
  category_slug: string;
  content_tags: Json;
  created_at: string;
  has_human: boolean | null;
  image_subject_class: "clear-face" | "faceless-human" | "object-only" | null;
  height: number | null;
  id: string;
  image_query: string | null;
  orientation: "landscape" | "portrait" | "square";
  pexels_photo_id: string | null;
  pexels_photo_url: string | null;
  pexels_photographer: string | null;
  pexels_photographer_url: string | null;
  mood_tags: Json;
  near_duplicate_group: string | null;
  object_tags: Json;
  primary_vertical: string | null;
  quality_score: number | null;
  canonical_asset_id: string | null;
  license_information: string | null;
  runtime_exclusion_reason: string | null;
  source_query: string | null;
  source_provider: CategoryImageAssetSourceProvider;
  source_file_sha256: string | null;
  source_filename: string | null;
  source_folder: string | null;
  source_metadata: Json;
  source_original_s3_key: string | null;
  source_original_url: string | null;
  source_perceptual_hash: string | null;
  status: "archived" | "failed" | "processing" | "ready";
  subject_analysis: Json | null;
  subject_analyzed_at: string | null;
  subject_analyzer_version: string | null;
  subject_review_status: "approved" | "rejected" | "unreviewed";
  face_count: number | null;
  person_count: number | null;
  max_face_area_ratio: number | null;
  thumb_s3_key: string | null;
  thumb_url: string | null;
  updated_at: string;
  usage_count: number;
  usable_profiles: Json;
  usable_verticals: Json;
  visual_bucket: string | null;
  visual_setting: string | null;
  visual_style: string | null;
  visual_keywords: Json;
  width: number | null;
};

export type CategoryImageAssetStatus = CategoryImageAssetRow["status"];

export type CategoryImageAssetSourcingState = {
  approvedObjectOnlyCount: number;
  rawCandidateCount: number;
  rejectedCount: number;
  unreviewedCount: number;
};

export type CategoryImageAssetInsert = {
  asset_scope?: CategoryImageAssetScope;
  asset_variant?: CategoryImageAssetVariant;
  avg_color?: string | null;
  base_s3_key: string;
  base_url: string;
  best_for_slide_types?: Json;
  broad_visual_bucket?: string | null;
  bucket_taxonomy_version?: string | null;
  bucket_type?: "universal" | "vertical" | null;
  category_slug: string;
  content_tags?: Json;
  has_human?: boolean | null;
  image_subject_class?: "clear-face" | "faceless-human" | "object-only" | null;
  height?: number | null;
  image_query?: string | null;
  canonical_asset_id?: string | null;
  license_information?: string | null;
  orientation?: "landscape" | "portrait" | "square";
  pexels_photo_id?: string | null;
  pexels_photo_url?: string | null;
  pexels_photographer?: string | null;
  pexels_photographer_url?: string | null;
  mood_tags?: Json;
  near_duplicate_group?: string | null;
  object_tags?: Json;
  primary_vertical?: string | null;
  quality_score?: number | null;
  runtime_exclusion_reason?: string | null;
  source_query?: string | null;
  source_provider?: CategoryImageAssetSourceProvider;
  source_file_sha256?: string | null;
  source_filename?: string | null;
  source_folder?: string | null;
  source_metadata?: Json;
  source_original_s3_key?: string | null;
  source_original_url?: string | null;
  source_perceptual_hash?: string | null;
  status?: "archived" | "failed" | "processing" | "ready";
  subject_analysis?: Json | null;
  subject_analyzed_at?: string | null;
  subject_analyzer_version?: string | null;
  subject_review_status?: "approved" | "rejected" | "unreviewed";
  face_count?: number | null;
  person_count?: number | null;
  max_face_area_ratio?: number | null;
  thumb_s3_key?: string | null;
  thumb_url?: string | null;
  usable_profiles?: Json;
  usable_verticals?: Json;
  visual_bucket?: string | null;
  visual_setting?: string | null;
  visual_style?: string | null;
  visual_keywords?: Json;
  width?: number | null;
};

export type CategoryImageAssetSample = {
  avgColor: string | null;
  baseUrl: string;
  bestForSlideTypes: Json;
  bucketType: "universal" | "vertical" | null;
  contentTags: Json;
  createdAt: string;
  hasHuman: boolean | null;
  height: number | null;
  id: string;
  imageQuery: string | null;
  moodTags: Json;
  pexelsPhotoId: string | null;
  pexelsPhotographer: string | null;
  primaryVertical: string | null;
  qualityScore: number | null;
  sourceQuery: string | null;
  status: CategoryImageAssetStatus;
  thumbUrl: string | null;
  usageCount: number;
  usableVerticals: Json;
  visualBucket: string | null;
  visualSetting: string | null;
  visualStyle: string | null;
  width: number | null;
};

export type CategoryImageAssetReadiness = {
  assets: CategoryImageAssetSample[];
  categorySlug: string;
  counts: Record<"archived" | "failed" | "processing" | "ready" | "total", number>;
};

type CarouselDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      category_image_assets: {
        Insert: CategoryImageAssetInsert;
        Relationships: [];
        Row: CategoryImageAssetRow;
        Update: Partial<CategoryImageAssetInsert>;
      };
    };
    Views: Record<string, never>;
  };
};

let supabaseServerClient: SupabaseClient<CarouselDatabase> | null = null;
const CATEGORY_IMAGE_ASSET_STATUSES: CategoryImageAssetStatus[] = [
  "ready",
  "processing",
  "failed",
  "archived",
];

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

function getSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Carousel Supabase storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<CarouselDatabase>(
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

  return supabaseServerClient;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function getMissingCarouselSupabaseEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function countReadyCategoryImageAssets(categorySlug: string) {
  return countCategoryImageAssets(categorySlug, "ready");
}

export async function countReadyCategoryImageAssetsForBucket(params: {
  categorySlug: string;
  visualBucketId: string;
}) {
  return countCategoryImageAssets(params.categorySlug, "ready", {
    visualBucketId: params.visualBucketId,
  });
}

export async function countReadyCategoryImageReviewCandidates(
  categorySlug: string,
) {
  return countCategoryImageAssets(categorySlug, "ready", {
    reviewCandidateOnly: true,
  });
}

export async function countReadyCategoryImageReviewCandidatesForBucket(params: {
  categorySlug: string;
  visualBucketId: string;
}) {
  return countCategoryImageAssets(params.categorySlug, "ready", {
    reviewCandidateOnly: true,
    visualBucketId: params.visualBucketId,
  });
}

export async function getCategoryImageAssetSourcingState(params: {
  broadVisualBucketId?: string | null;
  categorySlug: string;
  visualBucketId?: string | null;
}) {
  const filters = {
    broadVisualBucketId: params.broadVisualBucketId,
    visualBucketId: params.visualBucketId,
  };
  const [rawCandidateCount, approvedObjectOnlyCount, unreviewedCount, rejectedCount] =
    await Promise.all([
      countCategoryImageAssets(params.categorySlug, undefined, filters),
      countCategoryImageAssets(params.categorySlug, "ready", {
        ...filters,
        runtimeSafeApprovedOnly: true,
      }),
      countCategoryImageAssets(params.categorySlug, "ready", {
        ...filters,
        subjectReviewStatus: "unreviewed",
      }),
      countCategoryImageAssets(params.categorySlug, undefined, {
        ...filters,
        subjectReviewStatus: "rejected",
      }),
    ]);

  return {
    approvedObjectOnlyCount,
    rawCandidateCount,
    rejectedCount,
    unreviewedCount,
  } satisfies CategoryImageAssetSourcingState;
}

async function countCategoryImageAssets(
  categorySlug: string,
  status?: CategoryImageAssetStatus,
  filters: {
    broadVisualBucketId?: string | null;
    reviewCandidateOnly?: boolean;
    runtimeSafeApprovedOnly?: boolean;
    subjectReviewStatus?: CategoryImageAssetRow["subject_review_status"];
    visualBucketId?: string | null;
  } = {},
) {
  const query = getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("category_slug", categorySlug);
  const statusQuery = status ? query.eq("status", status) : query;
  const visualBucketQuery = filters.visualBucketId
    ? statusQuery.eq("visual_bucket", filters.visualBucketId)
    : statusQuery;
  const bucketQuery = filters.broadVisualBucketId
    ? visualBucketQuery
        .eq("broad_visual_bucket", filters.broadVisualBucketId)
        .eq("bucket_taxonomy_version", "broad-v1")
    : visualBucketQuery;
  const reviewStatusQuery = filters.subjectReviewStatus
    ? bucketQuery.eq("subject_review_status", filters.subjectReviewStatus)
    : bucketQuery;
  const approvedQuery = filters.runtimeSafeApprovedOnly
    ? reviewStatusQuery
        .eq("subject_review_status", "approved")
        .eq("image_subject_class", "object-only")
        .eq("has_human", false)
        .eq("face_count", 0)
        .eq("person_count", 0)
        .is("runtime_exclusion_reason", null)
    : reviewStatusQuery;
  const filteredQuery = filters.reviewCandidateOnly
    ? approvedQuery
        .neq("subject_review_status", "rejected")
        .or("image_subject_class.is.null,image_subject_class.eq.object-only")
        .or("has_human.is.null,has_human.eq.false")
        .or("face_count.is.null,face_count.eq.0")
        .or("person_count.is.null,person_count.eq.0")
    : approvedQuery;
  const { count, error } = await filteredQuery;

  if (error) {
    throw new Error(`Could not count category image assets: ${error.message}`);
  }

  return count ?? 0;
}

export async function getCategoryImageAssetReadiness(params: {
  categorySlug: string;
  sampleLimit?: number;
  visualBucketId?: string | null;
}) {
  const sampleLimit = Math.min(Math.max(params.sampleLimit ?? 8, 1), 20);
  const [total, ...statusCounts] = await Promise.all([
    countCategoryImageAssets(params.categorySlug, undefined, {
      visualBucketId: params.visualBucketId,
    }),
    ...CATEGORY_IMAGE_ASSET_STATUSES.map((status) =>
      countCategoryImageAssets(params.categorySlug, status, {
        visualBucketId: params.visualBucketId,
      }),
    ),
  ]);
  const query = getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .eq("category_slug", params.categorySlug)
    .order("status", { ascending: false });
  const filteredQuery = params.visualBucketId
    ? query.eq("visual_bucket", params.visualBucketId)
    : query;
  const { data, error } = await filteredQuery
    .order("usage_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(sampleLimit);

  if (error) {
    throw new Error(`Could not list category image assets: ${error.message}`);
  }

  return {
    assets: (data ?? []).map((asset) => ({
      avgColor: asset.avg_color,
      baseUrl: asset.base_url,
      bestForSlideTypes: asset.best_for_slide_types,
      bucketType: asset.bucket_type,
      contentTags: asset.content_tags,
      createdAt: asset.created_at,
      hasHuman: asset.has_human,
      height: asset.height,
      id: asset.id,
      imageQuery: asset.image_query,
      moodTags: asset.mood_tags,
      pexelsPhotoId: asset.pexels_photo_id,
      pexelsPhotographer: asset.pexels_photographer,
      primaryVertical: asset.primary_vertical,
      qualityScore: asset.quality_score,
      sourceQuery: asset.source_query,
      status: asset.status,
      thumbUrl: asset.thumb_url,
      usageCount: asset.usage_count,
      usableVerticals: asset.usable_verticals,
      visualBucket: asset.visual_bucket,
      visualSetting: asset.visual_setting,
      visualStyle: asset.visual_style,
      width: asset.width,
    })),
    categorySlug: params.categorySlug,
    counts: {
      total,
      ready: statusCounts[0] ?? 0,
      processing: statusCounts[1] ?? 0,
      failed: statusCounts[2] ?? 0,
      archived: statusCounts[3] ?? 0,
    },
  } satisfies CategoryImageAssetReadiness;
}

export async function getExistingPexelsPhotoIds(photoIds: string[]) {
  const uniquePhotoIds = Array.from(new Set(photoIds.filter(Boolean)));

  if (uniquePhotoIds.length === 0) {
    return new Set<string>();
  }

  const existingPhotoIds = new Set<string>();

  for (const photoIdChunk of chunkArray(
    uniquePhotoIds,
    MAX_PEXELS_ID_LOOKUP_SIZE,
  )) {
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await getSupabaseServerClient()
        .from(CATEGORY_IMAGE_ASSETS_TABLE)
        .select("pexels_photo_id")
        .eq("source_provider", "pexels")
        .in("pexels_photo_id", photoIdChunk);

      if (!error) {
        for (const photoId of (data ?? [])
          .map((item) => item.pexels_photo_id)
          .filter((photoId): photoId is string => Boolean(photoId))) {
          existingPhotoIds.add(photoId);
        }

        lastError = null;
        break;
      }

      lastError = error.message;

      if (!error.message.toLowerCase().includes("fetch failed") || attempt === 2) {
        break;
      }

      await sleep(1_000 * (attempt + 1));
    }

    if (lastError) {
      throw new Error(`Could not check existing Pexels photos: ${lastError}`);
    }
  }

  return existingPhotoIds;
}

export async function insertCategoryImageAsset(row: CategoryImageAssetInsert) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not insert category image asset: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Category image asset insert returned no ID.");
  }

  return data.id;
}
