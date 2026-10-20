import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as removedImages from "./removed-carousel-images.ts";

function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, console: { error() {} }, require: name => {
    if (name === "server-only") return {};
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

const candidate = load("./reviewed-feed-candidate.ts", { "./removed-carousel-images.ts": removedImages });
const logic = load("./quota-review-history.ts", { "./reviewed-feed-candidate": candidate });
function service(owned = true) {
  const calls = [];
  const slot = { id: "slot", assignmentId: "assignment", feedId: "quota", format: "reaction", position: 2, source: "carried", state: "decided" };
  const provider = name => ({ items: name });
  const dependencies = {
    "./unified-daily-feed-db": { findOwnedDailyTrendingFeed: async (...args) => {
      calls.push(["owner", ...args]);
      return owned ? { feed: { businessProfileId: "old-profile", businessProfileVersion: 3 }, slots: [slot] } : null;
    } },
    "./creative-decisions": { listTrendingCreativeDecisions: async (...args) => {
      calls.push(["decisions", ...args]);
      return [{ assignment_id: "assignment", creative_id: "creative", format: "reaction", decision: "accepted", decided_at: "2026-10-19T01:00:00Z" }];
    } },
    "./daily-feed": { listReviewedTrendingCarousels: async () => [] },
    "./hook-video-db": { listActiveTrendingHookIdeas: async params => { calls.push(["hook", params]); return []; } },
    "./wall-text-db": { listActiveTrendingWallTextIdeas: async params => { calls.push(["wall", params]); return []; } },
    "./reaction-feed": { listActiveTrendingReactionIdeas: async params => {
      calls.push(["reaction", params]);
      return [{ id: "unused", format: "reaction", assignmentId: "assignment", creativeId: "creative", readiness: "preview_ready",
        creative: { previewUrl: "/video.mp4", caption: "An earlier post", title: "Preserved" } }];
    } },
    "./trending-hook-feed": { toHookSourceRecord: () => { throw Error("No hook in page"); } },
    "./trending-wall-text-feed": { toWallTextSourceRecord: () => { throw Error("No wall in page"); } },
    "@/lib/avatars/avatar-storage": { listReadyAvatarAssets: () => { throw Error("No hook in page"); } },
    "./hook-video-text-placement": {},
    "./feed-items": { createCarouselTrendingFeedProvider: provider, createHookTrendingFeedProvider: provider,
      createWallTextTrendingFeedProvider: provider, createReactionTrendingFeedProvider: provider },
    "./quota-review-history": logic,
  };
  return { calls, ...load("./quota-review-history-server.ts", dependencies) };
}

test("quota ownership is checked before decisions or any creative hydration", async () => {
  const fixture = service(false);
  assert.equal(await fixture.readQuotaReviewHistory("owner-b", "quota", null), null);
  assert.deepEqual(fixture.calls, [["owner", "quota", "owner-b"]]);
});

test("recovery uses the saved profile/version and exact assignments, never the current business or quota", async () => {
  const fixture = service();
  const result = await fixture.readQuotaReviewHistory("owner-a", "quota", null);
  const params = fixture.calls.find(call => call[0] === "reaction")[1];
  assert.equal(params.userId, "owner-a");
  assert.equal(params.businessProfileId, "old-profile");
  assert.equal(params.businessProfileVersion, 3);
  assert.equal(JSON.stringify(params.reviewedAssignmentIds), '["assignment"]');
  assert.equal(result.entries[0].id, "reaction:slot");
  assert.equal(result.entries[0].decision, "liked");
  assert.equal(result.unavailableCount, 0);
  assert.equal(result.nextBefore, null);
});

class AuthError extends Error { constructor(status) { super("Sign in"); this.status = status; } }
function route(auth = async () => ({ uid: "owner-a" }), result = { feedId: "quota", entries: [], nextBefore: null }) {
  const calls = [];
  return { calls, ...load("../../app/api/trending/feed/history/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "@/lib/firebase/server-auth": { FirebaseAuthRequestError: AuthError, requireFirebaseUser: auth },
    "@/lib/trending/quota-review-history-server": { readQuotaReviewHistory: async (...args) => { calls.push(args); return result; } },
  }) };
}
const feedId = "bfb7ef0e-c543-4f28-acbf-29b25af53610";
test("history route requires authentication, validates the quota/cursor and disables response caching", async () => {
  const unauth = route(async () => { throw new AuthError(401); });
  assert.equal((await unauth.GET(new Request(`https://example.com/api?feedId=${feedId}`))).status, 401);
  assert.equal(unauth.calls.length, 0);
  const fixture = route();
  for (const query of ["feedId=bad", `feedId=${feedId}&before=-1`, `feedId=${feedId}&before=NaN`, `feedId=${feedId}&before=`]) {
    assert.equal((await fixture.GET(new Request(`https://example.com/api?${query}`))).status, 400);
  }
  assert.equal(fixture.calls.length, 0);
  const response = await fixture.GET(new Request(`https://example.com/api?feedId=${feedId}&before=20`));
  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(fixture.calls, [["owner-a", feedId, 20]]);
  assert.equal((await route(undefined, null).GET(new Request(`https://example.com/api?feedId=${feedId}`))).status, 404);
});
