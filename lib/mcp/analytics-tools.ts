import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  getInstagramAccountInsightsSnapshotForOwner,
  getInstagramContentSnapshotForOwner,
} from "@/lib/analytics/instagram-snapshots";
import { readSavedSocialAnalytics } from "@/lib/analytics/social-snapshot";

import {
  executeTool,
  oauthMetadata,
  principalIdentity,
  ToolFailure,
} from "./read-tools";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const empty = z.strictObject({});
const days = z.union([z.literal(7), z.literal(30), z.literal(90)]);
const timestamp = z.string().datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const nullableText = z.string().max(5_000).nullable();
const nullableMetric = z.number().finite().nonnegative().nullable();
const httpsUrl = z.url().regex(/^https:\/\//i);
const accountStatus = z.enum([
  "error",
  "permission_missing",
  "ready",
  "unavailable",
]);

const instagramInsightPoint = z.strictObject({
  date: z.string().date(),
  interactions: nullableMetric,
  reach: nullableMetric,
  views: nullableMetric,
});
const instagramInsightsSource = z.object({
  accountName: nullableText,
  accountUsername: nullableText,
  connectionId: z.uuid(),
  daily: z.array(instagramInsightPoint).max(100),
  lastSyncedAt: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
  totals: z.object({
    interactions: nullableMetric,
    reach: nullableMetric,
    views: nullableMetric,
  }),
});
const instagramInsightsAccount = z.strictObject({
  account_name: nullableText,
  account_username: nullableText,
  connection_id: z.uuid(),
  daily: z.array(instagramInsightPoint).max(100),
  last_synced_at: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
  totals: z.strictObject({
    interactions: nullableMetric,
    reach: nullableMetric,
    views: nullableMetric,
  }),
});

const instagramContentItemSource = z.object({
  caption: nullableText,
  contentType: z.enum(["carousel", "post", "reel"]),
  id: z.string().min(1).max(300),
  mediaType: z.string().max(100).nullable(),
  metrics: z.object({
    comments: nullableMetric,
    interactions: nullableMetric,
    likes: nullableMetric,
    reach: nullableMetric,
    saves: nullableMetric,
    shares: nullableMetric,
    views: nullableMetric,
  }),
  permalink: httpsUrl.nullable(),
  publishedAt: timestamp,
  thumbnailUrl: httpsUrl.nullable(),
});
const instagramContentItem = z.strictObject({
  caption: nullableText,
  content_type: z.enum(["carousel", "post", "reel"]),
  id: z.string().min(1).max(300),
  media_type: z.string().max(100).nullable(),
  metrics: z.strictObject({
    comments: nullableMetric,
    interactions: nullableMetric,
    likes: nullableMetric,
    reach: nullableMetric,
    saves: nullableMetric,
    shares: nullableMetric,
    views: nullableMetric,
  }),
  permalink: httpsUrl.nullable(),
  published_at: timestamp,
  thumbnail_url: httpsUrl.nullable(),
});
const instagramContentSource = z.object({
  accountName: nullableText,
  accountUsername: nullableText,
  connectionId: z.uuid(),
  items: z.array(instagramContentItemSource).max(500),
  lastSyncedAt: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
});
const instagramContentAccount = z.strictObject({
  account_name: nullableText,
  account_username: nullableText,
  connection_id: z.uuid(),
  items: z.array(instagramContentItem).max(100),
  items_total: z.number().int().nonnegative(),
  items_truncated: z.boolean(),
  last_synced_at: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
});

const tiktokVideoSource = z.object({
  commentCount: nullableMetric,
  coverImageUrl: httpsUrl.nullable(),
  createdAt: nullableTimestamp,
  description: nullableText,
  id: z.string().min(1).max(300),
  likeCount: nullableMetric,
  shareCount: nullableMetric,
  shareUrl: httpsUrl.nullable(),
  title: nullableText,
  viewCount: nullableMetric,
});
const tiktokVideo = z.strictObject({
  comment_count: nullableMetric,
  cover_image_url: httpsUrl.nullable(),
  created_at: nullableTimestamp,
  description: nullableText,
  id: z.string().min(1).max(300),
  like_count: nullableMetric,
  share_count: nullableMetric,
  share_url: httpsUrl.nullable(),
  title: nullableText,
  view_count: nullableMetric,
});
const tiktokAccountSource = z.object({
  accountName: nullableText,
  accountUsername: nullableText,
  connectionId: z.uuid(),
  lastSyncedAt: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
  videos: z.array(tiktokVideoSource).max(20),
});
const tiktokAccount = z.strictObject({
  account_name: nullableText,
  account_username: nullableText,
  connection_id: z.uuid(),
  last_synced_at: nullableTimestamp,
  message: nullableText,
  status: accountStatus,
  videos: z.array(tiktokVideo).max(20),
});

const youtubeMetricsSource = z.object({
  comments: nullableMetric,
  estimatedMinutesWatched: nullableMetric,
  likes: nullableMetric,
  views: nullableMetric,
}).nullable();
const youtubeMetrics = z.strictObject({
  comments: nullableMetric,
  estimated_minutes_watched: nullableMetric,
  likes: nullableMetric,
  views: nullableMetric,
}).nullable();
const youtubeVideoSource = z.object({
  commentCount: nullableMetric,
  id: z.string().min(1).max(300),
  likeCount: nullableMetric,
  publishedAt: nullableTimestamp,
  thumbnailUrl: httpsUrl.nullable(),
  title: nullableText,
  viewCount: nullableMetric,
  watchUrl: httpsUrl,
});
const youtubeVideo = z.strictObject({
  comment_count: nullableMetric,
  id: z.string().min(1).max(300),
  like_count: nullableMetric,
  published_at: nullableTimestamp,
  thumbnail_url: httpsUrl.nullable(),
  title: nullableText,
  view_count: nullableMetric,
  watch_url: httpsUrl,
});
const youtubeAccountSource = z.object({
  accountName: nullableText,
  accountUsername: nullableText,
  connectionId: z.uuid(),
  lastSyncedAt: nullableTimestamp,
  message: nullableText,
  metrics: youtubeMetricsSource,
  status: accountStatus,
  videos: z.array(youtubeVideoSource).max(20),
});
const youtubeAccount = z.strictObject({
  account_name: nullableText,
  account_username: nullableText,
  connection_id: z.uuid(),
  last_synced_at: nullableTimestamp,
  message: nullableText,
  metrics: youtubeMetrics,
  status: accountStatus,
  videos: z.array(youtubeVideo).max(20),
});

export const registeredAnalyticsMcpTools = [
  "get_analytics_capabilities",
  "get_instagram_account_analytics",
  "get_instagram_content_analytics",
  "get_tiktok_analytics",
  "get_youtube_analytics",
] as const;

function storageConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function analyticsOwner(ctx: Parameters<typeof principalIdentity>[0]) {
  const identity = principalIdentity(ctx, "analytics:read");

  if (!identity.emailVerified) {
    throw new ToolFailure(
      "VERIFIED_IDENTITY_REQUIRED",
      "Verify the email on your UGC Pilot account before reading social analytics.",
    );
  }

  return identity.uid;
}

function unavailable() {
  return new ToolFailure(
    "ANALYTICS_UNAVAILABLE",
    "Saved analytics are temporarily unavailable.",
    true,
  );
}

function instagramInsightAccounts(value: unknown) {
  const parsed = z.array(instagramInsightsSource).max(50).safeParse(value);
  if (!parsed.success) {
    throw unavailable();
  }

  return parsed.data.map((account) => ({
    account_name: account.accountName,
    account_username: account.accountUsername,
    connection_id: account.connectionId,
    daily: account.daily,
    last_synced_at: account.lastSyncedAt,
    message: account.message,
    status: account.status,
    totals: account.totals,
  }));
}

function instagramContentAccounts(value: unknown, limit: number) {
  const parsed = z.array(instagramContentSource).max(50).safeParse(value);
  if (!parsed.success) {
    throw unavailable();
  }

  return parsed.data.map((account) => {
    const items = account.items.slice(0, limit).map((item) => ({
      caption: item.caption,
      content_type: item.contentType,
      id: item.id,
      media_type: item.mediaType,
      metrics: item.metrics,
      permalink: item.permalink,
      published_at: item.publishedAt,
      thumbnail_url: item.thumbnailUrl,
    }));

    return {
      account_name: account.accountName,
      account_username: account.accountUsername,
      connection_id: account.connectionId,
      items,
      items_total: account.items.length,
      items_truncated: account.items.length > items.length,
      last_synced_at: account.lastSyncedAt,
      message: account.message,
      status: account.status,
    };
  });
}

function tiktokAccounts(value: unknown) {
  const parsed = z.array(tiktokAccountSource).max(50).safeParse(value);
  if (!parsed.success) {
    throw unavailable();
  }

  return parsed.data.map((account) => ({
    account_name: account.accountName,
    account_username: account.accountUsername,
    connection_id: account.connectionId,
    last_synced_at: account.lastSyncedAt,
    message: account.message,
    status: account.status,
    videos: account.videos.map((video) => ({
      comment_count: video.commentCount,
      cover_image_url: video.coverImageUrl,
      created_at: video.createdAt,
      description: video.description,
      id: video.id,
      like_count: video.likeCount,
      share_count: video.shareCount,
      share_url: video.shareUrl,
      title: video.title,
      view_count: video.viewCount,
    })),
  }));
}

function youtubeAccounts(value: unknown) {
  const parsed = z.array(youtubeAccountSource).max(50).safeParse(value);
  if (!parsed.success) {
    throw unavailable();
  }

  return parsed.data.map((account) => ({
    account_name: account.accountName,
    account_username: account.accountUsername,
    connection_id: account.connectionId,
    last_synced_at: account.lastSyncedAt,
    message: account.message,
    metrics: account.metrics
      ? {
          comments: account.metrics.comments,
          estimated_minutes_watched: account.metrics.estimatedMinutesWatched,
          likes: account.metrics.likes,
          views: account.metrics.views,
        }
      : null,
    status: account.status,
    videos: account.videos.map((video) => ({
      comment_count: video.commentCount,
      id: video.id,
      like_count: video.likeCount,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      title: video.title,
      view_count: video.viewCount,
      watch_url: video.watchUrl,
    })),
  }));
}

export function registerAnalyticsMcpTools(server: McpServer) {
  server.registerTool("get_analytics_capabilities", {
    description:
      "Check whether the connected account may read its saved social analytics. This never contacts a social provider, refreshes reports, or changes any connection.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      identity_verified: z.boolean(),
      read_tools_available: z.boolean(),
      refresh_tools_available: z.literal(false),
      required_read_scope: z.literal("analytics:read"),
      requires_verified_identity: z.literal(true),
      storage_configured: z.boolean(),
      notes: z.array(z.string()).max(2),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("analytics:read"),
    _meta: oauthMetadata("analytics:read"),
  }, (_args, ctx) => executeTool(async () => {
    const identity = principalIdentity(ctx, "analytics:read");
    const configured = storageConfigured();
    const available = configured && identity.emailVerified;

    return {
      identity_verified: identity.emailVerified,
      read_tools_available: available,
      refresh_tools_available: false,
      required_read_scope: "analytics:read",
      requires_verified_identity: true,
      storage_configured: configured,
      notes: available
        ? ["Saved Instagram, TikTok, and YouTube reports can be read. Provider refresh remains unavailable to agents."]
        : [
            !configured
              ? "Analytics snapshot storage is not configured for this deployment."
              : "Verify the email on the connected UGC Pilot account before reading social analytics.",
          ],
    };
  }));

  server.registerTool("get_instagram_account_analytics", {
    description:
      "Read the connected account's saved Instagram account insights for one range. This returns only stored snapshots and never refreshes Meta data.",
    inputSchema: z.strictObject({ days: days.default(30) }),
    outputSchema: z.strictObject({
      accounts: z.array(instagramInsightsAccount).max(50),
      days,
      has_saved_snapshot: z.boolean(),
      refresh_recommended: z.boolean(),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("analytics:read"),
    _meta: oauthMetadata("analytics:read"),
  }, ({ days }, ctx) => executeTool(async () => {
    const owner = analyticsOwner(ctx);
    try {
      const snapshot = await getInstagramAccountInsightsSnapshotForOwner({
        userId: owner,
        days,
      });
      return {
        accounts: instagramInsightAccounts(snapshot.accounts),
        days,
        has_saved_snapshot: snapshot.hasSnapshot,
        refresh_recommended: snapshot.needsRefresh,
      };
    } catch (error) {
      if (error instanceof ToolFailure) {
        throw error;
      }
      throw unavailable();
    }
  }));

  server.registerTool("get_instagram_content_analytics", {
    description:
      "Read saved Instagram post, Reel, and carousel metrics for one range. This never contacts Meta or starts a refresh; truncated results state the saved total.",
    inputSchema: z.strictObject({
      days: days.default(30),
      limit_per_account: z.number().int().min(1).max(100).default(50),
    }),
    outputSchema: z.strictObject({
      accounts: z.array(instagramContentAccount).max(50),
      days,
      has_saved_snapshot: z.boolean(),
      refresh_recommended: z.boolean(),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("analytics:read"),
    _meta: oauthMetadata("analytics:read"),
  }, ({ days, limit_per_account }, ctx) => executeTool(async () => {
    const owner = analyticsOwner(ctx);
    try {
      const snapshot = await getInstagramContentSnapshotForOwner({
        userId: owner,
        days,
      });
      return {
        accounts: instagramContentAccounts(
          snapshot.accounts,
          limit_per_account,
        ),
        days,
        has_saved_snapshot: snapshot.hasSnapshot,
        refresh_recommended: snapshot.needsRefresh,
      };
    } catch (error) {
      if (error instanceof ToolFailure) {
        throw error;
      }
      throw unavailable();
    }
  }));

  server.registerTool("get_tiktok_analytics", {
    description:
      "Read saved TikTok video analytics for the connected account. This never contacts TikTok, accesses publishing records, or starts a refresh.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      accounts: z.array(tiktokAccount).max(50),
      has_saved_snapshot: z.boolean(),
      refresh_recommended: z.boolean(),
      saved_at: nullableTimestamp,
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("analytics:read"),
    _meta: oauthMetadata("analytics:read"),
  }, (_args, ctx) => executeTool(async () => {
    const owner = analyticsOwner(ctx);
    try {
      const snapshot = await readSavedSocialAnalytics({
        userId: owner,
        operation: "tiktok_videos",
      });
      return {
        accounts: tiktokAccounts(snapshot.accounts),
        has_saved_snapshot: snapshot.hasSavedSnapshot,
        refresh_recommended: snapshot.refreshRecommended,
        saved_at: snapshot.savedAt,
      };
    } catch (error) {
      if (error instanceof ToolFailure) {
        throw error;
      }
      throw unavailable();
    }
  }));

  server.registerTool("get_youtube_analytics", {
    description:
      "Read saved YouTube channel and uploaded-video analytics for the connected account. This never contacts YouTube or starts a refresh.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      accounts: z.array(youtubeAccount).max(50),
      has_saved_snapshot: z.boolean(),
      refresh_recommended: z.boolean(),
      saved_at: nullableTimestamp,
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("analytics:read"),
    _meta: oauthMetadata("analytics:read"),
  }, (_args, ctx) => executeTool(async () => {
    const owner = analyticsOwner(ctx);
    try {
      const snapshot = await readSavedSocialAnalytics({
        userId: owner,
        operation: "youtube_channel",
      });
      return {
        accounts: youtubeAccounts(snapshot.accounts),
        has_saved_snapshot: snapshot.hasSavedSnapshot,
        refresh_recommended: snapshot.refreshRecommended,
        saved_at: snapshot.savedAt,
      };
    } catch (error) {
      if (error instanceof ToolFailure) {
        throw error;
      }
      throw unavailable();
    }
  }));
}
