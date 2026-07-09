import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AvatarAssetRatio,
  AvatarAssetRow,
  AvatarAssetStatus,
  AvatarAssetType,
  AvatarAssetWithPreference,
  AvatarSelection,
  AvatarTrimInput,
  Json,
  UserAvatarPreferenceRow,
} from "@/lib/avatars/types";

const AVATAR_ASSETS_TABLE = "avatar_assets";
const USER_AVATAR_PREFERENCES_TABLE = "user_avatar_preferences";

type AvatarAssetInsert = {
  avatar_type?: AvatarAssetType;
  deleted_at?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  height?: number | null;
  id?: string;
  metadata?: Json;
  name: string;
  ratio?: AvatarAssetRatio;
  sort_order?: number;
  source_s3_key: string;
  source_video_url: string;
  status?: AvatarAssetStatus;
  thumbnail_url?: string | null;
  updated_at?: string;
  width?: number | null;
};

type AvatarAssetUpdate = Partial<Omit<AvatarAssetInsert, "id">>;

type UserAvatarPreferenceInsert = {
  avatar_asset_id: string;
  id?: string;
  is_trimmed?: boolean;
  last_used_at?: string | null;
  trim_end?: number | null;
  trim_start?: number | null;
  updated_at?: string;
  user_id: string;
};

type UserAvatarPreferenceUpdate = Partial<
  Omit<UserAvatarPreferenceInsert, "avatar_asset_id" | "id" | "user_id">
>;

type AvatarDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      avatar_assets: {
        Insert: AvatarAssetInsert;
        Relationships: [];
        Row: AvatarAssetRow;
        Update: AvatarAssetUpdate;
      };
      user_avatar_preferences: {
        Insert: UserAvatarPreferenceInsert;
        Relationships: [];
        Row: UserAvatarPreferenceRow;
        Update: UserAvatarPreferenceUpdate;
      };
    };
    Views: Record<string, never>;
  };
};

type CreateAvatarAssetInput = {
  description?: string | null;
  durationSeconds?: number | null;
  height?: number | null;
  metadata?: Json;
  name: string;
  ratio?: AvatarAssetRatio;
  sortOrder?: number;
  sourceS3Key: string;
  sourceVideoUrl: string;
  status?: AvatarAssetStatus;
  thumbnailUrl?: string | null;
  width?: number | null;
};

let supabaseServerClient: SupabaseClient<AvatarDatabase> | null = null;

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
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
    throw new Error("Avatar storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<AvatarDatabase>(
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

export function getMissingAvatarStorageEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function isAvatarStorageConfigured() {
  return getMissingAvatarStorageEnvVars().length === 0;
}

export async function createAvatarAsset(input: CreateAvatarAssetInput) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from(AVATAR_ASSETS_TABLE)
    .insert({
      avatar_type: "global",
      description: input.description ?? null,
      duration_seconds: input.durationSeconds ?? null,
      height: input.height ?? null,
      metadata: input.metadata ?? {},
      name: input.name.trim(),
      ratio: input.ratio ?? "9:16",
      sort_order: input.sortOrder ?? 0,
      source_s3_key: input.sourceS3Key.trim(),
      source_video_url: input.sourceVideoUrl.trim(),
      status: input.status ?? "ready",
      thumbnail_url: input.thumbnailUrl ?? null,
      updated_at: now,
      width: input.width ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create avatar asset: ${error.message}`);
  }

  return data;
}

export async function listReadyAvatarAssetsWithPreferences(params: {
  userId: string;
}) {
  const assets = await listReadyAvatarAssets();
  const preferences = await listUserAvatarPreferences({
    avatarAssetIds: assets.map((asset) => asset.id),
    userId: params.userId,
  });
  const preferencesByAvatarId = new Map(
    preferences.map((preference) => [preference.avatar_asset_id, preference]),
  );

  return assets.map((asset): AvatarAssetWithPreference => {
    return {
      asset,
      preference: preferencesByAvatarId.get(asset.id) ?? null,
    };
  });
}

export async function getAvatarAssetWithPreference(params: {
  avatarAssetId: string;
  userId: string;
}) {
  const asset = await getAvatarAsset(params.avatarAssetId);
  const preference = await getUserAvatarPreference({
    avatarAssetId: params.avatarAssetId,
    userId: params.userId,
  });

  return {
    asset,
    preference,
  } satisfies AvatarAssetWithPreference;
}

export async function listReadyAvatarAssets() {
  const { data, error } = await getSupabaseServerClient()
    .from(AVATAR_ASSETS_TABLE)
    .select("*")
    .eq("avatar_type", "global")
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list avatar assets: ${error.message}`);
  }

  return data;
}

export async function getAvatarAsset(avatarAssetId: string) {
  const { data, error } = await getSupabaseServerClient()
    .from(AVATAR_ASSETS_TABLE)
    .select("*")
    .eq("id", avatarAssetId)
    .eq("avatar_type", "global")
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(`Could not load avatar asset: ${error.message}`);
  }

  return data;
}

export async function getUserAvatarPreference(params: {
  avatarAssetId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(USER_AVATAR_PREFERENCES_TABLE)
    .select("*")
    .eq("avatar_asset_id", params.avatarAssetId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load avatar preference: ${error.message}`);
  }

  return data;
}

export async function listUserAvatarPreferences(params: {
  avatarAssetIds: string[];
  userId: string;
}) {
  if (params.avatarAssetIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseServerClient()
    .from(USER_AVATAR_PREFERENCES_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .in("avatar_asset_id", params.avatarAssetIds);

  if (error) {
    throw new Error(`Could not list avatar preferences: ${error.message}`);
  }

  return data;
}

export async function saveUserAvatarPreference(params: {
  avatarAssetId: string;
  trim: AvatarTrimInput;
  userId: string;
}) {
  const now = new Date().toISOString();
  const preference: UserAvatarPreferenceInsert = {
    avatar_asset_id: params.avatarAssetId,
    is_trimmed: params.trim.isTrimmed,
    trim_end: params.trim.isTrimmed ? params.trim.trimEnd : null,
    trim_start: params.trim.isTrimmed ? params.trim.trimStart : null,
    updated_at: now,
    user_id: params.userId,
  };
  const { data, error } = await getSupabaseServerClient()
    .from(USER_AVATAR_PREFERENCES_TABLE)
    .upsert(preference, {
      onConflict: "user_id,avatar_asset_id",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not save avatar preference: ${error.message}`);
  }

  return data;
}

export async function resetUserAvatarPreference(params: {
  avatarAssetId: string;
  userId: string;
}) {
  return saveUserAvatarPreference({
    avatarAssetId: params.avatarAssetId,
    trim: {
      isTrimmed: false,
      trimEnd: null,
      trimStart: null,
    },
    userId: params.userId,
  });
}

export async function markUserAvatarUsed(params: {
  avatarAssetId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const existingPreference = await getUserAvatarPreference(params);
  const preference: UserAvatarPreferenceInsert = {
    avatar_asset_id: params.avatarAssetId,
    is_trimmed: existingPreference?.is_trimmed ?? false,
    last_used_at: now,
    trim_end: existingPreference?.trim_end ?? null,
    trim_start: existingPreference?.trim_start ?? null,
    updated_at: now,
    user_id: params.userId,
  };
  const { data, error } = await getSupabaseServerClient()
    .from(USER_AVATAR_PREFERENCES_TABLE)
    .upsert(preference, {
      onConflict: "user_id,avatar_asset_id",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not mark avatar as used: ${error.message}`);
  }

  return data;
}

export function getAvatarSelection(
  asset: AvatarAssetRow,
  preference: UserAvatarPreferenceRow | null,
): AvatarSelection {
  const trimStart = preference?.trim_start ?? null;
  const trimEnd = preference?.trim_end ?? null;
  const hasTrim =
    preference?.is_trimmed === true &&
    typeof trimStart === "number" &&
    typeof trimEnd === "number";

  return {
    avatarAssetId: asset.id,
    isTrimmed: hasTrim,
    sourceVideoUrl: asset.source_video_url,
    trimEnd: hasTrim ? trimEnd : asset.duration_seconds,
    trimStart: hasTrim ? trimStart : 0,
  };
}

export function isAvatarStorageNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const storageError = error as {
    code?: string;
    message?: string;
  };

  return (
    storageError.code === "PGRST116" ||
    storageError.message?.includes("0 rows") === true ||
    storageError.message?.includes("JSON object requested") === true
  );
}
