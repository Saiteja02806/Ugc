import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { QueryClient, QueryObserver, environmentManager, onlineManager, timeoutManager } from "@tanstack/query-core";
import * as policy from "../lib/jobs/background-job-polling-policy.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const id = "00000000-0000-4000-8000-000000000001";
const assetId = "00000000-0000-4000-8000-000000000002";
const completed = () => ({ id, status: "completed", error: null, completedAt: "2026-10-23T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z", output: { mediaAssetId: assetId } });
const source = ts.transpileModule(readFileSync(new URL("../lib/jobs/background-job-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
environmentManager.setIsServer(() => false);
timeoutManager.setTimeoutProvider({
  setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timer.unref?.(); return timer; }, clearTimeout,
  setInterval(fn, ms) { const timer = setInterval(fn, ms); timer.unref?.(); return timer; }, clearInterval,
});
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

function fixture(hook) {
  onlineManager.setOnline(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 1_800_000, refetchOnReconnect: true } } });
  client.mount();
  const state = { owner: "alice", job: completed(), fail: false };
  const reads = [], observers = [], stops = [];
  const exported = {};
  function observe(options) {
    const observer = new QueryObserver(client, options);
    observers.push(observer); stops.push(observer.subscribe(() => {}));
    return observer.getCurrentResult();
  }
  const imports = {
    react: {},
    "@tanstack/react-query": { useQuery: observe, useQueryClient: () => client, useQueries: ({ queries }) => queries.map(observe) },
    "@/contexts/auth-context": { useAuth: () => ({ loading: false, user: { uid: state.owner } }) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, state.owner); return owner; } },
    "@/lib/http/read-deadline": { withReadDeadline },
    "./background-job-polling-policy": policy,
  };
  vm.runInNewContext(source, { exports: exported, Headers, require(name) { assert.ok(name in imports, name); return imports[name]; },
    async fetch(url, init) {
      assert.equal(init.method ?? "GET", "GET");
      reads.push({ url, owner: init.headers.get("Authorization") });
      if (state.fail) throw new Error("Temporary status read failure");
      return Response.json({ ok: true, job: state.job });
    },
  });
  return { state, client, reads,
    mount() { return hook === "single" ? exported.useBackgroundJob(id) : exported.useBackgroundJobs([id])[0]; },
    last: () => observers.at(-1),
    unmount() { stops.pop()?.(); observers.pop()?.destroy(); },
    expire() { client.setQueryData(["background-jobs", state.owner, id], state.job, { updatedAt: Date.now() - policy.COMPLETED_MEDIA_JOB_FRESHNESS_MS - 1_000 }); },
    async reconnect() { onlineManager.setOnline(false); onlineManager.setOnline(true); await settle(); },
    close() { stops.forEach(stop => stop()); client.unmount(); client.clear(); },
  };
}

for (const hook of ["single", "multi"]) {
  test(`${hook}: verified completed media coalesces rapid remount/reconnect, then revalidates after30s`, async () => {
    const h = fixture(hook);
    try {
      h.mount(); await settle();
      assert.equal(h.last().options.staleTime(h.last().getCurrentQuery()), 30_000);
      h.unmount(); h.mount(); await settle(); await h.reconnect();
      assert.equal(h.reads.length, 1);
      h.expire(); await h.reconnect(); assert.equal(h.reads.length, 2);
      h.unmount(); h.expire(); h.mount(); await settle(); assert.equal(h.reads.length, 3);
    } finally { h.close(); }
  });

  test(`${hook}: explicit refresh and invalidation bypass fresh completed cache`, async () => {
    const h = fixture(hook);
    try {
      h.mount(); await settle(); await h.last().refetch(); assert.equal(h.reads.length, 2);
      await h.client.invalidateQueries({ queryKey: ["background-jobs", "alice", id], exact: true });
      assert.equal(h.reads.length, 3);
    } finally { h.close(); }
  });

  for (const [name, patch] of [
    ["failed", { status: "failed" }], ["cancelled", { status: "cancelled" }],
    ["missing output", { output: null }], ["unverified output", { output: { url: "https://example.test/output.mp4" } }],
    ["malformed asset ID", { output: { mediaAssetId: "not-an-id" } }],
    ["malformed completion time", { completedAt: "not-a-time" }],
    ["missing completion time", { completedAt: null }],
    ["inconsistent error", { error: { code: "COLLECTION_PENDING" } }],
  ]) {
    test(`${hook}: ${name} retains mount/reconnect recovery`, async () => {
      const h = fixture(hook);
      try {
        h.state.job = { ...completed(), ...patch };
        h.mount(); await settle(); h.unmount(); h.mount(); await settle();
        assert.equal(h.reads.length, 2);
        await h.reconnect(); assert.equal(h.reads.length, 3);
      } finally { h.close(); }
    });
  }

  test(`${hook}: retained completed data after read error cannot suppress recovery`, async () => {
    const h = fixture(hook);
    try {
      h.mount(); await settle(); h.state.fail = true; await h.last().refetch();
      assert.equal(h.last().getCurrentResult().isError, true);
      assert.equal(h.last().options.staleTime(h.last().getCurrentQuery()), 0);
      h.state.fail = false; h.unmount(); h.mount(); await settle();
      assert.equal(h.reads.length, 3); assert.equal(h.last().getCurrentResult().isError, false);
    } finally { h.close(); }
  });

  test(`${hook}: another owner does not reuse completed cache`, async () => {
    const h = fixture(hook);
    try {
      h.mount(); await settle(); h.unmount(); h.state.owner = "bob"; h.mount(); await settle();
      assert.deepEqual(h.reads.map(read => read.owner), ["Bearer alice", "Bearer bob"]);
    } finally { h.close(); }
  });

  test(`${hook}: same-ID retry receipt becomes stale immediately and completion output recovers`, async () => {
    const h = fixture(hook);
    try {
      h.mount(); await settle();
      h.state.job = { ...completed(), status: "queued", completedAt: null, output: null };
      h.client.setQueryData(["background-jobs", "alice", id], h.state.job);
      assert.equal(h.last().options.staleTime(h.last().getCurrentQuery()), 0);
      await h.reconnect(); assert.equal(h.reads.length, 2);
      h.state.job = completed(); await h.last().refetch();
      assert.equal(h.last().getCurrentResult().data.output.mediaAssetId, assetId);
    } finally { h.close(); }
  });
}

test("in-progress retry failure counter does not grant completed freshness", () => {
  assert.equal(policy.backgroundJobStaleTime({ state: { status: "success", data: completed(), fetchFailureCount: 1 } }), 0);
});
