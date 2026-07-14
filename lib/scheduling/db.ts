import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ScheduledPost,
  ScheduledPostStatus,
  ScheduledPostTarget,
  ScheduledPostTargetStatus,
  SchedulePlatform,
  ScheduleSourceKind,
} from "@/lib/scheduling/types";
import type { SocialConnectionStatus, SocialProvider } from "@/lib/social/types";

const SCHEDULED_POSTS_TABLE = "scheduled_posts";
const SCHEDULED_POST_TARGETS_TABLE = "scheduled_post_targets";
const SOCIAL_CONNECTIONS_TABLE = "social_connections";
const MEDIA_ASSETS_TABLE = "media_assets";
const LIBRARY_ITEMS_TABLE = "library_items";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type ScheduledPostRow = {
  cancelled_at: string | null;
  caption: string;
  created_at: string;
  id: string;
  idempotency_key: string | null;
  last_error_code: string | null;
  library_item_id: string | null;
  media_asset_id: string | null;
  metadata: Json;
  project_id: string | null;
  published_at: string | null;
  scheduled_for: string | null;
  source_kind: ScheduleSourceKind;
  status: ScheduledPostStatus;
  timezone: string;
  title: string;
  updated_at: string;
  user_id: string;
};

type ScheduledPostTargetRow = {
  attempt_count: number;
  cancelled_at: string | null;
  created_at: string;
  id: string;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: Json;
  platform: SchedulePlatform;
  platform_post_id: string | null;
  platform_post_url: string | null;
  published_at: string | null;
  scheduled_for: string;
  scheduled_post_id: string;
  scheduler_schedule_arn: string | null;
  scheduler_schedule_name: string | null;
  settings: Json;
  social_connection_id: string;
  status: ScheduledPostTargetStatus;
  updated_at: string;
  user_id: string;
};

type SocialConnectionRow = {
  expires_at: string | null;
  id: string;
  platform: SchedulePlatform;
  provider: SocialProvider;
  revoked_at: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  user_id: string;
};

type SchedulableMediaAssetRow = {
  collection: string;
  id: string;
  project_id: string | null;
  status: string;
  title: string;
  user_id: string;
};

type SchedulableLibraryItemRow = {
  deleted_at: string | null;
  id: string;
  media_type: string;
  project_id: string;
  source_type: string;
  status: string;
  title: string;
  user_id: string;
};

type ScheduledPostInsert = Pick<
  ScheduledPostRow,
  | "caption"
  | "idempotency_key"
  | "library_item_id"
  | "media_asset_id"
  | "metadata"
  | "project_id"
  | "scheduled_for"
  | "source_kind"
  | "status"
  | "timezone"
  | "title"
  | "user_id"
>;

type ScheduledPostTargetInsert = Pick<
  ScheduledPostTargetRow,
  | "metadata"
  | "platform"
  | "scheduled_for"
  | "scheduled_post_id"
  | "settings"
  | "social_connection_id"
  | "status"
  | "user_id"
>;

type SchedulingDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      library_items: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: SchedulableLibraryItemRow;
        Update: Partial<SchedulableLibraryItemRow>;
      };
      media_assets: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: SchedulableMediaAssetRow;
        Update: Partial<SchedulableMediaAssetRow>;
      };
      scheduled_post_targets: {
        Insert: ScheduledPostTargetInsert;
        Relationships: [];
        Row: ScheduledPostTargetRow;
        Update: Partial<ScheduledPostTargetRow>;
      };
      scheduled_posts: {
        Insert: ScheduledPostInsert;
        Relationships: [];
        Row: ScheduledPostRow;
        Update: Partial<ScheduledPostRow>;
      };
      social_connections: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: SocialConnectionRow;
        Update: Partial<SocialConnectionRow>;
      };
    };
    Views: Record<string, never>;
  };
};

let schedulingSupabaseClient: SupabaseClient<SchedulingDatabase> | null = null;

export function getMissingScheduleDbEnvVars() {
  const missing: string[] = [];

  if (!getSupabaseUrl()) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export async function listScheduledPostsForUser(params: {
  from?: string | null;
  status?: ScheduledPostStatus | null;
  to?: string | null;
  userId: string;
}) {
  let query = getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.from) {
    query = query.gte("scheduled_for", params.from);
  }

  if (params.to) {
    query = query.lte("scheduled_for", params.to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load schedules: ${error.message}`);
  }

  return attachTargets(data ?? []);
}

export async function getScheduledPostForUser(params: {
  postId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .select("*")
    .eq("id", params.postId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load schedule: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (await attachTargets([data]))[0] ?? null;
}

export async function getScheduledPostByIdempotency(params: {
  idempotencyKey: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load existing schedule: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (await attachTargets([data]))[0] ?? null;
}

export async function insertScheduledPost(input: ScheduledPostInsert) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create schedule: ${error.message}`);
  }

  return data;
}

export async function insertScheduledPostTargets(
  targets: ScheduledPostTargetInsert[],
) {
  if (targets.length === 0) {
    return [];
  }

  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POST_TARGETS_TABLE)
    .insert(targets)
    .select("*");

  if (error) {
    throw new Error(`Could not create schedule targets: ${error.message}`);
  }

  return data ?? [];
}

export async function markScheduledPostStatus(params: {
  lastErrorCode?: string | null;
  postId: string;
  status: ScheduledPostStatus;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .update({
      last_error_code: params.lastErrorCode ?? null,
      status: params.status,
      updated_at: getNowIso(),
    })
    .eq("id", params.postId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not update schedule status: ${error.message}`);
  }

  return data;
}

export async function updateScheduledPostRenderState(params: {
  lastErrorCode?: string | null;
  mediaAssetId?: string | null;
  metadata: Record<string, Json | undefined>;
  postId: string;
  userId: string;
}) {
  const current = await getScheduledPostForUser({
    postId: params.postId,
    userId: params.userId,
  });

  if (!current) {
    return null;
  }

  const update: Partial<ScheduledPostRow> = {
    last_error_code: params.lastErrorCode ?? null,
    metadata: toJsonObject({
      ...current.metadata,
      ...params.metadata,
    }),
    updated_at: getNowIso(),
  };

  if (params.mediaAssetId !== undefined) {
    update.media_asset_id = params.mediaAssetId;
  }

  const { error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POSTS_TABLE)
    .update(update)
    .eq("id", params.postId)
    .eq("user_id", params.userId)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not update schedule render state: ${error.message}`);
  }

  return getScheduledPostForUser({
    postId: params.postId,
    userId: params.userId,
  });
}

export async function markScheduleTargetScheduler(params: {
  scheduleArn: string | null;
  scheduleName: string;
  targetId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POST_TARGETS_TABLE)
    .update({
      scheduler_schedule_arn: params.scheduleArn,
      scheduler_schedule_name: params.scheduleName,
      status: "scheduled",
      updated_at: getNowIso(),
    })
    .eq("id", params.targetId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not update schedule target: ${error.message}`);
  }

  return data;
}

export async function markScheduleTargetFailed(params: {
  errorCode: string;
  errorMessage?: string | null;
  targetId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POST_TARGETS_TABLE)
    .update({
      last_error_code: params.errorCode,
      last_error_message: params.errorMessage ?? null,
      status: "failed",
      updated_at: getNowIso(),
    })
    .eq("id", params.targetId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not mark schedule target failed: ${error.message}`);
  }

  return data;
}

export async function cancelScheduledPostRows(params: {
  postId: string;
  userId: string;
}) {
  const now = getNowIso();
  const client = getSchedulingSupabaseClient();
  const { data: post, error: postError } = await client
    .from(SCHEDULED_POSTS_TABLE)
    .update({
      cancelled_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", params.postId)
    .eq("user_id", params.userId)
    .neq("status", "published")
    .select("*")
    .maybeSingle();

  if (postError) {
    throw new Error(`Could not cancel schedule: ${postError.message}`);
  }

  if (!post) {
    return null;
  }

  const { error: targetError } = await client
    .from(SCHEDULED_POST_TARGETS_TABLE)
    .update({
      cancelled_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("scheduled_post_id", params.postId)
    .eq("user_id", params.userId)
    .in("status", ["draft", "scheduling", "scheduled", "failed"]);

  if (targetError) {
    throw new Error(`Could not cancel schedule targets: ${targetError.message}`);
  }

  return post;
}

export async function getSchedulableMediaAsset(params: {
  assetId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(MEDIA_ASSETS_TABLE)
    .select("id,user_id,project_id,collection,status,title")
    .eq("id", params.assetId)
    .eq("user_id", params.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load schedule media: ${error.message}`);
  }

  return data;
}

export async function getSchedulableLibraryItem(params: {
  itemId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(LIBRARY_ITEMS_TABLE)
    .select("id,user_id,project_id,status,title")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .eq("media_type", "carousel")
    .eq("source_type", "generated_carousel")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load schedule carousel: ${error.message}`);
  }

  return data;
}

export async function getConnectedSocialConnection(params: {
  connectionId: string;
  userId: string;
}) {
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SOCIAL_CONNECTIONS_TABLE)
    .select("id,user_id,platform,provider,status,scopes,expires_at,revoked_at")
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load connected account: ${error.message}`);
  }

  return data;
}

export function serializeScheduledPost(
  post: ScheduledPostRow,
  targets: ScheduledPostTargetRow[],
): ScheduledPost {
  return {
    cancelledAt: post.cancelled_at,
    caption: post.caption,
    createdAt: post.created_at,
    id: post.id,
    idempotencyKey: post.idempotency_key,
    lastErrorCode: post.last_error_code,
    libraryItemId: post.library_item_id,
    mediaAssetId: post.media_asset_id,
    metadata: toRecord(post.metadata),
    projectId: post.project_id,
    publishedAt: post.published_at,
    scheduledFor: post.scheduled_for,
    sourceKind: post.source_kind,
    status: post.status,
    targets: targets.map(serializeScheduledPostTarget),
    timezone: post.timezone,
    title: post.title,
    updatedAt: post.updated_at,
  };
}

function serializeScheduledPostTarget(
  row: ScheduledPostTargetRow,
): ScheduledPostTarget {
  return {
    attemptCount: row.attempt_count,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    id: row.id,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    platformPostUrl: row.platform_post_url,
    publishedAt: row.published_at,
    scheduledFor: row.scheduled_for,
    schedulerScheduleArn: row.scheduler_schedule_arn,
    schedulerScheduleName: row.scheduler_schedule_name,
    settings: toRecord(row.settings),
    socialConnectionId: row.social_connection_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function attachTargets(rows: ScheduledPostRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const { data, error } = await getSchedulingSupabaseClient()
    .from(SCHEDULED_POST_TARGETS_TABLE)
    .select("*")
    .in("scheduled_post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load schedule targets: ${error.message}`);
  }

  const targetsByPostId = new Map<string, ScheduledPostTargetRow[]>();

  for (const target of data ?? []) {
    const targets = targetsByPostId.get(target.scheduled_post_id) ?? [];

    targets.push(target);
    targetsByPostId.set(target.scheduled_post_id, targets);
  }

  return rows.map((row) =>
    serializeScheduledPost(row, targetsByPostId.get(row.id) ?? []),
  );
}

function getSchedulingSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error("Scheduling database is not configured.");
  }

  if (!schedulingSupabaseClient) {
    schedulingSupabaseClient = createClient<SchedulingDatabase>(
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

  return schedulingSupabaseClient;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

function getNowIso() {
  return new Date().toISOString();
}

function toRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toJsonObject(value: Record<string, unknown>): Json {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Json] =>
      isJsonValue(entry[1]),
    ),
  );
}

function isJsonValue(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}
