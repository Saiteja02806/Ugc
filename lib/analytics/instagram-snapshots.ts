import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  InstagramContentAccount,
  InstagramContentItem,
} from "@/lib/analytics/instagram-content-insights";
import {
  getUniqueInstagramConnections,
  type InstagramInsightsAccount,
} from "@/lib/analytics/instagram-insights";
import type { InstagramInsightsRangeDays } from "@/lib/analytics/instagram";
import {
  getInstagramAnalyticsRangeStart,
  INSTAGRAM_ACCOUNT_INSIGHTS_REFRESH_MS,
  INSTAGRAM_MEDIA_FEED_REFRESH_MS,
  isInstagramContentMetricsStale,
  isInstagramTimestampStale,
} from "@/lib/analytics/instagram-freshness";
import { listSocialConnections } from "@/lib/social/oauth";

const ACCOUNT_SNAPSHOTS_TABLE = "instagram_analytics_account_snapshots";
const CONNECTION_SNAPSHOTS_TABLE =
  "instagram_analytics_connection_snapshots";
const CONTENT_TABLE = "instagram_analytics_content";

type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

type AccountSnapshotRow = {
  range_days: number;
  snapshot_json: Json;
  social_connection_id: string;
  synced_at: string;
  updated_at: string;
  user_id: string;
};

type ConnectionSnapshotRow = {
  account_name: string | null;
  account_username: string | null;
  feed_synced_at: string | null;
  last_synced_at: string | null;
  message: string | null;
  range_days: number;
  social_connection_id: string;
  status: InstagramContentAccount["status"];
  updated_at: string;
  user_id: string;
};

type ContentRow = {
  account_name: string | null;
  account_username: string | null;
  caption: string | null;
  comments: number | null;
  content_type: InstagramContentItem["contentType"];
  created_at: string;
  interactions: number | null;
  last_sync_error: string | null;
  likes: number | null;
  media_type: string | null;
  metrics_synced_at: string | null;
  permalink: string | null;
  platform_media_id: string;
  published_at: string;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  social_connection_id: string;
  thumbnail_url: string | null;
  updated_at: string;
  user_id: string;
  views: number | null;
};

type AnalyticsDatabase = {
  public: {
    Functions: Record<string, never>;
    Tables: {
      instagram_analytics_account_snapshots: {
        Insert: Omit<AccountSnapshotRow, "updated_at"> & {
          updated_at?: string;
        };
        Relationships: [];
        Row: AccountSnapshotRow;
        Update: Partial<AccountSnapshotRow>;
      };
      instagram_analytics_connection_snapshots: {
        Insert: Omit<ConnectionSnapshotRow, "updated_at"> & {
          updated_at?: string;
        };
        Relationships: [];
        Row: ConnectionSnapshotRow;
        Update: Partial<ConnectionSnapshotRow>;
      };
      instagram_analytics_content: {
        Insert: Omit<ContentRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
        Row: ContentRow;
        Update: Partial<ContentRow>;
      };
    };
    Views: Record<string, never>;
  };
};

export type StoredInstagramContentItem = {
  item: InstagramContentItem;
  lastSyncError: string | null;
  metricsSyncedAt: string | null;
};

export type StoredInstagramConnectionSnapshot = {
  feedSyncedAt: string | null;
  lastSyncedAt: string | null;
};

export async function getInstagramAccountInsightsSnapshotForOwner(params: {
  days: InstagramInsightsRangeDays;
  now?: number;
  userId: string;
}) {
  const connections = getUniqueInstagramConnections(
    await listSocialConnections(params.userId),
  );

  if (connections.length === 0) {
    return { accounts: [], hasSnapshot: true, needsRefresh: false };
  }

  const connectionIds = connections.map((connection) => connection.id);
  const { data, error } = await getAnalyticsSupabaseClient()
    .from(ACCOUNT_SNAPSHOTS_TABLE)
    .select("*")
    .eq("user_id", params.userId)
    .eq("range_days", params.days)
    .in("social_connection_id", connectionIds);

  if (error) {
    throw new Error(`Could not read Instagram insight snapshots: ${error.message}`);
  }

  const rows = data ?? [];
  const rowsByConnectionId = new Map(
    rows.map((row) => [row.social_connection_id, row]),
  );
  const accounts = rows.flatMap((row) => {
    const account = parseInstagramInsightsAccount(row.snapshot_json);
    return account ? [account] : [];
  });
  const needsRefresh = connections.some((connection) => {
    const row = rowsByConnectionId.get(connection.id);

    return (
      !row ||
      isInstagramTimestampStale({
        maxAgeMs: INSTAGRAM_ACCOUNT_INSIGHTS_REFRESH_MS,
        now: params.now,
        timestamp: row.synced_at,
      })
    );
  });

  return {
    accounts,
    hasSnapshot: accounts.length > 0,
    needsRefresh,
  };
}

export async function persistInstagramAccountInsightsSnapshots(params: {
  accounts: InstagramInsightsAccount[];
  days: InstagramInsightsRangeDays;
  userId: string;
}) {
  if (params.accounts.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = params.accounts.map((account) => ({
    range_days: params.days,
    snapshot_json: account as unknown as Json,
    social_connection_id: account.connectionId,
    synced_at: account.lastSyncedAt ?? now,
    updated_at: now,
    user_id: params.userId,
  }));
  const { error } = await getAnalyticsSupabaseClient()
    .from(ACCOUNT_SNAPSHOTS_TABLE)
    .upsert(rows, {
      onConflict: "user_id,social_connection_id,range_days",
    });

  if (error) {
    throw new Error(`Could not save Instagram insight snapshots: ${error.message}`);
  }
}

export async function getInstagramContentSnapshotForOwner(params: {
  days: InstagramInsightsRangeDays;
  now?: number;
  userId: string;
}) {
  const connections = getUniqueInstagramConnections(
    await listSocialConnections(params.userId),
  );

  if (connections.length === 0) {
    return {
      accounts: [] as InstagramContentAccount[],
      connectionStates: new Map<string, StoredInstagramConnectionSnapshot>(),
      hasSnapshot: true,
      needsRefresh: false,
      recordsByConnectionId: new Map<string, StoredInstagramContentItem[]>(),
    };
  }

  const connectionIds = connections.map((connection) => connection.id);
  const since = getInstagramAnalyticsRangeStart(params.days).toISOString();
  const client = getAnalyticsSupabaseClient();
  const [stateResult, contentResult] = await Promise.all([
    client
      .from(CONNECTION_SNAPSHOTS_TABLE)
      .select("*")
      .eq("user_id", params.userId)
      .eq("range_days", params.days)
      .in("social_connection_id", connectionIds),
    client
      .from(CONTENT_TABLE)
      .select("*")
      .eq("user_id", params.userId)
      .in("social_connection_id", connectionIds)
      .gte("published_at", since)
      .order("published_at", { ascending: false }),
  ]);

  if (stateResult.error) {
    throw new Error(
      `Could not read Instagram connection snapshots: ${stateResult.error.message}`,
    );
  }

  if (contentResult.error) {
    throw new Error(
      `Could not read Instagram content snapshots: ${contentResult.error.message}`,
    );
  }

  const stateRowsByConnectionId = new Map(
    (stateResult.data ?? []).map((row) => [row.social_connection_id, row]),
  );
  const recordsByConnectionId = new Map<
    string,
    StoredInstagramContentItem[]
  >();

  for (const row of contentResult.data ?? []) {
    const records = recordsByConnectionId.get(row.social_connection_id) ?? [];

    records.push(deserializeContentRow(row));
    recordsByConnectionId.set(row.social_connection_id, records);
  }

  const connectionStates = new Map<string, StoredInstagramConnectionSnapshot>();
  const accounts = connections.map((connection): InstagramContentAccount => {
    const state = stateRowsByConnectionId.get(connection.id);
    const records = recordsByConnectionId.get(connection.id) ?? [];

    if (state) {
      connectionStates.set(connection.id, {
        feedSyncedAt: state.feed_synced_at,
        lastSyncedAt: state.last_synced_at,
      });
    }

    return {
      accountName: state?.account_name ?? connection.platformAccountName,
      accountUsername:
        state?.account_username ?? connection.platformAccountUsername,
      connectionId: connection.id,
      items: records.map((record) => record.item),
      lastSyncedAt: state?.last_synced_at ?? null,
      message:
        state?.message ??
        (records.length > 0 ? "Refreshing the latest Instagram metrics." : null),
      status: state?.status ?? (records.length > 0 ? "ready" : "error"),
    };
  });
  const hasAllConnectionStates = connections.every((connection) =>
    stateRowsByConnectionId.has(connection.id),
  );
  const hasSnapshot =
    hasAllConnectionStates || (contentResult.data?.length ?? 0) > 0;
  const needsRefresh = connections.some((connection) => {
    const state = stateRowsByConnectionId.get(connection.id);
    const records = recordsByConnectionId.get(connection.id) ?? [];

    return (
      !state ||
      isInstagramTimestampStale({
        maxAgeMs: INSTAGRAM_MEDIA_FEED_REFRESH_MS,
        now: params.now,
        timestamp: state.feed_synced_at,
      }) ||
      records.some((record) =>
        isInstagramContentMetricsStale({
          metricsSyncedAt: record.metricsSyncedAt,
          now: params.now,
          publishedAt: record.item.publishedAt,
        }),
      )
    );
  });

  return {
    accounts,
    connectionStates,
    hasSnapshot,
    needsRefresh,
    recordsByConnectionId,
  };
}

export async function persistInstagramContentRecords(params: {
  records: StoredInstagramContentItem[];
  userId: string;
}) {
  if (params.records.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = params.records.map(({ item, lastSyncError, metricsSyncedAt }) => ({
    account_name: item.accountName,
    account_username: item.accountUsername,
    caption: item.caption,
    comments: item.metrics.comments,
    content_type: item.contentType,
    interactions: item.metrics.interactions,
    last_sync_error: lastSyncError?.slice(0, 1_000) ?? null,
    likes: item.metrics.likes,
    media_type: item.mediaType,
    metrics_synced_at: metricsSyncedAt,
    permalink: item.permalink,
    platform_media_id: item.id,
    published_at: item.publishedAt,
    reach: item.metrics.reach,
    saves: item.metrics.saves,
    shares: item.metrics.shares,
    social_connection_id: item.connectionId,
    thumbnail_url: item.thumbnailUrl,
    updated_at: now,
    user_id: params.userId,
    views: item.metrics.views,
  }));
  const { error } = await getAnalyticsSupabaseClient()
    .from(CONTENT_TABLE)
    .upsert(rows, {
      onConflict: "user_id,social_connection_id,platform_media_id",
    });

  if (error) {
    throw new Error(`Could not save Instagram content snapshots: ${error.message}`);
  }
}

export async function persistInstagramContentConnectionSnapshots(params: {
  days: InstagramInsightsRangeDays;
  snapshots: Array<{
    account: InstagramContentAccount;
    feedSyncedAt: string | null;
  }>;
  userId: string;
}) {
  if (params.snapshots.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = params.snapshots.map(({ account, feedSyncedAt }) => ({
    account_name: account.accountName,
    account_username: account.accountUsername,
    feed_synced_at: feedSyncedAt,
    last_synced_at: account.lastSyncedAt,
    message: account.message,
    range_days: params.days,
    social_connection_id: account.connectionId,
    status: account.status,
    updated_at: now,
    user_id: params.userId,
  }));
  const { error } = await getAnalyticsSupabaseClient()
    .from(CONNECTION_SNAPSHOTS_TABLE)
    .upsert(rows, {
      onConflict: "user_id,social_connection_id,range_days",
    });

  if (error) {
    throw new Error(
      `Could not save Instagram connection snapshots: ${error.message}`,
    );
  }
}

function deserializeContentRow(row: ContentRow): StoredInstagramContentItem {
  return {
    item: {
      accountName: row.account_name,
      accountUsername: row.account_username,
      caption: row.caption,
      connectionId: row.social_connection_id,
      contentType: row.content_type,
      id: row.platform_media_id,
      mediaType: row.media_type,
      metrics: {
        comments: row.comments,
        interactions: row.interactions,
        likes: row.likes,
        reach: row.reach,
        saves: row.saves,
        shares: row.shares,
        views: row.views,
      },
      permalink: row.permalink,
      publishedAt: row.published_at,
      thumbnailUrl: row.thumbnail_url,
    },
    lastSyncError: row.last_sync_error,
    metricsSyncedAt: row.metrics_synced_at,
  };
}

function parseInstagramInsightsAccount(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const account = value as Record<string, Json | undefined>;

  return typeof account.connectionId === "string" &&
    Array.isArray(account.daily) &&
    typeof account.status === "string" &&
    account.totals &&
    typeof account.totals === "object" &&
    !Array.isArray(account.totals)
    ? (value as unknown as InstagramInsightsAccount)
    : null;
}

let analyticsSupabaseClient: SupabaseClient<AnalyticsDatabase> | null = null;

function getAnalyticsSupabaseClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRoleKey) {
    throw new Error("Instagram analytics snapshot storage is not configured.");
  }

  if (!analyticsSupabaseClient) {
    analyticsSupabaseClient = createClient<AnalyticsDatabase>(
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

  return analyticsSupabaseClient;
}
