import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
let signedIn = true;
const writes = [];
class AuthError extends Error { status = 401; }
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Sign in first."); return { uid: "owner" }; },
} });
mock.module("../business-profiles/db.ts", { namedExports: { getBusinessProfileForUser: async () => ({ userId: "owner", trendingTimezone: "UTC" }) } });
mock.module("../business-profiles/onboarding-access.ts", { namedExports: { getBusinessProfileOnboardingGate: () => null } });
mock.module("./unified-daily-feed.ts", { namedExports: { ensureUnifiedTrendingDailyFeed: async () => ({ contentMix: {}, feed: {} }) } });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  getTrendingContentMixPreference: async () => ({ mix: { carousel: 20, hook_video: 30, reaction: 20, wall_text: 30 }, preferenceVersion: 2, updatedAt: "saved" }),
  getTrendingPlanEntitlement: async () => ({ dailyLimit: 20, planKey: "pro", displayName: "Starter" }),
  getDailyTrendingFeedForDate: async () => ({ feed: { id: "existing" } }),
  getTrendingLocalDate: () => "2026-10-13",
  normalizeTrendingTimezone: () => "UTC",
  saveTrendingContentMixPreference: async params => { writes.push(params); return { mix: params.mix, preferenceVersion: 3, updatedAt: "now" }; },
} });
const { GET, PUT } = await import("../../app/api/trending/content-mix/route.ts");
const request = mix => new Request("https://www.getugcpilot.com/api/trending/content-mix", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mix) });

test("Adjust returns a fixed slideshow-only mix even for an older saved video preference", async () => {
  const response = await GET(new Request("https://www.getugcpilot.com/api/trending/content-mix"));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.editable, false);
  assert.deepEqual(data.preference.mix, { carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 });
  assert.equal(data.preference.preferenceVersion, 2);
  assert.equal(writes.length, 0);
});

test("stale clients cannot save any hidden format percentage", async () => {
  for (const format of ["hook_video", "wall_text", "reaction"]) {
    const response = await PUT(request({ carousel: 0, hook_video: 0, reaction: 0, wall_text: 0, [format]: 100 }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /slideshows only/);
  }
  assert.equal(writes.length, 0);
});

test("authentication still applies before reading or saving the mix", async () => {
  signedIn = false;
  try {
    assert.equal((await GET(new Request("https://www.getugcpilot.com/api/trending/content-mix"))).status, 401);
    assert.equal((await PUT(request({ carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 }))).status, 401);
    assert.equal(writes.length, 0);
  } finally { signedIn = true; }
});
