import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as scheduleTime from "../lib/scheduling/schedule-time.ts";
import * as settings from "../lib/scheduling/platform-settings.ts";
import * as requirement from "../lib/scheduling/schedule-target-requirement.ts";
import * as metadata from "../lib/scheduling/schedule-metadata.ts";
import * as errors from "../lib/scheduling/errors.ts";
import * as social from "../lib/social/types.ts";
import * as handoff from "../lib/scheduling/target-scheduling.ts";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { source: { kind: "media_asset", id: id(1) }, targets: [{ connectionId: id(2), platform: "instagram", settings: { shareToFeed: true } }],
  caption: "Exact post", title: "Talking head + demo", timezone: "UTC", scheduledFor: "2030-10-14T12:00:00Z", idempotencyKey: `explore:${id(3)}`, metadata: { mediaMode: "single_video" } };
function fixture(options = {}) {
  let schedule = options.existing ?? null, commitHash = null;
  const events = [];
  const database = {
    getScheduledPostByIdempotency: async () => schedule,
    getSchedulableMediaAsset: async () => { events.push("source"); return { id: id(1), status: "ready", collection: "video", source_type: "upload", project_id: "explore", title: input.title }; },
    getConnectedSocialConnection: async () => { events.push("account"); return { id: id(2), platform: "instagram", status: "connected", revoked_at: null, expires_at: null, scopes: [] }; },
    insertDirectScheduledPost: async ({ post, targets, requestHash, queueName }) => {
      events.push("atomic-commit"); assert.equal(queueName, "publish-test"); commitHash = requestHash;
      schedule = { id: id(4), status: post.status, mediaAssetId: post.media_asset_id, idempotencyKey: post.idempotency_key,
        caption: post.caption, title: post.title, timezone: post.timezone, scheduledFor: post.scheduled_for, projectId: post.project_id,
        metadata: { ...post.metadata, scheduleCreateRequestHash: requestHash }, targets: targets.map(target => ({ id: id(5), socialConnectionId: target.social_connection_id,
          platform: target.platform, settings: target.settings, publishJobId: id(6), scheduledFor: post.scheduled_for, status: "scheduling" })) };
      if (options.crashAfterCommit) throw new Error("Lost transaction reply");
      return { created: true, post: { id: schedule.id }, targetRows: [] };
    },
    getScheduledPostForUser: async () => schedule,
    markScheduleTargetScheduler: async () => { events.push("scheduled-target"); schedule.targets[0].status = "scheduled"; },
    markScheduleTargetSchedulerFallback: async () => { events.push("fallback-target"); if (options.projectionUnavailable) throw new Error("DB projection unavailable"); schedule.targets[0].status = "scheduled"; },
    markScheduledPostStatus: async ({ status }) => { events.push("post-status"); schedule.status = status; },
  };
  const imports = { "node:crypto": { createHash }, "@/lib/scheduling/schedule-time": scheduleTime, "@/lib/scheduling/platform-settings": settings,
    "@/lib/scheduling/errors": errors, "@/lib/scheduling/schedule-target-requirement": requirement, "@/lib/scheduling/schedule-metadata": metadata,
    "@/lib/social/types": social, "@/lib/scheduling/target-scheduling": handoff,
    "@/lib/scheduling/social-connection-policy": { getConnectionPublishingBlock: () => null },
    "@/lib/billing/free-trial": { assertFreeTrialInstagramSchedulingAccess: async () => {}, FreeTrialAccessError: class extends Error {} },
    "@/lib/queues/job-queue": { getQueueNameForJobType: () => "publish-test" },
    "@/lib/jobs/background-jobs": { createBackgroundJob: async () => { throw new Error("Must reuse atomically attached publishing job"); } },
    "@/lib/scheduling/social-scheduler": { createSocialPublishSchedule: async ({ jobId, targetId }) => {
      events.push("provider"); assert.equal(jobId, id(6)); assert.equal(targetId, id(5));
      if (options.providerUnavailable) throw new Error("Provider unavailable"); return { name: "existing-task", arn: "existing-arn" };
    }, deleteSocialPublishSchedule: async () => {} },
    "@/lib/scheduling/db": new Proxy(database, { get(target, name) { return target[name] ?? (() => { throw new Error(`Unexpected split write: ${String(name)}`); }); } }),
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/scheduling/service.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Error, console: { error() {}, warn() {} }, process: { env: {} }, require: name => imports[name] ?? {} });
  return { events, schedule: () => schedule, hash: () => commitHash, create: value => exports.createUserSchedule({ userId: "owner-a", input: value }) };
}
test("direct schedule commits once and hands off exact durable job/target IDs without split inserts", async () => {
  const h = fixture(); const result = await h.create(input);
  assert.equal(result.created, true); assert.equal(result.schedule.status, "scheduled"); assert.equal(result.schedule.targets[0].publishJobId, id(6));
  assert.equal(h.events.filter(event => event === "atomic-commit").length, 1); assert.equal(h.events.filter(event => event === "provider").length, 1);
});
test("lost committed reply resumes exact unresolved target and job after original time has elapsed", async t => {
  const h = fixture({ crashAfterCommit: true }); await assert.rejects(h.create(input), /Lost transaction reply/);
  assert.equal(h.schedule().targets.length, 1);
  t.mock.method(Date, "now", () => Date.parse("2031-10-14T12:00:00Z"));
  const result = await h.create(input); assert.equal(result.created, false); assert.equal(result.schedule.status, "scheduled");
  assert.equal(h.events.filter(event => event === "atomic-commit").length, 1); assert.equal(h.events.filter(event => event === "provider").length, 1);
});
test("changed confirmation conflicts while terminal/cancelled replay cannot dispatch again", async () => {
  const h = fixture(); await h.create(input);
  await assert.rejects(h.create({ ...input, caption: "Changed" }), error => error.code === "schedule_idempotency_conflict");
  h.schedule().status = "cancelled"; h.schedule().targets[0].status = "cancelled";
  const before = h.events.length; assert.equal((await h.create(input)).schedule.status, "cancelled"); assert.equal(h.events.length, before);
});
test("legacy targetless parent is explicit incomplete review and cannot invent destinations", async () => {
  const h = fixture({ existing: { id: id(4), status: "scheduling", targets: [], metadata: {} } });
  await assert.rejects(h.create(input), error => error.status === 409 && error.code === "schedule_creation_incomplete");
  assert.deepEqual(h.events, []);
});
test("provider outage retains durable fallback; projection outage retains recoverable scheduling state", async () => {
  const fallback = fixture({ providerUnavailable: true }); assert.equal((await fallback.create(input)).schedule.status, "scheduled");
  const unconfirmed = fixture({ providerUnavailable: true, projectionUnavailable: true }); assert.equal((await unconfirmed.create(input)).schedule.status, "scheduling");
  assert.equal(unconfirmed.schedule().targets[0].publishJobId, id(6));
});
test("default-time replay keeps the first accepted slot instead of hashing a new clock", async t => {
  t.mock.method(Date, "now", () => Date.parse("2030-10-14T11:00:00Z"));
  const h = fixture(); const automatic = { ...input, useDefaultScheduleTime: true };
  const first = await h.create(automatic), time = first.schedule.scheduledFor;
  t.mock.method(Date, "now", () => Date.parse("2030-10-14T11:30:00Z"));
  const replay = await h.create(automatic); assert.equal(replay.created, false); assert.equal(replay.schedule.scheduledFor, time);
  assert.equal(h.events.filter(event => event === "atomic-commit").length, 1);
});
test("clients cannot supply an immutable server creation hash", async () => {
  const h = fixture(); await assert.rejects(h.create({ ...input, metadata: { ...input.metadata, scheduleCreateRequestHash: "a".repeat(64) } }),
    error => error.status === 409 && error.code === "explore_schedule_contract_required");
  assert.deepEqual(h.events, []);
});
