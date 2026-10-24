import assert from "node:assert/strict";
import { confirmToolResult } from "./mcp-confirm-client.mjs";
import { mock, test } from "node:test";

const iso = "2026-10-17T06:30:00.000Z";
const later = "2026-10-17T07:30:00.000Z";
const scheduleId = "00000000-0000-4000-8000-000000000001";
const targetId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000003";
const assetId = "00000000-0000-4000-8000-000000000004";

let configured = true;
let calls = [];
process.env.MCP_SCHEDULING_WRITES_ENABLED = "false";
class SchedulingRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const schedule = (owner = "owner-a") => ({
  id: scheduleId,
  title: "Launch Reel",
  caption: "Caption",
  sourceKind: "media_asset",
  mediaAssetId: assetId,
  libraryItemId: null,
  status: "scheduled",
  scheduledFor: later,
  timezone: "Asia/Calcutta",
  publishedAt: null,
  cancelledAt: null,
  lastErrorCode: null,
  createdAt: iso,
  updatedAt: iso,
  metadata: { internalProviderToken: "must-not-leak", owner },
  targets: [{
    id: targetId,
    socialConnectionId: connectionId,
    platform: "instagram",
    status: "scheduled",
    scheduledFor: later,
    publishedAt: null,
    platformPostUrl: null,
    attemptCount: 1,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextRetryAt: null,
    updatedAt: iso,
    schedulerScheduleArn: "internal-arn",
    settings: { secretProviderSetting: "must-not-leak" },
  }],
});

mock.module("../lib/scheduling/service.ts", {
  namedExports: {
    SchedulingRequestError,
    createUserSchedule: async (input) => {
      calls.push({ operation: "create", input });
      return { created: true, schedule: schedule(input.userId) };
    },
    getMissingSchedulingRuntimeEnvVars: () => configured ? [] : ["SUPABASE_URL"],
    listUserSchedules: async (input) => {
      calls.push({ operation: "list", input });
      return [schedule(input.userId)];
    },
    getUserSchedule: async (input) => {
      calls.push({ operation: "get", input });
      return input.userId === "owner-a" && input.postId === scheduleId ? schedule(input.userId) : null;
    },
  },
});
mock.module("../lib/social/oauth.ts", {
  namedExports: {
    listSocialConnections: async (owner) => {
      calls.push({ operation: "connections", owner });
      return [{
        id: connectionId,
        platform: "instagram",
        provider: "meta",
        platformAccountName: "UGC Pilot",
        platformAccountUsername: "@ugc_pilot",
        status: "connected",
        expiresAt: null,
        supportsBackgroundRefresh: true,
        requiresInstagramProfessionalAccount: false,
        updatedAt: iso,
        scopes: ["instagram_content_publish"],
        platformAccountId: "hidden-account-id",
      }];
    },
  },
});

const { McpServer, createMcpHandler } = await import("@modelcontextprotocol/server");
const { registerSchedulingMcpTools, registeredSchedulingMcpTools } = await import("../lib/mcp/scheduling-tools.ts");
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "fixture", version: "1" });
  registerSchedulingMcpTools(server);
  return server;
}, { legacy: "stateless" });

async function rpc(method, params, owner = "owner-a", scopes = ["account:read", "publishing:read"], emailVerified = false) {
  const response = await handler.fetch(new Request("https://mcp.getugcpilot.com/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }), { authInfo: { token: "fixture", clientId: "fixture", scopes, extra: { emailVerified, firebaseUid: owner } } });
  const text = await response.text();
  const line = text.split("\n").find((item) => item.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text);
}

async function call(name, args = {}, owner, scopes, emailVerified) {
  return confirmToolResult(async (next) => {
    const body = await rpc("tools/call", { name, arguments: next }, owner, scopes, emailVerified);
    return body.result ?? { isError: true, content: [{ type: "text", text: JSON.stringify(body.error) }] };
  }, args);
}

function error(result) {
  assert.equal(result.isError, true, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
}

test("discovery declares four reads and one disabled-gate write with distinct publishing scopes", async () => {
  const tools = (await rpc("tools/list", {})).result.tools;
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...registeredSchedulingMcpTools].sort());
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, tool.name !== "create_schedule");
    assert.equal(tool.annotations.openWorldHint, false);
    assert.deepEqual(tool._meta.securitySchemes[0].scopes, [tool.name === "create_schedule"
      ? "publishing:write"
      : "publishing:read"]);
  }
});

test("capability reads are pure and unconfigured services stop before data access", async () => {
  calls = [];
  const capability = (await call("get_scheduling_capabilities")).structuredContent;
  assert.equal(capability.configured, true);
  assert.equal(capability.write_tools_available, false);
  assert.equal(calls.length, 0);
  configured = false;
  process.env.MCP_SCHEDULING_WRITES_ENABLED = "true";
  const unavailableCapability = (await call("get_scheduling_capabilities")).structuredContent;
  assert.equal(unavailableCapability.configured, false);
  assert.equal(unavailableCapability.write_tools_available, false);
  assert.equal(calls.length, 0);
  assert.equal(error(await call("list_schedules")).code, "SCHEDULING_UNAVAILABLE");
  assert.equal(calls.length, 0);
  configured = true;
  process.env.MCP_SCHEDULING_WRITES_ENABLED = "false";
});

test("schedule creation is scope-protected, disabled by default, and preserves the verified identity policy", async () => {
  calls = [];
  const input = {
    request_id: "00000000-0000-4000-8000-000000000010",
    source: { id: assetId, kind: "media_asset" },
    target_connection_ids: [connectionId],
    scheduled_for: later,
    timezone: "Asia/Calcutta",
    title: "Launch Reel",
  };
  const missingScope = await call("create_schedule", input);
  assert.equal(missingScope.isError, true);
  assert.equal(missingScope.content[0].text, '"insufficient_scope"');
  assert.equal(calls.length, 0);
  const disabled = error(await call("create_schedule", input, "owner-a", ["account:read", "publishing:write"]));
  assert.equal(disabled.code, "SCHEDULING_WRITE_DISABLED");
  assert.equal(calls.length, 0);

  process.env.MCP_SCHEDULING_WRITES_ENABLED = "true";
  const accepted = (await call("create_schedule", input, "owner-a", ["account:read", "publishing:write"], true)).structuredContent;
  assert.equal(accepted.created, true);
  assert.equal(accepted.schedule.id, scheduleId);
  assert.equal(JSON.stringify(accepted).includes("must-not-leak"), false);
  assert.deepEqual(calls.at(-1), {
    operation: "create",
    input: {
      allowTikTokTargets: true,
      allowYouTubeTargets: true,
      input: {
        caption: undefined,
        idempotencyKey: input.request_id,
        scheduledFor: later,
        source: { id: assetId, kind: "media_asset" },
        targets: [{ connectionId }],
        timezone: "Asia/Calcutta",
        title: "Launch Reel",
      },
      userId: "owner-a",
    },
  });
  const unverified = await call("create_schedule", { ...input, request_id: "00000000-0000-4000-8000-000000000011" }, "owner-a", ["account:read", "publishing:write"], false);
  assert.equal(unverified.structuredContent.created, true);
  assert.equal(calls.at(-1).input.allowTikTokTargets, false);
  assert.equal(calls.at(-1).input.allowYouTubeTargets, false);
  process.env.MCP_SCHEDULING_WRITES_ENABLED = "false";
});

test("owner-bound reads require publishing consent and strip hidden fields", async () => {
  calls = [];
  const missingScope = await call("list_schedules", {}, "owner-a", ["account:read"]);
  assert.equal(missingScope.isError, true);
  assert.equal(missingScope.content[0].text, '"insufficient_scope"');
  assert.equal(calls.length, 0);
  const connections = (await call("list_social_connections")).structuredContent.connections;
  assert.equal(connections[0].display_name, "@ugc_pilot");
  assert.equal(JSON.stringify(connections).includes("hidden-account-id"), false);
  assert.equal(JSON.stringify(connections).includes("instagram_content_publish"), false);
  const schedules = (await call("list_schedules", { from: iso, to: later })).structuredContent.schedules;
  assert.equal(calls.at(-1).input.userId, "owner-a");
  assert.equal(calls.at(-1).input.from, iso);
  assert.equal(calls.at(-1).input.to, later);
  assert.equal(schedules[0].targets[0].connection_id, connectionId);
  assert.equal(JSON.stringify(schedules).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(schedules).includes("internal-arn"), false);
});

test("schedule reads preserve ownership and reject invalid date filters", async () => {
  calls = [];
  assert.equal(error(await call("get_schedule", { schedule_id: scheduleId }, "owner-b")).code, "NOT_FOUND");
  assert.equal(calls.at(-1).input.userId, "owner-b");
  assert.equal(error(await call("list_schedules", { from: later, to: iso })).code, "INVALID_INPUT");
  assert.equal(error(await call("list_schedules", { from: "not-a-date" })).code, "INVALID_INPUT");
});
