export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type BackgroundJobStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "processing"
  | "queued";

export type BackgroundJobType =
  | "extract_video_metadata"
  | "generate_avatar"
  | "generate_carousel"
  | "generate_hook_video"
  | "generate_image"
  | "generate_thumbnail"
  | "publish_social_post"
  | "render_demo_video"
  | "render_edit_video"
  | "render_schedule_combination"
  | "test_worker_job";

export type BackgroundJobRow = {
  attempt_count: number;
  aws_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  id: string;
  input_json: Json;
  job_type: BackgroundJobType;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  output_json: Json | null;
  project_id: string | null;
  queue_name: string;
  started_at: string | null;
  status: BackgroundJobStatus;
  updated_at: string;
  user_id: string | null;
  worker_id: string | null;
};

export type BackgroundJobUpdate = Partial<{
  attempt_count: number;
  completed_at: string | null;
  error_message: string | null;
  last_heartbeat_at: string | null;
  locked_at: string | null;
  output_json: Json | null;
  started_at: string | null;
  status: BackgroundJobStatus;
  updated_at: string;
  worker_id: string | null;
}>;

type EditableVideoUpdate = Partial<{
  rendered_video_url: string | null;
  status: "ready" | "draft" | "rendering" | "rendered" | "failed";
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
    | "combined_render";
  status: "uploading" | "processing" | "ready" | "failed";
  storage_key: string;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  url: string;
  user_id: string;
  width: number | null;
};

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
  carouselAngles?: string[];
  category?: string | null;
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
  candidate_count: number;
  candidate_index: number;
  category_slug: string | null;
  content_plan_fallback_reason: string | null;
  content_plan_normalized: Json | null;
  content_plan_raw_response: Json | null;
  content_plan_source: string | null;
  content_plan_validation: Json | null;
  content_planner_model: string | null;
  content_planner_version: string | null;
  created_at: string;
  error_message: string | null;
  format: CarouselFormat;
  generation_batch_id: string;
  goal: string | null;
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

export type CarouselGenerationUpdate = Partial<{
  content_plan_fallback_reason: string | null;
  content_plan_normalized: Json | null;
  content_plan_raw_response: Json | null;
  content_plan_source: string | null;
  content_plan_validation: Json | null;
  content_planner_model: string | null;
  content_planner_version: string | null;
  error_message: string | null;
  renderer_version: string | null;
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

export type BackgroundJobsDatabase = {
  public: {
    Functions: {
      increment_category_image_asset_usage: {
        Args: { asset_ids: string[] };
        Returns: null;
      };
    };
    Tables: {
      background_jobs: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: BackgroundJobRow;
        Update: BackgroundJobUpdate;
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
      media_assets: {
        Insert: MediaAssetInsert;
        Relationships: [];
        Row: MediaAssetInsert & {
          created_at: string;
          deleted_at: string | null;
        };
        Update: Partial<MediaAssetInsert> & { deleted_at?: string | null };
      };
      scheduled_posts: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: {
          id: string;
          media_asset_id: string | null;
          metadata: Json;
          project_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Update: Partial<{
          media_asset_id: string | null;
          metadata: Json;
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
  jobId: string;
  jobType: BackgroundJobType;
};
