import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const calls = [];
let authStatus = 200;
const owner = {
  uid: "ordinary-user",
  email: "new-customer@example.com",
  emailVerified: true,
};

class AuthError extends Error {
  constructor(status) {
    super("Authentication required");
    this.status = status;
  }
}

// Keep real access helpers and route handlers; stub only hosted dependencies.
mock.module("next/server", { namedExports: {
  NextResponse: { json: (body, options) => Response.json(body, options) },
  after: () => {},
} });
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => {
    if (authStatus !== 200) throw new AuthError(authStatus);
    return owner;
  },
} });
mock.module("../analytics/social-snapshot.ts", { namedExports: {
  readOrRefreshSocialAnalytics: async (params) => {
    calls.push(params);
    return { ok: true, data: { accounts: [] } };
  },
} });
mock.module("./oauth.ts", { namedExports: {
  SocialOAuthError: class extends Error {},
  createSocialAuthorization: async (params) => {
    calls.push(params);
    return { authorizationUrl: `https://provider.example/${params.platform}` };
  },
} });
mock.module("../library/db.ts", { namedExports: {
  getLibraryCarouselItemForUser: async () => null,
} });
mock.module("../billing/subscription-db.ts", { namedExports: {
  getUserSubscription: async () => ({ connectedInstagramAccounts: 0, instagramAccounts: 1 }),
} });
mock.module("../scheduling/service.ts", { namedExports: {
  SchedulingRequestError: class extends Error {},
  getMissingSchedulingRuntimeEnvVars: () => [],
  getSocialSchedulingMinimumLeadMinutes: () => 5,
  listUserSchedules: async () => [],
  reconcileCancelledSchedulerResources: async () => {},
  createUserSchedule: async (params) => {
    calls.push(params);
    return { created: true, schedule: { id: "new-schedule" } };
  },
} });

const { POST: connect } = await import("../../app/api/social/oauth/start/route.ts");
const { POST: tiktokAnalytics } = await import("../../app/api/analytics/tiktok/videos/route.ts");
const { POST: youtubeAnalytics } = await import("../../app/api/analytics/youtube/channel/route.ts");
const { POST: schedule } = await import("../../app/api/schedules/route.ts");
const handlers = [connect, tiktokAnalytics, youtubeAnalytics, schedule];

function request(body = {}) {
  return new Request("https://www.getugcpilot.com/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("ordinary users can connect both platforms through the real OAuth route", async () => {
  for (const [platform, provider] of [["tiktok", "tiktok"], ["youtube", "google"]]) {
    const response = await connect(request({ platform, provider, returnTo: "accounts" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(calls.at(-1).userId, owner.uid);
    assert.equal(calls.at(-1).platform, platform);
  }
});

test("ordinary users can load and refresh owner-scoped analytics for both platforms", async () => {
  for (const [handler, operation] of [[tiktokAnalytics, "tiktok_videos"], [youtubeAnalytics, "youtube_channel"]]) {
    for (const force of [false, true]) {
      const response = await handler(request({ force }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
      assert.deepEqual(calls.at(-1), { force, operation, userId: owner.uid });
    }
  }
});

test("ordinary users can schedule both TikTok and YouTube targets", async () => {
  const input = { targets: [{ connectionId: "tiktok-account" }, { connectionId: "youtube-channel" }] };
  const response = await schedule(request(input));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(calls.at(-1), {
    allowTikTokTargets: true,
    allowYouTubeTargets: true,
    input,
    userId: owner.uid,
  });
});

test("opening access retains authentication and verification at every route", async () => {
  try {
    for (const status of [401, 403]) {
      authStatus = status;
      for (const handler of handlers) {
        const callCount = calls.length;
        const response = await handler(request());
        assert.equal(response.status, status);
        assert.equal((await response.json()).ok, false);
        assert.equal(calls.length, callCount);
      }
    }
  } finally {
    authStatus = 200;
  }
});
