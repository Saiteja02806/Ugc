import assert from "node:assert/strict";
import test from "node:test";
import { parseExplorePendingSchedule, stableExploreScheduleJson, explorePreparationDecision } from "./pending-schedule-contract.ts";
import { resolveRenderFinalizationScheduleTime } from "../scheduling/schedule-time.ts";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const draft = { version: 1, kind: "hook", sourceAssetId: id(1), demoAssetId: id(2), demoAudioAssetId: null,
  demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: null,
  composition: { version: 1, sourceEditing: null, demoEditing: null, sourceAudioAssetId: null, sourceAudioPlayback: "once" } };
const input = () => ({ version: 1, requestKey: id(10), draft: structuredClone(draft), schedule: {
  caption: "Exact caption", timezone: "Asia/Calcutta", scheduledFor: "2030-01-01T10:00:00.000Z",
  targets: [{ connectionId: id(3), platform: "instagram", settings: { coverTimestampMs: 1000 } }],
} });
test("preserves immutable clip composition, exact caption, account settings and publish time", () => {
  const parsed = parseExplorePendingSchedule(input());
  assert.deepEqual(parsed, input());
});
test("rejects arbitrary schedule source/metadata/idempotency overrides and caption-only assets", () => {
  for (const name of ["source", "metadata", "idempotencyKey", "plannedTargets"]) {
    const value = input(); value.schedule[name] = {};
    assert.throws(() => parseExplorePendingSchedule(value));
  }
  const caption = input(); caption.draft.captionPreview = true; caption.draft.subtitles = { language: "en", style: "clean", version: 2 };
  assert.throws(() => parseExplorePendingSchedule(caption), /review captions/i);
});
test("rejects missing accounts, invalid versions and oversized fields", () => {
  for (const mutate of [v => v.schedule.targets = [], v => v.version = 2, v => v.requestKey = "external",
    v => v.schedule.caption = "x".repeat(5001), v => v.schedule.timezone = "x".repeat(101), v => v.extra = "bad"]) {
    const value = input(); mutate(value); assert.throws(() => parseExplorePendingSchedule(value));
  }
});
test("request identity ignores object key ordering while preserving exact values and target order", () => {
  assert.equal(stableExploreScheduleJson({ b: { d: 2, c: 1 }, a: 3 }), stableExploreScheduleJson({ a: 3, b: { c: 1, d: 2 } }));
  assert.notEqual(stableExploreScheduleJson([1, 2]), stableExploreScheduleJson([2, 1]));
  const changed = input(); changed.schedule.caption += " changed";
  assert.notEqual(stableExploreScheduleJson(input()), stableExploreScheduleJson(changed));
});
const now = Date.parse("2030-01-01T10:00:00Z");
const policy = changes => explorePreparationDecision({ receiptCompleted: false, receiptUncertain: false, jobStatus: "queued",
  scheduleStatus: "draft", hasTargets: false, deadlineAt: new Date(now + 300_000).toISOString(), now, ...changes });
test("raw sources wait; cancellation and uncertain provider results never publish", () => {
  assert.equal(policy({}), "wait");
  assert.equal(policy({ receiptCompleted: true }), "finalize");
  assert.equal(policy({ scheduleStatus: "cancelled", receiptCompleted: true }), "cancelled");
  assert.equal(policy({ receiptUncertain: true }), "failed");
  assert.equal(policy({ jobStatus: "failed" }), "failed");
});
test("verified stored output recovers when post-output callback exhausted worker retries", () => {
  assert.equal(policy({ receiptCompleted: true, jobStatus: "failed" }), "finalize");
});
test("late preparation fails and never silently moves the selected publish time", () => {
  assert.equal(policy({ receiptCompleted: true, deadlineAt: new Date(now).toISOString() }), "deadline_expired");
  assert.equal(policy({ deadlineAt: "invalid" }), "deadline_expired");
});
test("already scheduled targets survive duplicate callbacks and later render-job failures", () => {
  assert.equal(policy({ scheduleStatus: "scheduled", hasTargets: true, jobStatus: "failed", deadlineAt: new Date(now - 1).toISOString() }), "already_scheduled");
});
test("accepted five-minute time stays exact when rendering completes thirty seconds later", () => {
  const scheduledFor = new Date(now + 300_000).toISOString();
  assert.deepEqual(resolveRenderFinalizationScheduleTime({ now: now + 30_000, preferredScheduledFor: scheduledFor,
    deadlineAt: scheduledFor, minimumTaskCreationBufferSeconds: 30 }), {
    action: "schedule", scheduledFor, deadlineAt: scheduledFor, usedGraceWindow: false,
  });
});
