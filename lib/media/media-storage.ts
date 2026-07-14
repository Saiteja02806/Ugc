import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  MediaAsset,
  MediaAssetStatus,
  MediaCollection,
  MediaRatio,
  MediaSourceType,
} from "@/lib/media/types";

const MEDIA_ASSETS_TABLE = "media_assets";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type MediaAssetRow = {
  collection: MediaCollection;
  created_at: string;
  deleted_at: string | null;
  duration_seconds: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  height: number | null;
  id: string;
  metadata: Json;
  mime_type: string;
  parent_asset_id: string | null;
  project_id: string | null;
  ratio: MediaRatio;
  source_record_id: string | null;
  source_type: MediaSourceType;
  status: MediaAssetStatus;
  storage_key: string;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  url: string;
  user_id: string;
  width: number | null;
};

type MediaAssetInsert = Omit<MediaAssetRow, "created_at" | "deleted_at" | "updated_at"> & {
  created_at?: string;
  deleted_at?: string | null;
  updated_at?: string;
};

type MediaDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      media_assets: {
        Insert: MediaAssetInsert;
        Relationships: [];
        Row: MediaAssetRow;
        Update: Partial<MediaAssetInsert>;
      };
    };
    Views: Record<string, never>;
  };
};

export type CreateUploadingMediaAssetInput = {
  assetId: string;
  collection: MediaCollection;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  projectId?: string | null;
  sourceType: Extract<MediaSourceType, "upload" | "influencer_upload">;
  storageKey: string;
  title: string;
  url: string;
  userId: string;
};

export type UpsertReadyMediaAssetInput = {
  assetId?: string;
  collection: MediaCollection;
  durationSeconds?: number | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  height?: number | null;
  metadata?: Record<string, Json | undefined>;
  mimeType: string;
  parentAssetId?: string | null;
  projectId?: string | null;
  ratio?: MediaRatio;
  sourceRecordId: string;
  sourceType: MediaSourceType;
  storageKey: string;
  thumbnailUrl?: string | null;
  title: string;
  url: string;
  userId: string;
  width?: number | null;
};

let supabaseServerClient: SupabaseClient<MediaDatabase> | null = null;

function getSupabaseServerClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Unified media storage is not configured.");
  }

  if (!supabaseServerClient) {
    supabaseServerClient = createClient<MediaDatabase>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseServerClient;
}

export function getMissingMediaStorageEnvVars() {
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

export async function createUploadingMediaAsset(
  input: CreateUploadingMediaAssetInput,
) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .insert({
      collection: input.collection,
      duration_seconds: null,
      file_name: input.fileName,
      file_size_bytes: input.fileSizeBytes,
      height: null,
      id: input.assetId,
      metadata: {},
      mime_type: input.mimeType,
      parent_asset_id: null,
      project_id: input.projectId ?? null,
      ratio: "other",
      source_record_id: input.assetId,
      source_type: input.sourceType,
      status: "uploading",
      storage_key: input.storageKey,
      thumbnail_url: null,
      title: input.title,
      updated_at: now,
      url: input.url,
      user_id: input.userId,
      width: null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create media asset: ${error.message}`);
  }

  return data;
}

export async function listMediaAssets(params: {
  collection?: MediaCollection | null;
  userId: string;
}) {
  let query = getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (params.collection) {
    query = query.eq("collection", params.collection);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list media assets: ${error.message}`);
  }

  return data;
}

export async function getMediaAssetForOwner(params: {
  assetId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .select("*")
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load media asset: ${error.message}`);
  }

  return data;
}

export async function markMediaAssetReady(params: {
  assetId: string;
  durationSeconds?: number | null;
  height: number;
  ratio: MediaRatio;
  userId: string;
  width: number;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .update({
      duration_seconds: params.durationSeconds ?? null,
      height: params.height,
      ratio: params.ratio,
      status: "ready",
      updated_at: new Date().toISOString(),
      width: params.width,
    })
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not finish media asset: ${error.message}`);
  }

  return data;
}

export async function updateMediaAssetForOwner(params: {
  assetId: string;
  metadata?: Record<string, Json | undefined>;
  title?: string;
  userId: string;
}) {
  const current = await getMediaAssetForOwner(params);

  if (!current) {
    return null;
  }

  const currentMetadata = isJsonObject(current.metadata) ? current.metadata : {};
  const update: Partial<MediaAssetInsert> = {
    updated_at: new Date().toISOString(),
  };

  if (params.metadata) {
    update.metadata = {
      ...currentMetadata,
      ...params.metadata,
    };
  }

  if (params.title?.trim()) {
    update.title = params.title.trim().slice(0, 140);
  }

  const { data, error } = await getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .update(update)
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not update media asset: ${error.message}`);
  }

  return data;
}

export async function softDeleteMediaAsset(params: {
  assetId: string;
  userId: string;
}) {
  const { data, error } = await getSupabaseServerClient()
    .from(MEDIA_ASSETS_TABLE)
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete media asset: ${error.message}`);
  }

  return data;
}

export async function upsertReadyMediaAsset(input: UpsertReadyMediaAssetInput) {
  const now = new Date().toISOString();
  const row: MediaAssetInsert = {
    collection: input.collection,
    duration_seconds: input.durationSeconds ?? null,
    file_name: input.fileName ?? null,
    file_size_bytes: input.fileSizeBytes ?? null,
    height: input.height ?? null,
    id: input.assetId ?? crypto.randomUUID(),
    metadata: toJsonObject(input.metadata ?? {}),
    mime_type: input.mimeType,
    parent_asset_id: input.parentAssetId ?? null,
    project_id: input.projectId ?? null,
    ratio: input.ratio ?? "other",
    source_record_id: input.sourceRecordId,
    source_type: input.sourceType,
    status: "ready",
    storage_key: input.storageKey,
    thumbnail_url: input.thumbnailUrl ?? null,
    title: input.title.trim().slice(0, 140) || "Untitled media",
    updated_at: now,
    url: input.url,
    user_id: input.userId,
    width: input.width ?? null,
  };
  const client = getSupabaseServerClient();
  const { data: existing, error: existingError } = await client
    .from(MEDIA_ASSETS_TABLE)
    .select("id")
    .eq("user_id", input.userId)
    .eq("source_type", input.sourceType)
    .eq("source_record_id", input.sourceRecordId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Could not find media asset: ${existingError.message}`);
  }

  const operation = existing
    ? client
        .from(MEDIA_ASSETS_TABLE)
        .update({ ...row, id: existing.id })
        .eq("id", existing.id)
    : client.from(MEDIA_ASSETS_TABLE).insert(row);
  const { data, error } = await operation.select("*").single();

  if (error) {
    throw new Error(`Could not save media asset: ${error.message}`);
  }

  return data;
}

export function serializeMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    collection: row.collection,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    height: row.height,
    id: row.id,
    metadata: isJsonObject(row.metadata) ? row.metadata : {},
    mimeType: row.mime_type,
    parentAssetId: row.parent_asset_id,
    projectId: row.project_id,
    ratio: row.ratio,
    sourceRecordId: row.source_record_id,
    sourceType: row.source_type,
    status: row.status,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    updatedAt: row.updated_at,
    url: row.url,
    width: row.width,
  };
}

function isJsonObject(value: Json): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJsonObject(value: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] => {
      return entry[1] !== undefined;
    }),
  );
}
