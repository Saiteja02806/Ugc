import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import { SchedulingRequestError } from "../scheduling/errors.ts";
import { getDefaultScheduleTargetSettings } from "../scheduling/platform-settings.ts";
import { createReactionScheduleRequest } from "./reaction-scheduling-contract.ts";
import { createWallTextScheduleRequest } from "./wall-text-scheduling-contract.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const owner = { uid: "ordinary-user", email: "new-customer@example.com", emailVerified: true };
const assignmentId = "10000000-0000-4000-8000-000000000001";
const accountIds = { tiktok: "20000000-0000-4000-8000-000000000002", youtube: "30000000-0000-4000-8000-000000000003" };
const calls = [];
const continuations = [];
let ready = true;
let schedulerFails = false;
let createFails = false;
let lastInput;

class AuthError extends Error {}
mock.module("next/server", { namedExports: {
  NextResponse: { json: (body, options) => Response.json(body, options) },
  after: callback => continuations.push(callback),
} });
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => owner,
} });
mock.module("../scheduling/service.ts", { namedExports: {
  SchedulingRequestError,
  createUserSchedule: async params => {
    calls.push({ action: "create", ...params });
    if (createFails) throw new SchedulingRequestError("Reconnect this account.", 409, "provider_permission_missing");
    lastInput = params.input;
    return { created: true, schedule: { id: "saved-schedule", status: "draft", targets: [], updatedAt: "version", metadata: params.input.metadata } };
  },
  scheduleRenderedPost: async params => {
    calls.push({ action: "publish", ...params });
    return { created: true, schedule: {
      id: params.postId, status: schedulerFails ? "failed" : "scheduled", scheduledFor: "2026-10-01T10:00:00Z",
      targets: params.input.connectionIds.map(id => ({ socialConnectionId: id, status: schedulerFails ? "failed" : "scheduled", settings: lastInput.plannedTargets.find(target => target.connectionId === id).settings })),
    } };
  },
  updateUserSchedule: async () => assert.fail("Fresh draft should not be updated"),
} });
mock.module("./reaction-feed.ts", { namedExports: {
  getSelectedReadyReactionCreative: async params => {
    assert.deepEqual(params, { assignmentId, userId: owner.uid });
    return ready ? { assignmentId, creativeId: "reaction-creative", mediaAssetId: "reaction-mp4", title: "Reaction Reel" } : null;
  },
} });
mock.module("./creative-decisions.ts", { namedExports: {
  recordTrendingCreativeDecision: async params => calls.push({ action: "accept", ...params }),
} });
mock.module("./unified-daily-feed-db.ts", { namedExports: {
  markDailyTrendingSlotDecided: async params => calls.push({ action: "decide", ...params }),
} });
mock.module("./wall-text-db.ts", { namedExports: {
  getSelectedWallTextDraft: async params => {
    assert.deepEqual(params, { assignmentId, userId: owner.uid });
    return { assignmentId, id: "text-creative", text: { fullText: "My Text Reel" } };
  },
} });
mock.module("../scheduling/wall-text-render-start.ts", { namedExports: {
  startWallTextScheduleRender: async params => calls.push({ action: "render", ...params }),
} });

const { POST: scheduleReaction } = await import("../../app/api/trending/reactions/schedules/route.ts");
const { POST: scheduleText } = await import("../../app/api/trending/wall-text/schedules/route.ts");
function selection(platforms) {
  return {
    assignmentId, caption: "My caption", scheduledDate: "2026-10-01", scheduledTime: "15:30",
    timezone: "Asia/Kolkata", useDefaultScheduleTime: false,
    targets: platforms.map(platform => ({ connectionId: accountIds[platform], platform, settings: {
      ...getDefaultScheduleTargetSettings(platform),
      ...(platform === "tiktok" ? { privacyLevel: "PUBLIC_TO_EVERYONE", musicUsageConfirmed: true } : { privacyStatus: "public" }),
    } })),
  };
}
function request(body) {
  return new Request("https://www.getugcpilot.com/api/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("the real Trending Reaction handler schedules TikTok, YouTube, and both together with chosen settings", async () => {
  for (const platforms of [["tiktok"], ["youtube"], ["tiktok", "youtube"]]) {
    calls.length = 0;
    const body = createReactionScheduleRequest(selection(platforms));
    const response = await scheduleReaction(request(body));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.equal(result.schedule.status, "scheduled");
    assert.deepEqual(calls.map(call => call.action), ["accept", "decide", "create", "publish"]);
    const create = calls[2];
    const publish = calls[3];
    assert.equal(create.userId, owner.uid);
    assert.equal(create.allowTikTokTargets, true);
    assert.equal(create.allowYouTubeTargets, true);
    assert.equal(create.input.source.id, "reaction-mp4");
    assert.deepEqual(create.input.plannedTargets, body.targets);
    assert.equal(create.input.scheduledDate, body.scheduledDate);
    assert.equal(create.input.scheduledTime, body.scheduledTime);
    assert.equal(create.input.timezone, body.timezone);
    assert.deepEqual(publish.input.connectionIds, body.targets.map(target => target.connectionId));
    assert.equal(publish.allowTikTokTargets, true);
    assert.equal(publish.allowYouTubeTargets, true);
    for (const target of body.targets) {
      assert.deepEqual(result.schedule.targets.find(item => item.socialConnectionId === target.connectionId).settings, target.settings);
    }
  }
});

test("Reaction scheduling reports scheduler failures and never returns a false success", async () => {
  schedulerFails = true;
  try {
    const response = await scheduleReaction(request(createReactionScheduleRequest(selection(["tiktok", "youtube"]))));
    const result = await response.json();
    assert.equal(response.status, 409);
    assert.equal(result.ok, false);
    assert.equal(result.code, "reaction_schedule_incomplete");
  } finally { schedulerFails = false; }
});

test("Reaction scheduling refuses unavailable rendered content before saving or dispatching", async () => {
  ready = false;
  calls.length = 0;
  try {
    const response = await scheduleReaction(request(createReactionScheduleRequest(selection(["youtube"]))));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).ok, false);
    assert.deepEqual(calls, []);
  } finally { ready = true; }
});

test("the real Text Reel handler saves both account settings and time before continuing render on the server", async () => {
  calls.length = 0;
  continuations.length = 0;
  const body = createWallTextScheduleRequest(selection(["tiktok", "youtube"]));
  const response = await scheduleText(request(body));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.renderStatus, "queued");
  assert.deepEqual(calls.map(call => call.action), ["create"]);
  assert.equal(calls[0].userId, owner.uid);
  assert.equal(calls[0].allowTikTokTargets, true);
  assert.equal(calls[0].allowYouTubeTargets, true);
  assert.deepEqual(calls[0].input.plannedTargets, body.targets);
  assert.deepEqual(calls[0].input.source, { id: assignmentId, kind: "wall_text_pending" });
  assert.equal(calls[0].input.scheduledDate, body.scheduledDate);
  assert.equal(calls[0].input.scheduledTime, body.scheduledTime);
  assert.equal(calls[0].input.timezone, body.timezone);
  assert.equal(continuations.length, 1);
  await continuations[0]();
  assert.equal(calls[1].action, "render");
  assert.equal(calls[1].schedule.id, result.schedule.id);
  assert.equal(calls[1].userId, owner.uid);
});

test("failed Text Reel saves do not queue a render or report success", async () => {
  createFails = true;
  continuations.length = 0;
  try {
    const response = await scheduleText(request(createWallTextScheduleRequest(selection(["youtube"]))));
    const result = await response.json();
    assert.equal(response.status, 409);
    assert.equal(result.ok, false);
    assert.equal(result.code, "provider_permission_missing");
    assert.equal(continuations.length, 0);
  } finally { createFails = false; }
});
