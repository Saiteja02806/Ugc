import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  serializeMediaAsset,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import { isMediaAssetVisibleInCreativeLibrary } from "@/lib/media/media-library-visibility";
import type { MediaAsset } from "@/lib/media/types";

const CREATIVE_ASSET_GROUPS_TABLE = "creative_asset_groups";
const CREATIVE_ASSET_GROUP_ITEMS_TABLE = "creative_asset_group_items";
const MEDIA_ASSETS_TABLE = "media_assets";
const MAX_GROUP_NAME_LENGTH = 80;

export const creativeAssetGroupMediaTypes = ["video", "image"] as const;

export type CreativeAssetGroupMediaType =
  (typeof creativeAssetGroupMediaTypes)[number];

type CreativeAssetGroupRow = {
  created_at: string;
  id: string;
  media_type: CreativeAssetGroupMediaType;
  name: string;
  updated_at: string;
  user_id: string;
};

type CreativeAssetGroupInsert = Omit<
  CreativeAssetGroupRow,
  "created_at" | "id" | "updated_at"
> & {
  created_at?: string;
  id?: string;
  updated_at?: string;
};

type CreativeAssetGroupItemRow = {
  created_at: string;
  group_id: string;
  media_asset_id: string;
  user_id: string;
};

type CreativeAssetGroupItemInsert = Omit<
  CreativeAssetGroupItemRow,
  "created_at"
> & {
  created_at?: string;
};

type CreativeAssetGroupsDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      creative_asset_group_items: {
        Insert: CreativeAssetGroupItemInsert;
        Relationships: [];
        Row: CreativeAssetGroupItemRow;
        Update: Partial<CreativeAssetGroupItemInsert>;
      };
      creative_asset_groups: {
        Insert: CreativeAssetGroupInsert;
        Relationships: [];
        Row: CreativeAssetGroupRow;
        Update: Partial<CreativeAssetGroupInsert>;
      };
      media_assets: {
        Insert: MediaAssetRow;
        Relationships: [];
        Row: MediaAssetRow;
        Update: Partial<MediaAssetRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type CreativeAssetGroup = {
  createdAt: string;
  id: string;
  mediaType: CreativeAssetGroupMediaType;
  name: string;
  updatedAt: string;
};

export type CreativeAssetGroupItem = {
  addedAt: string;
  groupId: string;
  mediaAssetId: string;
};

export type CreativeAssetGroupAsset = {
  addedAt: string;
  asset: MediaAsset;
};

let supabaseServerClient: SupabaseClient<CreativeAssetGroupsDatabase> | null =
  null;

export function isCreativeAssetGroupMediaType(
  value: unknown,
): value is CreativeAssetGroupMediaType {
  return (
    typeof value === "string" &&
    creativeAssetGroupMediaTypes.includes(
      value as CreativeAssetGroupMediaType,
    )
  );
}

export function normalizeCreativeAssetGroupName(value: string) {
  const name = value.trim();

  if (!name) {
    throw new Error("Group name is required.");
  }

  if (name.length > MAX_GROUP_NAME_LENGTH) {
    throw new Error(
      `Group name must be ${MAX_GROUP_NAME_LENGTH} characters or fewer.`,
    );
  }

  return name;
}

export async function createCreativeAssetGroup(input: {
  mediaType: CreativeAssetGroupMediaType;
  name: string;
  userId: string;
}) {
  const userId = requireUserId(input.userId);
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUPS_TABLE)
    .insert({
      media_type: input.mediaType,
      name: normalizeCreativeAssetGroupName(input.name),
      user_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create creative asset group: ${error.message}`);
  }

  return serializeCreativeAssetGroup(data);
}

export async function listCreativeAssetGroups(input: {
  mediaType: CreativeAssetGroupMediaType;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUPS_TABLE)
    .select("*")
    .eq("user_id", requireUserId(input.userId))
    .eq("media_type", input.mediaType)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list creative asset groups: ${error.message}`);
  }

  return data.map(serializeCreativeAssetGroup);
}

export async function getCreativeAssetGroupForOwner(input: {
  groupId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUPS_TABLE)
    .select("*")
    .eq("id", input.groupId)
    .eq("user_id", requireUserId(input.userId))
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load creative asset group: ${error.message}`);
  }

  return data ? serializeCreativeAssetGroup(data) : null;
}

export async function renameCreativeAssetGroup(input: {
  groupId: string;
  name: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUPS_TABLE)
    .update({
      name: normalizeCreativeAssetGroupName(input.name),
    })
    .eq("id", input.groupId)
    .eq("user_id", requireUserId(input.userId))
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not rename creative asset group: ${error.message}`);
  }

  return data ? serializeCreativeAssetGroup(data) : null;
}

export async function deleteCreativeAssetGroup(input: {
  groupId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUPS_TABLE)
    .delete()
    .eq("id", input.groupId)
    .eq("user_id", requireUserId(input.userId))
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete creative asset group: ${error.message}`);
  }

  return Boolean(data);
}

export async function addMediaAssetToGroup(input: {
  groupId: string;
  mediaAssetId: string;
  userId: string;
}) {
  const userId = requireUserId(input.userId);
  const client = getSupabaseServerClient();
  const { error: insertError } = await client
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .upsert(
      {
        group_id: input.groupId,
        media_asset_id: input.mediaAssetId,
        user_id: userId,
      },
      {
        ignoreDuplicates: true,
        onConflict: "group_id,media_asset_id",
      },
    );

  if (insertError) {
    throw new Error(
      `Could not add media asset to group: ${insertError.message}`,
    );
  }

  const { data, error } = await client
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .select("*")
    .eq("group_id", input.groupId)
    .eq("media_asset_id", input.mediaAssetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load creative asset group item: ${error.message}`);
  }

  if (!data) {
    throw new Error("Could not add media asset to group.");
  }

  return serializeCreativeAssetGroupItem(data);
}

export async function addMediaAssetsToGroup(input: {
  groupId: string;
  mediaAssetIds: string[];
  userId: string;
}) {
  const userId = requireUserId(input.userId);
  const mediaAssetIds = Array.from(
    new Set(input.mediaAssetIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (mediaAssetIds.length === 0) {
    return [];
  }

  if (mediaAssetIds.length > 100) {
    throw new Error("A maximum of 100 media assets can be added at once.");
  }

  const client = getSupabaseServerClient();
  const { error: insertError } = await client
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .upsert(
      mediaAssetIds.map((mediaAssetId) => ({
        group_id: input.groupId,
        media_asset_id: mediaAssetId,
        user_id: userId,
      })),
      {
        ignoreDuplicates: true,
        onConflict: "group_id,media_asset_id",
      },
    );

  if (insertError) {
    throw new Error(
      `Could not add media assets to group: ${insertError.message}`,
    );
  }

  const { data, error } = await client
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .select("*")
    .eq("group_id", input.groupId)
    .eq("user_id", userId)
    .in("media_asset_id", mediaAssetIds);

  if (error) {
    throw new Error(
      `Could not load creative asset group items: ${error.message}`,
    );
  }

  return data.map(serializeCreativeAssetGroupItem);
}

export async function removeMediaAssetFromGroup(input: {
  groupId: string;
  mediaAssetId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .delete()
    .eq("group_id", input.groupId)
    .eq("media_asset_id", input.mediaAssetId)
    .eq("user_id", requireUserId(input.userId))
    .select("media_asset_id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not remove media asset from group: ${error.message}`,
    );
  }

  return Boolean(data);
}

export async function listCreativeAssetGroupItems(input: {
  groupId: string;
  userId: string;
}) {
  const userId = requireUserId(input.userId);
  const group = await getCreativeAssetGroupForOwner({
    groupId: input.groupId,
    userId,
  });

  if (!group) {
    return null;
  }

  const { data, error } = await getSupabaseServerClient()
    .from(CREATIVE_ASSET_GROUP_ITEMS_TABLE)
    .select("*")
    .eq("group_id", input.groupId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Could not list creative asset group items: ${error.message}`,
    );
  }

  return {
    group,
    items: data.map(serializeCreativeAssetGroupItem),
  };
}

export async function listCreativeAssetGroupAssets(input: {
  groupId: string;
  userId: string;
}) {
  const result = await listCreativeAssetGroupItems(input);

  if (!result) {
    return null;
  }

  if (result.items.length === 0) {
    return {
      assets: [] as CreativeAssetGroupAsset[],
      group: result.group,
    };
  }

  const assetIds = result.items.map((item) => item.mediaAssetId);
  let query = getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .select("*")
    .eq("user_id", requireUserId(input.userId))
    .eq("status", "ready")
    .is("deleted_at", null)
    .in("id", assetIds);

  query =
    result.group.mediaType === "image"
      ? query.eq("collection", "image")
      : query.in("collection", ["video", "influencer"]);

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Could not list media assets in creative asset group: ${error.message}`,
    );
  }

  const assetsById = new Map(
    data
      .filter((row) =>
        isMediaAssetVisibleInCreativeLibrary({
          metadata: row.metadata,
          sourceType: row.source_type,
        }),
      )
      .map((row) => [row.id, serializeMediaAsset(row)]),
  );
  const assets = result.items.flatMap((item) => {
    const asset = assetsById.get(item.mediaAssetId);

    return asset
      ? [
          {
            addedAt: item.addedAt,
            asset,
          },
        ]
      : [];
  });

  return {
    assets,
    group: result.group,
  };
}

function getSupabaseServerClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Creative asset group storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<CreativeAssetGroupsDatabase>(
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

function serializeCreativeAssetGroup(
  row: CreativeAssetGroupRow,
): CreativeAssetGroup {
  return {
    createdAt: row.created_at,
    id: row.id,
    mediaType: row.media_type,
    name: row.name,
    updatedAt: row.updated_at,
  };
}

function serializeCreativeAssetGroupItem(
  row: CreativeAssetGroupItemRow,
): CreativeAssetGroupItem {
  return {
    addedAt: row.created_at,
    groupId: row.group_id,
    mediaAssetId: row.media_asset_id,
  };
}
