import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CarouselBusinessVisualProfileId } from "@/lib/carousel/business-visual-profile";
import {
  getBroadAssetSourceCategorySlugsForProfile,
  isBroadAssetSourceAllowedForProfile,
  isBroadVisualBucketId,
} from "@/lib/carousel/broad-visual-bucket-taxonomy";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

const CATEGORY_IMAGE_ASSETS_TABLE = "category_image_assets";
const CATEGORY_IMAGE_ASSET_PAGE_SIZE = 1000;
const CAROUSEL_GENERATIONS_TABLE = "carousel_generations";
const CAROUSEL_SLIDES_TABLE = "carousel_slides";
const INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION =
  "increment_category_image_asset_usage";
const WEBSITE_ANALYSES_TABLE = "website_analyses";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type CarouselFormat = "1:1" | "4:5";
export type CarouselGenerationStatus = "completed" | "failed" | "processing";
export type CarouselSlideStatus = "failed" | "processing" | "ready";

type WebsiteAnalysisRow = {
  analysis_json: WebsiteBusinessAnalysis;
  business_name: string | null;
  category: string | null;
  carousel_angles: string[];
  cta_ideas: string[];
  id: string;
  normalized_domain: string;
  pexels_image_queries: string[];
  product_summary: string | null;
  project_id: string;
  recommended_carousel_structure: string[];
  user_id: string;
  value_props: string[];
  visual_keywords: string[];
  website_url: string;
};

type CategoryImageAssetRow = {
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
  face_count: number | null;
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
  person_count: number | null;
  primary_vertical: string | null;
  quality_score: number | null;
  source_query: string | null;
  source_provider: "pexels";
  status: "archived" | "failed" | "processing" | "ready";
  subject_review_status: "approved" | "rejected" | "unreviewed";
  runtime_exclusion_reason: string | null;
  thumb_s3_key: string | null;
  thumb_url: string | null;
  updated_at: string;
  usage_count: number;
  usable_verticals: Json;
  visual_bucket: string | null;
  visual_setting: string | null;
  visual_style: string | null;
  visual_keywords: Json;
  width: number | null;
};

type CarouselGenerationRow = {
  business_profile_id: string | null;
  business_profile_version: number | null;
  candidate_count: number;
  candidate_index: number;
  category_slug: string | null;
  created_at: string;
  error_message: string | null;
  format: CarouselFormat;
  generation_batch_id: string;
  generation_source: "auto_generated" | "manual";
  goal: string | null;
  id: string;
  project_id: string;
  selected_angle: string | null;
  slide_count: number;
  status: CarouselGenerationStatus;
  trigger_run_id: string | null;
  updated_at: string;
  user_id: string;
  website_analysis_id: string | null;
};

type CarouselGenerationInsert = {
  business_profile_id?: string | null;
  business_profile_version?: number | null;
  candidate_count?: number;
  candidate_index?: number;
  category_slug?: string | null;
  error_message?: string | null;
  format?: CarouselFormat;
  generation_batch_id?: string;
  generation_source?: "auto_generated" | "manual";
  goal?: string | null;
  project_id: string;
  selected_angle?: string | null;
  slide_count?: number;
  status?: CarouselGenerationStatus;
  trigger_run_id?: string | null;
  user_id: string;
  website_analysis_id?: string | null;
};

type CarouselGenerationUpdate = Partial<CarouselGenerationInsert> & {
  updated_at?: string;
};

type CarouselSlideRow = {
  carousel_generation_id: string;
  category_image_asset_id: string | null;
  created_at: string;
  cta_text: string | null;
  headline: string;
  id: string;
  image_direction: string | null;
  layout_preset: string | null;
  rendered_s3_key: string | null;
  rendered_url: string | null;
  slide_number: number;
  slide_type: string | null;
  status: CarouselSlideStatus;
  subtext: string | null;
  text_position: string | null;
  updated_at: string;
};

export type CarouselSlideInsert = {
  carousel_generation_id: string;
  category_image_asset_id?: string | null;
  cta_text?: string | null;
  headline: string;
  image_direction?: string | null;
  layout_preset?: string | null;
  rendered_s3_key?: string | null;
  rendered_url?: string | null;
  slide_number: number;
  slide_type?: string | null;
  status?: CarouselSlideStatus;
  subtext?: string | null;
  text_position?: string | null;
};

type CarouselDatabase = {
  public: {
    Functions: {
      increment_category_image_asset_usage: {
        Args: { asset_ids: string[] };
        Returns: null;
      };
    };
    Tables: {
      carousel_generations: {
        Insert: CarouselGenerationInsert;
        Relationships: [];
        Row: CarouselGenerationRow;
        Update: CarouselGenerationUpdate;
      };
      carousel_slides: {
        Insert: CarouselSlideInsert;
        Relationships: [];
        Row: CarouselSlideRow;
        Update: Partial<CarouselSlideInsert>;
      };
      category_image_assets: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CategoryImageAssetRow;
        Update: Partial<CategoryImageAssetRow>;
      };
      website_analyses: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: WebsiteAnalysisRow;
        Update: Partial<WebsiteAnalysisRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type WebsiteAnalysisForCarousel = {
  analysis: WebsiteBusinessAnalysis;
  businessName: string | null;
  category: string | null;
  id: string;
  normalizedDomain: string;
  pexelsImageQueries: string[];
  productSummary: string | null;
  projectId: string;
  userId: string;
  visualKeywords: string[];
  websiteUrl: string;
};

export type ReadyCategoryImageAsset = {
  baseS3Key: string;
  baseUrl: string;
  bestForSlideTypes: Json;
  broadVisualBucket: string | null;
  bucketTaxonomyVersion: string | null;
  bucketType: "universal" | "vertical" | null;
  categorySlug: string;
  contentTags: Json;
  faceCount: number | null;
  hasHuman: boolean | null;
  id: string;
  imageSubjectClass:
    | "clear-face"
    | "faceless-human"
    | "object-only"
    | null;
  imageQuery: string | null;
  moodTags: Json;
  nearDuplicateGroup: string | null;
  objectTags: Json;
  pexelsPhotoId: string | null;
  pexelsPhotographer: string | null;
  personCount: number | null;
  primaryVertical: string | null;
  sourceQuery: string | null;
  status: CategoryImageAssetRow["status"];
  subjectReviewStatus: CategoryImageAssetRow["subject_review_status"];
  runtimeExclusionReason: string | null;
  usageCount: number;
  usableVerticals: Json;
  visualBucket: string | null;
  visualSetting: string | null;
  visualStyle: string | null;
};

export type CarouselGenerationRecord = {
  businessProfileId: string | null;
  businessProfileVersion: number | null;
  candidateCount: number;
  candidateIndex: number;
  categorySlug: string | null;
  createdAt: string;
  errorMessage: string | null;
  format: CarouselFormat;
  generationBatchId: string;
  generationSource: "auto_generated" | "manual";
  goal: string | null;
  id: string;
  projectId: string;
  selectedAngle: string | null;
  slideCount: number;
  status: CarouselGenerationStatus;
  triggerRunId: string | null;
  updatedAt: string;
  userId: string;
  websiteAnalysisId: string | null;
};

export type CarouselSlideRecord = {
  carouselGenerationId: string;
  categoryImageAssetId: string | null;
  ctaText: string | null;
  headline: string;
  id: string;
  imageDirection: string | null;
  layoutPreset: string | null;
  renderedS3Key: string | null;
  renderedUrl: string | null;
  slideNumber: number;
  slideType: string | null;
  status: CarouselSlideStatus;
  subtext: string | null;
  textPosition: string | null;
};

function isRuntimeSafeCategoryImageAsset(
  asset: CategoryImageAssetRow,
): asset is CategoryImageAssetRow {
  return (
    asset.status === "ready" &&
    asset.subject_review_status === "approved" &&
    asset.image_subject_class === "object-only" &&
    asset.has_human === false &&
    asset.face_count === 0 &&
    asset.person_count === 0 &&
    asset.runtime_exclusion_reason === null
  );
}

let supabaseServerClient: SupabaseClient<CarouselDatabase> | null = null;

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

function mapGeneration(row: CarouselGenerationRow): CarouselGenerationRecord {
  return {
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    candidateCount: row.candidate_count,
    candidateIndex: row.candidate_index,
    categorySlug: row.category_slug,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    format: row.format,
    generationBatchId: row.generation_batch_id,
    generationSource: row.generation_source,
    goal: row.goal,
    id: row.id,
    projectId: row.project_id,
    selectedAngle: row.selected_angle,
    slideCount: row.slide_count,
    status: row.status,
    triggerRunId: row.trigger_run_id,
    updatedAt: row.updated_at,
    userId: row.user_id,
    websiteAnalysisId: row.website_analysis_id,
  };
}

function mapSlide(row: CarouselSlideRow): CarouselSlideRecord {
  return {
    carouselGenerationId: row.carousel_generation_id,
    categoryImageAssetId: row.category_image_asset_id,
    ctaText: row.cta_text,
    headline: row.headline,
    id: row.id,
    imageDirection: row.image_direction,
    layoutPreset: row.layout_preset,
    renderedS3Key: row.rendered_s3_key,
    renderedUrl: row.rendered_url,
    slideNumber: row.slide_number,
    slideType: row.slide_type,
    status: row.status,
    subtext: row.subtext,
    textPosition: row.text_position,
  };
}

async function getRuntimeSafeCategoryImageAssetIds(assetIds: string[]) {
  const uniqueAssetIds = Array.from(new Set(assetIds.filter(Boolean)));

  if (uniqueAssetIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .in("id", uniqueAssetIds);

  if (error) {
    throw new Error(`Could not verify carousel image safety: ${error.message}`);
  }

  return new Set(
    (data ?? [])
      .filter(isRuntimeSafeCategoryImageAsset)
      .map((asset) => asset.id),
  );
}

async function mapRuntimeSafeSlides(rows: CarouselSlideRow[]) {
  const safeAssetIds = await getRuntimeSafeCategoryImageAssetIds(
    rows
      .map((row) => row.category_image_asset_id)
      .filter((assetId): assetId is string => Boolean(assetId)),
  );

  return rows
    .filter(
      (row) =>
        Boolean(row.category_image_asset_id) &&
        safeAssetIds.has(row.category_image_asset_id as string),
    )
    .map(mapSlide);
}

function getNowIso() {
  return new Date().toISOString();
}

function getAssetSourceCategorySlugs(params: {
  categorySlug: string;
  profileId?: CarouselBusinessVisualProfileId | null;
}) {
  return params.profileId
    ? getBroadAssetSourceCategorySlugsForProfile(
        params.profileId,
        params.categorySlug,
      )
    : [params.categorySlug];
}

export function getMissingCarouselDbEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function getWebsiteAnalysisForCarousel(analysisId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(WEBSITE_ANALYSES_TABLE)
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load website analysis: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    analysis: data.analysis_json,
    businessName: data.business_name,
    category: data.category,
    id: data.id,
    normalizedDomain: data.normalized_domain,
    pexelsImageQueries: data.pexels_image_queries,
    productSummary: data.product_summary,
    projectId: data.project_id,
    userId: data.user_id,
    visualKeywords: data.visual_keywords,
    websiteUrl: data.website_url,
  } satisfies WebsiteAnalysisForCarousel;
}

export async function countReadyCategoryImageAssetsForCarousel(
  categorySlug: string,
  profileId?: CarouselBusinessVisualProfileId | null,
) {
  if (profileId) {
    return (
      await listReadyCategoryImageAssets({ categorySlug, profileId })
    ).length;
  }

  const categorySlugs = getAssetSourceCategorySlugs({ categorySlug, profileId });
  const query = getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("id", { count: "exact", head: true })
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
  const { count, error } = await filteredQuery;

  if (error) {
    throw new Error(`Could not count ready category images: ${error.message}`);
  }

  return count ?? 0;
}

export async function countReadyCategoryImageAssetsByVisualBucket(params: {
  categorySlug: string;
  profileId?: CarouselBusinessVisualProfileId | null;
  visualBucketIds: string[];
}) {
  const visualBucketIds = params.visualBucketIds.filter(Boolean);

  if (visualBucketIds.length === 0) {
    return [];
  }

  const categorySlugs = getAssetSourceCategorySlugs(params);
  const query = getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("broad_visual_bucket,category_slug,visual_bucket")
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .eq("image_subject_class", "object-only")
    .eq("has_human", false)
    .eq("face_count", 0)
    .eq("person_count", 0)
    .is("runtime_exclusion_reason", null)
    .in("visual_bucket", visualBucketIds);
  const filteredQuery =
    categorySlugs.length === 1
      ? query.eq("category_slug", categorySlugs[0])
      : query.in("category_slug", categorySlugs);
  const { data, error } = await filteredQuery;

  if (error) {
    throw new Error(`Could not count ready visual bucket images: ${error.message}`);
  }

  const counts = new Map(visualBucketIds.map((bucketId) => [bucketId, 0]));

  for (const asset of data ?? []) {
    if (
      params.profileId &&
      asset.category_slug !== params.categorySlug &&
      (!asset.broad_visual_bucket ||
        !isBroadVisualBucketId(asset.broad_visual_bucket) ||
        !isBroadAssetSourceAllowedForProfile({
          broadBucketId: asset.broad_visual_bucket,
          primaryCategorySlug: params.categorySlug,
          profileId: params.profileId,
          sourceCategorySlug: asset.category_slug,
        }))
    ) {
      continue;
    }

    const bucketId = asset.visual_bucket;

    if (!bucketId || !counts.has(bucketId)) {
      continue;
    }

    counts.set(bucketId, (counts.get(bucketId) ?? 0) + 1);
  }

  return visualBucketIds.map((bucketId) => ({
    readyCount: counts.get(bucketId) ?? 0,
    visualBucketId: bucketId,
  }));
}

export async function listReadyCategoryImageAssets(params: {
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
  const categorySlugs = getAssetSourceCategorySlugs(params);
  let from = 0;

  while (true) {
    const remaining =
      requestedLimit === null ? pageSize : requestedLimit - rows.length;

    if (remaining <= 0) {
      break;
    }

    const currentPageSize = Math.min(pageSize, remaining);
    const query = getSupabaseServerClient()
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

  return rows
    .filter(isRuntimeSafeCategoryImageAsset)
    .filter((asset) => {
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
    })
    .map((asset) => ({
    baseS3Key: asset.base_s3_key,
    baseUrl: asset.base_url,
    bestForSlideTypes: asset.best_for_slide_types,
    broadVisualBucket: asset.broad_visual_bucket,
    bucketTaxonomyVersion: asset.bucket_taxonomy_version,
    bucketType: asset.bucket_type,
    categorySlug: asset.category_slug,
    contentTags: asset.content_tags,
    faceCount: asset.face_count,
    hasHuman: asset.has_human,
    id: asset.id,
    imageSubjectClass: asset.image_subject_class,
    imageQuery: asset.image_query,
    moodTags: asset.mood_tags,
    nearDuplicateGroup: asset.near_duplicate_group,
    objectTags: asset.object_tags,
    pexelsPhotoId: asset.pexels_photo_id,
    pexelsPhotographer: asset.pexels_photographer,
    personCount: asset.person_count,
    primaryVertical: asset.primary_vertical,
    sourceQuery: asset.source_query,
    status: asset.status,
    subjectReviewStatus: asset.subject_review_status,
    runtimeExclusionReason: asset.runtime_exclusion_reason,
    usageCount: asset.usage_count,
    usableVerticals: asset.usable_verticals,
    visualBucket: asset.visual_bucket,
    visualSetting: asset.visual_setting,
    visualStyle: asset.visual_style,
    })) satisfies ReadyCategoryImageAsset[];
}

export async function createCarouselGeneration(input: {
  businessProfileId?: string | null;
  businessProfileVersion?: number | null;
  candidateCount: number;
  candidateIndex: number;
  categorySlug: string;
  format: CarouselFormat;
  generationBatchId: string;
  generationSource?: "auto_generated" | "manual";
  goal?: string | null;
  projectId: string;
  selectedAngle?: string | null;
  slideCount: number;
  userId: string;
  websiteAnalysisId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .insert({
      business_profile_id: input.businessProfileId ?? null,
      business_profile_version: input.businessProfileVersion ?? null,
      candidate_count: input.candidateCount,
      candidate_index: input.candidateIndex,
      category_slug: input.categorySlug,
      format: input.format,
      generation_batch_id: input.generationBatchId,
      generation_source: input.generationSource ?? "manual",
      goal: input.goal ?? null,
      project_id: input.projectId,
      selected_angle: input.selectedAngle ?? null,
      slide_count: input.slideCount,
      status: "processing",
      user_id: input.userId,
      website_analysis_id: input.websiteAnalysisId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create carousel generation: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Carousel generation insert returned no ID.");
  }

  return data.id;
}

export async function updateCarouselGeneration(
  carouselId: string,
  patch: CarouselGenerationUpdate,
) {
  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .update({
      ...patch,
      updated_at: getNowIso(),
    })
    .eq("id", carouselId);

  if (error) {
    throw new Error(`Could not update carousel generation: ${error.message}`);
  }
}

export async function getCarouselGeneration(carouselId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("id", carouselId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load carousel generation: ${error.message}`);
  }

  return data ? mapGeneration(data) : null;
}

export async function upsertCarouselSlides(rows: CarouselSlideInsert[]) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_SLIDES_TABLE)
    .upsert(rows, {
      onConflict: "carousel_generation_id,slide_number",
    });

  if (error) {
    throw new Error(`Could not store carousel slides: ${error.message}`);
  }
}

export async function incrementCategoryImageAssetUsage(assetIds: string[]) {
  const usedAssetIds = assetIds.filter(Boolean);

  if (usedAssetIds.length === 0) {
    return;
  }

  const { error } = await getSupabaseServerClient().rpc(
    INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION,
    {
      asset_ids: usedAssetIds,
    },
  );

  if (error) {
    throw new Error(`Could not update category image usage counts: ${error.message}`);
  }
}

export async function getCarouselGenerationStatus(carouselId: string) {
  const generation = await getCarouselGeneration(carouselId);

  if (!generation) {
    return null;
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_SLIDES_TABLE)
    .select("*")
    .eq("carousel_generation_id", carouselId)
    .order("slide_number", { ascending: true });

  if (error) {
    throw new Error(`Could not load carousel slides: ${error.message}`);
  }

  return {
    generation,
    slides: await mapRuntimeSafeSlides(data ?? []),
  };
}

async function getCarouselGenerationStatusesForRows(
  generations: CarouselGenerationRecord[],
) {
  if (generations.length === 0) {
    return [];
  }

  const carouselIds = generations.map((generation) => generation.id);
  const { data: slideRows, error: slideError } = await getSupabaseServerClient()
    .from(CAROUSEL_SLIDES_TABLE)
    .select("*")
    .in("carousel_generation_id", carouselIds)
    .order("slide_number", { ascending: true });

  if (slideError) {
    throw new Error(`Could not load carousel batch slides: ${slideError.message}`);
  }

  const safeSlides = await mapRuntimeSafeSlides(slideRows ?? []);
  const slidesByCarouselId = new Map<string, CarouselSlideRecord[]>();

  for (const slide of safeSlides) {
    const slides = slidesByCarouselId.get(slide.carouselGenerationId) ?? [];

    slides.push(slide);
    slidesByCarouselId.set(slide.carouselGenerationId, slides);
  }

  return generations.map((generation) => ({
    generation,
    slides: slidesByCarouselId.get(generation.id) ?? [],
  }));
}

export async function getCarouselGenerationsByBatchId(generationBatchId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("generation_batch_id", generationBatchId)
    .order("candidate_index", { ascending: true });

  if (error) {
    throw new Error(`Could not load carousel generation batch: ${error.message}`);
  }

  return (data ?? []).map(mapGeneration);
}

export async function updateCarouselGenerationBatchCandidateCount(params: {
  candidateCount: number;
  generationBatchId: string;
}) {
  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .update({
      candidate_count: params.candidateCount,
      updated_at: getNowIso(),
    })
    .eq("generation_batch_id", params.generationBatchId);

  if (error) {
    throw new Error(`Could not update carousel batch candidate count: ${error.message}`);
  }
}

export async function getCarouselGenerationStatusPageByBatchId(params: {
  generationBatchId: string;
  limit: number;
  offset: number;
  userId?: string;
}) {
  const from = Math.max(Math.trunc(params.offset), 0);
  const limit = Math.max(Math.trunc(params.limit), 1);
  const to = from + limit - 1;
  let query = getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*", { count: "exact" })
    .eq("generation_batch_id", params.generationBatchId);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  const { data: generationRows, error: generationError, count } = await query
    .order("candidate_index", { ascending: true })
    .range(from, to);

  if (generationError) {
    throw new Error(
      `Could not load carousel generation batch: ${generationError.message}`,
    );
  }

  const generations = (generationRows ?? []).map(mapGeneration);
  const statuses = await getCarouselGenerationStatusesForRows(generations);

  return {
    hasMore: from + statuses.length < (count ?? 0),
    limit,
    offset: from,
    statuses,
    totalCandidates: count ?? 0,
  };
}

export async function getCarouselGenerationStatusesByBatchId(params: {
  generationBatchId: string;
  limit: number;
}) {
  const page = await getCarouselGenerationStatusPageByBatchId({
    generationBatchId: params.generationBatchId,
    limit: params.limit,
    offset: 0,
  });

  return page.statuses;
}

export async function listCarouselGenerationStatusesForUser(params: {
  businessProfileId?: string | null;
  businessProfileVersion?: number | null;
  limit: number;
  projectId?: string | null;
  userId: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit), 1), 50);
  let query = getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("user_id", params.userId);

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  if (params.businessProfileId) {
    query = query.eq("business_profile_id", params.businessProfileId);
  }

  if (params.businessProfileVersion) {
    query = query.eq("business_profile_version", params.businessProfileVersion);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not list carousel generations: ${error.message}`);
  }

  return getCarouselGenerationStatusesForRows((data ?? []).map(mapGeneration));
}

export async function listAutoCarouselGenerationsForBusinessProfile(params: {
  businessProfileId: string;
  profileVersion: number;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.profileVersion)
    .order("candidate_index", { ascending: true });

  if (error) {
    throw new Error(`Could not list profile carousel generations: ${error.message}`);
  }

  return (data ?? []).map(mapGeneration);
}
