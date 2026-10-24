import assert from "node:assert/strict";
import test from "node:test";
import type { BackgroundJobRecord } from "./background-jobs.ts";
import { recoverStaleBackgroundJob } from "./queued-job-recovery.ts";

test("healthy backlog never spends attempts, redispatches or terminalizes an unstarted job", async () => {
  const job = { id: "queued", status: "queued", attemptCount: 2, maxAttempts: 3 } as BackgroundJobRecord;
  const unexpected = async () => { throw new Error("must not recover existing queue delivery"); };
  assert.deepEqual(await recoverStaleBackgroundJob(job, { taskExists: async () => true, recoverQueued: unexpected, recoverRunning: unexpected }), { waiting: true, recovered: null });
});

test("missing delivery uses the compare-and-set recovery, and lookup errors fail closed", async () => {
  const job = { id: "queued", status: "queued" } as BackgroundJobRecord;
  let calls = 0;
  const dependencies = { taskExists: async () => false, recoverQueued: async () => { calls++; return null; }, recoverRunning: async () => { throw new Error("wrong recovery path"); } };
  assert.deepEqual(await recoverStaleBackgroundJob(job, dependencies), { waiting: false, recovered: null });
  assert.equal(calls, 1);
  await assert.rejects(recoverStaleBackgroundJob(job, { ...dependencies, taskExists: async () => { throw new Error("403"); } }), /403/);
  assert.equal(calls, 1);
});

test("stale running jobs retain lease recovery and do not depend on queue lookup", async () => {
  const job = { id: "running", status: "processing" } as BackgroundJobRecord;
  const unexpected = async () => { throw new Error("unexpected lookup"); };
  assert.deepEqual(await recoverStaleBackgroundJob(job, { taskExists: unexpected, recoverQueued: unexpected, recoverRunning: async (id) => { assert.equal(id, job.id); return job; } }), { waiting: false, recovered: job });
});
