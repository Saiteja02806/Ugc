import "server-only";

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
  WALL_TEXT_PATTERNS,
  WALL_TEXT_PLACEMENT_ZONES,
} from "@/lib/trending/wall-text-types";
import {
  createWallTextLayout,
  getWallTextZoneBox,
  isEligibleWallTextVideo,
  type WallTextAssetSelectionInput,
} from "@/lib/trending/wall-text-feed-logic";

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
  overlay_media_asset_id: string;
  status: "archived" | "failed" | "preview_ready";
  text_content: Json;
  updated_at: string;
  user_id: string;
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
      claim_wall_text_render: {
        Args: {
          p_assignment_id: string;
          p_edit_id: string | null;
          p_edit_revision: number | null;
          p_user_id: string;
        };
        Returns: UserWallTextAssignmentRow[];
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
    };
    Views: Record<string, never>;
  };
};

export type TrendingWallTextIdeaRecord = {
  assignmentId: string;
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
    .not("duration_seconds", "is", null)
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

export async function ensureWallTextOverlayAssetsForMediaAssets(params: {
  assets: MediaAssetRow[];
  userId: string;
}): Promise<WallTextAssetSelectionInput[]> {
  const eligibleAssets = params.assets.filter(
    (asset) =>
      asset.status === "ready" &&
      asset.mime_type.startsWith("video/") &&
      typeof asset.duration_seconds === "number" &&
      asset.duration_seconds > 0 &&
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
    source_file_name: asset.file_name,
    source_media_asset_id: asset.id,
    source_type: "owned",
    status: "active",
    text_capacity: "high",
    thumbnail_url: asset.thumbnail_url,
    usage_count: 0,
    visual_group: `creative-asset:${asset.id}`,
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
    .eq("analysis_status", "succeeded");

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
  const rows = params.candidates.map((candidate) => ({
    business_profile_id: params.businessProfileId,
    business_profile_version: params.businessProfileVersion,
    candidate_index: candidateIndexOffset + candidate.candidateIndex,
    duration_seconds: candidate.durationSeconds,
    generation_id: generationId,
    generator_model: params.generatorModel,
    generator_version: WALL_TEXT_GENERATOR_VERSION,
    id: crypto.randomUUID(),
    layout: toJson(candidate.layout),
    overlay_media_asset_id: candidate.backgroundAssetId,
    status: "preview_ready" as const,
    text_content: toJson(candidate.text),
    user_id: params.userId,
  }));
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
  return (
    creative.generator_version === WALL_TEXT_GENERATOR_VERSION &&
    parseWallTextContent(creative.text_content) !== null &&
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
  userId: string;
}) {
  const updates = params.creatives.map((creative) => ({
    candidate_index: creative.candidateIndex,
    id: creative.id,
    layout: creative.layout,
    text_content: creative.text,
  }));
  const { error } = await getClient().rpc(
    "replace_wall_text_creative_copy_v5",
    {
      p_business_profile_id: params.businessProfileId,
      p_business_profile_version: params.businessProfileVersion,
      p_generator_model: params.generatorModel,
      p_updates: toJson(updates),
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Could not refresh Trending Wall-of-text copy: ${error.message}`,
    );
  }

  return listTrendingWallTextCreatives({
    businessProfileId: params.businessProfileId,
    businessProfileVersion: params.businessProfileVersion,
    userId: params.userId,
  });
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
  backgroundAssetIds?: string[] | null;
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}): Promise<TrendingWallTextIdeaRecord[]> {
  if (params.backgroundAssetIds && params.backgroundAssetIds.length === 0) {
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
    .eq("status", "preview_ready")
    .eq("generator_version", WALL_TEXT_GENERATOR_VERSION);

  if (params.backgroundAssetIds) {
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
  const { data: assets, error: assetError } = await getClient()
    .from("overlay_media_assets")
    .select("*")
    .in("id", assetIds)
    .eq("asset_type", "video")
    .eq("format_family", "wall_text_overlay")
    .eq("aspect_ratio", "9:16")
    .eq("status", "active")
    .eq("analysis_status", "succeeded");

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

    const selectionAsset = asset ? mapAssetForSelection(asset) : null;

    if (
      !creative ||
      !asset ||
      !asset.preview_url ||
      !selectionAsset ||
      !isEligibleWallTextVideo(selectionAsset)
    ) {
      return [];
    }

    const text = parseWallTextContent(creative.text_content);
    const layout = parseWallTextLayout(creative.layout);

    if (!text || !layout) {
      return [];
    }

    return [
      {
        assignmentId: assignment.id,
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
    .order("updated_at", { ascending: false });

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
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load this Wall-of-text video: ${error.message}`);
  }

  if (!assignment) {
    return null;
  }

  return (await hydrateSavedWallTextDrafts([assignment], params.userId))[0] ?? null;
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
  const [{ data: backgrounds, error: backgroundError }, renderedResult] =
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

    if (!creative || !background?.preview_url || !text || !layout) {
      return [];
    }

    const rendered = assignment.rendered_media_asset_id
      ? renderedById.get(assignment.rendered_media_asset_id)
      : null;

    return [
      {
        assignmentId: assignment.id,
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

function parseWallTextContent(value: Json): TrendingWallTextContent | null {
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

function parseWallTextLayout(value: Json): TrendingWallTextLayout | null {
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

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
