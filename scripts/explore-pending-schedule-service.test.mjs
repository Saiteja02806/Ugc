import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as contract from "../lib/explore/pending-schedule-contract.ts";
import { ExploreFinishError, isExploreUuid } from "../worker/src/lib/explore-finishing-contract.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const key = id(10), owner = "owner-a", fingerprint = "b".repeat(64);
const input = { version: 1, requestKey: key, draft: { version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2),
  demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null,
  composition: { version: 1, sourceEditing: null, demoEditing: null, sourceAudioAssetId: null, sourceAudioPlayback: "once" } },
  schedule: { caption: "Exact caption", timezone: "UTC", scheduledFor: "2030-01-01T10:00:00Z", targets: [{ connectionId: id(3), platform: "instagram", settings: { shareToFeed: true } }] } };
class SchedulingError extends Error { constructor(message, status = 400, code = "schedule_error") { super(message); this.status = status; this.code = code; } }
function harness(options = {}) {
  const events = [], receipt = { user_id: owner, request_key: key, fingerprint, job_id: id(11), output_asset_id: id(12),
    status: options.completed ? "completed" : "queued", draft: input.draft };
  let binding = options.existing ? { user_id: owner, request_key: key, request_hash: createHash("sha256").update(contract.stableExploreScheduleJson(contract.parseExplorePendingSchedule(input))).digest("hex"),
    schedule_id: id(20), state: "pending", deadline_at: options.expired ? "2000-01-01T00:00:00Z" : input.schedule.scheduledFor } : null;
  let schedule = { id: id(20), userId: owner, status: options.cancelled ? "cancelled" : "draft", mediaAssetId: id(1), targets: [],
    metadata: { exploreFinishRequestKey: key, exploreFinishFingerprint: fingerprint, exploreFinishOutputAssetId: id(12), exploreFinishStatus: "preparing" } };
  if (options.badBinding) schedule.metadata.exploreFinishFingerprint = "c".repeat(64);
  const storage = { read: async (uid, requestKey) => { assert.equal(uid, owner); assert.equal(requestKey, key); events.push("read-binding"); return binding; },
    reserve: async args => { events.push("reserve"); assert.deepEqual(JSON.parse(JSON.stringify(args.draft)), input.draft);
      binding = { user_id: owner, request_key: key, request_hash: args.requestHash, schedule_id: id(20), state: "pending", deadline_at: input.schedule.scheduledFor }; return binding; },
    claim: async () => { events.push("claim"); return options.leaseBusy ? null : binding; },
    finish: async (_binding, _token, state, code, message) => { events.push(`outbox:${state}`); binding.state = state; binding.last_error_code = code; binding.last_error_message = message; },
    fail: async (_binding, _token, code, message) => { events.push("failure-transaction");
      if (options.cancelDuringFailure) schedule.status = "cancelled";
      binding.state = schedule.status === "cancelled" ? "cancelled" : "failed";
      if (binding.state === "failed") { schedule.status = "failed"; binding.last_error_code = code; binding.last_error_message = message; }
      return binding; },
    due: async () => binding ? [binding] : [] };
  const imports = {
    "server-only": {}, "node:crypto": { createHash, randomUUID },
    "@/worker/src/lib/explore-finishing-contract": { ExploreFinishError, isExploreUuid },
    "./pending-schedule-contract": contract,
    "./pending-schedule-store": { ExplorePendingScheduleStore: class { constructor() { return storage; } } },
    "./workflow-finishing-store": { ExploreFinishingRequestStore: class { async read() { return receipt; } } },
    "./workflow-finishing-service": { fingerprintExploreFinish: () => fingerprint,
      videoFinishingRuntime: () => ({ enabled: true, configured: true, editing: true, framing: true, subtitles: true }),
      getWorkflowFinishingForOwner: async () => ({ status: options.jobStatus ?? "queued", outcome: options.uncertain ? "uncertain" : options.completed ? "completed" : "pending", message: "Preparation failed" }) },
    "@/lib/jobs/background-jobs": { getBackgroundJobForUser: async () => ({ id: receipt.job_id, status: "queued" }) },
    "@/lib/jobs/background-job-service": { dispatchQueuedBackgroundJobForRecovery: async () => { events.push("dispatch"); } },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async args => { assert.equal(args.userId, owner); assert.equal(args.assetId, receipt.output_asset_id); events.push("asset"); return { id: receipt.output_asset_id }; } },
    "@/lib/scheduling/explore-finished-video": { isVerifiedExploreFinishedVideo: async () => { events.push("verify-output"); return options.unverified ? false : true; } },
    "@/lib/scheduling/db": { getScheduledPostForUser: async () => schedule,
      markScheduledPostStatus: async args => { schedule.status = args.status; events.push(`post:${args.status}`); },
      updateScheduledPostRenderState: async args => { events.push("attach/state"); schedule.metadata = { ...schedule.metadata, ...args.metadata }; if (args.mediaAssetId) schedule.mediaAssetId = args.mediaAssetId; return schedule; } },
    "@/lib/scheduling/service": { SchedulingRequestError: SchedulingError,
      prepareExplorePendingSchedule: async args => { events.push("preflight"); assert.equal(args.input.source.id, input.draft.sourceAssetId); assert.deepEqual(JSON.parse(JSON.stringify(args.input.targets)), input.schedule.targets);
        return { ...input.schedule, title: "Explore video", metadata: { plannedScheduledFor: input.schedule.scheduledFor } }; },
      scheduleRenderedPost: async args => { events.push("schedule"); assert.equal(args.leadPolicy, "render_finalization"); assert.equal(schedule.mediaAssetId, receipt.output_asset_id);
        if (options.schedulerUnconfirmed) throw new ExploreFinishError("Unconfirmed", 503);
        schedule.status = "scheduled"; schedule.targets = [{ id: id(30), status: "scheduled" }]; return { schedule }; },
      reconcileExploreScheduleTargets: async () => schedule },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/explore/pending-schedule-service.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, process: { env: { EXPLORE_PENDING_SCHEDULING_ENABLED: options.disabled ? "false" : "true" } }, Date });
  return { service: exports, events, receipt, binding: () => binding, schedule: () => schedule };
}
test("acknowledgement commits exact snapshot without waiting for queue, rendering or platform scheduling", async () => {
  const h = harness(), accepted = await h.service.reserveExplorePendingSchedule(owner, input, {});
  assert.equal(accepted.created, true); assert.equal(accepted.result.preparation.state, "preparing");
  assert.deepEqual(h.events.filter(event => ["preflight", "reserve", "dispatch", "schedule"].includes(event)), ["preflight", "reserve"]);
  assert.equal(accepted.result.schedule.mediaAssetId, id(1)); assert.equal(accepted.result.preparation.mediaAssetId, null);
});
test("status reads never dispatch or publish and preserve owner-bound identity", async () => {
  const h = harness({ existing: true }); await h.service.getExplorePendingSchedule(owner, key);
  assert.ok(!h.events.includes("dispatch") && !h.events.includes("schedule") && !h.events.includes("claim"));
});
test("matching POST replay recovers before creation gates and altered caption conflicts", async () => {
  const h = harness({ existing: true, disabled: true }); assert.equal((await h.service.reserveExplorePendingSchedule(owner, input, {})).created, false);
  const different = structuredClone(input); different.schedule.caption = "Changed";
  await assert.rejects(h.service.reserveExplorePendingSchedule(owner, different, {}), error => error.code === "explore_schedule_conflict");
  assert.ok(!h.events.includes("preflight") && !h.events.includes("reserve"));
});
test("a pending job is independently dispatched by recovery after the browser closes", async () => {
  const h = harness({ existing: true }); await h.service.reconcileExplorePendingSchedule(owner, key);
  assert.ok(h.events.includes("dispatch")); assert.equal(h.binding().state, "pending"); assert.ok(!h.events.includes("schedule"));
});
test("verified exact output attaches before platform scheduling, including failed post-output callbacks", async () => {
  const h = harness({ existing: true, completed: true, jobStatus: "failed" }); await h.service.reconcileExplorePendingSchedule(owner, key);
  assert.ok(h.events.indexOf("verify-output") < h.events.indexOf("schedule")); assert.equal(h.binding().state, "scheduled"); assert.equal(h.schedule().mediaAssetId, id(12));
});
test("cancelled, expired, uncertain and unverified outputs never create publishing targets", async () => {
  for (const options of [{ cancelled: true, completed: true }, { expired: true, completed: true }, { uncertain: true }, { completed: true, unverified: true }, { badBinding: true }]) {
    const h = harness({ existing: true, ...options }); await h.service.reconcileExplorePendingSchedule(owner, key);
    assert.ok(!h.events.includes("schedule")); assert.ok(!h.events.includes("dispatch"));
    assert.equal(h.binding().state, options.cancelled ? "cancelled" : "failed");
  }
});
test("duplicate callback lease and unconfirmed scheduling keep the same durable request", async () => {
  const busy = harness({ existing: true, completed: true, leaseBusy: true }); await busy.service.reconcileExplorePendingSchedule(owner, key); assert.ok(!busy.events.includes("schedule"));
  const h = harness({ existing: true, completed: true, schedulerUnconfirmed: true });
  await assert.rejects(h.service.reconcileExplorePendingSchedule(owner, key)); assert.equal(h.binding().state, "pending"); assert.equal(h.binding().last_error_code, "explore_reconciliation_retry");
});

test("cancellation while reporting a render failure remains cancelled", async () => {
  const h = harness({ existing: true, expired: true, cancelDuringFailure: true });
  await h.service.reconcileExplorePendingSchedule(owner, key);
  assert.equal(h.binding().state, "cancelled"); assert.equal(h.schedule().status, "cancelled");
  assert.ok(!h.events.includes("schedule"));
});

test("disabling new acceptance still recovers schedules committed before the flag changed", async () => {
  const h = harness({ existing: true, disabled: true });
  const recovery = await h.service.reconcileDueExplorePendingSchedules();
  assert.equal(recovery.inspected, 1); assert.ok(h.events.includes("dispatch"));
});
