import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  getMissingSchedulingRuntimeEnvVars,
  getUserSchedule,
  listUserSchedules,
} from "@/lib/scheduling/service";
import {
  scheduledPostStatuses,
  scheduledPostTargetStatuses,
  schedulePlatforms,
  scheduleSourceKinds,
  type ScheduledPost,
} from "@/lib/scheduling/types";
import { listSocialConnections } from "@/lib/social/oauth";
import { socialProviders } from "@/lib/social/types";

import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const timestamp = z.string().datetime({ offset: true });
const id = z.uuid();

const connection = z.strictObject({
  id,
  platform: z.enum(schedulePlatforms),
  provider: z.enum(socialProviders),
  display_name: z.string(),
  status: z.enum(["connected", "error", "expired", "permission_missing", "revoked"]),
  expires_at: timestamp.nullable(),
  supports_background_refresh: z.boolean(),
  requires_instagram_professional_account: z.boolean(),
  updated_at: timestamp,
});

const target = z.strictObject({
  id,
  connection_id: id,
  platform: z.enum(schedulePlatforms),
  status: z.enum(scheduledPostTargetStatuses),
  scheduled_for: timestamp,
  published_at: timestamp.nullable(),
  published_url: z.string().url().nullable(),
  attempt_count: z.number().int().nonnegative(),
  last_error_code: z.string().nullable(),
  last_error_message: z.string().nullable(),
  next_retry_at: timestamp.nullable(),
  updated_at: timestamp,
});

const schedule = z.strictObject({
  id,
  title: z.string(),
  caption: z.string(),
  source_kind: z.enum(scheduleSourceKinds),
  media_asset_id: id.nullable(),
  library_item_id: id.nullable(),
  status: z.enum(scheduledPostStatuses),
  scheduled_for: timestamp.nullable(),
  timezone: z.string(),
  published_at: timestamp.nullable(),
  cancelled_at: timestamp.nullable(),
  last_error_code: z.string().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  targets: z.array(target).max(20),
});

export const registeredSchedulingMcpTools = [
  "get_scheduling_capabilities",
  "list_social_connections",
  "list_schedules",
  "get_schedule",
] as const;

function unavailable(message = "Scheduling data is temporarily unavailable.") {
  return new ToolFailure("SCHEDULING_UNAVAILABLE", message, true);
}

function serializeConnection(value: Awaited<ReturnType<typeof listSocialConnections>>[number]) {
  return {
    id: value.id,
    platform: value.platform,
    provider: value.provider,
    display_name: value.platformAccountUsername ?? value.platformAccountName ?? value.platform,
    status: value.status,
    expires_at: value.expiresAt,
    supports_background_refresh: value.supportsBackgroundRefresh,
    requires_instagram_professional_account: Boolean(value.requiresInstagramProfessionalAccount),
    updated_at: value.updatedAt,
  };
}

function serializeSchedule(value: ScheduledPost) {
  return {
    id: value.id,
    title: value.title,
    caption: value.caption,
    source_kind: value.sourceKind,
    media_asset_id: value.mediaAssetId,
    library_item_id: value.libraryItemId,
    status: value.status,
    scheduled_for: value.scheduledFor,
    timezone: value.timezone,
    published_at: value.publishedAt,
    cancelled_at: value.cancelledAt,
    last_error_code: value.lastErrorCode,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    targets: value.targets.map((item) => ({
      id: item.id,
      connection_id: item.socialConnectionId,
      platform: item.platform,
      status: item.status,
      scheduled_for: item.scheduledFor,
      published_at: item.publishedAt,
      published_url: item.platformPostUrl,
      attempt_count: item.attemptCount,
      last_error_code: item.lastErrorCode,
      last_error_message: item.lastErrorMessage,
      next_retry_at: item.nextRetryAt,
      updated_at: item.updatedAt,
    })),
  };
}

function date(value: string | undefined, field: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new ToolFailure("INVALID_INPUT", `${field} must be an ISO timestamp.`);
  }
  return new Date(parsed).toISOString();
}

export function registerSchedulingMcpTools(server: McpServer) {
  server.registerTool("get_scheduling_capabilities", {
    description: "Read whether the account's existing Scheduling service is configured. This does not connect a social account, create a post, publish media, or alter publishing defaults.",
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({
      configured: z.boolean(),
      required_read_scope: z.literal("publishing:read"),
      required_write_scope: z.literal("publishing:write"),
      write_tools_available: z.literal(false),
      social_connection_oauth_available: z.literal(false),
      notes: z.array(z.string()).max(2),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("account:read"),
    _meta: oauthMetadata("account:read"),
  }, (_args, ctx) => executeTool(async () => {
    principal(ctx, "account:read");
    const configured = getMissingSchedulingRuntimeEnvVars().length === 0;
    return {
      configured,
      required_read_scope: "publishing:read",
      required_write_scope: "publishing:write",
      write_tools_available: false,
      social_connection_oauth_available: false,
      notes: configured
        ? ["Schedule and connected-account reads are available. Agent-initiated publishing remains gated."]
        : ["Scheduling is not configured for this deployment."],
    };
  }));

  server.registerTool("list_social_connections", {
    description: "List social accounts owned by the connected UGC Pilot account. Returns connection health and public account labels only; it never returns OAuth tokens, provider credentials, or hidden scheduler data.",
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({ connections: z.array(connection).max(50) }),
    annotations: readOnly,
    scopeChallenge: requireScopes("publishing:read"),
    _meta: oauthMetadata("publishing:read"),
  }, (_args, ctx) => executeTool(async () => {
    const owner = principal(ctx, "publishing:read");
    if (getMissingSchedulingRuntimeEnvVars().length) throw unavailable("Scheduling is not configured for this deployment.");
    try {
      return { connections: (await listSocialConnections(owner)).map(serializeConnection) };
    } catch {
      throw unavailable();
    }
  }));

  server.registerTool("list_schedules", {
    description: "List this account's existing schedules and safe per-target delivery state. Filter to a narrow ISO date range when possible. The output excludes provider credentials, target settings, scheduler identifiers, and internal metadata.",
    inputSchema: z.strictObject({
      status: z.enum(scheduledPostStatuses).optional(),
      from: z.string().max(64).optional(),
      to: z.string().max(64).optional(),
    }),
    outputSchema: z.strictObject({ schedules: z.array(schedule).max(200) }),
    annotations: readOnly,
    scopeChallenge: requireScopes("publishing:read"),
    _meta: oauthMetadata("publishing:read"),
  }, (args, ctx) => executeTool(async () => {
    const owner = principal(ctx, "publishing:read");
    if (getMissingSchedulingRuntimeEnvVars().length) throw unavailable("Scheduling is not configured for this deployment.");
    const from = date(args.from, "from");
    const to = date(args.to, "to");
    if (from && to && from > to) throw new ToolFailure("INVALID_INPUT", "from must be before to.");
    try {
      return { schedules: (await listUserSchedules({ userId: owner, status: args.status ?? null, from, to })).map(serializeSchedule) };
    } catch {
      throw unavailable();
    }
  }));

  server.registerTool("get_schedule", {
    description: "Read one schedule owned by this account, including safe target delivery state. Use the returned updated_at only for later gated editing when that feature becomes available.",
    inputSchema: z.strictObject({ schedule_id: id }),
    outputSchema: z.strictObject({ schedule }),
    annotations: readOnly,
    scopeChallenge: requireScopes("publishing:read"),
    _meta: oauthMetadata("publishing:read"),
  }, ({ schedule_id }, ctx) => executeTool(async () => {
    const owner = principal(ctx, "publishing:read");
    if (getMissingSchedulingRuntimeEnvVars().length) throw unavailable("Scheduling is not configured for this deployment.");
    try {
      const result = await getUserSchedule({ userId: owner, postId: schedule_id });
      if (!result) throw new ToolFailure("NOT_FOUND", "Schedule not found.");
      return { schedule: serializeSchedule(result) };
    } catch (error) {
      if (error instanceof ToolFailure) throw error;
      throw unavailable();
    }
  }));
}
