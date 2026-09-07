import assert from "node:assert/strict";
import test from "node:test";
import { scheduleReactionWithDependencies } from "./reaction-scheduling-flow.ts";
import type { ScheduledPost, ScheduledPostTarget, ScheduleCreateInput } from "../scheduling/types.ts";

function schedule(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
  return {
    id: "draft", mediaAssetId: "reaction-mp4", metadata: {}, status: "draft", targets: [],
    cancelledAt: null, caption: "", createdAt: "2026-09-07T10:14:00Z", idempotencyKey: "reaction:assignment",
    lastErrorCode: null, libraryItemId: null, projectId: null, publishedAt: null, scheduledFor: null,
    sourceKind: "media_asset", timezone: "Asia/Kolkata", title: "Reaction", updatedAt: "original-version",
    ...overrides,
  };
}
const input: ScheduleCreateInput = {
  source: { id: "reaction-mp4", kind: "media_asset" }, targets: [],
  plannedTargets: [{ connectionId: "instagram-account", settings: { shareToFeed: true } }],
  caption: "New caption", timezone: "Asia/Kolkata", scheduledDate: "2026-09-08", scheduledTime: "16:00",
};
const params = { input, connectionIds: ["instagram-account"], userId: "owner" };
function target(status: ScheduledPostTarget["status"]): ScheduledPostTarget {
  return { socialConnectionId: "instagram-account", status } as ScheduledPostTarget;
}
const published = schedule({ status: "scheduled", scheduledFor: "2026-09-08T10:30:00Z", targets: [target("scheduled")] });

test("a ready Reaction draft is submitted to the scheduler before success is returned", async () => {
  const calls: string[] = [];
  const result = await scheduleReactionWithDependencies(params, {
    create: async (value) => { assert.deepEqual(value.input, input); calls.push("create"); return { created: true, schedule: schedule() }; },
    update: async () => { throw new Error("Fresh draft should not be rewritten"); },
    publish: async (value) => { assert.deepEqual(value.input.connectionIds, params.connectionIds); assert.equal(value.postId, "draft"); calls.push("publish"); return { created: true, schedule: published }; },
  });
  assert.deepEqual(calls, ["create", "publish"]);
  assert.equal(result.schedule.status, "scheduled");
});

test("recovers the account's old draft with the newly chosen caption, account and time", async () => {
  const calls: string[] = [];
  await scheduleReactionWithDependencies(params, {
    create: async () => ({ created: false, schedule: schedule() }),
    update: async (value) => {
      assert.deepEqual(value.input, { ...input, expectedUpdatedAt: "original-version" });
      calls.push("update"); return schedule();
    },
    publish: async () => { calls.push("publish"); return { created: true, schedule: published }; },
  });
  assert.deepEqual(calls, ["update", "publish"]);
});

test("never reports success for an undated draft or failed publishing target", async () => {
  for (const bad of [schedule(), schedule({ status: "failed", scheduledFor: published.scheduledFor, targets: [target("failed")] })]) {
    await assert.rejects(scheduleReactionWithDependencies(params, {
      create: async () => ({ created: true, schedule: schedule() }),
      update: async () => schedule(),
      publish: async () => ({ created: false, schedule: bad }),
    }), /platform scheduling needs attention/);
  }
});

test("repeated successful requests reuse the existing scheduled post without editing it", async () => {
  const result = await scheduleReactionWithDependencies(params, {
    create: async () => ({ created: false, schedule: published }),
    update: async () => { throw new Error("Already scheduled post must not be changed"); },
    publish: async () => ({ created: false, schedule: published }),
  });
  assert.equal(result.created, false);
  assert.equal(result.schedule, published);
});

test("a draft update conflict prevents publishing stale details", async () => {
  await assert.rejects(scheduleReactionWithDependencies(params, {
    create: async () => ({ created: false, schedule: schedule() }),
    update: async () => { throw new Error("version conflict"); },
    publish: async () => { assert.fail("Must not publish after an edit conflict"); },
  }), /version conflict/);
});
