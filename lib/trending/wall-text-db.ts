import "server-only";

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { MediaAssetRow } from "@/lib/media/media-storage";
import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
  WallTextNormalizedBox,
  WallTextPlacementAnalysis,
  WallTextPlacementZone,
} from "@/lib/trending/wall-text-types";
import {
  WALL_TEXT_GENERATOR_VERSION,
  WALL_TEXT_FINAL_LAYOUT_VERSION,
  WALL_TEXT_FORMAT_IDS,
  WALL_TEXT_PATTERNS,
  WALL_TEXT_PLACEMENT_ZONES,
  WALL_TEXT_RENDER_SAFETY_VERSION,
} from "@/lib/trending/wall-text-types";
import {
  createWallTextLayout,
  getWallTextZoneBox,
  isEligibleWallTextVideo,
  MIN_WALL_TEXT_VIDEO_DURATION_SECONDS,
  type WallTextAssetSelectionInput,
} from "@/lib/trending/wall-text-feed-logic";
import { createAuthoritativeWallTextContent } from "@/lib/trending/wall-layout-engine";
import {
  ensureBaseWallTextAudioSelections,
  listBaseWallTextAudioSelections,
  type ResolvedWallTextAudioSelection,
} from "@/lib/trending/wall-audio-db";
import type { WallTextDuplicateSignature } from "@/lib/trending/wall-text-duplicate-logic";
import {
  LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT,
  LEGACY_WALL_TEXT_FONT_WEIGHT,
  WALL_TEXT_ARIAL_REGULAR_FONT_WEIGHT,
  WALL_TEXT_FONT_WEIGHT,
} from "@/lib/trending/wall-text-visual-style";
import {
  applyWallTextRenderFit,
  validateWallTextRenderFit,
} from "@/lib/trending/wall-text-render-validation";
import {
  deriveWallTextPerformanceSignals,
  type WallTextPerformanceSignals,
} from "@/lib/trending/wall-format-performance-logic";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type OverlayMediaAssetRow = {
  analyzed_at: string | null;
  analysis_status: string;
  aspect_ratio: string;
  asset_type: string;
  content_type: string | null;
  created_at: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  format_family: string;
  height: number | null;
  id: string;
  last_used_at: string | null;
  motion_level: string | null;
  owner_user_id: string | null;
  placement_analysis: Json | null;
  preview_url: string | null;
  readability_score: number | null;
  recommended_position: string | null;
  s3_key: string;
  source_batch: string | null;
  source_file_sha256: string | null;
  source_file_name: string | null;
  source_media_asset_id: string | null;
  source_type: string;
  status: string;
  text_capacity: string | null;
  thumbnail_s3_key: string | null;
  thumbnail_url: string | null;
  updated_at: string;
  usage_count: number;
  visual_group: string | null;
  wall_text_source_kind: "creative_asset" | "instagram_reel" | "ugcpilot" | null;
  width: number | null;
};

type WallTextRenderedMediaAssetRow = {
  created_at: string;
  id: string;
  status: "uploading" | "processing" | "ready" | "failed";
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  url: string;
};

export type WallTextCreativeRow = {
  business_profile_id: string;
  business_profile_version: number;
  candidate_index: number;
  created_at: string;
  duration_seconds: number;
  error_message: string | null;
  generation_id: string;
  generator_model: string | null;
  generator_version: string;
  id: string;
  layout: Json;
  instagram_reel_template_id: string | null;
  overlay_media_asset_id: string;
  status: "archived" | "failed" | "preview_ready";
  source_kind: "creative_asset" | "instagram_reel" | "ugcpilot";
  text_content: Json;
  updated_at: string;
  user_id: string;
};

type WallTextGenerationBatchRow = {
  business_profile_id: string;
  business_profile_version: number;
  candidate_index_start: number;
  chunk_count: number;
  format_library_version: string;
  generator_version: string;
  id: string;
  requested_count: number;
  request_hash: string;
  request_key: string;
  prompt_version: string;
  selector_version: string;
  status: "pending" | "processing" | "completed" | "failed";
  user_id: string;
};

type WallTextGenerationAssignmentRow = {
  assigned_format_id: string | null;
  batch_candidate_index: number;
  batch_id: string;
  chunk_id: string;
  creative_candidate_index: number;
  duration_seconds: number;
  format_version: number;
  id: string;
  instagram_reel_template_id: string | null;
  instagram_reel_template_version: number | null;
  instagram_reference_text: string | null;
  instagram_reference_text_hash: string | null;
  instagram_locked_audio_asset_id: string | null;
  instagram_audio_fit_mode: "exact" | "trim" | null;
  layout_json: Json;
  max_words: number;
  overlay_media_asset_id: string;
  selection_mode: WallTextPersistedFormatAssignment["selectionMode"];
  selection_weight_snapshot: number;
  source_kind: "creative_asset" | "instagram_reel" | "ugcpilot";
  status: "pending" | "processing" | "retry_pending" | "completed" | "failed";
  target_words: number;
  wall_text_creative_id: string | null;
  wall_text_content_plan_id: string | null;
  wall_text_content_plan_item_id: string | null;
};

type WallTextContentPlanBriefRow = {
  audience_context: string;
  creative_seed: string;
  emotional_tension: string;
  human_moment: string;
  id: string;
  plan_id: string;
  preferred_format_family: string;
  supported_angle: string;
  user_id: string;
};

type WallTextContentPlanItemRow = {
  content_idea: string;
  creative_brief_id: string;
  feeling: string;
  id: string;
  plan_id: string;
  private_context: Json | null;
  status: "available" | "consumed" | "reserved" | "retired";
  user_id: string;
};

export type WallTextPrivateCreativeContext = {
  contentIdea: string;
  feeling: string;
  planningBrief: {
    audienceContext: string;
    conceptLane?: string;
    creativeSeed: string;
    emotionalTension: string;
    humanMoment: string;
    supportedAngle: string;
  };
};

export type WallTextPersistedFormatAssignment = {
  assignedFormatId: string | null;
  selectionMode:
    | "controlled_rotation"
    | "freeform"
    | "instagram_template"
    | "performance_exploration"
    | "performance_weighted";
  selectionWeight: number;
};

type WallTextContentHistoryRow = {
  business_profile_id: string;
  content_hash: string;
  created_at: string;
  normalized_text: string;
  similarity_signature: Json;
  user_id: string;
};

type WallTextInstagramReelTemplateRow = {
  audio_fit_mode: "exact" | "trim";
  canonical_reference_url: string;
  id: string;
  instagram_reference_url: string;
  locked_audio_asset_id: string;
  overlay_media_asset_id: string;
  reference_text: string;
  reference_text_hash: string;
  safe_text_box: Json;
  status: "active" | "inactive" | "pending" | "rejected";
  template_key: string;
  template_version: number;
  writer_format_id: string;
};

type WallTextGenerationChunkRow = {
  attempt_count: number;
  batch_id: string;
  claim_token: string | null;
  chunk_index: number;
  id: string;
  status: "pending" | "processing" | "retry_pending" | "completed" | "failed";
};

export type WallTextRenderStatus =
  | "not_requested"
  | "queued"
  | "rendering"
  | "ready"
  | "failed";

export type UserWallTextAssignmentRow = {
  business_profile_id: string;
  business_profile_version: number;
  completed_at: string | null;
  created_at: string;
  id: string;
  last_opened_at: string | null;
  library_saved_at: string | null;
  position: number;
  render_edit_id: string | null;
  render_edit_revision: number | null;
  render_error: string | null;
  render_id: string | null;
  render_job_id: string | null;
  render_requested_at: string | null;
  render_status: WallTextRenderStatus;
  rendered_at: string | null;
  rendered_media_asset_id: string | null;
  state: "active" | "completed_skipped" | "selected";
  updated_at: string;
  user_id: string;
  wall_text_creative_id: string;
};

type WallTextDatabase = {
  public: {
    Functions: {
      replace_wall_text_creative_copy_v5: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_generator_model: string;
          p_updates: Json;
          p_user_id: string;
        };
        Returns: WallTextCreativeRow[];
      };
      replace_wall_text_creative_copy_v8: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_generator_model: string;
          p_updates: Json;
          p_user_id: string;
        };
        Returns: WallTextCreativeRow[];
      };
      replace_wall_text_creative_copy_v9: {
        Args: {
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_generator_model: string;
          p_updates: Json;
          p_user_id: string;
        };
        Returns: WallTextCreativeRow[];
      };
      claim_wall_text_render: {
        Args: {
          p_assignment_id: string;
          p_edit_id: string | null;
          p_edit_revision: number | null;
          p_user_id: string;
        };
        Returns: UserWallTextAssignmentRow[];
      };
      get_wall_text_format_performance_v1: {
        Args: { p_business_profile_id: string; p_user_id: string };
        Returns: Array<{
          format_id: string;
          last_generated_at: string | null;
          published_result_count: number;
          recent_view_counts: number[];
          times_generated: number;
        }>;
      };
      claim_wall_text_generation_chunk_v1: {
        Args: { p_chunk_id: string; p_user_id: string };
        Returns: string | null;
      };
      record_wall_text_generation_chunk_failure_v1: {
        Args: {
          p_chunk_id: string;
          p_claim_token: string;
          p_error_code: string;
          p_error_message: string;
          p_retryable: boolean;
          p_user_id: string;
        };
        Returns: undefined;
      };
      reserve_wall_text_generation_batch_v1: {
        Args: {
          p_assignments: Json;
          p_business_profile_id: string;
          p_business_profile_version: number;
          p_format_library_version: string;
          p_generator_version: string;
          p_prompt_version: string;
          p_request_hash: string;
          p_request_key: string;
          p_selector_version: string;
          p_user_id: string;
        };
        Returns: WallTextGenerationBatchRow[];
      };
      save_wall_text_generation_candidate_v1: {
        Args: {
          p_assignment_id: string;
          p_claim_token: string;
          p_content_hash: string;
          p_creative_id: string;
          p_generator_model: string;
          p_layout: Json;
          p_normalized_text: string;
          p_similarity_signature: Json;
          p_text_content: Json;
          p_user_id: string;
        };
        Returns: WallTextCreativeRow[];
      };
    };
    Tables: {
      media_assets: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: WallTextRenderedMediaAssetRow;
        Update: Record<string, never>;
      };
      overlay_media_assets: {
        Insert: Partial<OverlayMediaAssetRow>;
        Relationships: [];
        Row: OverlayMediaAssetRow;
        Update: Partial<OverlayMediaAssetRow>;
      };
      user_wall_text_assignments: {
        Insert: Partial<UserWallTextAssignmentRow> &
          Pick<
            UserWallTextAssignmentRow,
            | "business_profile_id"
            | "business_profile_version"
            | "position"
            | "user_id"
            | "wall_text_creative_id"
          >;
        Relationships: [];
        Row: UserWallTextAssignmentRow;
        Update: Partial<UserWallTextAssignmentRow>;
      };
      wall_text_creatives: {
        Insert: Partial<WallTextCreativeRow> &
          Pick<
            WallTextCreativeRow,
            | "business_profile_id"
            | "business_profile_version"
            | "candidate_index"
            | "duration_seconds"
            | "generation_id"
            | "id"
            | "layout"
            | "overlay_media_asset_id"
            | "text_content"
            | "user_id"
          >;
        Relationships: [];
        Row: WallTextCreativeRow;
        Update: Partial<WallTextCreativeRow>;
      };
      wall_text_content_plan_briefs: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: WallTextContentPlanBriefRow;
        Update: Partial<WallTextContentPlanBriefRow>;
      };
      wall_text_content_plan_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: WallTextContentPlanItemRow;
        Update: Partial<WallTextContentPlanItemRow>;
      };
      wall_text_content_history: {
        Insert: never;
        Relationships: [];
        Row: WallTextContentHistoryRow;
        Update: never;
      };
      wall_text_generation_assignments: {
        Insert: never;
        Relationships: [];
        Row: WallTextGenerationAssignmentRow;
        Update: never;
      };
      wall_text_generation_chunks: {
        Insert: never;
        Relationships: [];
        Row: WallTextGenerationChunkRow;
        Update: never;
      };
      wall_text_instagram_reel_templates: {
        Insert: Partial<WallTextInstagramReelTemplateRow>;
        Relationships: [];
        Row: WallTextInstagramReelTemplateRow;
        Update: Partial<WallTextInstagramReelTemplateRow>;
      };
      wall_text_generation_batches: {
        Insert: never;
        Relationships: [];
        Row: WallTextGenerationBatchRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

export type TrendingWallTextIdeaRecord = {
  assignmentId: string;
  audio: ResolvedWallTextAudioSelection;
  backgroundAssetId: string;
  candidateIndex: number;
  createdAt: string;
  durationSeconds: number;
  id: string;
  layout: TrendingWallTextLayout;
  position: number;
  previewUrl: string;
  text: TrendingWallTextContent;
  thumbnailUrl: string | null;
};

export type SavedWallTextDraft = TrendingWallTextIdeaRecord & {
  renderError: string | null;
  renderedAt: string | null;
  renderedMediaAssetId: string | null;
  renderedThumbnailUrl: string | null;
  renderedVideoUrl: string | null;
  renderStatus: WallTextRenderStatus;
  updatedAt: string;
};

let client: SupabaseClient<WallTextDatabase> | null = null;

export function getMissingWallTextDbEnvVars() {
  const missing: string[] = [];

  if (
    !process.env.SUPABASE_URL?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function listRecentWallTextBackgroundAssetIds(params: {
  limit?: number;
  userId: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 60), 1), 100);
  const { data, error } = await getClient()
    .from("wall_text_creatives")
    .select("overlay_media_asset_id")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Could not load recent Wall-of-text backgrounds: ${error.message}`,
    );
  }

  const assetIds = new Set(data.map((row) => row.overlay_media_asset_id));

  if (assetIds.size === 0) {
    return { assetIds, visualGroups: new Set<string>() };
  }

  const { data: assets, error: assetError } = await getClient()
    .from("overlay_media_assets")
    .select("*")
    .in("id", [...assetIds]);

  if (assetError) {
    throw new Error(
      `Could not load recent Wall-of-text visual groups: ${assetError.message}`,
    );
  }

  return {
    assetIds,
    visualGroups: new Set(
      assets.flatMap((asset) =>
        asset.visual_group?.trim() ? [asset.visual_group.trim()] : [],
      ),
    ),
  };
}

export async function listWallTextVideoAssetInventory(
  limit = 160,
): Promise<WallTextAssetSelectionInput[]> {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 250);
  const { data, error } = await getClient()
    .from("overlay_media_assets")
    .select("*")
    .eq("asset_type", "video")
    .eq("format_family", "wall_text_overlay")
    .eq("aspect_ratio", "9:16")
    .eq("status", "active")
    .eq("analysis_status", "succeeded")
    .eq("wall_text_source_kind", "ugcpilot")
    .not("duration_seconds", "is", null)
    .gte("duration_seconds", MIN_WALL_TEXT_VIDEO_DURATION_SECONDS)
    .not("preview_url", "is", null)
    .order("usage_count", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(
      `Could not load Wall-of-text video inventory: ${error.message}`,
    );
  }

  return data.map(mapAssetForSelection);
}

export async function listActiveWallTextInstagramReelTemplates(params: {
  templateIds?: string[];
} = {}) {
  if (params.templateIds && params.templateIds.length === 0) return [];
  let query = getClient()
    .from("wall_text_instagram_reel_templates")
    .select("*")
    .eq("status", "active");
  if (params.templateIds) {
    query = query.in("id", [...new Set(params.templateIds)]);
  }
  const { data: templates, error } = await query.order("template_key", {
    ascending: true,
  });
  if (error) {
    throw new Error(`Could not load Instagram Reel Wall templates: ${error.message}`);
  }
  if (templates.length === 0) return [];

  const assets = await listWallTextOverlayAssetsByIds(
    templates.map((template) => template.overlay_media_asset_id),
  );
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return templates.map((template) => {
    const asset = assetById.get(template.overlay_media_asset_id);
    const textBox = parseNormalizedBox(template.safe_text_box);
    if (
      !asset ||
      !textBox ||
      !isCurrentWallTextFormatId(template.writer_format_id)
    ) {
      throw new Error(
        `Active Instagram Reel Wall template ${template.template_key} is invalid.`,
      );
    }
    const centerY = textBox.y + textBox.height / 2;
    const placement: WallTextPlacementZone =
      centerY < 0.46
        ? "upper-middle"
        : centerY > 0.52
          ? "lower-middle"
          : "middle";
    const layout = {
      ...createWallTextLayout(asset),
      placement,
      placementSource: "visual-group-fallback" as const,
      textBox,
    };
    return {
      asset,
      audioFitMode: template.audio_fit_mode,
      id: template.id,
      layout,
      lockedAudioAssetId: template.locked_audio_asset_id,
      referenceText: template.reference_text.replace(/\s+/gu, " ").trim(),
      referenceTextHash: template.reference_text_hash,
      templateKey: template.template_key,
      templateVersion: template.template_version,
      writerFormatId: template.writer_format_id,
    };
  });
}

export async function ensureWallTextOverlayAssetsForMediaAssets(params: {
  assets: MediaAssetRow[];
  userId: string;
}): Promise<WallTextAssetSelectionInput[]> {
  const eligibleAssets = params.assets.filter(
    (asset) =>
      asset.status === "ready" &&
      asset.mime_type.startsWith("video/") &&
      typeof asset.duration_seconds === "number" &&
      asset.duration_seconds >= MIN_WALL_TEXT_VIDEO_DURATION_SECONDS &&
      Boolean(asset.storage_key.trim()) &&
      Boolean(asset.url.trim()),
  );

  if (eligibleAssets.length === 0) {
    return [];
  }

  const rows = eligibleAssets.map((asset) => ({
    analysis_status: "succeeded",
    analyzed_at: new Date().toISOString(),
    aspect_ratio: "9:16",
    asset_type: "video",
    content_type: asset.mime_type,
    duration_seconds: asset.duration_seconds,
    file_size_bytes: asset.file_size_bytes,
    format_family: "wall_text_overlay",
    height: asset.height,
    motion_level: "low",
    owner_user_id: params.userId,
    preview_url: asset.url,
    readability_score: 1,
    recommended_position: "center",
    s3_key: asset.storage_key,
    source_batch: `creative-assets:${params.userId}`,
    source_file_sha256: createHash("sha256")
      .update(`${params.userId}:${asset.id}:${asset.storage_key}`, "utf8")
      .digest("hex"),
    source_file_name: asset.file_name,
    source_media_asset_id: asset.id,
    source_type: "owned",
    status: "active",
    text_capacity: "high",
    thumbnail_url: asset.thumbnail_url,
    usage_count: 0,
    visual_group: `creative-asset:${asset.id}`,
    wall_text_source_kind: "creative_asset" as const,
    width: asset.width,
  }));
  const { data, error } = await getClient()
    .from("overlay_media_assets")
    .upsert(rows, {
      onConflict: "owner_user_id,source_media_asset_id",
    })
    .select("*");

  if (error) {
    throw new Error(
      `Could not prepare Creative Assets videos for Wall-of-text: ${error.message}`,
    );
  }

  return data.map(mapAssetForSelection);
}

export async function listWallTextOverlayAssetsForMediaAssetIds(params: {
  mediaAssetIds: string[];
  userId: string;
}): Promise<WallTextAssetSelectionInput[]> {
  if (params.mediaAssetIds.length === 0) {
    return [];
  }

  const { data, error } = await getClient()
    .from("overlay_media_assets")
    .select("*")
    .eq("owner_user_id", params.userId)
    .in("source_media_asset_id", params.mediaAssetIds)
    .eq("status", "active")
    .eq("analysis_status", "succeeded")
    .gte("duration_seconds", MIN_WALL_TEXT_VIDEO_DURATION_SECONDS)
    .eq("wall_text_source_kind", "creative_asset");

  if (error) {
    throw new Error(
      `Could not load Creative Assets Wall-of-text videos: ${error.message}`,
    );
  }

  return data.map(mapAssetForSelection);
}

export async function createTrendingWallTextCreatives(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  candidateIndexOffset?: number;
  candidates: Array<{
    backgroundAssetId: string;
    candidateIndex: number;
    durationSeconds: number;
    layout: TrendingWallTextLayout;
    text: TrendingWallTextContent;
  }>;
  generatorModel: string;
  userId: string;
}) {
  const generationId = crypto.randomUUID();
  const candidateIndexOffset = Math.max(
    0,
    Math.trunc(params.candidateIndexOffset ?? 0),
  );
  const rows = await Promise.all(
    params.candidates.map(async (candidate) => {
      const { layout, text } = await prepareWallTextForPersistence({
        layout: candidate.layout,
        text: candidate.text,
      });
      return {
        business_profile_id: params.businessProfileId,
        business_profile_version: params.businessProfileVersion,
        candidate_index: candidateIndexOffset + candidate.candidateIndex,
        duration_seconds: candidate.durationSeconds,
        generation_id: generationId,
        generator_model: params.generatorModel,
        generator_version: WALL_TEXT_GENERATOR_VERSION,
        id: crypto.randomUUID(),
        layout: toJson(layout),
        overlay_media_asset_id: candidate.backgroundAssetId,
        status: "preview_ready" as const,
        text_content: toJson(text),
        user_id: params.userId,
      };
    }),
  );
  const { error } = await getClient()
    .from("wall_text_creatives")
    .upsert(rows, {
      ignoreDuplicates: true,
      onConflict:
        "user_id,business_profile_id,business_profile_version,candidate_index",
    });

  if (error) {
    throw new Error(
      `Could not save Trending Wall-of-text ideas: ${error.message}`,
    );
  }

  return listTrendingWallTextCreatives({
    backgroundAssetIds: [
      ...new Set(
        params.candidates.map((candidate) => candidate.backgroundAssetId),
      ),
    ],
    businessProfileId: params.businessProfileId,
    businessProfileVersion: params.businessProfileVersion,
    userId: params.userId,
  });
}

export async function reserveWallTextGenerationBatch(params: {
  assignments: Array<{
    assignment: WallTextPersistedFormatAssignment;
    focus?: Json;
    durationSeconds: number;
    instagramReelTemplateId?: string;
    instagramReelTemplateVersion?: number;
    instagramReferenceText?: string;
    instagramReferenceTextHash?: string;
    instagramLockedAudioAssetId?: string;
    instagramAudioFitMode?: "exact" | "trim";
    layout: TrendingWallTextLayout;
    maxWords: number;
    overlayMediaAssetId: string;
    sourceKind: "creative_asset" | "instagram_reel" | "ugcpilot";
    targetWords: number;
  }>;
  businessProfileId: string;
  businessProfileVersion: number;
  formatLibraryVersion: string;
  generatorVersion: string;
  promptVersion: string;
  requestHash: string;
  requestKey: string;
  selectorVersion: string;
  userId: string;
}) {
  const { data: batches, error: batchError } = await getClient().rpc(
    "reserve_wall_text_generation_batch_v1",
    {
      p_assignments: toJson(
        params.assignments.map((entry) => ({
          assignedFormatId: entry.assignment.assignedFormatId,
          durationSeconds: entry.durationSeconds,
          focus: entry.focus ?? {},
          instagramReelTemplateId: entry.instagramReelTemplateId ?? null,
          instagramReelTemplateVersion:
            entry.instagramReelTemplateVersion ?? null,
          instagramReferenceText: entry.instagramReferenceText ?? null,
          instagramReferenceTextHash:
            entry.instagramReferenceTextHash ?? null,
          instagramLockedAudioAssetId:
            entry.instagramLockedAudioAssetId ?? null,
          instagramAudioFitMode: entry.instagramAudioFitMode ?? null,
          layout: entry.layout,
          maxWords: entry.maxWords,
          overlayMediaAssetId: entry.overlayMediaAssetId,
          selectionMode: entry.assignment.selectionMode,
          selectionWeight: entry.assignment.selectionWeight,
          sourceKind: entry.sourceKind,
          targetWords: entry.targetWords,
        })),
      ),
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_format_library_version: params.formatLibraryVersion,
      p_generator_version: params.generatorVersion,
      p_prompt_version: params.promptVersion,
      p_request_hash: params.requestHash,
      p_request_key: params.requestKey,
      p_selector_version: params.selectorVersion,
      p_user_id: params.userId,
    },
  );
  if (batchError) {
    throw new Error(`Could not reserve Wall-of-text generation: ${batchError.message}`);
  }
  const batch = batches?.[0];
  if (!batch) throw new Error("Wall-of-text generation reservation returned no batch.");

  const { data: assignments, error: assignmentError } = await getClient()
    .from("wall_text_generation_assignments")
    .select("*")
    .eq("batch_id", batch.id)
    .order("batch_candidate_index", { ascending: true });
  if (assignmentError) {
    throw new Error(
      `Could not load Wall-of-text generation assignments: ${assignmentError.message}`,
    );
  }
  if (assignments.length !== params.assignments.length) {
    throw new Error("Wall-of-text generation reservation is incomplete.");
  }
  return { assignments, batch };
}

/**
 * Freshness is evaluated over the user's complete displayed Wall library,
 * including earlier Business Profile versions. New uploads therefore win over
 * older assets after a profile refresh.
 */
export async function listUsedWallTextBackgroundAssetIds(params: {
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("wall_text_creatives")
    .select("overlay_media_asset_id")
    .eq("user_id", params.userId)
    .eq("status", "preview_ready");

  if (error) {
    throw new Error(
      `Could not load used Wall-of-text backgrounds: ${error.message}`,
    );
  }

  return new Set(data.map((creative) => creative.overlay_media_asset_id));
}

/**
 * Background selection happens before the reservation transaction. Exclude
 * work that has already been reserved by another live batch so a retry can
 * choose a different background instead of retrying a write that the
 * profile/asset uniqueness constraint must reject.
 */
export async function listReservedWallTextBackgroundAssetIds(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  const { data: batches, error: batchError } = await getClient()
    .from("wall_text_generation_batches")
    .select("id")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .in("status", ["pending", "processing"]);
  if (batchError) {
    throw new Error(
      `Could not load reserved Wall-of-text backgrounds: ${batchError.message}`,
    );
  }

  const batchIds = batches.map((batch) => batch.id);
  if (batchIds.length === 0) return new Set<string>();

  const { data: assignments, error: assignmentError } = await getClient()
    .from("wall_text_generation_assignments")
    .select("overlay_media_asset_id")
    .in("batch_id", batchIds)
    .in("status", ["pending", "processing", "retry_pending"]);
  if (assignmentError) {
    throw new Error(
      `Could not load reserved Wall-of-text assignments: ${assignmentError.message}`,
    );
  }

  return new Set(assignments.map((assignment) => assignment.overlay_media_asset_id));
}

export async function getWallTextGenerationReservation(params: {
  requestKey: string;
  userId: string;
}) {
  const { data: batch, error } = await getClient()
    .from("wall_text_generation_batches")
    .select("*")
    .eq("user_id", params.userId)
    .eq("request_key", params.requestKey)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not resume Wall-of-text generation: ${error.message}`);
  }
  if (!batch) return null;
  const { data: assignments, error: assignmentError } = await getClient()
    .from("wall_text_generation_assignments")
    .select("*")
    .eq("batch_id", batch.id)
    .order("batch_candidate_index", { ascending: true });
  if (assignmentError) {
    throw new Error(`Could not resume Wall-of-text assignments: ${assignmentError.message}`);
  }
  return { assignments, batch };
}

export async function getWallTextPrivateCreativeContexts(params: {
  assignments: readonly Pick<
    WallTextGenerationAssignmentRow,
    | "id"
    | "wall_text_content_plan_id"
    | "wall_text_content_plan_item_id"
  >[];
  userId: string;
}) {
  const plannedAssignments = params.assignments.filter(
    (assignment) =>
      Boolean(assignment.wall_text_content_plan_id) &&
      Boolean(assignment.wall_text_content_plan_item_id),
  );
  if (plannedAssignments.length === 0) {
    return new Map<string, WallTextPrivateCreativeContext>();
  }

  if (
    plannedAssignments.some(
      (assignment) =>
        !assignment.wall_text_content_plan_id ||
        !assignment.wall_text_content_plan_item_id,
    )
  ) {
    throw new Error("Wall-of-Text planned context linkage is incomplete.");
  }

  const itemIds = plannedAssignments.map(
    (assignment) => assignment.wall_text_content_plan_item_id!,
  );
  const { data: items, error: itemError } = await getClient()
    .from("wall_text_content_plan_items")
    .select("*")
    .eq("user_id", params.userId)
    .in("id", itemIds);
  if (itemError) {
    throw new Error(`Could not load Wall-of-Text planned ideas: ${itemError.message}`);
  }

  const itemById = new Map((items ?? []).map((item) => [item.id, item]));
  if (
    plannedAssignments.some((assignment) => {
      const item = itemById.get(assignment.wall_text_content_plan_item_id!);
      return (
        !item ||
        item.plan_id !== assignment.wall_text_content_plan_id ||
        item.status !== "reserved"
      );
    })
  ) {
    throw new Error("Wall-of-Text planned idea is unavailable or stale.");
  }

  const itemPrivateContexts = new Map(
    (items ?? []).map((item) => [
      item.id,
      parseWallTextItemPrivateContext(item.private_context),
    ]),
  );
  if (
    (items ?? []).some(
      (item) =>
        item.private_context !== null && !itemPrivateContexts.get(item.id),
    )
  ) {
    throw new Error("Wall-of-Text planned idea has invalid private writing context.");
  }

  const briefIds = [
    ...new Set(
      (items ?? [])
        .filter((item) => !itemPrivateContexts.get(item.id))
        .map((item) => item.creative_brief_id),
    ),
  ];
  if (briefIds.length === 0) {
    const contexts = new Map<string, WallTextPrivateCreativeContext>();
    for (const assignment of plannedAssignments) {
      const item = itemById.get(assignment.wall_text_content_plan_item_id!)!;
      const planningBrief = itemPrivateContexts.get(item.id);
      if (!planningBrief) {
        throw new Error("Wall-of-Text planned idea is missing its private brief.");
      }
      contexts.set(assignment.id, {
        contentIdea: item.content_idea,
        feeling: item.feeling,
        planningBrief,
      });
    }
    return contexts;
  }
  const { data: briefs, error: briefError } = await getClient()
    .from("wall_text_content_plan_briefs")
    .select("*")
    .eq("user_id", params.userId)
    .in("id", briefIds);
  if (briefError) {
    throw new Error(`Could not load Wall-of-Text private briefs: ${briefError.message}`);
  }

  const briefById = new Map((briefs ?? []).map((brief) => [brief.id, brief]));
  const contexts = new Map<string, WallTextPrivateCreativeContext>();
  for (const assignment of plannedAssignments) {
    const item = itemById.get(assignment.wall_text_content_plan_item_id!)!;
    const itemPlanningBrief = itemPrivateContexts.get(item.id);
    if (itemPlanningBrief) {
      contexts.set(assignment.id, {
        contentIdea: item.content_idea,
        feeling: item.feeling,
        planningBrief: itemPlanningBrief,
      });
      continue;
    }
    const brief = briefById.get(item.creative_brief_id);
    if (!brief || brief.plan_id !== item.plan_id) {
      throw new Error("Wall-of-Text planned idea is missing its private brief.");
    }
    contexts.set(assignment.id, {
      contentIdea: item.content_idea,
      feeling: item.feeling,
      planningBrief: {
        audienceContext: brief.audience_context,
        creativeSeed: brief.creative_seed,
        emotionalTension: brief.emotional_tension,
        humanMoment: brief.human_moment,
        supportedAngle: brief.supported_angle,
      },
    });
  }

  return contexts;
}

export async function claimWallTextGenerationChunk(params: {
  chunkId: string;
  userId: string;
}) {
  const { data, error } = await getClient().rpc(
    "claim_wall_text_generation_chunk_v1",
    { p_chunk_id: params.chunkId, p_user_id: params.userId },
  );
  if (error) {
    throw new Error(`Could not claim Wall-of-text generation chunk: ${error.message}`);
  }
  return data;
}

export async function recordWallTextGenerationChunkFailure(params: {
  claimToken: string;
  chunkId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  userId: string;
}) {
  const { error } = await getClient().rpc(
    "record_wall_text_generation_chunk_failure_v1",
    {
      p_chunk_id: params.chunkId,
      p_claim_token: params.claimToken,
      p_error_code: params.errorCode.slice(0, 120),
      p_error_message: params.errorMessage.slice(0, 1_000),
      p_retryable: params.retryable,
      p_user_id: params.userId,
    },
  );
  if (error) {
    throw new Error(`Could not record Wall-of-text chunk failure: ${error.message}`);
  }
}

export async function listWallTextOverlayAssetsByIds(assetIds: string[]) {
  if (assetIds.length === 0) return [];
  const { data, error } = await getClient()
    .from("overlay_media_assets")
    .select("*")
    .in("id", [...new Set(assetIds)])
    .eq("asset_type", "video")
    .eq("format_family", "wall_text_overlay")
    .eq("status", "active")
    .eq("analysis_status", "succeeded")
    .gte("duration_seconds", MIN_WALL_TEXT_VIDEO_DURATION_SECONDS);
  if (error) {
    throw new Error(`Could not resume Wall-of-text backgrounds: ${error.message}`);
  }
  return data.map(mapAssetForSelection);
}

export async function listWallTextDuplicateSignatures(params: {
  businessProfileId: string;
  limit?: number;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("wall_text_content_history")
    .select("content_hash, normalized_text, similarity_signature")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(params.limit ?? 120, 1), 500));
  if (error) {
    console.warn(
      "Wall-of-text duplicate history is unavailable; continuing with batch-only checks:",
      error,
    );
    return [];
  }
  return data.flatMap((row) => {
    if (!isJsonObject(row.similarity_signature)) return [];
    const signature = row.similarity_signature;
    if (
      typeof signature.opening !== "string" ||
      !Array.isArray(signature.shingles) ||
      signature.shingles.some((value) => typeof value !== "string")
    ) {
      return [];
    }
    return [{
      contentHash: row.content_hash,
      normalizedText: row.normalized_text,
      opening: signature.opening,
      shingles: signature.shingles as string[],
      version: "wall-text-duplicate-signature-v1" as const,
    } satisfies WallTextDuplicateSignature];
  });
}

export async function getWallTextPerformanceSignals(params: {
  businessProfileId: string;
  userId: string;
}): Promise<WallTextPerformanceSignals> {
  const { data, error } = await getClient().rpc(
    "get_wall_text_format_performance_v1",
    {
      p_business_profile_id: params.businessProfileId,
      p_user_id: params.userId,
    },
  );
  if (error) {
    console.warn(
      "Wall-of-text performance is unavailable; using controlled rotation:",
      error,
    );
    return { formats: [], version: "wall-text-views-v1-72h-median" };
  }
  return deriveWallTextPerformanceSignals(
    (data ?? []).map((row) => ({
      formatId: row.format_id,
      lastGeneratedAt: row.last_generated_at,
      publishedResultCount: Number(row.published_result_count),
      recentViewCounts: row.recent_view_counts.map(Number),
      timesGenerated: Number(row.times_generated),
    })),
  );
}

export async function saveWallTextGenerationCandidate(params: {
  assignmentId: string;
  claimToken: string;
  contentHash: string;
  creativeId: string;
  generatorModel: string;
  layout: TrendingWallTextLayout;
  normalizedText: string;
  similaritySignature: WallTextDuplicateSignature;
  text: TrendingWallTextContent;
  userId: string;
}) {
  // This is the final persistence boundary. Rebuild the line breaks from the
  // complete copy here as well as validating it. That means a caller cannot
  // accidentally save stale or edge-touching lines by skipping an earlier
  // layout step.
  const { layout: persistedLayout, text: renderSafeText } =
    await prepareWallTextForPersistence({
      layout: params.layout,
      text: params.text,
    });
  const { data, error } = await getClient().rpc(
    "save_wall_text_generation_candidate_v1",
    {
      p_assignment_id: params.assignmentId,
      p_claim_token: params.claimToken,
      p_content_hash: params.contentHash,
      p_creative_id: params.creativeId,
      p_generator_model: params.generatorModel,
      p_layout: toJson(persistedLayout),
      p_normalized_text: params.normalizedText,
      p_similarity_signature: toJson(params.similaritySignature),
      p_text_content: toJson(renderSafeText),
      p_user_id: params.userId,
    },
  );
  if (error) {
    throw Object.assign(
      new Error(
        `Could not save Wall-of-text generation candidate: ${error.message}`,
      ),
      { code: error.code },
    );
  }
  const creative = data?.[0];
  if (!creative) throw new Error("Wall-of-text candidate storage returned no row.");
  return creative;
}

export async function getWallTextGenerationAttribution(params: {
  creativeId: string;
  userId: string;
}) {
  const { data: assignment, error } = await getClient()
    .from("wall_text_generation_assignments")
    .select("*")
    .eq("wall_text_creative_id", params.creativeId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load Wall-of-text attribution: ${error.message}`);
  }
  if (!assignment) return null;
  const { data: batch, error: batchError } = await getClient()
    .from("wall_text_generation_batches")
    .select("*")
    .eq("id", assignment.batch_id)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (batchError) {
    throw new Error(`Could not load Wall-of-text attribution batch: ${batchError.message}`);
  }
  if (!batch) return null;
  return {
    formatId: assignment.assigned_format_id,
    formatLearningEligible:
      assignment.assigned_format_id !== null &&
      assignment.source_kind !== "instagram_reel",
    formatVersion: assignment.format_version,
    instagramReelTemplateId: assignment.instagram_reel_template_id,
    lockedAudioAssetId: assignment.instagram_locked_audio_asset_id,
    selectionMode: assignment.selection_mode,
    selectionWeight: Number(assignment.selection_weight_snapshot),
    selectorVersion: batch.selector_version,
    sourceKind: assignment.source_kind,
  };
}

export async function getNextWallTextCandidateIndex(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("wall_text_creatives")
    .select("candidate_index")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .order("candidate_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not allocate Wall-of-text idea positions: ${error.message}`,
    );
  }

  return (data?.candidate_index ?? -1) + 1;
}

export function areTrendingWallTextCreativesCurrent(
  creatives: readonly WallTextCreativeRow[],
) {
  return (
    creatives.length > 0 &&
    creatives.every(isTrendingWallTextCreativeCurrent)
  );
}

export function isTrendingWallTextCreativeCurrent(
  creative: WallTextCreativeRow,
) {
  const content = parseWallTextContent(creative.text_content);
  return (
    creative.generator_version === WALL_TEXT_GENERATOR_VERSION &&
    content?.renderSafetyVersion === WALL_TEXT_RENDER_SAFETY_VERSION &&
    content?.finalLayout?.version === WALL_TEXT_FINAL_LAYOUT_VERSION &&
    content.finalLayout !== undefined &&
    parseWallTextLayout(creative.layout) !== null
  );
}

export async function replaceTrendingWallTextCreativeCopy(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  creatives: Array<{
    candidateIndex: number;
    id: string;
    layout: TrendingWallTextLayout;
    text: TrendingWallTextContent;
  }>;
  generatorModel: string;
  recoveryIteration?: number | null;
  recoveryKey?: string | null;
  requestKey?: string | null;
  userId: string;
}) {
  const MAX_WALL_TEXT_REPLACEMENT_BATCH_SIZE = 50;
  const updates = await Promise.all(
    params.creatives.map(async (creative) => {
      const { layout, text } = await prepareWallTextForPersistence({
        layout: creative.layout,
        text: creative.text,
      });
      return {
        candidate_index: creative.candidateIndex,
        id: creative.id,
        layout,
        text_content: text,
      };
    }),
  );

  // The database validates replacement batches at fifty rows. Historical
  // accounts can have more stale creatives than that, so update in bounded
  // batches rather than sending one deterministic invalid-count request.
  for (let offset = 0; offset < updates.length; offset += MAX_WALL_TEXT_REPLACEMENT_BATCH_SIZE) {
    const replacementBatch = updates.slice(
      offset,
      offset + MAX_WALL_TEXT_REPLACEMENT_BATCH_SIZE,
    );
    const { data, error } = await getClient().rpc(
      "replace_wall_text_creative_copy_v9",
      {
        p_business_profile_id: params.businessProfileId,
        p_business_profile_version: params.businessProfileVersion,
        p_generator_model: params.generatorModel,
        p_updates: toJson(replacementBatch),
        p_user_id: params.userId,
      },
    );

    if (error) {
      // Keep the bounded, non-content diagnostic together so recurring
      // recovery can be identified without logging generated Wall copy.
      const rpcData: unknown = data;
      console.error("Wall-of-text replacement RPC failed", {
        databaseCode: error.code ?? null,
        expectedCount: replacementBatch.length,
        returnedCount: Array.isArray(rpcData) ? rpcData.length : null,
        creativeIds: replacementBatch.map((update) => update.id),
        recoveryIteration: params.recoveryIteration ?? null,
        recoveryKey: params.recoveryKey ?? null,
        requestKey: params.requestKey ?? null,
      });
      throw Object.assign(
        new Error(
          `Could not refresh Trending Wall-of-text copy: ${error.message}`,
        ),
        { code: error.code },
      );
    }
  }

  return listTrendingWallTextCreatives({
    businessProfileId: params.businessProfileId,
    businessProfileVersion: params.businessProfileVersion,
    userId: params.userId,
  });
}

async function prepareWallTextForPersistence(params: {
  layout: TrendingWallTextLayout;
  text: TrendingWallTextContent;
}) {
  const authoritative = await createAuthoritativeWallTextContent({
    content: { kind: "text", text: params.text.fullText },
    formatId: params.text.formatId ?? params.text.pattern,
    layout: params.layout,
  });
  const render = await validateWallTextRenderFit(authoritative.content);

  return {
    layout: authoritative.layout,
    text: applyWallTextRenderFit(authoritative.content, render),
  };
}

export async function listTrendingWallTextCreatives(params: {
  backgroundAssetIds?: string[] | null;
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  if (params.backgroundAssetIds && params.backgroundAssetIds.length === 0) {
    return [];
  }

  let query = getClient()
    .from("wall_text_creatives")
    .select("*")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("status", "preview_ready");

  if (params.backgroundAssetIds) {
    query = query.in(
      "overlay_media_asset_id",
      params.backgroundAssetIds,
    );
  }

  const { data, error } = await query.order("candidate_index", {
    ascending: true,
  });

  if (error) {
    throw new Error(
      `Could not load Trending Wall-of-text ideas: ${error.message}`,
    );
  }

  return data;
}

export async function ensureTrendingWallTextAssignments(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  creatives: WallTextCreativeRow[];
  userId: string;
}) {
  const instagramTemplateIds = params.creatives.flatMap((creative) =>
    creative.instagram_reel_template_id
      ? [creative.instagram_reel_template_id]
      : [],
  );
  const instagramTemplates = await listActiveWallTextInstagramReelTemplates({
    templateIds: instagramTemplateIds,
  });
  const templateById = new Map(
    instagramTemplates.map((template) => [template.id, template]),
  );
  const audioCreatives = params.creatives.map((creative) => {
    const content = parseWallTextContent(creative.text_content);
    if (!content) {
      throw new Error(
        `Wall audio cannot be selected for invalid creative ${creative.id}.`,
      );
    }
    const template = creative.instagram_reel_template_id
      ? templateById.get(creative.instagram_reel_template_id)
      : null;
    if (creative.source_kind === "instagram_reel" && !template) {
      throw new Error(
        `Instagram Reel template audio is unavailable for creative ${creative.id}.`,
      );
    }
    return {
      content,
      creativeId: creative.id,
      durationSeconds: creative.duration_seconds,
      ...(template ? { lockedAudioAssetId: template.lockedAudioAssetId } : {}),
    };
  });

  await ensureBaseWallTextAudioSelections({
    creatives: audioCreatives,
    userId: params.userId,
  });

  const rows = params.creatives.map((creative) => ({
    business_profile_id: params.businessProfileId,
    business_profile_version: params.businessProfileVersion,
    id: crypto.randomUUID(),
    position: creative.candidate_index,
    state: "active" as const,
    user_id: params.userId,
    wall_text_creative_id: creative.id,
  }));

  if (rows.length > 0) {
    const { error } = await getClient()
      .from("user_wall_text_assignments")
      .upsert(rows, {
        ignoreDuplicates: true,
        onConflict: "user_id,wall_text_creative_id",
      });

    if (error) {
      throw new Error(
        `Could not assign Trending Wall-of-text ideas: ${error.message}`,
      );
    }
  }

  return listActiveTrendingWallTextIdeas(params);
}

export async function listActiveTrendingWallTextIdeas(params: {
  availableSourceMediaAssetIds?: readonly string[];
  backgroundAssetIds?: string[] | null;
  businessProfileId: string;
  businessProfileVersion: number;
  pinnedAssignmentIds?: readonly string[];
  userId: string;
}): Promise<TrendingWallTextIdeaRecord[]> {
  const pinnedAssignmentIds = new Set(params.pinnedAssignmentIds ?? []);
  const availableSourceMediaAssetIds = params.availableSourceMediaAssetIds
    ? new Set(params.availableSourceMediaAssetIds)
    : null;

  if (
    params.backgroundAssetIds &&
    params.backgroundAssetIds.length === 0 &&
    pinnedAssignmentIds.size === 0
  ) {
    return [];
  }

  const { data: assignments, error: assignmentError } = await getClient()
    .from("user_wall_text_assignments")
    .select("*")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("state", "active")
    .order("position", { ascending: true });

  if (assignmentError) {
    throw new Error(
      `Could not load Trending Wall-of-text assignments: ${assignmentError.message}`,
    );
  }

  if (assignments.length === 0) {
    return [];
  }

  const creativeIds = assignments.map(
    (assignment) => assignment.wall_text_creative_id,
  );
  let creativeQuery = getClient()
    .from("wall_text_creatives")
    .select("*")
    .in("id", creativeIds)
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("status", "preview_ready");

  // A daily slot may keep its current background source, but it must never
  // keep an older text-layout version. Otherwise a V8 assignment can stay
  // pinned forever and bypass the V9 measured reflow.
  creativeQuery = creativeQuery.eq(
    "generator_version",
    WALL_TEXT_GENERATOR_VERSION,
  );

  if (params.backgroundAssetIds && pinnedAssignmentIds.size === 0) {
    creativeQuery = creativeQuery.in(
      "overlay_media_asset_id",
      params.backgroundAssetIds,
    );
  }

  const { data: creatives, error: creativeError } = await creativeQuery;

  if (creativeError) {
    throw new Error(
      `Could not load assigned Wall-of-text ideas: ${creativeError.message}`,
    );
  }

  const assetIds = [
    ...new Set(creatives.map((creative) => creative.overlay_media_asset_id)),
  ];
  const [assetResult, audioByCreativeId] = await Promise.all([
    getClient()
      .from("overlay_media_assets")
      .select("*")
      .in("id", assetIds)
      .eq("asset_type", "video")
      .eq("format_family", "wall_text_overlay")
      .eq("aspect_ratio", "9:16")
      .eq("status", "active")
      .eq("analysis_status", "succeeded"),
    listBaseWallTextAudioSelections({
      creativeIds,
      userId: params.userId,
    }),
  ]);
  const { data: assets, error: assetError } = assetResult;

  if (assetError) {
    throw new Error(
      `Could not load assigned Wall-of-text backgrounds: ${assetError.message}`,
    );
  }

  const creativeById = new Map(
    creatives.map((creative) => [creative.id, creative]),
  );
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return assignments.flatMap((assignment) => {
    const creative = creativeById.get(assignment.wall_text_creative_id);
    const asset = creative
      ? assetById.get(creative.overlay_media_asset_id)
      : undefined;
    const audio = creative ? audioByCreativeId.get(creative.id) : undefined;

    const selectionAsset = asset ? mapAssetForSelection(asset) : null;

    if (
      !creative ||
      !asset ||
      !audio ||
      !asset.preview_url ||
      !selectionAsset ||
      !isEligibleWallTextVideo(selectionAsset) ||
      (availableSourceMediaAssetIds &&
        asset.source_media_asset_id &&
        !availableSourceMediaAssetIds.has(asset.source_media_asset_id)) ||
      (!pinnedAssignmentIds.has(assignment.id) &&
        (creative.generator_version !== WALL_TEXT_GENERATOR_VERSION ||
          (params.backgroundAssetIds != null &&
            !params.backgroundAssetIds.includes(
              creative.overlay_media_asset_id,
            ))))
    ) {
      return [];
    }

    const text = parseWallTextContent(creative.text_content);
    const layout = parseWallTextLayout(creative.layout);

    if (
      !text ||
      text.renderSafetyVersion !== WALL_TEXT_RENDER_SAFETY_VERSION ||
      !layout
    ) {
      return [];
    }

    return [
      {
        assignmentId: assignment.id,
        audio,
        backgroundAssetId: asset.id,
        candidateIndex: creative.candidate_index,
        createdAt: creative.created_at,
        durationSeconds: creative.duration_seconds,
        id: creative.id,
        layout,
        position: assignment.position,
        previewUrl: asset.preview_url,
        text,
        thumbnailUrl: asset.thumbnail_url,
      },
    ];
  });
}

export async function listSavedWallTextDrafts(params: {
  userId: string;
}): Promise<SavedWallTextDraft[]> {
  const { data: assignments, error } = await getClient()
    .from("user_wall_text_assignments")
    .select("*")
    .eq("user_id", params.userId)
    .eq("state", "selected")
    .not("library_saved_at", "is", null)
    .order("library_saved_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load saved Wall-of-text videos: ${error.message}`);
  }

  return hydrateSavedWallTextDrafts(assignments, params.userId);
}

export async function getSavedWallTextDraft(params: {
  assignmentId: string;
  userId: string;
}): Promise<SavedWallTextDraft | null> {
  const { data: assignment, error } = await getClient()
    .from("user_wall_text_assignments")
    .select("*")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("state", "selected")
    .not("library_saved_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load this Wall-of-text video: ${error.message}`);
  }

  if (!assignment) {
    return null;
  }

  return (await hydrateSavedWallTextDrafts([assignment], params.userId))[0] ?? null;
}

/**
 * Loads a reviewed Wall-of-text assignment for internal rendering or
 * scheduling. Selection removes it from the daily feed; it does not mean the
 * user saved it to Creative Assets.
 */
export async function getSelectedWallTextDraft(params: {
  assignmentId: string;
  userId: string;
}): Promise<SavedWallTextDraft | null> {
  const { data: assignment, error } = await getClient()
    .from("user_wall_text_assignments")
    .select("*")
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("state", "selected")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load selected Wall-of-text video: ${error.message}`);
  }

  if (!assignment) {
    return null;
  }

  return (await hydrateSavedWallTextDrafts([assignment], params.userId))[0] ?? null;
}

export async function markWallTextDraftSaved(params: {
  assignmentId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("user_wall_text_assignments")
    .update({
      library_saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("state", "selected")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not save Wall-of-text video to Creative Assets: ${error.message}`);
  }

  if (!data) {
    throw new Error("This Wall-of-text video is no longer available to save.");
  }
}

export async function getEditableWallTextDraft(params: {
  assignmentId: string;
  creativeId: string;
  userId: string;
}): Promise<SavedWallTextDraft | null> {
  const { data: assignment, error } = await getClient()
    .from("user_wall_text_assignments")
    .select("*")
    .eq("id", params.assignmentId)
    .eq("wall_text_creative_id", params.creativeId)
    .eq("user_id", params.userId)
    .in("state", ["active", "selected"])
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load this Wall-of-text edit: ${error.message}`);
  }

  if (!assignment) {
    return null;
  }

  return (await hydrateSavedWallTextDrafts([assignment], params.userId))[0] ?? null;
}

export async function claimWallTextRender(params: {
  assignmentId: string;
  editId?: string | null;
  editRevision?: number | null;
  userId: string;
}) {
  const { data, error } = await getClient().rpc("claim_wall_text_render", {
    p_assignment_id: params.assignmentId,
    p_edit_id: params.editId ?? null,
    p_edit_revision: params.editRevision ?? null,
    p_user_id: params.userId,
  });

  if (error) {
    throw new Error(`Could not save this Wall-of-text video: ${error.message}`);
  }

  const assignment = data?.[0] ?? null;

  if (!assignment) {
    throw new Error("This Wall-of-text idea is no longer available.");
  }

  return assignment;
}

export async function attachWallTextRenderJob(params: {
  assignmentId: string;
  jobId: string;
  renderId: string;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("user_wall_text_assignments")
    .update({
      render_job_id: params.jobId,
      render_status: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("render_id", params.renderId)
    .in("render_status", ["queued", "rendering"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not attach the Wall-of-text render job: ${error.message}`);
  }

  return data;
}

export async function markWallTextRenderQueueFailed(params: {
  assignmentId: string;
  errorMessage: string;
  renderId: string;
  userId: string;
}) {
  const { error } = await getClient()
    .from("user_wall_text_assignments")
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
    throw new Error(`Could not record the Wall-of-text render failure: ${error.message}`);
  }
}

export async function updateTrendingWallTextAssignment(params: {
  action: "restored" | "selected" | "skipped";
  assignmentId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const previousState =
    params.action === "restored" ? "completed_skipped" : "active";
  const values =
    params.action === "restored"
      ? {
          completed_at: null,
          state: "active" as const,
          updated_at: now,
        }
      : params.action === "skipped"
      ? {
          completed_at: now,
          state: "completed_skipped" as const,
          updated_at: now,
        }
      : {
          completed_at: now,
          last_opened_at: now,
          state: "selected" as const,
          updated_at: now,
        };
  const { data, error } = await getClient()
    .from("user_wall_text_assignments")
    .update(values)
    .eq("id", params.assignmentId)
    .eq("user_id", params.userId)
    .eq("state", previousState)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not update Trending Wall-of-text idea: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      params.action === "restored"
        ? "This Wall-of-text idea can no longer be restored."
        : "This Trending Wall-of-text idea is no longer active.",
    );
  }

  return data;
}

async function hydrateSavedWallTextDrafts(
  assignments: UserWallTextAssignmentRow[],
  userId: string,
): Promise<SavedWallTextDraft[]> {
  if (assignments.length === 0) {
    return [];
  }

  const creativeIds = assignments.map(
    (assignment) => assignment.wall_text_creative_id,
  );
  const { data: creatives, error: creativeError } = await getClient()
    .from("wall_text_creatives")
    .select("*")
    .in("id", creativeIds)
    .eq("user_id", userId)
    .eq("status", "preview_ready");

  if (creativeError) {
    throw new Error(`Could not load saved Wall-of-text copy: ${creativeError.message}`);
  }

  if (creatives.length === 0) {
    return [];
  }

  const backgroundAssetIds = [
    ...new Set(creatives.map((creative) => creative.overlay_media_asset_id)),
  ];
  const renderedMediaAssetIds = assignments
    .map((assignment) => assignment.rendered_media_asset_id)
    .filter((id): id is string => Boolean(id));
  const [
    { data: backgrounds, error: backgroundError },
    renderedResult,
    audioByCreativeId,
  ] =
    await Promise.all([
      getClient()
        .from("overlay_media_assets")
        .select("*")
        .in("id", backgroundAssetIds),
      renderedMediaAssetIds.length > 0
        ? getClient()
            .from("media_assets")
            .select("*")
            .in("id", renderedMediaAssetIds)
        : Promise.resolve({
            data: [] as WallTextRenderedMediaAssetRow[],
            error: null,
          }),
      listBaseWallTextAudioSelections({ creativeIds, userId }),
    ]);

  if (backgroundError) {
    throw new Error(
      `Could not load saved Wall-of-text backgrounds: ${backgroundError.message}`,
    );
  }

  if (renderedResult.error) {
    throw new Error(
      `Could not load rendered Wall-of-text videos: ${renderedResult.error.message}`,
    );
  }

  const creativeById = new Map(
    creatives.map((creative) => [creative.id, creative]),
  );
  const backgroundById = new Map(
    backgrounds.map((background) => [background.id, background]),
  );
  const renderedById = new Map(
    (renderedResult.data ?? []).map((asset) => [asset.id, asset]),
  );

  return assignments.flatMap((assignment) => {
    const creative = creativeById.get(assignment.wall_text_creative_id);
    const background = creative
      ? backgroundById.get(creative.overlay_media_asset_id)
      : null;
    const text = creative ? parseWallTextContent(creative.text_content) : null;
    const layout = creative ? parseWallTextLayout(creative.layout) : null;
    const audio = creative ? audioByCreativeId.get(creative.id) : null;

    if (!creative || !background?.preview_url || !text || !layout || !audio) {
      return [];
    }

    const rendered = assignment.rendered_media_asset_id
      ? renderedById.get(assignment.rendered_media_asset_id)
      : null;

    return [
      {
        assignmentId: assignment.id,
        audio,
        backgroundAssetId: background.id,
        candidateIndex: creative.candidate_index,
        createdAt: assignment.created_at,
        durationSeconds: creative.duration_seconds,
        id: creative.id,
        layout,
        position: assignment.position,
        previewUrl: background.preview_url,
        renderError: assignment.render_error,
        renderedAt: assignment.rendered_at,
        renderedMediaAssetId: rendered?.id ?? null,
        renderedThumbnailUrl: rendered?.thumbnail_url ?? null,
        renderedVideoUrl:
          rendered?.status === "ready" ? rendered.url : null,
        renderStatus: assignment.render_status,
        text,
        thumbnailUrl: background.thumbnail_url,
        updatedAt: assignment.updated_at,
      },
    ];
  });
}

function getClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Wall-of-text storage is not configured.");
  }

  if (!client) {
    client = createClient<WallTextDatabase>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return client;
}

function mapAssetForSelection(
  asset: OverlayMediaAssetRow,
): WallTextAssetSelectionInput {
  return {
    analysisStatus: asset.analysis_status,
    aspectRatio: asset.aspect_ratio,
    assetType: asset.asset_type,
    createdAt: asset.created_at,
    durationSeconds: asset.duration_seconds,
    formatFamily: asset.format_family,
    id: asset.id,
    lastUsedAt: asset.last_used_at,
    placementAnalysis: parseWallTextPlacementAnalysis(asset.placement_analysis),
    previewUrl: asset.preview_url,
    sourceBatch: asset.source_batch,
    sourceFileSha256: asset.source_file_sha256,
    status: asset.status,
    thumbnailUrl: asset.thumbnail_url,
    usageCount: asset.usage_count,
    visualGroup: asset.visual_group,
  };
}

export function parseWallTextContent(
  value: Json,
): TrendingWallTextContent | null {
  if (
    isJsonObject(value) &&
    value.kind === "wall_text" &&
    value.layoutVersion === "wall-text-overlay-v2" &&
    typeof value.text === "string" &&
    value.text.trim()
  ) {
    return convertLegacyWallTextContent(value.text);
  }

  if (
    isJsonObject(value) &&
    value.kind === "wall_text" &&
    ["wall-text-overlay-v5", "wall-text-overlay-v6", "wall-text-overlay-v7", "wall-text-overlay-v8", "wall-text-overlay-v9"].includes(
      String(value.layoutVersion),
    )
  ) {
    return parseCurrentWallTextContent(value);
  }

  if (
    !isJsonObject(value) ||
    value.kind !== "wall_text" ||
    !["wall-text-overlay-v3", "wall-text-overlay-v4"].includes(
      String(value.layoutVersion),
    ) ||
    typeof value.fullText !== "string" ||
    !value.fullText.trim() ||
    !Array.isArray(value.segments) ||
    value.segments.length < 2 ||
    value.segments.length > 3
  ) {
    return null;
  }

  const segments = value.segments.flatMap((segment) => {
    if (
      !isJsonObject(segment) ||
      !["lead", "support", "closing"].includes(String(segment.role)) ||
      !Array.isArray(segment.lines) ||
      segment.lines.length < 1 ||
      segment.lines.length > 4 ||
      segment.lines.some((line) => typeof line !== "string" || !line.trim())
    ) {
      return [];
    }

    return [
      {
        lines: (segment.lines as string[]).map((line) =>
          line.replace(/\s+/gu, " ").trim(),
        ),
        role: segment.role as "lead" | "support" | "closing",
      },
    ];
  });

  if (segments.length !== value.segments.length) {
    return null;
  }

  if (
    value.layoutVersion === "wall-text-overlay-v4" &&
    !WALL_TEXT_PATTERNS.includes(
      value.pattern as (typeof WALL_TEXT_PATTERNS)[number],
    )
  ) {
    return null;
  }

  const pattern =
    value.layoutVersion === "wall-text-overlay-v4"
      ? (value.pattern as (typeof WALL_TEXT_PATTERNS)[number])
      : "problem_change_result";

  return {
    fullText: value.fullText.replace(/\s+/gu, " ").trim(),
    kind: "wall_text",
    layoutVersion: "wall-text-overlay-v4",
    pattern,
    ...([44, 46, 48, 52].includes(Number(value.renderFontSize))
      ? {
          renderFontSize: Number(value.renderFontSize) as 44 | 46 | 48 | 52,
        }
      : {}),
    segments,
  };
}

function parseCurrentWallTextContent(
  value: { [key: string]: Json | undefined },
): TrendingWallTextContent | null {
  if (
    typeof value.fullText !== "string" ||
    !value.fullText.trim() ||
    !WALL_TEXT_PATTERNS.includes(
      value.formatId as (typeof WALL_TEXT_PATTERNS)[number],
    ) ||
    !isJsonObject(value.sourceContent) ||
    !isJsonObject(value.finalLayout)
  ) {
    return null;
  }

  const sourceContent = value.sourceContent;
  const parsedSource =
    sourceContent.kind === "text" &&
    typeof sourceContent.text === "string" &&
    sourceContent.text.trim()
      ? ({ kind: "text", text: sourceContent.text.replace(/\s+/gu, " ").trim() } as const)
      : sourceContent.kind === "prose" &&
    typeof sourceContent.text === "string" &&
    sourceContent.text.trim()
      ? ({ kind: "prose", text: sourceContent.text.replace(/\s+/gu, " ").trim() } as const)
      : sourceContent.kind === "list" &&
          typeof sourceContent.title === "string" &&
          sourceContent.title.trim() &&
          Array.isArray(sourceContent.items) &&
          sourceContent.items.length >= 3 &&
          sourceContent.items.length <= 5 &&
          sourceContent.items.every(
            (item) => typeof item === "string" && item.trim(),
          )
        ? ({
            items: (sourceContent.items as string[]).map((item) =>
              item.replace(/\s+/gu, " ").trim(),
            ),
            kind: "list",
            title: sourceContent.title.replace(/\s+/gu, " ").trim(),
          } as const)
        : null;
  const finalLayout = value.finalLayout;
  const textBox = parseNormalizedBox(finalLayout.textBox);
  const isAvenirNextV9 = value.layoutVersion === "wall-text-overlay-v9";
  const isArialRegularV8 = value.layoutVersion === "wall-text-overlay-v8";
  const isArialV7 = value.layoutVersion === "wall-text-overlay-v7";
  const isPlainTextLayout =
    value.layoutVersion === "wall-text-overlay-v6" ||
    isArialV7 ||
    isArialRegularV8 ||
    isAvenirNextV9;

  if (
    !parsedSource ||
    finalLayout.version !==
      (isAvenirNextV9
        ? "wall-text-final-layout-v5"
        : isArialRegularV8
        ? "wall-text-final-layout-v4"
        : isArialV7
          ? "wall-text-final-layout-v3"
          : isPlainTextLayout
            ? "wall-text-final-layout-v2"
            : "wall-text-final-layout-v1") ||
    (isAvenirNextV9
      ? finalLayout.fontFamily !== "Avenir Next" ||
        Number(finalLayout.fontWeight) !== WALL_TEXT_FONT_WEIGHT
      : isArialRegularV8
      ? finalLayout.fontFamily !== "Arial" ||
        Number(finalLayout.fontWeight) !== WALL_TEXT_ARIAL_REGULAR_FONT_WEIGHT
      : isArialV7
        ? finalLayout.fontFamily !== "Arial" ||
          Number(finalLayout.fontWeight) !== LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT
        : finalLayout.fontFamily !== "Inter" ||
          ![400, 600, LEGACY_WALL_TEXT_FONT_WEIGHT].includes(
            Number(finalLayout.fontWeight),
          )) ||
    ![36, 38, 40, 42, 44, 46, 48, 50, 52].includes(Number(finalLayout.fontSizePx)) ||
    typeof finalLayout.lineHeightPx !== "number" ||
    finalLayout.lineHeightPx <= 0 ||
    !textBox ||
    !Array.isArray(finalLayout.blocks) ||
    finalLayout.blocks.length < 1 ||
    finalLayout.blocks.length > (isPlainTextLayout ? 1 : 6)
  ) {
    return null;
  }

  const blocks = finalLayout.blocks.flatMap((entry) => {
    if (
      !isJsonObject(entry) ||
      !["prose", "text", "title", "item"].includes(String(entry.role)) ||
      !Array.isArray(entry.lines) ||
      entry.lines.length < 1 ||
      entry.lines.some((line) => typeof line !== "string" || !line.trim())
    ) {
      return [];
    }
    return [{
      lines: (entry.lines as string[]).map((line) =>
        line.replace(/\s+/gu, " ").trim(),
      ),
      role: entry.role as "prose" | "text" | "title" | "item",
    }];
  });

  const lines = blocks.flatMap((block) => block.lines);
  const normalizedFullText = value.fullText.replace(/\s+/gu, " ").trim();
  const finalLayoutText = lines.join(" ");
  if (
    blocks.length !== finalLayout.blocks.length ||
    (isPlainTextLayout &&
      (blocks.length !== 1 ||
        blocks[0]?.role !== "text" ||
        // Four-line V2 records remain readable so selected historical drafts
        // still open. New V9 writes are restricted to 5–8 lines by the
        // generator and database constraint.
        lines.length < 4 ||
        lines.length > 8 ||
        parsedSource.kind !== "text" ||
        parsedSource.text !== normalizedFullText ||
        finalLayoutText !== normalizedFullText))
  ) {
    return null;
  }

  const segments = toCompatibilitySegments(lines);
  const formatId = value.formatId as (typeof WALL_TEXT_PATTERNS)[number];

  const fontSizePx = normalizeCurrentWallTextFontSize(Number(finalLayout.fontSizePx));
  const parsedFinalLayout = isAvenirNextV9
    ? {
        blocks,
        fontFamily: "Avenir Next" as const,
        fontSizePx,
        fontWeight: WALL_TEXT_FONT_WEIGHT as 600,
        lineHeightPx: fontSizePx * 1.1,
        textBox,
        version: "wall-text-final-layout-v5" as const,
      }
    : isArialRegularV8
    ? {
        blocks,
        fontFamily: "Arial" as const,
        fontSizePx,
        fontWeight: WALL_TEXT_ARIAL_REGULAR_FONT_WEIGHT as 400,
        lineHeightPx: fontSizePx * 1.1,
        textBox,
        version: "wall-text-final-layout-v4" as const,
      }
    : isArialV7
      ? {
          blocks,
          fontFamily: "Arial" as const,
          fontSizePx,
          fontWeight: LEGACY_WALL_TEXT_ARIAL_BOLD_FONT_WEIGHT as 500,
          lineHeightPx: fontSizePx * 1.1,
          textBox,
          version: "wall-text-final-layout-v3" as const,
        }
      : {
        blocks,
        fontFamily: "Inter" as const,
        fontSizePx,
        fontWeight: 400 as const,
        lineHeightPx: fontSizePx * 1.1,
        textBox,
        version: isPlainTextLayout
          ? ("wall-text-final-layout-v2" as const)
          : ("wall-text-final-layout-v1" as const),
      };

  return {
    finalLayout: parsedFinalLayout,
    formatId,
    fullText: normalizedFullText,
    kind: "wall_text",
    layoutVersion: isAvenirNextV9
      ? "wall-text-overlay-v9"
      : isArialRegularV8
      ? "wall-text-overlay-v8"
      : isArialV7
        ? "wall-text-overlay-v7"
        : isPlainTextLayout
          ? "wall-text-overlay-v6"
          : "wall-text-overlay-v5",
    pattern: formatId,
    ...(value.renderSafetyVersion === WALL_TEXT_RENDER_SAFETY_VERSION
      ? { renderSafetyVersion: WALL_TEXT_RENDER_SAFETY_VERSION }
      : {}),
    renderFontSize: normalizeCurrentWallTextFontSize(Number(finalLayout.fontSizePx)),
    segments,
    sourceContent: parsedSource,
  };
}

function normalizeCurrentWallTextFontSize(value: number) {
  if ([36, 38, 40, 42, 44, 46, 48, 50, 52].includes(value)) {
    return value as 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 | 52;
  }
  return 52 as const;
}

function toCompatibilitySegments(lines: string[]) {
  if (lines.length <= 1) {
    return [{ lines, role: "lead" as const }];
  }
  if (lines.length === 2) {
    return [
      { lines: [lines[0]!], role: "lead" as const },
      { lines: [lines[1]!], role: "closing" as const },
    ];
  }
  const supportEnd = Math.ceil((lines.length + 1) / 2);
  return [
    { lines: [lines[0]!], role: "lead" as const },
    { lines: lines.slice(1, supportEnd), role: "support" as const },
    { lines: lines.slice(supportEnd), role: "closing" as const },
  ];
}

export function parseWallTextLayout(value: Json): TrendingWallTextLayout | null {
  if (
    isJsonObject(value) &&
    value.version === "wall-text-layout-v2" &&
    value.alignment === "left" &&
    value.placement === "full"
  ) {
    return createWallTextLayout();
  }

  if (
    isJsonObject(value) &&
    value.version === "wall-text-layout-v3" &&
    value.alignment === "left"
  ) {
    const placement = convertLegacyPlacement(String(value.placement));

    if (!placement) {
      return null;
    }

    const converted = createWallTextLayout();
    return {
      ...converted,
      placement,
      placementSource: ["face-analysis", "visual-group-fallback"].includes(
        String(value.placementSource),
      )
        ? (value.placementSource as
            | "face-analysis"
            | "visual-group-fallback")
        : "visual-group-fallback",
      textBox: getWallTextZoneBox(placement),
    };
  }

  if (
    !isJsonObject(value) ||
    value.version !== "wall-text-layout-v4" ||
    value.alignment !== "center" ||
    !WALL_TEXT_PLACEMENT_ZONES.includes(
      value.placement as WallTextPlacementZone,
    ) ||
    !["face-analysis", "visual-group-fallback"].includes(
      String(value.placementSource),
    ) ||
    !isJsonObject(value.safeArea) ||
    !isJsonObject(value.textBox)
  ) {
    return null;
  }

  const { bottom, left, right, top } = value.safeArea;
  const textBox = parseNormalizedBox(value.textBox);

  if (
    ![bottom, left, right, top].every(
      (entry) => typeof entry === "number" && entry >= 0 && entry <= 1,
    ) ||
    !textBox
  ) {
    return null;
  }

  return {
    alignment: "center",
    placement: value.placement as WallTextPlacementZone,
    placementSource: value.placementSource as
      | "face-analysis"
      | "visual-group-fallback",
    safeArea: {
      bottom: bottom as number,
      left: left as number,
      right: right as number,
      top: top as number,
    },
    textBox,
    version: "wall-text-layout-v4",
  };
}

function parseWallTextPlacementAnalysis(
  value: Json | null,
): WallTextPlacementAnalysis | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const selectedZone =
    value.version === "wall-text-placement-v1"
      ? convertLegacyPlacement(String(value.selectedZone))
      : value.version === "wall-text-placement-v2" &&
          WALL_TEXT_PLACEMENT_ZONES.includes(
            value.selectedZone as WallTextPlacementZone,
          )
        ? (value.selectedZone as WallTextPlacementZone)
        : null;

  if (
    !selectedZone ||
    typeof value.contrastScore !== "number" ||
    typeof value.faceOverlap !== "number" ||
    !Array.isArray(value.faceBoxes) ||
    !Array.isArray(value.importantRegions)
  ) {
    return null;
  }

  const faceBoxes = value.faceBoxes.map(parseNormalizedBox);
  const importantRegions = value.importantRegions.map(parseNormalizedBox);

  if (
    faceBoxes.some((box) => box === null) ||
    importantRegions.some((box) => box === null)
  ) {
    return null;
  }

  return {
    contrastScore: value.contrastScore,
    faceBoxes: faceBoxes as WallTextNormalizedBox[],
    faceOverlap: value.faceOverlap,
    importantRegions: importantRegions as WallTextNormalizedBox[],
    selectedZone,
    version: "wall-text-placement-v2",
  };
}

function parseNormalizedBox(value: Json | undefined): WallTextNormalizedBox | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const { height, width, x, y } = value;

  if (
    ![height, width, x, y].every(
      (entry) => typeof entry === "number" && entry >= 0 && entry <= 1,
    ) ||
    (x as number) + (width as number) > 1.001 ||
    (y as number) + (height as number) > 1.001
  ) {
    return null;
  }

  return {
    height: height as number,
    width: width as number,
    x: x as number,
    y: y as number,
  };
}

function convertLegacyWallTextContent(text: string): TrendingWallTextContent {
  const fullText = text.replace(/\s+/gu, " ").trim();
  const sentences =
    fullText.match(/[^.!?]+[.!?](?:["')\]]+)?/gu)?.map((sentence) =>
      sentence.trim(),
    ) ?? [fullText];
  const groups =
    sentences.length >= 3
      ? [sentences[0]!, sentences.slice(1, -1).join(" "), sentences.at(-1)!]
      : sentences.length === 2
        ? sentences
        : splitLegacyThought(fullText);
  const roles =
    groups.length === 2
      ? (["lead", "closing"] as const)
      : (["lead", "support", "closing"] as const);

  return {
    fullText,
    kind: "wall_text",
    layoutVersion: "wall-text-overlay-v4",
    pattern: "problem_change_result",
    segments: groups.map((group, index) => ({
      lines: wrapLegacyWallText(group, 38),
      role: roles[index]!,
    })),
  };
}

function convertLegacyPlacement(value: string): WallTextPlacementZone | null {
  if (value === "top-left" || value === "upper-center") {
    return "upper-middle";
  }

  if (value === "middle-left") {
    return "middle";
  }

  if (value === "lower-left") {
    return "lower-middle";
  }

  return null;
}

function splitLegacyThought(value: string) {
  const words = value.split(/\s+/u);
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function wrapLegacyWallText(value: string, maximumCharacters: number) {
  const lines: string[] = [];
  let line = "";

  for (const word of value.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length <= maximumCharacters || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function isJsonObject(
  value: Json | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseWallTextItemPrivateContext(
  value: Json | null,
): WallTextPrivateCreativeContext["planningBrief"] | null {
  const privateContext = value ?? undefined;
  if (!isJsonObject(privateContext)) return null;
  const audienceContext = getRequiredWallTextPrivateContextString(
    privateContext.audienceContext,
  );
  const creativeSeed = getRequiredWallTextPrivateContextString(
    privateContext.creativeSeed,
  );
  const emotionalTension = getRequiredWallTextPrivateContextString(
    privateContext.emotionalTension,
  );
  const humanMoment = getRequiredWallTextPrivateContextString(
    privateContext.humanMoment,
  );
  const supportedAngle = getRequiredWallTextPrivateContextString(
    privateContext.supportedAngle,
  );

  if (
    !audienceContext ||
    !creativeSeed ||
    !emotionalTension ||
    !humanMoment ||
    !supportedAngle ||
    (privateContext.conceptLane !== undefined &&
      typeof privateContext.conceptLane !== "string")
  ) {
    return null;
  }

  return {
    audienceContext,
    ...(typeof privateContext.conceptLane === "string"
      ? { conceptLane: privateContext.conceptLane }
      : {}),
    creativeSeed,
    emotionalTension,
    humanMoment,
    supportedAngle,
  };
}

function getRequiredWallTextPrivateContextString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isCurrentWallTextFormatId(
  value: string,
): value is (typeof WALL_TEXT_FORMAT_IDS)[number] {
  return (WALL_TEXT_FORMAT_IDS as readonly string[]).includes(value);
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
