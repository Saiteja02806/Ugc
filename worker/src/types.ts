export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type BackgroundJobStatus =
  | "cancelled"
  | "cancel_requested"
  | "completed"
  | "created"
  | "failed"
  | "processing"
  | "queued"
  | "rendering"
  | "stalled"
  | "uploading_output"
  | "waiting_external_service";

export type BackgroundJobType =
  | "analytics_sync"
  | "carousel_generation"
  | "final_render"
  | "generate_avatar"
  | "generate_carousel"
  | "generate_hook_video"
  | "generate_image"
  | "generate_thumbnail"
  | "generate_trending_hook_copy"
  | "extract_video_metadata"
  | "hook_text_generation"
  | "image_generation"
  | "media_analysis"
  | "preview_render"
  | "publish_social_post"
  | "render_demo_video"
  | "render_edit_video"
  | "render_schedule_combination"
  | "render_trending_carousel_edit"
  | "render_wall_text_video"
  | "social_publish"
  | "test_worker_job"
  | "video_generation"
  | "wall_text_generation";

export const EXECUTABLE_BACKGROUND_JOB_TYPES = [
  "analytics_sync",
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "generate_trending_hook_copy",
  "hook_text_generation",
  "media_analysis",
  "publish_social_post",
  "render_edit_video",
  "render_schedule_combination",
  "render_trending_carousel_edit",
  "render_wall_text_video",
  "test_worker_job",
  "wall_text_generation",
] as const satisfies readonly BackgroundJobType[];

type ScheduledPostStatus =
  | "cancelled"
  | "draft"
  | "failed"
  | "partially_failed"
  | "published"
  | "publishing"
  | "scheduled"
  | "scheduling";

type ScheduledPostTargetStatus =
  | "action_required"
  | "cancelled"
  | "draft"
  | "failed"
  | "published"
  | "publishing"
  | "scheduled"
  | "scheduling"
  | "skipped";

type SchedulePlatform = "instagram" | "tiktok" | "youtube";
type SocialConnectionStatus =
  | "connected"
  | "error"
  | "expired"
  | "permission_missing"
  | "revoked";

export type BackgroundJobRow = {
  attempt_count: number;
  cancel_requested_at: string | null;
  queue_message_id: string | null;
  claim_token: string | null;
  completed_at: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  failed_at: string | null;
  id: string;
  input_json: Json;
  input_reference: string | null;
  job_type: BackgroundJobType;
  last_delivery_at: string | null;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  max_attempts: number;
  next_attempt_at: string | null;
  output_json: Json | null;
  output_reference: string | null;
  progress: number | null;
  project_id: string | null;
  queue_name: string;
  queue_provider: "gcp";
  queued_at: string | null;
  stage: string | null;
  started_at: string | null;
  status: BackgroundJobStatus;
  updated_at: string;
  user_id: string | null;
  worker_execution_id: string | null;
  worker_id: string | null;
};

export type BackgroundJobUpdate = Partial<{
  attempt_count: number;
  cancel_requested_at: string | null;
  claim_token: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  failed_at: string | null;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  next_attempt_at: string | null;
  output_json: Json | null;
  output_reference: string | null;
  progress: number | null;
  stage: string | null;
  started_at: string | null;
  status: BackgroundJobStatus;
  updated_at: string;
  worker_execution_id: string | null;
  worker_id: string | null;
}>;

export type SocialPublishOperationStatus =
  | "initialized"
  | "pending"
  | "published";

export type SocialPublishProviderOperationKind =
  | "instagram_container"
  | "tiktok_publish"
  | "youtube_resumable_upload";

export type SocialPublishOperationRow = {
  active_claim_token: string | null;
  active_job_id: string | null;
  claimed_at: string | null;
  created_at: string;
  id: string;
  idempotency_key: string;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Json;
  platform: SchedulePlatform;
  platform_post_id: string | null;
  platform_post_url: string | null;
  provider_operation_id: string | null;
  provider_operation_kind: SocialPublishProviderOperationKind | null;
  published_at: string | null;
  scheduled_post_target_id: string;
  status: SocialPublishOperationStatus;
  updated_at: string;
  user_id: string;
};

export type SocialPublishOperationUpdate = Partial<{
  active_claim_token: string | null;
  active_job_id: string | null;
  claimed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Json;
  platform_post_id: string | null;
  platform_post_url: string | null;
  provider_operation_id: string | null;
  provider_operation_kind: SocialPublishProviderOperationKind | null;
  published_at: string | null;
  status: SocialPublishOperationStatus;
  updated_at: string;
}>;

type EditableVideoUpdate = Partial<{
  rendered_video_url: string | null;
  status: "ready" | "draft" | "rendering" | "rendered" | "failed";
  updated_at: string;
}>;

type DemoVideoUpdate = Partial<{
  error_message: string | null;
  latest_render_id: string | null;
  rendered_video_url: string | null;
  status:
    | "uploading"
    | "processing"
    | "ready"
    | "draft"
    | "rendering"
    | "rendered"
    | "failed";
  updated_at: string;
}>;

type VideoRenderJobUpdate = Partial<{
  completed_at: string | null;
  error_message: string | null;
  output_s3_key: string | null;
  output_url: string | null;
  started_at: string | null;
  status: "queued" | "rendering" | "completed" | "failed";
  updated_at: string;
}>;

type MediaAssetInsert = {
  collection: "image" | "influencer" | "video";
  duration_seconds: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  height: number | null;
  id: string;
  metadata: Json;
  mime_type: string;
  parent_asset_id: string | null;
  project_id: string | null;
  ratio: "9:16" | "1:1" | "4:5" | "16:9" | "other";
  source_record_id: string | null;
  source_type:
    | "upload"
    | "influencer_upload"
    | "demo_upload"
    | "catalog_influencer"
    | "generated_image"
    | "generated_video"
    | "edit_export"
    | "combined_render"
    | "wall_text_render";
  status: "uploading" | "processing" | "ready" | "failed";
  storage_key: string;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  url: string;
  user_id: string;
  width: number | null;
};

type UserWallTextAssignmentUpdate = Partial<{
  render_error: string | null;
  render_job_id: string | null;
  render_status: "not_requested" | "queued" | "rendering" | "ready" | "failed";
  rendered_at: string | null;
  rendered_media_asset_id: string | null;
  updated_at: string;
}>;

export type GenerationProvider = "openai" | "runway" | "veo";

export type GenerationProviderOperationStatus =
  | "failed"
  | "output_persisted"
  | "provider_succeeded"
  | "reserved"
  | "submission_uncertain"
  | "submitted";

export type GenerationProviderOperationRow = {
  created_at: string;
  id: string;
  job_id: string;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Json;
  operation_key: string;
  output_persisted_at: string | null;
  output_reference: string | null;
  output_url: string | null;
  provider: GenerationProvider;
  provider_completed_at: string | null;
  provider_operation_id: string | null;
  request_fingerprint: string;
  retry_allowed: boolean;
  status: GenerationProviderOperationStatus;
  submitted_at: string | null;
  updated_at: string;
};

export type GenerationProviderOperationInsert = {
  job_id: string;
  metadata?: Json;
  operation_key: string;
  provider: GenerationProvider;
  request_fingerprint: string;
};

export type GenerationProviderOperationUpdate = Partial<{
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Json;
  output_persisted_at: string | null;
  output_reference: string | null;
  output_url: string | null;
  provider_completed_at: string | null;
  provider_operation_id: string | null;
  retry_allowed: boolean;
  status: GenerationProviderOperationStatus;
  submitted_at: string | null;
  updated_at: string;
}>;

export type CarouselFormat = "1:1" | "4:5";
export type CarouselGenerationStatus = "completed" | "failed" | "processing";
export type CarouselSlideStatus = "failed" | "processing" | "ready";
export type CategoryImageAssetScope = "category" | "shared";
export type CategoryImageAssetSourceProvider = "local" | "pexels";
export type CategoryImageAssetVariant =
  | "canonical"
  | "cropped_only"
  | "derived_crop"
  | "duplicate"
  | "flat"
  | "preview";

export type WebsiteBusinessAnalysis = {
  brandTone?: string | null;
  businessName?: string | null;
  businessModel?: "b2b" | "b2c" | "both" | null;
  campaignPurposes?: Array<
    | "app_install"
    | "conversion"
    | "education"
    | "product_discovery"
    | "retargeting"
  >;
  carouselAngles?: string[];
  category?: string | null;
  categories?: string[];
  claimsToAvoid?: string[];
  confidence?: "high" | "low" | "medium";
  confidenceReason?: string | null;
  ctaIdeas?: string[];
  differentiators?: string[];
  mainProblem?: string | null;
  mainPromise?: string | null;
  missingInfo?: string[];
  painPoints?: string[];
  pexelsImageQueries?: string[];
  productSummary?: string | null;
  recommendedCarouselStructure?: string[];
  targetAudience?: string[];
  valueProps?: string[];
  visualKeywords?: string[];
};

export type WebsiteAnalysisRow = {
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

export type CategoryImageAssetRow = {
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
  height: number | null;
  id: string;
  image_subject_class: "clear-face" | "faceless-human" | "object-only" | null;
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
  visual_keywords: Json;
  visual_setting: string | null;
  visual_style: string | null;
  width: number | null;
};

export type CarouselGenerationRow = {
  business_profile_id: string | null;
  business_profile_version: number | null;
  candidate_count: number;
  candidate_index: number;
  category_slug: string | null;
  content_angle: string | null;
  content_audience_id: string | null;
  content_format_id: string | null;
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
  project_id: string;
  renderer_version: string | null;
  selected_angle: string | null;
  slide_count: number;
  status: CarouselGenerationStatus;
  trigger_run_id: string | null;
  updated_at: string;
  user_id: string;
  website_analysis_id: string | null;
};

export type BusinessProfileCarouselRow = {
  context_json: WebsiteBusinessAnalysis;
  id: string;
  profile_version: number;
  user_id: string;
};

export type CarouselGenerationUpdate = Partial<{
  content_angle: string | null;
  content_audience_id: string | null;
  content_format_id: string | null;
  content_plan_fallback_reason: string | null;
  content_plan_normalized: Json | null;
  content_plan_raw_response: Json | null;
  content_plan_source: string | null;
  content_plan_validation: Json | null;
  content_planner_model: string | null;
  content_planner_version: string | null;
  content_goal_id: string | null;
  content_grammar_version: string | null;
  content_history_snapshot: Json;
  content_problem_id: string | null;
  content_selector_version: string | null;
  content_topic: string | null;
  content_topic_id: string | null;
  error_message: string | null;
  renderer_version: string | null;
  hook_family_id: string | null;
  status: CarouselGenerationStatus;
  updated_at: string;
}>;

export type CarouselSlideRow = {
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

export type TrendingCreativeEditRow = {
  assignment_id: string;
  content_json: Json;
  created_at: string;
  creative_id: string;
  format: "carousel" | "hook_video" | "wall_text";
  id: string;
  position_json: Json;
  render_error: string | null;
  render_job_id: string | null;
  render_output_json: Json | null;
  render_status: "draft" | "failed" | "queued" | "ready" | "rendering";
  resolved_media_asset_id: string | null;
  revision: number;
  source_group_id: string | null;
  source_media_asset_id: string | null;
  source_selection_kind: "asset" | "group" | null;
  updated_at: string;
  user_id: string;
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

export type LibraryItemRow = {
  deleted_at: string | null;
  id: string;
  media_type: "carousel";
  project_id: string;
  source_type: "generated_carousel";
  status: "archived" | "ready";
  title: string;
  user_id: string;
};

export type LibraryCarouselSlideRow = {
  id: string;
  library_item_id: string;
  rendered_url: string;
  slide_number: number;
};

export type SocialConnectionRow = {
  access_token_ciphertext: string;
  connected_at: string;
  expires_at: string | null;
  id: string;
  last_error_code: string | null;
  metadata: Json;
  platform: SchedulePlatform;
  platform_account_id: string;
  platform_account_name: string | null;
  platform_account_username: string | null;
  provider: "google" | "meta" | "tiktok";
  refresh_expires_at: string | null;
  refresh_token_ciphertext: string | null;
  revoked_at: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  token_refreshed_at: string | null;
  token_refresh_claim_token: string | null;
  token_refresh_claimed_at: string | null;
  token_type: string | null;
  updated_at: string;
  user_id: string;
};

export type BackgroundJobsDatabase = {
  public: {
    Functions: {
      claim_social_connection_token_refresh: {
        Args: {
          p_claim_token: string;
          p_connection_id: string;
          p_stale_after_seconds: number;
          p_user_id: string;
        };
        Returns: SocialConnectionRow[];
      };
      complete_social_connection_token_refresh: {
        Args: {
          p_access_token_ciphertext: string;
          p_claim_token: string;
          p_connection_id: string;
          p_expires_at: string | null;
          p_refresh_expires_at: string | null;
          p_refresh_token_ciphertext: string | null;
          p_scopes: string[];
          p_status: "connected" | "permission_missing";
          p_token_type: string;
          p_user_id: string;
        };
        Returns: SocialConnectionRow[];
      };
      mark_social_publish_target_action_required: {
        Args: {
          p_error_code: string;
          p_error_message: string;
          p_metadata: Json;
          p_target_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      claim_background_job: {
        Args: {
          p_claim_token: string;
          p_job_id: string;
          p_stale_after_seconds: number;
          p_worker_id: string;
        };
        Returns: BackgroundJobRow[];
      };
      complete_background_job: {
        Args: {
          p_claim_token: string;
          p_job_id: string;
          p_output: Json;
          p_output_reference: string | null;
        };
        Returns: BackgroundJobRow[];
      };
      finalize_edit_render: {
        Args: {
          p_error_message: string | null;
          p_output_s3_key: string | null;
          p_output_url: string | null;
          p_project_id: string;
          p_render_id: string;
          p_source_video_id: string;
          p_terminal_status: "completed" | "failed";
          p_user_id: string;
        };
        Returns: boolean;
      };
      claim_social_publish_operation: {
        Args: {
          p_claim_token: string;
          p_job_id: string;
          p_platform: SchedulePlatform;
          p_stale_after_seconds: number;
          p_target_id: string;
          p_user_id: string;
        };
        Returns: SocialPublishOperationRow[];
      };
      list_due_social_publish_jobs: {
        Args: {
          p_limit: number;
          p_stale_after_seconds: number;
        };
        Returns: Array<{ job_id: string }>;
      };
      reconcile_social_schedule_state: {
        Args: {
          p_limit: number;
          p_stale_after_seconds: number;
        };
        Returns: number;
      };
      release_social_connection_token_refresh: {
        Args: {
          p_claim_token: string;
          p_connection_id: string;
          p_error_code: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      increment_category_image_asset_usage: {
        Args: { asset_ids: string[] };
        Returns: null;
      };
      persist_trending_hook_copy_generation: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: number;
      };
      persist_trending_hook_copy_generation_v4: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: number;
      };
      persist_trending_hook_copy_generation_v5: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: number;
      };
      persist_trending_hook_copy_generation_v6: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: number;
      };
      persist_validated_hook_composition_generation: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_demo_asset_id: string;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: Array<{ id: string; text: string }>;
      };
      persist_validated_hook_composition_generation_v6: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_candidates: Json;
          p_demo_asset_id: string;
          p_generator_model: string;
          p_job_id: string;
          p_prompt_version: string;
          p_selection_version: string;
          p_user_id: string;
        };
        Returns: Array<{ id: string; text: string }>;
      };
    };
    Tables: {
      background_jobs: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: BackgroundJobRow;
        Update: BackgroundJobUpdate;
      };
      business_profiles: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: BusinessProfileCarouselRow;
        Update: Record<string, never>;
      };
      carousel_generations: {
        Insert: Record<string, never>;
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
      trending_creative_edits: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: TrendingCreativeEditRow;
        Update: Partial<TrendingCreativeEditRow>;
      };
      category_image_assets: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: CategoryImageAssetRow;
        Update: Partial<CategoryImageAssetRow>;
      };
      editable_videos: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: Record<string, Json>;
        Update: EditableVideoUpdate;
      };
      generation_provider_operations: {
        Insert: GenerationProviderOperationInsert;
        Relationships: [];
        Row: GenerationProviderOperationRow;
        Update: GenerationProviderOperationUpdate;
      };
      demo_videos: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: Record<string, Json>;
        Update: DemoVideoUpdate;
      };
      media_assets: {
        Insert: MediaAssetInsert;
        Relationships: [];
        Row: MediaAssetInsert & {
          created_at: string;
          deleted_at: string | null;
        };
        Update: Partial<MediaAssetInsert> & { deleted_at?: string | null };
      };
      user_wall_text_assignments: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: {
          id: string;
          render_id: string | null;
          user_id: string;
        };
        Update: UserWallTextAssignmentUpdate;
      };
      library_carousel_slides: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: LibraryCarouselSlideRow;
        Update: Record<string, never>;
      };
      library_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: LibraryItemRow;
        Update: Record<string, never>;
      };
      scheduled_posts: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: {
          caption: string;
          id: string;
          last_error_code: string | null;
          library_item_id: string | null;
          media_asset_id: string | null;
          metadata: Json;
          published_at: string | null;
          project_id: string | null;
          source_kind: "library_item" | "media_asset";
          status: ScheduledPostStatus;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Update: Partial<{
          last_error_code: string | null;
          media_asset_id: string | null;
          metadata: Json;
          published_at: string | null;
          status: ScheduledPostStatus;
          updated_at: string;
        }>;
      };
      scheduled_post_targets: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: {
          attempt_count: number;
          id: string;
          last_error_code: string | null;
          last_error_message: string | null;
          metadata: Json;
          next_retry_at: string | null;
          platform: SchedulePlatform;
          platform_post_id: string | null;
          platform_post_url: string | null;
          publish_job_id: string | null;
          published_at: string | null;
          scheduled_for: string;
          scheduled_post_id: string;
          settings: Json;
          social_connection_id: string;
          status: ScheduledPostTargetStatus;
          updated_at: string;
          user_id: string;
        };
        Update: Partial<{
          attempt_count: number;
          last_error_code: string | null;
          last_error_message: string | null;
          metadata: Json;
          next_retry_at: string | null;
          platform_post_id: string | null;
          platform_post_url: string | null;
          published_at: string | null;
          status: ScheduledPostTargetStatus;
          updated_at: string;
        }>;
      };
      social_publish_operations: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: SocialPublishOperationRow;
        Update: SocialPublishOperationUpdate;
      };
      social_connections: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: SocialConnectionRow;
        Update: Partial<{
          access_token_ciphertext: string;
          expires_at: string | null;
          last_error_code: string | null;
          refresh_expires_at: string | null;
          refresh_token_ciphertext: string | null;
          scopes: string[];
          status: SocialConnectionStatus;
          token_refreshed_at: string | null;
          token_refresh_claim_token: string | null;
          token_refresh_claimed_at: string | null;
          token_type: string | null;
          updated_at: string;
        }>;
      };
      video_render_jobs: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: Record<string, Json>;
        Update: VideoRenderJobUpdate;
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

export type WorkerQueueMessage = {
  attempt?: number;
  jobId: string;
  jobType: BackgroundJobType;
  schemaVersion?: number;
};
