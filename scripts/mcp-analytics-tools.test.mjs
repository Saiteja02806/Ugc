import assert from "node:assert/strict";
import { mock, test } from "node:test";

const owner = "owner-a";
const connectionId = "00000000-0000-4000-8000-000000000001";
const syncedAt = "2026-10-18T05:30:00.000Z";
let calls = [];
let corruptTikTok = false;

const instagramAccount = {
  accountName: "UGC Pilot",
  accountUsername: "@ugcpilot",
  connectionId,
  daily: [{ date: "2026-10-17", interactions: 4, reach: 12, views: 18 }],
  lastSyncedAt: syncedAt,
  message: null,
  status: "ready",
  totals: { interactions: 4, reach: 12, views: 18 },
};
const instagramContentAccount = {
  accountName: "UGC Pilot",
  accountUsername: "@ugcpilot",
  connectionId,
  items: [{
    caption: "A reel",
    contentType: "reel",
    id: "ig-post-1",
    mediaType: "VIDEO",
    metrics: {
      comments: 2,
      interactions: 8,
      likes: 4,
      reach: 20,
      saves: 1,
      shares: 1,
      views: 25,
    },
    permalink: "https://instagram.com/p/1",
    publishedAt: syncedAt,
    thumbnailUrl: "https://cdn.example.com/ig.jpg",
  }],
  lastSyncedAt: syncedAt,
  message: null,
  status: "ready",
};
const tiktokAccount = {
  accountName: "UGC Pilot",
  accountUsername: "@ugcpilot",
  connectionId,
  lastSyncedAt: syncedAt,
  message: null,
  privatePublishingRecords: [{ secret: "must-not-leak" }],
  status: "ready",
  videos: [{
    commentCount: 2,
    coverImageUrl: "https://cdn.example.com/tiktok.jpg",
    createdAt: syncedAt,
    description: "A video",
    id: "tiktok-video-1",
    likeCount: 4,
    shareCount: 1,
    shareUrl: "https://tiktok.com/@ugcpilot/video/1",
    title: "Demo",
    viewCount: 20,
  }],
};
const youtubeAccount = {
  accountName: "UGC Pilot",
  accountUsername: "@ugcpilot",
  connectionId,
  lastSyncedAt: syncedAt,
  message: null,
  metrics: { comments: 2, estimatedMinutesWatched: 6, likes: 4, views: 20 },
  status: "ready",
  videos: [{
    commentCount: 2,
    id: "youtube-video-1",
    likeCount: 4,
    publishedAt: syncedAt,
    thumbnailUrl: "https://cdn.example.com/youtube.jpg",
    title: "Demo",
    viewCount: 20,
    watchUrl: "https://www.youtube.com/watch?v=youtube-video-1",
  }],
};

mock.module("../lib/analytics/instagram-snapshots.ts", {
  namedExports: {
    getInstagramAccountInsightsSnapshotForOwner: async (input) => {
      calls.push({ operation: "instagram-account", input });
      return { accounts: [instagramAccount], hasSnapshot: true, needsRefresh: false };
    },
    getInstagramContentSnapshotForOwner: async (input) => {
      calls.push({ operation: "instagram-content", input });
      return { accounts: [instagramContentAccount], hasSnapshot: true, needsRefresh: true };
    },
  },
});
mock.module("../lib/analytics/social-snapshot.ts", {
  namedExports: {
    readSavedSocialAnalytics: async (input) => {
      calls.push({ operation: "saved", input });
      if (input.operation === "tiktok_videos") {
        return {
          accounts: corruptTikTok ? [{ ...tiktokAccount, videos: [{ ...tiktokAccount.videos[0], viewCount: -1 }] }] : [tiktokAccount],
          hasSavedSnapshot: true,
          refreshRecommended: false,
          savedAt: syncedAt,
        };
      }
      return {
        accounts: [youtubeAccount],
        hasSavedSnapshot: true,
        refreshRecommended: true,
        savedAt: null,
      };
    },
  },
});
class ToolFailure extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
mock.module("../lib/mcp/read-tools.ts", {
  namedExports: {
    ToolFailure,
    executeTool: async (callback) => {
      try {
        const output = await callback();
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
        };
      } catch (error) {
        const known = error instanceof ToolFailure ? error : null;
        return {
          isError: true,
          content: [{
            type: "text",
            text: JSON.stringify({
              code: known?.code ?? "INTERNAL_ERROR",
              message: known?.message ?? "The request could not be completed.",
              retryable: known?.retryable ?? true,
            }),
          }],
        };
      }
    },
    oauthMetadata: (scope, extra = {}) => ({
      securitySchemes: [{ type: "oauth2", scopes: [scope] }],
      ...extra,
    }),
    principalIdentity: (ctx, scope) => {
      const auth = ctx.http?.authInfo;
      const uid = auth?.extra?.firebaseUid;
      if (!auth || typeof uid !== "string" || !uid.trim()) {
        throw new ToolFailure("UNAUTHENTICATED", "Connect your UGC Pilot account.");
      }
      if (!auth.scopes.includes(scope)) {
        throw new ToolFailure("INSUFFICIENT_SCOPE", `The ${scope} permission is required.`);
      }
      return { uid, emailVerified: auth.extra?.emailVerified === true };
    },
  },
});

const { McpServer, createMcpHandler } = await import("@modelcontextprotocol/server");
const { registerAnalyticsMcpTools, registeredAnalyticsMcpTools } = await import("../lib/mcp/analytics-tools.ts");
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "fixture", version: "1" });
  registerAnalyticsMcpTools(server);
  return server;
}, { legacy: "stateless" });

async function rpc(method, params, options = {}) {
  const response = await handler.fetch(new Request("https://mcp.getugcpilot.com/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }), {
    authInfo: {
      token: "fixture",
      clientId: "fixture",
      scopes: options.scopes ?? ["account:read", "analytics:read"],
      extra: { firebaseUid: options.owner ?? owner, emailVerified: options.emailVerified ?? true },
    },
  });
  const text = await response.text();
  const line = text.split("\n").find((item) => item.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text);
}

async function call(name, args = {}, options) {
  const body = await rpc("tools/call", { name, arguments: args }, options);
  return body.result ?? {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(body.error) }],
  };
}

function error(result) {
  assert.equal(result.isError, true, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
}

test("discovery advertises five owner-scoped read tools and fresh analytics consent", async () => {
  const tools = (await rpc("tools/list", {})).result.tools;
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...registeredAnalyticsMcpTools].sort());
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
  }
  for (const tool of tools) {
    assert.deepEqual(tool._meta.securitySchemes[0].scopes, ["analytics:read"]);
  }
});

test("capability read is pure and reports verified identity truthfully", async () => {
  calls = [];
  const result = (await call("get_analytics_capabilities")).structuredContent;
  assert.equal(result.identity_verified, true);
  assert.equal(result.refresh_tools_available, false);
  assert.equal(calls.length, 0);
  const unverified = (await call("get_analytics_capabilities", {}, { emailVerified: false })).structuredContent;
  assert.equal(unverified.identity_verified, false);
  assert.equal(unverified.read_tools_available, false);
  assert.equal(calls.length, 0);
});

test("read tools stop before data access without analytics consent or verified identity", async () => {
  calls = [];
  const missingScope = await call("get_instagram_account_analytics", {}, { scopes: ["account:read"] });
  assert.equal(missingScope.isError, true);
  assert.equal(missingScope.content[0].text, '"insufficient_scope"');
  const unverified = error(await call("get_instagram_account_analytics", {}, { emailVerified: false }));
  assert.equal(unverified.code, "VERIFIED_IDENTITY_REQUIRED");
  assert.equal(calls.length, 0);
});

test("saved analytics read maps only reviewed provider fields and is owner-scoped", async () => {
  calls = [];
  const account = (await call("get_instagram_account_analytics", { days: 7 })).structuredContent;
  assert.equal(account.days, 7);
  assert.equal(account.accounts[0].connection_id, connectionId);
  assert.equal(calls[0].input.userId, owner);

  const content = (await call("get_instagram_content_analytics", { limit_per_account: 1 })).structuredContent;
  assert.equal(content.accounts[0].items_total, 1);
  assert.equal(content.refresh_recommended, true);

  const tiktok = (await call("get_tiktok_analytics")).structuredContent;
  assert.equal(tiktok.accounts[0].videos[0].view_count, 20);
  assert.equal(JSON.stringify(tiktok).includes("must-not-leak"), false);
  assert.equal(calls.at(-1).input.operation, "tiktok_videos");

  const youtube = (await call("get_youtube_analytics", {}, { owner: "owner-b" })).structuredContent;
  assert.equal(youtube.accounts[0].metrics.estimated_minutes_watched, 6);
  assert.equal(calls.at(-1).input.userId, "owner-b");
  assert.equal(calls.at(-1).input.operation, "youtube_channel");
});

test("invalid saved provider payload fails closed without exposing raw output", async () => {
  calls = [];
  corruptTikTok = true;
  const result = error(await call("get_tiktok_analytics"));
  assert.equal(result.code, "ANALYTICS_UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("viewCount"), false);
  corruptTikTok = false;
});
