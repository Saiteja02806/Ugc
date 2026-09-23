import assert from "node:assert/strict";
import { mock, test } from "node:test";

let completed = [];
let active = [];
let dispatches = 0;
let dispatchFails = false;
const now = Date.now();
const connection = { id: "channel", connectedAt: new Date(now - 86400000).toISOString(), status: "connected", platform: "youtube" };
const data = { accounts: [{ connectionId: "channel", lastSyncedAt: new Date(now).toISOString(), videos: [{ viewCount: 0 }] }] };
mock.module("../jobs/background-jobs.ts", { namedExports: {
  listBackgroundJobsForUser: async (params) => {
    assert.equal(params.userId, "owner");
    assert.equal(params.projectId, "youtube_channel:current");
    return params.completedOnly ? completed : active;
  },
} });
mock.module("../jobs/background-job-contract.ts", { namedExports: { getPublicBackgroundJob: (job) => job } });
mock.module("../social/oauth.ts", { namedExports: { listSocialConnections: async () => [connection] } });
mock.module("./jobs.ts", { namedExports: { enqueueAnalyticsSyncJob: async () => {
  dispatches++;
  if (dispatchFails) throw new Error("Queue offline");
  return { id: "refresh", status: "queued" };
} } });
const { readOrRefreshSocialAnalytics } = await import("./social-snapshot.ts");
const params = { userId: "owner", operation: "youtube_channel", force: false };

test("fresh durable snapshot bypasses queue and provider", async () => {
  completed = [{ completedAt: new Date(now).toISOString(), output: data }];
  assert.deepEqual(await readOrRefreshSocialAnalytics(params), { ok: true, data });
  assert.equal(dispatches, 0);
});
test("stale data returns alongside one refresh job", async () => {
  completed = [{ completedAt: new Date(now - 600000).toISOString(), output: data }];
  const result = await readOrRefreshSocialAnalytics(params);
  assert.deepEqual(result.data, data);
  assert.equal(result.jobId, "refresh");
  assert.equal(dispatches, 1);
});
test("repeated refreshes reuse active work", async () => {
  active = [{ id: "already-running", status: "processing", createdAt: new Date(now).toISOString() }];
  assert.equal((await readOrRefreshSocialAnalytics({ ...params, force: true })).jobId, "already-running");
  assert.equal(dispatches, 1);
});
test("queue outage still serves saved analytics", async () => {
  active = [];
  dispatchFails = true;
  const result = await readOrRefreshSocialAnalytics(params);
  assert.deepEqual(result.data, data);
  assert.match(result.warning, /Saved analytics/);
});
test("first load without a snapshot reports queue errors honestly", async () => {
  completed = [];
  await assert.rejects(readOrRefreshSocialAnalytics(params), /Queue offline/);
});
