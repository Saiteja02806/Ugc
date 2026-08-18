import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CarouselBusinessVisualProfileId } from "@/lib/carousel/business-visual-profile";
import {
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatId,
  type CarouselHookFamilyId,
} from "@/lib/carousel/content-grammar";
import type {
  CarouselContentAssignment,
  CarouselPerformanceSelectionMode,
  CarouselRecentContentSummary,
} from "@/lib/carousel/content-selector";
import {
  isCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
} from "@/lib/carousel/structure-2-formats";
import type {
  CarouselStructure2FormatAssignment,
  CarouselStructure2RecentHistory,
} from "@/lib/carousel/structure-2-selector";
import {
  isCarouselStructureId,
  isCarouselStructureMode,
  isCarouselStructureSelectionMode,
  type CarouselStructureId,
  type CarouselStructureMode,
  type CarouselStructureSelectionMode,
} from "@/lib/carousel/structure";
import {
  getBroadAssetSourceCategorySlugsForProfile,
  isBroadAssetSourceAllowedForProfile,
  isBroadVisualBucketId,
} from "@/lib/carousel/broad-visual-bucket-taxonomy";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

export type CarouselStructureFormatId =
  | CarouselContentFormatId
  | CarouselStructure2FormatId;
export type CarouselStructureContentAssignment =
  | CarouselContentAssignment
  | CarouselStructure2FormatAssignment;

const CATEGORY_IMAGE_ASSETS_TABLE = "category_image_assets";
const CATEGORY_IMAGE_ASSET_PAGE_SIZE = 1000;
const CAROUSEL_GENERATIONS_TABLE = "carousel_generations";
const CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE =
  "carousel_experiment_assignments";
const CAROUSEL_EXPERIMENT_BATCHES_TABLE = "carousel_experiment_batches";
const CAROUSEL_SLIDES_TABLE = "carousel_slides";
const INCREMENT_CATEGORY_IMAGE_USAGE_FUNCTION =
  "increment_category_image_asset_usage";
const WEBSITE_ANALYSES_TABLE = "website_analyses";

export type Json =
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
  asset_role: "hook" | "human" | "product_asset" | "static" | null;
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
  face_count: number | null;
  has_human: boolean | null;
  image_subject_class: "clear-face" | "faceless-human" | "object-only" | null;
  height: number | null;
  id: string;
  image_query: string | null;
  is_active: boolean;
  library_asset_id: string | null;
  orientation: "landscape" | "portrait" | "square";
  pexels_photo_id: string | null;
  pexels_photo_url: string | null;
  pexels_photographer: string | null;
  pexels_photographer_url: string | null;
  mood_tags: Json;
  near_duplicate_group: string | null;
  object_tags: Json;
  owner_business_profile_id: string | null;
  person_count: number | null;
  primary_vertical: string | null;
  quality_score: number | null;
  canonical_asset_id: string | null;
  license_information: string | null;
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
  subject_review_status: "approved" | "rejected" | "unreviewed";
  runtime_exclusion_reason: string | null;
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

type CategoryImageAssetInsert = Pick<
  CategoryImageAssetRow,
  | "asset_role"
  | "asset_scope"
  | "base_s3_key"
  | "base_url"
  | "category_slug"
  | "id"
  | "is_active"
  | "library_asset_id"
  | "orientation"
  | "owner_business_profile_id"
  | "source_filename"
  | "source_folder"
  | "source_metadata"
  | "source_original_s3_key"
  | "source_original_url"
  | "source_provider"
  | "status"
  | "subject_review_status"
> &
  Partial<
    Pick<
      CategoryImageAssetRow,
      | "height"
      | "runtime_exclusion_reason"
      | "source_file_sha256"
      | "thumb_s3_key"
      | "thumb_url"
      | "updated_at"
      | "width"
    >
  >;

type CarouselGenerationRow = {
  available_on_local_date: string | null;
  business_profile_id: string | null;
  business_profile_version: number | null;
  candidate_count: number;
  candidate_index: number;
  carousel_experiment_assignment_id: string | null;
  carousel_experiment_batch_id: string | null;
  category_slug: string | null;
  content_angle: string | null;
  content_assigned_format_id: string | null;
  content_audience_id: string | null;
  content_format_id: string | null;
  content_format_version: number | null;
  content_goal_id: string | null;
  content_grammar_version: string | null;
  content_history_snapshot: Json;
  content_plan_fallback_reason: string | null;
  content_plan_normalized: Json | null;
  content_plan_raw_response: Json | null;
  content_plan_source: string | null;
  content_plan_validation: Json | null;
  content_planner_model: string | null;
  content_planner_version: string | null;
  content_problem_id: string | null;
  content_selector_version: string | null;
  content_topic: string | null;
  content_topic_id: string | null;
  created_at: string;
  error_message: string | null;
  format: CarouselFormat;
  generation_batch_id: string;
  generation_source: "auto_generated" | "manual";
  goal: string | null;
  hook_family_id: string | null;
  id: string;
  origin_daily_feed_id: string | null;
  project_id: string;
  renderer_version: string | null;
  selected_angle: string | null;
  slide_count: number;
  status: CarouselGenerationStatus;
  structure_id: CarouselStructureId;
  structure_version: number;
  trigger_run_id: string | null;
  updated_at: string;
  user_id: string;
  website_analysis_id: string | null;
};

type CarouselGenerationInsert = {
  available_on_local_date?: string | null;
  business_profile_id?: string | null;
  business_profile_version?: number | null;
  candidate_count?: number;
  candidate_index?: number;
  carousel_experiment_assignment_id?: string | null;
  carousel_experiment_batch_id?: string | null;
  category_slug?: string | null;
  content_angle?: string | null;
  content_assigned_format_id?: string | null;
  content_audience_id?: string | null;
  content_format_id?: string | null;
  content_format_version?: number | null;
  content_goal_id?: string | null;
  content_grammar_version?: string | null;
  content_history_snapshot?: Json;
  content_plan_fallback_reason?: string | null;
  content_plan_normalized?: Json | null;
  content_plan_raw_response?: Json | null;
  content_plan_source?: string | null;
  content_plan_validation?: Json | null;
  content_planner_model?: string | null;
  content_planner_version?: string | null;
  content_problem_id?: string | null;
  content_selector_version?: string | null;
  content_topic?: string | null;
  content_topic_id?: string | null;
  error_message?: string | null;
  format?: CarouselFormat;
  generation_batch_id?: string;
  generation_source?: "auto_generated" | "manual";
  goal?: string | null;
  hook_family_id?: string | null;
  origin_daily_feed_id?: string | null;
  project_id: string;
  renderer_version?: string | null;
  selected_angle?: string | null;
  slide_count?: number;
  status?: CarouselGenerationStatus;
  structure_id?: CarouselStructureId;
  structure_version?: number;
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
  product_visual_eligibility: "allowed" | "forbidden" | "preferred" | null;
  rendered_s3_key: string | null;
  rendered_url: string | null;
  slide_number: number;
  slide_type: string | null;
  status: CarouselSlideStatus;
  story_format_id: string | null;
  story_layout_variant:
    | "story_overlay_only"
    | "story_pill_overlay"
    | "story_product_reveal"
    | null;
  story_role:
    | "failure_scene"
    | "product_turning_point"
    | "proof_reflection_cta"
    | "recognition"
    | "reframe"
    | null;
  story_text_treatment: "outlined_overlay" | "overlay" | "pill" | null;
  structure_id: CarouselStructureId;
  structure_version: number;
  subtext: string | null;
  text_position: string | null;
  updated_at: string;
  visual_role: "hook" | "human" | "product_asset" | "static" | null;
};

export type CarouselSlideInsert = {
  carousel_generation_id: string;
  category_image_asset_id?: string | null;
  cta_text?: string | null;
  headline: string;
  image_direction?: string | null;
  layout_preset?: string | null;
  product_visual_eligibility?: "allowed" | "forbidden" | "preferred" | null;
  rendered_s3_key?: string | null;
  rendered_url?: string | null;
  slide_number: number;
  slide_type?: string | null;
  status?: CarouselSlideStatus;
  story_format_id?: string | null;
  story_layout_variant?:
    | "story_overlay_only"
    | "story_pill_overlay"
    | "story_product_reveal"
    | null;
  story_role?:
    | "failure_scene"
    | "product_turning_point"
    | "proof_reflection_cta"
    | "recognition"
    | "reframe"
    | null;
  story_text_treatment?: "outlined_overlay" | "overlay" | "pill" | null;
  structure_id?: CarouselStructureId;
  structure_version?: number;
  subtext?: string | null;
  text_position?: string | null;
  visual_role?: "hook" | "human" | "product_asset" | "static" | null;
};

type CarouselExperimentBatchRow = {
  batch_sequence: number;
  business_profile_id: string;
  business_profile_version: number;
  created_at: string;
  cycle_batch_position: number | null;
  cycle_number: number | null;
  generation_batch_id: string;
  id: string;
  planner_job_id: string | null;
  requested_structure_batch_sequence: number;
  requested_structure_id: CarouselStructureId;
  requested_structure_version: number;
  requested_carousel_count: number;
  status: "completed" | "failed" | "partial" | "processing" | "queued" | "reserved";
  structure_batch_sequence: number;
  structure_id: CarouselStructureId;
  structure_fallback_reason: string | null;
  structure_mode_snapshot: CarouselStructureMode;
  structure_planning_attempt_count: number;
  structure_resolution_mode: "planning_fallback" | "requested";
  structure_resolved_at: string | null;
  structure_rotation_sequence: number | null;
  structure_selection_mode: CarouselStructureSelectionMode;
  structure_version: number;
  updated_at: string;
};

type CarouselExperimentAssignmentRow = {
  actual_format_id: string | null;
  assigned_format_id: string;
  carousel_generation_id: string | null;
  created_at: string;
  experiment_batch_id: string;
  format_selection_mode: CarouselPerformanceSelectionMode;
  format_selection_multiplier: number;
  format_version: number;
  hook_family_id: string | null;
  hook_selection_mode: CarouselPerformanceSelectionMode | null;
  hook_selection_multiplier: number | null;
  id: string;
  replacement_for_format_id: string | null;
  rotation_candidate_format_id: string;
  slot_index: number;
  status: "completed" | "failed" | "not_applicable" | "processing" | "queued" | "reserved";
  structure_id: CarouselStructureId;
  structure_version: number;
  updated_at: string;
};

type CarouselGlobalSettingsRow = {
  created_at: string;
  singleton: true;
  structure_config_version: number;
  structure_mode: CarouselStructureMode;
  updated_at: string;
  updated_by_user_id: string | null;
};

type CarouselExperimentAssignmentInsert = Partial<
  Pick<
    CarouselExperimentAssignmentRow,
    | "actual_format_id"
    | "carousel_generation_id"
    | "replacement_for_format_id"
    | "status"
    | "structure_id"
    | "structure_version"
  >
> &
  Pick<
    CarouselExperimentAssignmentRow,
    | "assigned_format_id"
    | "experiment_batch_id"
    | "format_selection_mode"
    | "format_selection_multiplier"
    | "format_version"
    | "hook_family_id"
    | "hook_selection_mode"
    | "hook_selection_multiplier"
    | "rotation_candidate_format_id"
    | "slot_index"
  >;

type CarouselDatabase = {
  public: {
    Functions: {
      increment_category_image_asset_usage: {
        Args: { asset_ids: string[] };
        Returns: null;
      };
      reserve_carousel_experiment_batches: {
        Args: {
          p_batch_count: number;
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_generation_batch_id: string;
        };
        Returns: CarouselExperimentBatchRow[];
      };
      take_over_carousel_experiment_batch_with_structure_2: {
        Args: {
          p_experiment_batch_id: string;
          p_failure_reason: string;
          p_planning_attempt_count: number;
        };
        Returns: CarouselExperimentBatchRow[];
      };
      reserve_carousel_role_assets_v1: {
        Args: {
          p_business_profile_id: string;
          p_carousel_id: string;
          p_category_slug: string;
          p_use_product_asset: boolean;
        };
        Returns: ReservedCarouselRoleAssetRow[];
      };
    };
    Tables: {
      carousel_global_settings: {
        Insert: {
          singleton?: true;
          structure_config_version?: number;
          structure_mode?: CarouselStructureMode;
          updated_by_user_id?: string | null;
        };
        Relationships: [];
        Row: CarouselGlobalSettingsRow;
        Update: Partial<
          Pick<
            CarouselGlobalSettingsRow,
            | "structure_config_version"
            | "structure_mode"
            | "updated_by_user_id"
          >
        > & { updated_at?: string };
      };
      carousel_experiment_assignments: {
        Insert: CarouselExperimentAssignmentInsert;
        Relationships: [];
        Row: CarouselExperimentAssignmentRow;
        Update: Partial<CarouselExperimentAssignmentInsert> & {
          updated_at?: string;
        };
      };
      carousel_experiment_batches: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CarouselExperimentBatchRow;
        Update: Partial<CarouselExperimentBatchRow>;
      };
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
        Insert: CategoryImageAssetInsert;
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
  assetRole: "hook" | "human" | "product_asset" | "static" | null;
  assetScope: CategoryImageAssetScope;
  assetVariant: CategoryImageAssetVariant;
  baseObjectKey: string;
  baseUrl: string;
  bestForSlideTypes: Json;
  broadVisualBucket: string | null;
  bucketTaxonomyVersion: string | null;
  bucketType: "universal" | "vertical" | null;
  categorySlug: string;
  canonicalAssetId: string | null;
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
  isActive: boolean;
  libraryAssetId: string | null;
  moodTags: Json;
  nearDuplicateGroup: string | null;
  objectTags: Json;
  pexelsPhotoId: string | null;
  pexelsPhotographer: string | null;
  personCount: number | null;
  primaryVertical: string | null;
  sourceFileSha256: string | null;
  sourcePerceptualHash: string | null;
  sourceProvider: CategoryImageAssetSourceProvider;
  sourceQuery: string | null;
  status: CategoryImageAssetRow["status"];
  subjectReviewStatus: CategoryImageAssetRow["subject_review_status"];
  runtimeExclusionReason: string | null;
  usageCount: number;
  usableProfiles: Json;
  usableVerticals: Json;
  visualBucket: string | null;
  visualSetting: string | null;
  visualStyle: string | null;
};

type ReservedCarouselRoleAssetRow = {
  asset_id: string;
  asset_role: "hook" | "human" | "product_asset" | "static";
  base_s3_key: string;
  base_url: string;
  category_slug: string;
  cycle_number: number;
  library_asset_id: string;
  slide_number: number;
  source_file_sha256: string;
};

export type ReservedCarouselRoleAsset = {
  assetRole: ReservedCarouselRoleAssetRow["asset_role"];
  baseObjectKey: string;
  baseUrl: string;
  categorySlug: string;
  cycleNumber: number;
  id: string;
  libraryAssetId: string;
  slideNumber: number;
  sourceFileSha256: string;
};

export type CarouselGenerationRecord = {
  availableOnLocalDate: string | null;
  businessProfileId: string | null;
  businessProfileVersion: number | null;
  candidateCount: number;
  candidateIndex: number;
  carouselExperimentAssignmentId: string | null;
  carouselExperimentBatchId: string | null;
  categorySlug: string | null;
  contentAngle: string | null;
  contentAssignedFormatId: CarouselStructureFormatId | null;
  contentAudienceId: string | null;
  contentFormatId: CarouselStructureFormatId | null;
  contentFormatVersion: number | null;
  contentGoalId: string | null;
  contentGrammarVersion: string | null;
  contentHistorySnapshot: Json;
  contentPlanNormalized: Json | null;
  contentProblemId: string | null;
  contentSelectorVersion: string | null;
  contentTopic: string | null;
  contentTopicId: string | null;
  createdAt: string;
  errorMessage: string | null;
  format: CarouselFormat;
  generationBatchId: string;
  generationSource: "auto_generated" | "manual";
  goal: string | null;
  hookFamilyId: CarouselHookFamilyId | null;
  id: string;
  originDailyFeedId: string | null;
  projectId: string;
  rendererVersion: string | null;
  selectedAngle: string | null;
  slideCount: number;
  status: CarouselGenerationStatus;
  structureId: CarouselStructureId;
  structureVersion: number;
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
  productVisualEligibility: "allowed" | "forbidden" | "preferred" | null;
  renderedS3Key: string | null;
  renderedUrl: string | null;
  slideNumber: number;
  slideType: string | null;
  status: CarouselSlideStatus;
  storyFormatId: string | null;
  storyLayoutVariant:
    | "story_overlay_only"
    | "story_pill_overlay"
    | "story_product_reveal"
    | null;
  storyRole:
    | "failure_scene"
    | "product_turning_point"
    | "proof_reflection_cta"
    | "recognition"
    | "reframe"
    | null;
  storyTextTreatment: "outlined_overlay" | "overlay" | "pill" | null;
  structureId: CarouselStructureId;
  structureVersion: number;
  subtext: string | null;
  textPosition: string | null;
  visualRole: "hook" | "human" | "product_asset" | "static" | null;
};

export type CarouselEditBackground = {
  id: string;
  url: string;
};

export type CarouselProductAsset = {
  businessProfileId: string;
  categorySlug: string;
  createdAt: string;
  fileName: string;
  height: number;
  id: string;
  libraryAssetId: string;
  storageKey: string;
  url: string;
  width: number;
};

export type CarouselProductAssetUpload = {
  businessProfileId: string;
  categorySlug: string;
  id: string;
  status: CategoryImageAssetRow["status"];
  storageKey: string;
};

export class CarouselProductAssetConflictError extends Error {
  constructor(message = "This app screenshot is already saved.") {
    super(message);
    this.name = "CarouselProductAssetConflictError";
  }
}

function isRuntimeSafeCategoryImageAsset(
  asset: CategoryImageAssetRow,
): asset is CategoryImageAssetRow {
  return (
    asset.status === "ready" &&
    asset.subject_review_status === "approved" &&
    asset.is_active === true &&
    asset.library_asset_id !== null &&
    asset.asset_role !== null &&
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
  if (!isCarouselStructureId(row.structure_id)) {
    throw new Error("Carousel generation has an invalid structure id.");
  }

  return {
    availableOnLocalDate: row.available_on_local_date,
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    candidateCount: row.candidate_count,
    candidateIndex: row.candidate_index,
    carouselExperimentAssignmentId: row.carousel_experiment_assignment_id,
    carouselExperimentBatchId: row.carousel_experiment_batch_id,
    categorySlug: row.category_slug,
    contentAngle: row.content_angle,
    contentAssignedFormatId: parseStructureFormatId(
      row.structure_id,
      row.content_assigned_format_id,
    ),
    contentAudienceId: row.content_audience_id,
    contentFormatId: parseStructureFormatId(
      row.structure_id,
      row.content_format_id,
    ),
    contentFormatVersion: row.content_format_version,
    contentGoalId: row.content_goal_id,
    contentGrammarVersion: row.content_grammar_version,
    contentHistorySnapshot: row.content_history_snapshot,
    contentPlanNormalized: row.content_plan_normalized,
    contentProblemId: row.content_problem_id,
    contentSelectorVersion: row.content_selector_version,
    contentTopic: row.content_topic,
    contentTopicId: row.content_topic_id,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    format: row.format,
    generationBatchId: row.generation_batch_id,
    generationSource: row.generation_source,
    goal: row.goal,
    hookFamilyId:
      row.structure_id === "structure_1" &&
      isCarouselHookFamilyId(row.hook_family_id)
      ? row.hook_family_id
      : null,
    id: row.id,
    originDailyFeedId: row.origin_daily_feed_id,
    projectId: row.project_id,
    rendererVersion: row.renderer_version,
    selectedAngle: row.selected_angle,
    slideCount: row.slide_count,
    status: row.status,
    structureId: row.structure_id,
    structureVersion: row.structure_version,
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
    productVisualEligibility: row.product_visual_eligibility,
    renderedS3Key: row.rendered_s3_key,
    renderedUrl: row.rendered_url,
    slideNumber: row.slide_number,
    slideType: row.slide_type,
    status: row.status,
    storyFormatId: row.story_format_id,
    storyLayoutVariant: row.story_layout_variant,
    storyRole: row.story_role,
    storyTextTreatment: row.story_text_treatment,
    structureId: row.structure_id,
    structureVersion: row.structure_version,
    subtext: row.subtext,
    textPosition: row.text_position,
    visualRole: row.visual_role,
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
      assetRole: asset.asset_role,
      assetScope: asset.asset_scope,
      assetVariant: asset.asset_variant,
      baseObjectKey: asset.base_s3_key,
      baseUrl: asset.base_url,
      bestForSlideTypes: asset.best_for_slide_types,
      broadVisualBucket: asset.broad_visual_bucket,
      bucketTaxonomyVersion: asset.bucket_taxonomy_version,
      bucketType: asset.bucket_type,
      categorySlug: asset.category_slug,
      canonicalAssetId: asset.canonical_asset_id,
      contentTags: asset.content_tags,
      faceCount: asset.face_count,
      hasHuman: asset.has_human,
      id: asset.id,
      imageSubjectClass: asset.image_subject_class,
      imageQuery: asset.image_query,
      isActive: asset.is_active,
      libraryAssetId: asset.library_asset_id,
      moodTags: asset.mood_tags,
      nearDuplicateGroup: asset.near_duplicate_group,
      objectTags: asset.object_tags,
      pexelsPhotoId: asset.pexels_photo_id,
      pexelsPhotographer: asset.pexels_photographer,
      personCount: asset.person_count,
      primaryVertical: asset.primary_vertical,
      sourceFileSha256: asset.source_file_sha256,
      sourcePerceptualHash: asset.source_perceptual_hash,
      sourceProvider: asset.source_provider,
      sourceQuery: asset.source_query,
      status: asset.status,
      subjectReviewStatus: asset.subject_review_status,
      runtimeExclusionReason: asset.runtime_exclusion_reason,
      usageCount: asset.usage_count,
      usableProfiles: asset.usable_profiles,
      usableVerticals: asset.usable_verticals,
      visualBucket: asset.visual_bucket,
      visualSetting: asset.visual_setting,
      visualStyle: asset.visual_style,
    })) satisfies ReadyCategoryImageAsset[];
}

export async function createCarouselGeneration(input: {
  availableOnLocalDate?: string | null;
  businessProfileId: string;
  businessProfileVersion: number;
  candidateCount: number;
  candidateIndex: number;
  categorySlug: string;
  contentAssignment: CarouselStructureContentAssignment;
  experimentAssignmentId: string;
  experimentBatchId: string;
  format: CarouselFormat;
  generationBatchId: string;
  generationSource: "auto_generated";
  goal?: string | null;
  originDailyFeedId?: string | null;
  projectId: string;
  selectedAngle?: string | null;
  slideCount: number;
  structureId: CarouselStructureId;
  structureVersion: number;
  userId: string;
  websiteAnalysisId: string;
}) {
  const assignment = normalizeStructureContentAssignment({
    assignment: input.contentAssignment,
    structureId: input.structureId,
  });
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .insert({
      available_on_local_date: input.availableOnLocalDate ?? null,
      business_profile_id: input.businessProfileId,
      business_profile_version: input.businessProfileVersion,
      candidate_count: input.candidateCount,
      candidate_index: input.candidateIndex,
      carousel_experiment_assignment_id: input.experimentAssignmentId,
      carousel_experiment_batch_id: input.experimentBatchId,
      category_slug: input.categorySlug,
      content_assigned_format_id: assignment.assignedFormatId,
      content_format_id: assignment.actualFormatId,
      content_format_version: assignment.formatVersion,
      content_grammar_version: assignment.grammarVersion,
      content_history_snapshot:
        assignment.historySnapshot as unknown as Json,
      content_selector_version: assignment.selectorVersion,
      format: input.format,
      generation_batch_id: input.generationBatchId,
      generation_source: input.generationSource,
      goal: input.goal ?? null,
      hook_family_id: assignment.hookFamilyId,
      origin_daily_feed_id: input.originDailyFeedId ?? null,
      project_id: input.projectId,
      selected_angle: input.selectedAngle ?? null,
      slide_count: input.slideCount,
      status: "processing",
      structure_id: input.structureId,
      structure_version: input.structureVersion,
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

export async function countActiveCarouselRoleAssets(categorySlug: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("asset_role")
    .eq("category_slug", categorySlug)
    .eq("is_active", true)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .is("runtime_exclusion_reason", null)
    .in("asset_role", ["hook", "human", "static"]);

  if (error) {
    throw new Error(`Could not count active Carousel role assets: ${error.message}`);
  }

  const counts = { hook: 0, human: 0, static: 0 };

  for (const row of data ?? []) {
    if (row.asset_role === "hook") counts.hook += 1;
    if (row.asset_role === "human") counts.human += 1;
    if (row.asset_role === "static") counts.static += 1;
  }

  return counts;
}

export async function reserveCarouselRoleAssets(params: {
  businessProfileId: string;
  carouselId: string;
  categorySlug: string;
  useProductAsset?: boolean;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "reserve_carousel_role_assets_v1",
    {
      p_business_profile_id: params.businessProfileId,
      p_carousel_id: params.carouselId,
      p_category_slug: params.categorySlug,
      p_use_product_asset: Boolean(params.useProductAsset),
    },
  );

  if (error) {
    throw new Error(`Could not reserve Carousel role images: ${error.message}`);
  }

  return (data ?? []).map(
    (row): ReservedCarouselRoleAsset => ({
      assetRole: row.asset_role,
      baseObjectKey: row.base_s3_key,
      baseUrl: row.base_url,
      categorySlug: row.category_slug,
      cycleNumber: row.cycle_number,
      id: row.asset_id,
      libraryAssetId: row.library_asset_id,
      slideNumber: row.slide_number,
      sourceFileSha256: row.source_file_sha256,
    }),
  );
}

export type CarouselExperimentBatchRecord = {
  batchSequence: number;
  businessProfileId: string;
  businessProfileVersion: number;
  cycleBatchPosition: number | null;
  cycleNumber: number | null;
  generationBatchId: string;
  id: string;
  plannerJobId: string | null;
  requestedStructureBatchSequence: number;
  requestedStructureId: CarouselStructureId;
  requestedStructureVersion: number;
  status: CarouselExperimentBatchRow["status"];
  structureBatchSequence: number;
  structureId: CarouselStructureId;
  structureFallbackReason: string | null;
  structureModeSnapshot: CarouselStructureMode;
  structurePlanningAttemptCount: number;
  structureResolutionMode: CarouselExperimentBatchRow["structure_resolution_mode"];
  structureResolvedAt: string | null;
  structureRotationSequence: number | null;
  structureSelectionMode: CarouselStructureSelectionMode;
  structureVersion: number;
};

export type CarouselExperimentAssignmentRecord = {
  actualFormatId: CarouselStructureFormatId | null;
  assignedFormatId: CarouselStructureFormatId;
  carouselGenerationId: string | null;
  experimentBatchId: string;
  formatSelectionMode: CarouselPerformanceSelectionMode;
  formatSelectionMultiplier: number;
  formatVersion: number;
  hookFamilyId: CarouselHookFamilyId | null;
  hookSelectionMode: CarouselPerformanceSelectionMode | null;
  hookSelectionMultiplier: number | null;
  id: string;
  rotationCandidateFormatId: CarouselStructureFormatId;
  slotIndex: number;
  status: CarouselExperimentAssignmentRow["status"];
  structureId: CarouselStructureId;
  structureVersion: number;
};

export async function reserveCarouselExperimentBatches(params: {
  batchCount: number;
  businessProfileId: string;
  businessProfileVersion: number;
  generationBatchId: string;
}) {
  const { data, error } = await getSupabaseServerClient().rpc(
    "reserve_carousel_experiment_batches",
    {
      p_batch_count: params.batchCount,
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_generation_batch_id: params.generationBatchId,
    },
  );

  if (error) {
    throw new Error(`Could not reserve Carousel experiment batches: ${error.message}`);
  }

  return (data ?? []).map(mapExperimentBatch);
}

export async function upsertCarouselExperimentAssignments(params: {
  assignments: readonly CarouselStructureContentAssignment[];
  experimentBatchId: string;
  structureId: CarouselStructureId;
  structureVersion: number;
}) {
  if (params.assignments.length !== 5) {
    throw new Error("A Carousel experiment batch must reserve exactly five assignments.");
  }

  const rows = params.assignments.map((assignment, slotIndex) => {
    const normalized = normalizeStructureContentAssignment({
      assignment,
      structureId: params.structureId,
    });

    return {
      assigned_format_id: normalized.assignedFormatId,
      experiment_batch_id: params.experimentBatchId,
      format_selection_mode: normalized.formatSelectionMode,
      format_selection_multiplier: normalized.formatSelectionMultiplier,
      format_version: normalized.formatVersion,
      hook_family_id: normalized.hookFamilyId,
      hook_selection_mode: normalized.hookSelectionMode,
      hook_selection_multiplier: normalized.hookSelectionMultiplier,
      rotation_candidate_format_id: normalized.rotationCandidateFormatId,
      slot_index: slotIndex,
      status: "reserved" as const,
      structure_id: params.structureId,
      structure_version: params.structureVersion,
    };
  });
  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE)
    .upsert(rows, {
      ignoreDuplicates: true,
      onConflict: "experiment_batch_id,slot_index",
    })
    .select("*")
    .order("slot_index", { ascending: true });

  if (error) {
    throw new Error(`Could not reserve Carousel experiment assignments: ${error.message}`);
  }

  if ((data ?? []).length === 5) {
    return (data ?? []).map(mapExperimentAssignment);
  }

  const { data: existing, error: existingError } = await getSupabaseServerClient()
    .from(CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE)
    .select("*")
    .eq("experiment_batch_id", params.experimentBatchId)
    .order("slot_index", { ascending: true });

  if (existingError) {
    throw new Error(
      `Could not load Carousel experiment assignments: ${existingError.message}`,
    );
  }

  if ((existing ?? []).length !== 5) {
    throw new Error("Carousel experiment batch does not contain five assignments.");
  }

  return (existing ?? []).map(mapExperimentAssignment);
}

export async function linkCarouselExperimentAssignment(params: {
  assignmentId: string;
  carouselId: string;
}) {
  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_EXPERIMENT_ASSIGNMENTS_TABLE)
    .update({
      carousel_generation_id: params.carouselId,
      status: "queued",
      updated_at: getNowIso(),
    })
    .eq("id", params.assignmentId)
    .or(`carousel_generation_id.is.null,carousel_generation_id.eq.${params.carouselId}`);

  if (error) {
    throw new Error(`Could not link Carousel experiment assignment: ${error.message}`);
  }
}

export async function updateCarouselExperimentBatch(params: {
  experimentBatchId: string;
  patch: Partial<Pick<CarouselExperimentBatchRow, "planner_job_id" | "status">>;
}) {
  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_EXPERIMENT_BATCHES_TABLE)
    .update({ ...params.patch, updated_at: getNowIso() })
    .eq("id", params.experimentBatchId);

  if (error) {
    throw new Error(`Could not update Carousel experiment batch: ${error.message}`);
  }
}

function mapExperimentBatch(
  row: CarouselExperimentBatchRow,
): CarouselExperimentBatchRecord {
  if (
    !isCarouselStructureId(row.structure_id) ||
    !isCarouselStructureId(row.requested_structure_id) ||
    !isCarouselStructureMode(row.structure_mode_snapshot) ||
    !isCarouselStructureSelectionMode(row.structure_selection_mode) ||
    !["planning_fallback", "requested"].includes(
      row.structure_resolution_mode,
    )
  ) {
    throw new Error("Carousel experiment batch has invalid structure metadata.");
  }

  return {
    batchSequence: row.batch_sequence,
    businessProfileId: row.business_profile_id,
    businessProfileVersion: row.business_profile_version,
    cycleBatchPosition: row.cycle_batch_position,
    cycleNumber: row.cycle_number,
    generationBatchId: row.generation_batch_id,
    id: row.id,
    plannerJobId: row.planner_job_id,
    requestedStructureBatchSequence: row.requested_structure_batch_sequence,
    requestedStructureId: row.requested_structure_id,
    requestedStructureVersion: row.requested_structure_version,
    status: row.status,
    structureBatchSequence: row.structure_batch_sequence,
    structureId: row.structure_id,
    structureFallbackReason: row.structure_fallback_reason,
    structureModeSnapshot: row.structure_mode_snapshot,
    structurePlanningAttemptCount: row.structure_planning_attempt_count,
    structureResolutionMode: row.structure_resolution_mode,
    structureResolvedAt: row.structure_resolved_at,
    structureRotationSequence: row.structure_rotation_sequence,
    structureSelectionMode: row.structure_selection_mode,
    structureVersion: row.structure_version,
  };
}

function mapExperimentAssignment(
  row: CarouselExperimentAssignmentRow,
): CarouselExperimentAssignmentRecord {
  const assignedFormatId = parseStructureFormatId(
    row.structure_id,
    row.assigned_format_id,
  );
  const actualFormatId = parseStructureFormatId(
    row.structure_id,
    row.actual_format_id,
  );
  const rotationCandidateFormatId = parseStructureFormatId(
    row.structure_id,
    row.rotation_candidate_format_id,
  );
  const hookFieldsAreValid =
    row.structure_id === "structure_1"
      ? isCarouselHookFamilyId(row.hook_family_id) &&
        isCarouselPerformanceSelectionMode(row.hook_selection_mode) &&
        row.hook_selection_multiplier !== null
      : row.hook_family_id === null &&
        row.hook_selection_mode === null &&
        row.hook_selection_multiplier === null;

  if (
    assignedFormatId === null ||
    (row.actual_format_id !== null && actualFormatId === null) ||
    rotationCandidateFormatId === null ||
    !isCarouselPerformanceSelectionMode(row.format_selection_mode) ||
    !isCarouselStructureId(row.structure_id) ||
    !hookFieldsAreValid
  ) {
    throw new Error("Carousel experiment assignment has an invalid grammar id.");
  }

  return {
    actualFormatId,
    assignedFormatId,
    carouselGenerationId: row.carousel_generation_id,
    experimentBatchId: row.experiment_batch_id,
    formatSelectionMode: row.format_selection_mode,
    formatSelectionMultiplier: row.format_selection_multiplier,
    formatVersion: row.format_version,
    hookFamilyId: isCarouselHookFamilyId(row.hook_family_id)
      ? row.hook_family_id
      : null,
    hookSelectionMode: row.hook_selection_mode,
    hookSelectionMultiplier: row.hook_selection_multiplier,
    id: row.id,
    rotationCandidateFormatId,
    slotIndex: row.slot_index,
    status: row.status,
    structureId: row.structure_id,
    structureVersion: row.structure_version,
  };
}

function isCarouselPerformanceSelectionMode(
  value: unknown,
): value is CarouselPerformanceSelectionMode {
  return [
    "controlled_rotation",
    "performance_exploration",
    "performance_weighted",
  ].includes(value as string);
}

type NormalizedStructureContentAssignment = {
  actualFormatId: CarouselStructureFormatId;
  assignedFormatId: CarouselStructureFormatId;
  formatSelectionMode: CarouselPerformanceSelectionMode;
  formatSelectionMultiplier: number;
  formatVersion: number;
  grammarVersion: string;
  historySnapshot: readonly unknown[];
  hookFamilyId: CarouselHookFamilyId | null;
  hookSelectionMode: CarouselPerformanceSelectionMode | null;
  hookSelectionMultiplier: number | null;
  rotationCandidateFormatId: CarouselStructureFormatId;
  selectorVersion: string;
};

function normalizeStructureContentAssignment(params: {
  assignment: CarouselStructureContentAssignment;
  structureId: CarouselStructureId;
}): NormalizedStructureContentAssignment {
  if (params.structureId === "structure_1") {
    if (!("contentFormatId" in params.assignment)) {
      throw new Error("Structure 1 requires a Structure 1 content assignment.");
    }

    return {
      actualFormatId: params.assignment.contentFormatId,
      assignedFormatId: params.assignment.assignedContentFormatId,
      formatSelectionMode: params.assignment.formatSelectionMode,
      formatSelectionMultiplier: params.assignment.formatSelectionMultiplier,
      formatVersion: params.assignment.formatVersion,
      grammarVersion: params.assignment.grammarVersion,
      historySnapshot: params.assignment.historySnapshot,
      hookFamilyId: params.assignment.hookFamilyId,
      hookSelectionMode: params.assignment.hookSelectionMode,
      hookSelectionMultiplier: params.assignment.hookSelectionMultiplier,
      rotationCandidateFormatId:
        params.assignment.rotationCandidateContentFormatId,
      selectorVersion: params.assignment.selectorVersion,
    };
  }

  if (!("storyFormatId" in params.assignment)) {
    throw new Error("Structure 2 requires a Structure 2 format assignment.");
  }

  return {
    actualFormatId: params.assignment.storyFormatId,
    assignedFormatId: params.assignment.assignedStoryFormatId,
    formatSelectionMode: params.assignment.formatSelectionMode,
    formatSelectionMultiplier: params.assignment.formatSelectionMultiplier,
    formatVersion: params.assignment.formatVersion,
    grammarVersion: params.assignment.grammarVersion,
    historySnapshot: params.assignment.historySnapshot,
    hookFamilyId: null,
    hookSelectionMode: null,
    hookSelectionMultiplier: null,
    rotationCandidateFormatId:
      params.assignment.rotationCandidateStoryFormatId,
    selectorVersion: params.assignment.selectorVersion,
  };
}

function parseStructureFormatId(
  structureId: CarouselStructureId,
  value: string | null,
): CarouselStructureFormatId | null {
  if (structureId === "structure_1") {
    return isCarouselContentFormatId(value) ? value : null;
  }

  return isCarouselStructure2FormatId(value) ? value : null;
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

export async function reserveCarouselContentAssignment(params: {
  assignment: CarouselContentAssignment;
  carouselId: string;
}) {
  const { error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .update({
      content_assigned_format_id:
        params.assignment.assignedContentFormatId,
      content_format_id: params.assignment.contentFormatId,
      content_format_version: params.assignment.formatVersion,
      content_grammar_version: params.assignment.grammarVersion,
      content_history_snapshot:
        params.assignment.historySnapshot as unknown as Json,
      content_selector_version: params.assignment.selectorVersion,
      hook_family_id: params.assignment.hookFamilyId,
      updated_at: getNowIso(),
    })
    .eq("id", params.carouselId)
    .is("content_format_id", null)
    .is("hook_family_id", null);

  if (error) {
    throw new Error(`Could not reserve Carousel content grammar: ${error.message}`);
  }
}

export async function getCarouselEditBackgrounds(assetIds: string[]) {
  const ids = Array.from(new Set(assetIds.filter(Boolean)));

  if (ids.length === 0) {
    return [] satisfies CarouselEditBackground[];
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("id,base_url,is_active,runtime_exclusion_reason,status,subject_review_status")
    .in("id", ids);

  if (error) {
    throw new Error(`Could not load Carousel edit backgrounds: ${error.message}`);
  }

  return (data ?? []).flatMap((asset) =>
    asset.is_active &&
    asset.status === "ready" &&
    asset.subject_review_status === "approved" &&
    asset.runtime_exclusion_reason === null
      ? [{ id: asset.id, url: asset.base_url }]
      : [],
  ) satisfies CarouselEditBackground[];
}

export async function createCarouselProductAssetUpload(input: {
  assetId: string;
  businessProfileId: string;
  categorySlug: string;
  fileName: string;
  libraryAssetId: string;
  mimeType: string;
  publicUrl: string;
  storageKey: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .insert({
      asset_role: "product_asset",
      asset_scope: "category",
      base_s3_key: input.storageKey,
      base_url: input.publicUrl,
      category_slug: input.categorySlug,
      id: input.assetId,
      is_active: false,
      library_asset_id: input.libraryAssetId,
      orientation: "portrait",
      owner_business_profile_id: input.businessProfileId,
      source_filename: input.fileName,
      source_folder: "carousel-product-assets",
      source_metadata: {
        mimeType: input.mimeType,
        uploadKind: "trending_carousel_editor",
      },
      source_original_s3_key: input.storageKey,
      source_original_url: input.publicUrl,
      source_provider: "local",
      status: "processing",
      subject_review_status: "unreviewed",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create Carousel app screenshot upload: ${error.message}`);
  }

  return mapCarouselProductAssetUpload(data);
}

export async function getCarouselProductAssetUpload(input: {
  assetId: string;
  businessProfileId: string;
  categorySlug: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .eq("id", input.assetId)
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Carousel app screenshot upload: ${error.message}`);
  }

  return data ? mapCarouselProductAssetUpload(data) : null;
}

export async function completeCarouselProductAssetUpload(input: {
  assetId: string;
  businessProfileId: string;
  categorySlug: string;
  fileSize: number;
  height: number;
  mimeType: string;
  orientation: CategoryImageAssetRow["orientation"];
  sha256: string;
  width: number;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .update({
      height: input.height,
      is_active: true,
      orientation: input.orientation,
      runtime_exclusion_reason: null,
      source_file_sha256: input.sha256,
      source_metadata: {
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadKind: "trending_carousel_editor",
      },
      status: "ready",
      subject_review_status: "approved",
      updated_at: getNowIso(),
      width: input.width,
    })
    .eq("id", input.assetId)
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .eq("status", "processing")
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new CarouselProductAssetConflictError();
    }
    throw new Error(`Could not finish Carousel app screenshot upload: ${error.message}`);
  }
  if (!data) {
    throw new Error("Carousel app screenshot upload is no longer pending.");
  }

  return mapCarouselProductAsset(data);
}

export async function findCarouselProductAssetByHash(input: {
  businessProfileId: string;
  categorySlug: string;
  sha256: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .eq("source_file_sha256", input.sha256)
    .eq("is_active", true)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .is("runtime_exclusion_reason", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not check existing Carousel app screenshots: ${error.message}`);
  }

  return data ? mapCarouselProductAsset(data) : null;
}

export async function listCarouselProductAssets(input: {
  businessProfileId: string;
  categorySlug: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .eq("is_active", true)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .is("runtime_exclusion_reason", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list Carousel app screenshots: ${error.message}`);
  }

  return (data ?? []).map(mapCarouselProductAsset);
}

export async function getCarouselProductAssetsByIds(input: {
  assetIds: string[];
  businessProfileId: string;
  categorySlug: string;
}) {
  const assetIds = Array.from(new Set(input.assetIds.filter(Boolean)));

  if (assetIds.length === 0) {
    return [] satisfies CarouselProductAsset[];
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .select("*")
    .in("id", assetIds)
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .eq("is_active", true)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .is("runtime_exclusion_reason", null);

  if (error) {
    throw new Error(`Could not verify Carousel app screenshots: ${error.message}`);
  }

  return (data ?? []).map(mapCarouselProductAsset);
}

export async function archiveCarouselProductAsset(input: {
  assetId: string;
  businessProfileId: string;
  categorySlug: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CATEGORY_IMAGE_ASSETS_TABLE)
    .update({
      is_active: false,
      status: "archived",
      updated_at: getNowIso(),
    })
    .eq("id", input.assetId)
    .eq("asset_role", "product_asset")
    .eq("owner_business_profile_id", input.businessProfileId)
    .eq("category_slug", input.categorySlug)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not remove Carousel app screenshot: ${error.message}`);
  }

  return Boolean(data);
}

function mapCarouselProductAssetUpload(
  row: CategoryImageAssetRow,
): CarouselProductAssetUpload {
  if (!row.owner_business_profile_id || !row.asset_role || row.asset_role !== "product_asset") {
    throw new Error("Carousel app screenshot upload has invalid ownership metadata.");
  }

  return {
    businessProfileId: row.owner_business_profile_id,
    categorySlug: row.category_slug,
    id: row.id,
    status: row.status,
    storageKey: row.base_s3_key,
  };
}

function mapCarouselProductAsset(row: CategoryImageAssetRow): CarouselProductAsset {
  if (
    row.asset_role !== "product_asset" ||
    !row.owner_business_profile_id ||
    !row.library_asset_id ||
    !row.source_filename ||
    !row.width ||
    !row.height
  ) {
    throw new Error("Carousel app screenshot is missing required metadata.");
  }

  return {
    businessProfileId: row.owner_business_profile_id,
    categorySlug: row.category_slug,
    createdAt: row.created_at,
    fileName: row.source_filename,
    height: row.height,
    id: row.id,
    libraryAssetId: row.library_asset_id,
    storageKey: row.base_s3_key,
    url: row.base_url,
    width: row.width,
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

export async function getCarouselGenerationStatusesByIds(carouselIds: string[]) {
  const uniqueCarouselIds = Array.from(new Set(carouselIds.filter(Boolean)));

  if (uniqueCarouselIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .in("id", uniqueCarouselIds);

  if (error) {
    throw new Error(`Could not load carousel generations: ${error.message}`);
  }

  const statuses = await getCarouselGenerationStatusesForRows(
    (data ?? []).map(mapGeneration),
  );
  const statusByCarouselId = new Map(
    statuses.map((status) => [status.generation.id, status]),
  );

  return uniqueCarouselIds
    .map((carouselId) => statusByCarouselId.get(carouselId))
    .filter((status): status is NonNullable<typeof status> => Boolean(status));
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

export type AutoCarouselGenerationStatusPageCursor = {
  createdAt: string;
  id: string;
};

export async function getAutoCarouselGenerationStatusPageForUser(params: {
  availableOnOrBeforeLocalDate: string;
  businessProfileId: string;
  businessProfileVersion: number;
  cursor?: AutoCarouselGenerationStatusPageCursor | null;
  limit: number;
  projectId: string;
  statuses: readonly CarouselGenerationStatus[];
  userId: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit), 1), 200);
  const statuses = Array.from(new Set(params.statuses));

  if (statuses.length === 0) {
    return {
      nextCursor: null,
      statuses: [],
    };
  }

  let query = getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("generation_source", "auto_generated")
    .in("status", statuses)
    .or(
      `available_on_local_date.is.null,available_on_local_date.lte.${params.availableOnOrBeforeLocalDate}`,
    );

  if (params.cursor) {
    query = query.or(
      [
        `created_at.lt.${params.cursor.createdAt}`,
        `and(created_at.eq.${params.cursor.createdAt},id.lt.${params.cursor.id})`,
      ].join(","),
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not page automatic carousel generations: ${error.message}`);
  }

  const generations = (data ?? []).map(mapGeneration);
  const lastGeneration = generations.at(-1);

  return {
    nextCursor:
      generations.length === limit && lastGeneration
        ? {
            createdAt: lastGeneration.createdAt,
            id: lastGeneration.id,
          }
        : null,
    statuses: await getCarouselGenerationStatusesForRows(generations),
  };
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
    .eq("generation_source", "auto_generated")
    .order("candidate_index", { ascending: true });

  if (error) {
    throw new Error(`Could not list profile carousel generations: ${error.message}`);
  }

  return (data ?? []).map(mapGeneration);
}

export async function listRecentCarouselContentHistory(params: {
  businessProfileId: string;
  excludeGenerationBatchId?: string | null;
  limit?: number;
  structureId: CarouselStructureId;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 10);
  let query = getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("business_profile_id", params.businessProfileId)
    .eq("generation_source", "auto_generated")
    .eq("structure_id", params.structureId)
    .in("status", ["processing", "completed"]);

  if (params.excludeGenerationBatchId) {
    query = query.neq(
      "generation_batch_id",
      params.excludeGenerationBatchId,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("candidate_index", { ascending: false })
    .limit(limit * 4);

  if (error) {
    throw new Error(`Could not load recent Carousel content history: ${error.message}`);
  }

  return (data ?? [])
    .map(mapRecentContentSummary)
    .filter((summary) =>
      Boolean(
        summary.hook ||
          summary.topic ||
          summary.angle ||
          summary.contentFormatId ||
          summary.hookFamilyId,
      ),
    )
    .slice(0, limit);
}

export async function listRecentCarouselStructure2History(params: {
  businessProfileId: string;
  excludeGenerationBatchId?: string | null;
  limit?: number;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 10);
  let query = getSupabaseServerClient()
    .from(CAROUSEL_GENERATIONS_TABLE)
    .select("*")
    .eq("business_profile_id", params.businessProfileId)
    .eq("generation_source", "auto_generated")
    .eq("structure_id", "structure_2")
    .in("status", ["processing", "completed"]);

  if (params.excludeGenerationBatchId) {
    query = query.neq("generation_batch_id", params.excludeGenerationBatchId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("candidate_index", { ascending: false })
    .limit(limit * 4);

  if (error) {
    throw new Error(
      `Could not load recent Carousel Structure 2 history: ${error.message}`,
    );
  }

  return (data ?? [])
    .map(mapRecentCarouselStructure2History)
    .filter((item) =>
      Boolean(
        item.storyFormatId ||
          item.hookIdea ||
          item.storyAngle ||
          item.summary,
      ),
    )
    .slice(0, limit);
}

export async function listCarouselBatchContentHistory(params: {
  businessProfileId: string;
  excludeCarouselId: string;
  generationBatchId: string;
  limit?: number;
  structureId: CarouselStructureId;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 10);
  const { data, error } = await getSupabaseServerClient()
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

  return (data ?? []).map(mapRecentContentSummary).slice(0, limit);
}

function mapRecentContentSummary(
  row: CarouselGenerationRow,
): CarouselRecentContentSummary {
  const normalizedPlan = getJsonRecord(row.content_plan_normalized);
  const strategy = getJsonRecord(normalizedPlan?.contentStrategy);
  const slides = Array.isArray(normalizedPlan?.slides)
    ? normalizedPlan.slides
    : [];
  const firstSlide = getJsonRecord(slides[0]);

  return {
    angle:
      getJsonString(row.content_angle) ??
      getJsonString(strategy?.angle) ??
      getJsonString(normalizedPlan?.concept) ??
      row.selected_angle,
    audienceId:
      row.content_audience_id ?? getJsonString(strategy?.audienceId),
    contentFormatId: isCarouselContentFormatId(row.content_format_id)
      ? row.content_format_id
      : isCarouselContentFormatId(strategy?.contentFormatId)
        ? strategy.contentFormatId
        : null,
    hook:
      getJsonString(firstSlide?.headline) ??
      getJsonString(firstSlide?.body) ??
      getJsonString(firstSlide?.ctaText),
    hookFamilyId: isCarouselHookFamilyId(row.hook_family_id)
      ? row.hook_family_id
      : isCarouselHookFamilyId(strategy?.hookFamilyId)
        ? strategy.hookFamilyId
        : null,
    topic:
      row.content_topic ??
      getJsonString(strategy?.topic) ??
      getJsonString(strategy?.topicLabel),
    topicId:
      row.content_topic_id ??
      getJsonString(strategy?.topicId),
  };
}

function mapRecentCarouselStructure2History(
  row: CarouselGenerationRow,
): CarouselStructure2RecentHistory {
  const plan = getJsonRecord(row.content_plan_normalized);
  const historySummary = getJsonRecord(plan?.historySummary);
  const strategy = getJsonRecord(plan?.strategy);
  const slides = Array.isArray(plan?.slides) ? plan.slides : [];
  const firstSlide = getJsonRecord(slides[0]);
  const storyFormatId = [
    row.content_format_id,
    historySummary?.storyFormatId,
    strategy?.storyFormatId,
  ].find(isCarouselStructure2FormatId);

  return {
    centralProblem:
      getJsonString(historySummary?.centralProblem) ??
      getJsonString(strategy?.centralProblem),
    ctaAngle:
      getJsonString(historySummary?.ctaAngle) ??
      getJsonString(strategy?.ctaAngle),
    hookIdea:
      getJsonString(historySummary?.hookIdea) ??
      getJsonString(firstSlide?.storyText),
    productMechanism:
      getJsonString(historySummary?.productMechanism) ??
      getJsonString(strategy?.productMechanism),
    storyAngle:
      getJsonString(historySummary?.storyAngle) ??
      getJsonString(strategy?.angle),
    storyFormatId: storyFormatId ?? null,
    summary: getJsonString(historySummary?.summary),
  };
}

function getJsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getJsonString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
