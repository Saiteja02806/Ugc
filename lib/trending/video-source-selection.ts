import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { listCreativeAssetGroupItems } from "@/lib/media/creative-asset-groups";
import {
  getMediaAssetForOwner,
  listMediaAssets,
  serializeMediaAsset,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import type { MediaAsset } from "@/lib/media/types";

const TRENDING_VIDEO_SOURCE_SELECTIONS_TABLE =
  "trending_video_source_selections";

export const trendingVideoSourceFormats = [
  "hook_video",
  "wall_text",
] as const;
export const trendingVideoSelectionKinds = ["group", "asset"] as const;

export type TrendingVideoSourceFormat =
  (typeof trendingVideoSourceFormats)[number];
export type TrendingVideoSelectionKind =
  (typeof trendingVideoSelectionKinds)[number];

type TrendingVideoSourceSelectionRow = {
  created_at: string;
  format: TrendingVideoSourceFormat;
  group_id: string | null;
  id: string;
  media_asset_id: string | null;
  selection_kind: TrendingVideoSelectionKind;
  updated_at: string;
  user_id: string;
};

type TrendingVideoSourceSelectionInsert = Omit<
  TrendingVideoSourceSelectionRow,
  "created_at" | "id" | "updated_at"
> & {
  created_at?: string;
  id?: string;
  updated_at?: string;
};

type TrendingVideoSourceSelectionDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      trending_video_source_selections: {
        Insert: TrendingVideoSourceSelectionInsert;
        Relationships: [];
        Row: TrendingVideoSourceSelectionRow;
        Update: Partial<TrendingVideoSourceSelectionInsert>;
      };
    };
    Views: Record<string, never>;
  };
};

export type TrendingVideoSourceSelection = {
  createdAt: string;
  format: TrendingVideoSourceFormat;
  groupId: string | null;
  id: string;
  mediaAssetId: string | null;
  selectionKind: TrendingVideoSelectionKind;
  updatedAt: string;
};

export type ResolvedTrendingVideoSource = {
  assets: MediaAssetRow[];
  selection: TrendingVideoSourceSelection | null;
};

let supabaseServerClient:
  | SupabaseClient<TrendingVideoSourceSelectionDatabase>
  | null = null;

export function isTrendingVideoSourceFormat(
  value: unknown,
): value is TrendingVideoSourceFormat {
  return (
    typeof value === "string" &&
    trendingVideoSourceFormats.includes(value as TrendingVideoSourceFormat)
  );
}

export function isTrendingVideoSelectionKind(
  value: unknown,
): value is TrendingVideoSelectionKind {
  return (
    typeof value === "string" &&
    trendingVideoSelectionKinds.includes(
      value as TrendingVideoSelectionKind,
    )
  );
}

export function isTrendingSourceVideoAsset(
  asset: Pick<MediaAsset, "collection" | "mimeType" | "status">,
) {
  return (
    asset.status === "ready" &&
    (asset.collection === "video" || asset.collection === "influencer") &&
    asset.mimeType.startsWith("video/")
  );
}

export function isTrendingSourceVideoRow(asset: MediaAssetRow) {
  return isTrendingSourceVideoAsset({
    collection: asset.collection,
    mimeType: asset.mime_type,
    status: asset.status,
  });
}

export async function getTrendingVideoSourceSelection(input: {
  format: TrendingVideoSourceFormat;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(TRENDING_VIDEO_SOURCE_SELECTIONS_TABLE)
    .select("*")
    .eq("user_id", requireUserId(input.userId))
    .eq("format", input.format)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load Trending video source selection: ${error.message}`,
    );
  }

  return data ? serializeTrendingVideoSourceSelection(data) : null;
}

export async function saveTrendingVideoSourceSelection(input: {
  format: TrendingVideoSourceFormat;
  groupId?: string | null;
  mediaAssetId?: string | null;
  selectionKind: TrendingVideoSelectionKind;
  userId: string;
}) {
  const userId = requireUserId(input.userId);
  const groupId =
    input.selectionKind === "group" ? input.groupId?.trim() || null : null;
  const mediaAssetId =
    input.selectionKind === "asset"
      ? input.mediaAssetId?.trim() || null
      : null;

  if (
    (input.selectionKind === "group" && !groupId) ||
    (input.selectionKind === "asset" && !mediaAssetId)
  ) {
    throw new Error("Choose a group or video.");
  }

  const { data, error } = await getSupabaseServerClient()
    .from(TRENDING_VIDEO_SOURCE_SELECTIONS_TABLE)
    .upsert(
      {
        format: input.format,
        group_id: groupId,
        media_asset_id: mediaAssetId,
        selection_kind: input.selectionKind,
        user_id: userId,
      },
      { onConflict: "user_id,format" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Could not save Trending video source selection: ${error.message}`,
    );
  }

  return serializeTrendingVideoSourceSelection(data);
}

export async function clearTrendingVideoSourceSelection(input: {
  format: TrendingVideoSourceFormat;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(TRENDING_VIDEO_SOURCE_SELECTIONS_TABLE)
    .delete()
    .eq("user_id", requireUserId(input.userId))
    .eq("format", input.format)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not clear Trending video source selection: ${error.message}`,
    );
  }

  return Boolean(data);
}

export async function resolveTrendingVideoSource(input: {
  format: TrendingVideoSourceFormat;
  userId: string;
}): Promise<ResolvedTrendingVideoSource> {
  const userId = requireUserId(input.userId);
  const selection = await getTrendingVideoSourceSelection({
    format: input.format,
    userId,
  });

  if (!selection) {
    return { assets: [], selection: null };
  }

  if (selection.selectionKind === "asset" && selection.mediaAssetId) {
    const asset = await getMediaAssetForOwner({
      assetId: selection.mediaAssetId,
      userId,
    });

    return {
      assets:
        asset && isTrendingSourceVideoRow(asset) && asset.status === "ready"
          ? [asset]
          : [],
      selection,
    };
  }

  if (!selection.groupId) {
    return { assets: [], selection };
  }

  const groupResult = await listCreativeAssetGroupItems({
    groupId: selection.groupId,
    userId,
  });

  if (!groupResult || groupResult.group.mediaType !== "video") {
    return { assets: [], selection };
  }

  const selectedIds = new Set(
    groupResult.items.map((item) => item.mediaAssetId),
  );

  if (selectedIds.size === 0) {
    return { assets: [], selection };
  }

  const assets = await listMediaAssets({ userId });

  return {
    assets: assets.filter(
      (asset) =>
        selectedIds.has(asset.id) && isTrendingSourceVideoRow(asset),
    ),
    selection,
  };
}

export function serializeTrendingVideoSourceAsset(asset: MediaAssetRow) {
  return serializeMediaAsset(asset);
}

function getSupabaseServerClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Trending video source storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient =
      createClient<TrendingVideoSourceSelectionDatabase>(
        url,
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

function requireUserId(value: string) {
  const userId = value.trim();

  if (!userId) {
    throw new Error("User ID is required.");
  }

  return userId;
}

function serializeTrendingVideoSourceSelection(
  row: TrendingVideoSourceSelectionRow,
): TrendingVideoSourceSelection {
  return {
    createdAt: row.created_at,
    format: row.format,
    groupId: row.group_id,
    id: row.id,
    mediaAssetId: row.media_asset_id,
    selectionKind: row.selection_kind,
    updatedAt: row.updated_at,
  };
}
