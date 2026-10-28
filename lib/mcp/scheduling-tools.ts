import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  createUserSchedule,
  getMissingSchedulingRuntimeEnvVars,
  getUserSchedule,
  listUserSchedules,
  SchedulingRequestError,
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

import { confirmableOutputSchema, confirmedToolDescription, requireConfirmation, withConfirmToken } from "./confirm-token";
import { executeTool, oauthMetadata, principal, principalIdentity, ToolFailure } from "./read-tools";

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;
const timestamp = z.string().datetime({ offset: true });
const id = z.uuid();
const scheduleCreationSource = z.strictObject({
  id,
  kind: z.enum(["media_asset", "library_item"]),
});
const createScheduleInput = z.strictObject({
  caption: z.string().max(5_000).optional(),
  request_id: id,
  scheduled_for: timestamp,
  source: scheduleCreationSource,
  target_connection_ids: z.array(id).min(1).max(5).refine((values) => new Set(values).size === values.length, "target_connection_ids must not contain duplicates."),
  timezone: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160).optional(),
});

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
  "create_schedule",
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

export function serializeSchedule(value: ScheduledPost) {
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

function writesEnabled() {
  return process.env.MCP_SCHEDULING_WRITES_ENABLED === "true";
}

function writeUnavailable() {
  return new ToolFailure("SCHEDULING_WRITE_DISABLED", "Agent-initiated schedule creation is not enabled for this deployment.");
}

function schedulingFailure(error: unknown): never {
  if (error instanceof SchedulingRequestError) {
    const code = error.status === 404
      ? "NOT_FOUND"
      : error.status === 403
        ? "FORBIDDEN"
        : error.status === 409
          ? "CONFLICT"
          : "INVALID_INPUT";
    throw new ToolFailure(code, error.message);
  }
  throw unavailable();
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
      write_tools_available: z.boolean(),
      social_connection_oauth_available: z.literal(false),
      notes: z.array(z.string()).max(2),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("publishing:read"),
    _meta: oauthMetadata("publishing:read"),
  }, (_args, ctx) => executeTool(async () => {
    principal(ctx, "publishing:read");
    const configured = getMissingSchedulingRuntimeEnvVars().length === 0;
    const writeToolsAvailable = configured && writesEnabled();
    return {
      configured,
      required_read_scope: "publishing:read",
      required_write_scope: "publishing:write",
      write_tools_available: writeToolsAvailable,
      social_connection_oauth_available: false,
      notes: configured
        ? [writeToolsAvailable
          ? "Schedule reads and explicit schedule creation are available. Publishing, editing, cancellation, retry and social OAuth remain gated."
          : "Schedule and connected-account reads are available. Agent-initiated schedule creation and publishing remain gated."]
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

  server.registerTool("create_schedule", {
    description: confirmedToolDescription("Create one requested future schedule for selected owned media or a saved Library item and selected owned social connections. Requires an explicit schedule time and stable request ID. This does not connect a social account, publish immediately, edit/cancel/retry a schedule, or return provider credentials."),
    inputSchema: withConfirmToken(createScheduleInput),
    outputSchema: confirmableOutputSchema(z.strictObject({
      created: z.boolean(),
      schedule,
    })),
    annotations: write,
    scopeChallenge: requireScopes("publishing:write"),
    _meta: oauthMetadata("publishing:write"),
  }, (args, ctx) => executeTool(async () => {
    const owner = principalIdentity(ctx, "publishing:write");
    return requireConfirmation({
      tool: "create_schedule", accountId: owner.uid, args, effect: "publish",
      summary: `Schedule the selected source for ${args.scheduled_for} (${args.timezone}) on ${args.target_connection_ids.length} connection${args.target_connection_ids.length === 1 ? "" : "s"}. This does not publish immediately.`,
      creditCost: 0, creditCostIsEstimate: false,
      affected: [
        { type: args.source.kind, id: args.source.id, label: "Schedule source" },
        ...args.target_connection_ids.slice(0, 5).map((id) => ({ type: "social_connection", id, label: "Selected social connection" })),
      ],
      run: async () => {
        if (!writesEnabled()) throw writeUnavailable();
        if (getMissingSchedulingRuntimeEnvVars().length) throw unavailable("Scheduling is not configured for this deployment.");
        try {
          const result = await createUserSchedule({
            allowTikTokTargets: owner.emailVerified,
            allowYouTubeTargets: owner.emailVerified,
            input: {
              caption: args.caption,
              idempotencyKey: args.request_id,
              scheduledFor: args.scheduled_for,
              source: {
                id: args.source.id,
                kind: args.source.kind,
              },
              targets: args.target_connection_ids.map((connectionId) => ({ connectionId })),
              timezone: args.timezone,
              title: args.title,
            },
            userId: owner.uid,
          });
          return { created: result.created, schedule: serializeSchedule(result.schedule) };
        } catch (error) {
          schedulingFailure(error);
        }
      },
    });
  }));
}
