import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { readCoveredBackgroundJob, ACTIVE_JOB_COVERAGE_MAX_AGE_MS } from "../lib/jobs/background-job-polling-policy.ts";

const time = Date.now();
const job = (id = "one", offset = 0, status = "processing") => ({ id, updatedAt: new Date(time + offset).toISOString(), status, output: null });
const key = ["background-jobs", "alice", "active", "hook"];
function setup(jobs = [job()], queryKey = key, enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(queryKey, jobs, { updatedAt: time });
  const observer = new QueryObserver(client, { queryKey, queryFn: async () => jobs, enabled, staleTime: Infinity });
  const unsubscribe = observer.subscribe(() => {});
  return { client, observer, close: () => { unsubscribe(); client.clear(); } };
}
const covered = (client, options = {}) => readCoveredBackgroundJob(client, { ownerId: "alice", jobId: "one", now: time + 5_000, ...options });

test("reuses matching full receipt from a fresh observed list", () => {
  const s = setup();
  try { assert.equal(covered(s.client).id, "one"); } finally { s.close(); }
});

test("never infers completion for missing, filtered or limited list entries", () => {
  const s = setup(Array.from({ length: 100 }, (_, n) => job(`other-${n}`)));
  try { assert.equal(covered(s.client), undefined); } finally { s.close(); }
});

test("account keys isolate receipts even when IDs coincide", () => {
  const s = setup([job()], ["background-jobs", "bob", "active"]);
  try { assert.equal(covered(s.client), undefined); assert.equal(covered(s.client, { ownerId: undefined }), undefined); } finally { s.close(); }
});

test("disabled or unmounted list observers cannot suppress recovery", () => {
  const s = setup([job()], key, false);
  try {
    assert.equal(covered(s.client), undefined);
    s.observer.setOptions({ queryKey: key, enabled: true, staleTime: Infinity });
    assert.equal(covered(s.client).id, "one");
    s.observer.destroy();
    assert.equal(covered(s.client), undefined);
  } finally { s.close(); }
});

test("expired and future list timestamps fall back to independent reads", () => {
  const s = setup();
  try {
    assert.equal(covered(s.client, { now: time + ACTIVE_JOB_COVERAGE_MAX_AGE_MS + 1 }), undefined);
    assert.equal(covered(s.client, { now: time - 1 }), undefined);
  } finally { s.close(); }
});

test("list read failure with retained data immediately removes coverage", async () => {
  const s = setup();
  try {
    await assert.rejects(s.client.fetchQuery({ queryKey: key, queryFn: async () => { throw new Error("offline"); }, staleTime: 0 }));
    assert.ok(s.client.getQueryData(key));
    assert.equal(covered(s.client), undefined);
  } finally { s.close(); }
});

test("explicit list and detail invalidation bypass cache coverage", async () => {
  const s = setup();
  try {
    assert.equal(covered(s.client, { invalidated: true }), undefined);
    await s.client.invalidateQueries({ queryKey: key, refetchType: "none" });
    assert.equal(covered(s.client), undefined);
  } finally { s.close(); }
});

test("list retry failure counters disable retained success coverage before retries finish", () => {
  const s = setup();
  try {
    // TanStack retains success data while a failed refetch waits to retry.
    s.client.getQueryCache().find({ queryKey: key }).setState({ fetchStatus: "fetching", fetchFailureCount: 1 });
    assert.equal(covered(s.client), undefined);
  } finally { s.close(); }
});

test("mutation/new detail snapshots cannot regress to older list receipts", () => {
  const s = setup();
  try {
    assert.equal(covered(s.client, { currentJob: job("one", 1, "completed") }), undefined);
    assert.equal(covered(s.client, { currentJob: { ...job(), updatedAt: "unknown" } }), undefined);
  } finally { s.close(); }
});

test("equal timestamps with identical complete payload can reuse the receipt", () => {
  const s = setup();
  try { assert.deepEqual(covered(s.client, { currentJob: { ...job() } }), job()); } finally { s.close(); }
});

for (const [field, change] of [
  ["status", { status: "completed" }],
  ["progress", { progress: 70 }],
  ["stage", { stage: "collecting" }],
  ["output", { output: { url: "collected" } }],
]) {
  test(`equal timestamps with differing ${field} require a detail read in either direction`, () => {
    const original = job();
    const changed = { ...original, ...change };
    const s = setup([original]);
    try {
      assert.equal(covered(s.client, { currentJob: changed }), undefined);
      s.client.setQueryData(key, [changed], { updatedAt: time });
      assert.equal(covered(s.client, { currentJob: original }), undefined);
    } finally { s.close(); }
  });
}

test("microsecond timestamp truncation cannot hide progress or replace newer output", () => {
  const timestamp = "2026-10-23T12:00:00.123";
  const earlier = { ...job(), updatedAt: `${timestamp}001Z`, progress: 20 };
  const later = { ...job(), updatedAt: `${timestamp}999Z`, progress: 80, output: { url: "collected" } };
  assert.equal(Date.parse(earlier.updatedAt), Date.parse(later.updatedAt));
  const s = setup([earlier]);
  try {
    assert.equal(covered(s.client, { currentJob: later }), undefined);
    s.client.setQueryData(key, [later], { updatedAt: time });
    assert.equal(covered(s.client, { currentJob: earlier }), undefined);
  } finally { s.close(); }
});

test("newest matching receipt wins across global and scoped lists", () => {
  const s = setup();
  const globalKey = ["background-jobs", "alice", "active"];
  s.client.setQueryData(globalKey, [job("one", 1)], { updatedAt: time });
  const observer = new QueryObserver(s.client, { queryKey: globalKey, enabled: true, staleTime: Infinity });
  const stop = observer.subscribe(() => {});
  try { assert.equal(covered(s.client).updatedAt, job("one", 1).updatedAt); } finally { stop(); s.close(); }
});

test("slow list refresh never hides terminal receipt after disappearance", async () => {
  const s = setup();
  let release;
  const pending = s.client.fetchQuery({ queryKey: key, staleTime: 0, queryFn: () => new Promise(resolve => { release = resolve; }) });
  try {
    assert.equal(covered(s.client).status, "processing");
    release([]);
    await pending;
    assert.equal(covered(s.client), undefined);
    // The detail query now performs its normal GET; output collection/retry UI
    // receives the unchanged server receipt rather than a synthetic terminal job.
    const receipt = { ...job("one", 20, "completed"), output: { url: "saved-output" } };
    const result = await s.client.fetchQuery({ queryKey: ["background-jobs", "alice", "one"], queryFn: async () => covered(s.client) ?? receipt });
    assert.equal(result.output.url, "saved-output");
  } finally { s.close(); }
});

test("same three-job, twelve-cycle scenario: 48 requests becomes 12, then 3 terminal GETs", async () => {
  async function scenario(reuse) {
    const s = setup([job("a"), job("b"), job("c")]);
    let listReads = 0;
    let detailReads = 0;
    try {
    for (let tick = 0; tick < 12; tick++) {
      const now = time + tick * 5_000;
      listReads++;
      s.client.setQueryData(key, [job("a", tick), job("b", tick), job("c", tick)], { updatedAt: now });
      for (const id of ["a", "b", "c"]) {
        await s.client.fetchQuery({ queryKey: ["background-jobs", "alice", id], staleTime: 0, queryFn: async () => {
          const receipt = reuse && covered(s.client, { jobId: id, now });
          if (receipt) return receipt;
          detailReads++;
          return job(id, tick);
        } });
      }
    }
    const activeReads = listReads + detailReads;
    s.client.setQueryData(key, [], { updatedAt: time + 60_000 });
    for (const id of ["a", "b", "c"]) {
      await s.client.fetchQuery({ queryKey: ["background-jobs", "alice", id], staleTime: 0, queryFn: async () => {
        const receipt = reuse && covered(s.client, { jobId: id, now: time + 60_000 });
        if (receipt) return receipt;
        detailReads++;
        return { ...job(id, 100, "completed"), output: { url: `saved-${id}` } };
      } });
      assert.equal(s.client.getQueryData(["background-jobs", "alice", id]).output.url, `saved-${id}`);
    }
    return { activeReads, totalReads: listReads + detailReads };
    } finally { s.close(); }
  }
  assert.deepEqual(await scenario(false), { activeReads: 48, totalReads: 51 });
  assert.deepEqual(await scenario(true), { activeReads: 12, totalReads: 15 });
});
