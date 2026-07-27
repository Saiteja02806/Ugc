import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";
import {
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
  analysis_status: string;
  aspect_ratio: string;
  asset_type: string;
  created_at: string;
  duration_seconds: number | null;
  format_family: string;
  id: string;
  last_used_at: string | null;
  motion_level: string | null;
  preview_url: string | null;
  readability_score: number | null;
  recommended_position: string | null;
  status: string;
  text_capacity: string | null;
  thumbnail_url: string | null;
  updated_at: string;
  usage_count: number;
};

type WallTextCreativeRow = {
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

type UserWallTextAssignmentRow = {
  business_profile_id: string;
  business_profile_version: number;
  completed_at: string | null;
  created_at: string;
  id: string;
  last_opened_at: string | null;
  position: number;
  state: "active" | "completed_skipped" | "selected";
  updated_at: string;
  user_id: string;
  wall_text_creative_id: string;
};

type WallTextDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
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

  return new Set(data.map((row) => row.overlay_media_asset_id));
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
    .order("readability_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(
      `Could not load Wall-of-text video inventory: ${error.message}`,
    );
  }

  return data.map(mapAssetForSelection);
}

export async function createTrendingWallTextCreatives(params: {
  businessProfileId: string;
  businessProfileVersion: number;
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
  const rows = params.candidates.map((candidate) => ({
    business_profile_id: params.businessProfileId,
    business_profile_version: params.businessProfileVersion,
    candidate_index: candidate.candidateIndex,
    duration_seconds: candidate.durationSeconds,
    generation_id: generationId,
    generator_model: params.generatorModel,
    generator_version: "business-profile-wall-text-v1",
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
    businessProfileId: params.businessProfileId,
    businessProfileVersion: params.businessProfileVersion,
    userId: params.userId,
  });
}

export async function listTrendingWallTextCreatives(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}) {
  const { data, error } = await getClient()
    .from("wall_text_creatives")
    .select("*")
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("status", "preview_ready")
    .order("candidate_index", { ascending: true });

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
  businessProfileId: string;
  businessProfileVersion: number;
  userId: string;
}): Promise<TrendingWallTextIdeaRecord[]> {
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
  const { data: creatives, error: creativeError } = await getClient()
    .from("wall_text_creatives")
    .select("*")
    .in("id", creativeIds)
    .eq("user_id", params.userId)
    .eq("business_profile_id", params.businessProfileId)
    .eq("business_profile_version", params.businessProfileVersion)
    .eq("status", "preview_ready");

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

export async function updateTrendingWallTextAssignment(params: {
  action: "selected" | "skipped";
  assignmentId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const values =
    params.action === "skipped"
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
    .eq("state", "active")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not update Trending Wall-of-text idea: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error("This Trending Wall-of-text idea is no longer active.");
  }

  return data;
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
    motionLevel: asset.motion_level,
    previewUrl: asset.preview_url,
    readabilityScore: asset.readability_score,
    recommendedPosition: asset.recommended_position,
    status: asset.status,
    textCapacity: asset.text_capacity,
    thumbnailUrl: asset.thumbnail_url,
    usageCount: asset.usage_count,
  };
}

function parseWallTextContent(value: Json): TrendingWallTextContent | null {
  if (
    !isJsonObject(value) ||
    value.kind !== "wall_text" ||
    value.layoutVersion !== "wall-text-overlay-v1" ||
    !Array.isArray(value.blocks)
  ) {
    return null;
  }

  const blocks = value.blocks.flatMap((block) => {
    if (
      !isJsonObject(block) ||
      !["headline", "body", "closing"].includes(String(block.id)) ||
      typeof block.text !== "string" ||
      !block.text.trim()
    ) {
      return [];
    }

    return [
      {
        id: block.id as TrendingWallTextContent["blocks"][number]["id"],
        text: block.text.trim(),
      },
    ];
  });

  if (
    blocks.length !== 3 ||
    blocks[0]?.id !== "headline" ||
    blocks[1]?.id !== "body" ||
    blocks[2]?.id !== "closing"
  ) {
    return null;
  }

  return {
    blocks,
    kind: "wall_text",
    layoutVersion: "wall-text-overlay-v1",
  };
}

function parseWallTextLayout(value: Json): TrendingWallTextLayout | null {
  if (
    !isJsonObject(value) ||
    value.version !== "wall-text-layout-v1" ||
    value.alignment !== "left" ||
    !["top", "center", "bottom"].includes(String(value.placement)) ||
    !isJsonObject(value.safeArea)
  ) {
    return null;
  }

  const { bottom, left, right, top } = value.safeArea;

  if (
    ![bottom, left, right, top].every(
      (entry) => typeof entry === "number" && entry >= 0 && entry <= 1,
    )
  ) {
    return null;
  }

  return {
    alignment: "left",
    placement: value.placement as TrendingWallTextLayout["placement"],
    safeArea: {
      bottom: bottom as number,
      left: left as number,
      right: right as number,
      top: top as number,
    },
    version: "wall-text-layout-v1",
  };
}

function isJsonObject(
  value: Json | undefined,
): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJson(value: TrendingWallTextContent | TrendingWallTextLayout): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
