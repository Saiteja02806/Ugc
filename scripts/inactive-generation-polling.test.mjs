import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { QueryClient, QueriesObserver, QueryObserver, environmentManager, focusManager, onlineManager, timeoutManager } from "@tanstack/query-core";
import { withReadDeadline } from "../lib/http/read-deadline.ts";
import * as pollingPolicy from "../lib/jobs/background-job-polling-policy.ts";

// Evaluate the actual hooks with a minimal state adapter, then execute their
// actual options in the installed TanStack observers (including timers/cache).
const source = ts.transpileModule(readFileSync(new URL("../lib/jobs/background-job-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const intervals = new Map();
let nextTimer = 0;
environmentManager.setIsServer(() => false);
timeoutManager.setTimeoutProvider({
  setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timer.unref?.(); return timer; }, clearTimeout,
  setInterval(fn, ms) { const id = ++nextTimer; intervals.set(id, { fn, ms }); return id; },
  clearInterval(id) { intervals.delete(id); },
});
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const job = (id = "saved-job", status = "running") => ({ id, status, updatedAt: "2026-10-23T00:00:00.000Z", jobType: "image_generation", exploreFormat: "hook", output: status === "completed" ? { mediaAssetId: `${id}-asset` } : null });

function fixture({ transport } = {}) {
  focusManager.setFocused(true); onlineManager.setOnline(true);
  const state = { owner: "owner-a", loading: false, enabled: true, format: "hook", ids: ["saved-job"], activeJobs: [] };
  const reads = [], tokens = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60000 } } });
  client.mount();
  let listObserver, detailObserver, stopList, stopDetails, recovered, dirty;
  const exported = {};
  const imports = {
    react: { useState(initial) { recovered ??= initial; return [recovered, value => { recovered = value; dirty = true; }]; } },
    "@/contexts/auth-context": { useAuth: () => ({ loading: state.loading, user: state.owner ? { uid: state.owner } : null }) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async expected => { tokens.push(expected); assert.equal(expected, state.owner); return `${expected}-token`; } },
    "@/lib/http/read-deadline": { withReadDeadline },
    "./background-job-polling-policy": pollingPolicy,
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useQuery(options) {
        if (!listObserver) { listObserver = new QueryObserver(client, options); stopList = listObserver.subscribe(() => {}); }
        else listObserver.setOptions(options);
        return listObserver.getCurrentResult();
      },
      useQueries({ queries }) {
        if (!detailObserver) { detailObserver = new QueriesObserver(client, queries); stopDetails = detailObserver.subscribe(() => {}); }
        else detailObserver.setQueries(queries);
        return detailObserver.getCurrentResult();
      },
    },
  };
  vm.runInNewContext(source, {
    exports: exported, Headers,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
    async fetch(url, init) {
      assert.equal(init.method ?? "GET", "GET", "Recovery cannot generate, retry or cancel");
      const read = { url, init }; reads.push(read);
      return transport ? transport(read, state) : Response.json(url.startsWith("/api/jobs?") ? { ok: true, jobs: state.activeJobs } : { ok: true, job: job(url.split("/").at(-1)) });
    },
  });
  return {
    state, reads, tokens, client,
    render() {
      let result;
      do { dirty = false; result = exported.useRecoverableWorkflowJobs(state.ids, { enabled: state.enabled, exploreFormat: state.format, jobType: "image_generation" }); } while (dirty);
      return result;
    },
    direct(ids, options) { return exported.useBackgroundJobs(ids, options); },
    readList() { return listObserver.refetch(); },
    async cycle() { for (const timer of [...intervals.values()]) timer.fn(); await settle(); },
    close() { stopList?.(); stopDetails?.(); client.unmount(); client.clear(); },
  };
}

test("actual shared hook reuses fresh active-list receipts, but explicit checking always GETs the detail", async () => {
  const h = fixture();
  try {
    h.state.ids = []; h.state.activeJobs = [job()];
    h.render(); await settle(); h.render(); await settle();
    assert.equal(h.render().queries[0].data.id, "saved-job");
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 0);
    await h.cycle();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 0);
    await h.render().queries[0].refetch();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1);
    await h.render().queries[0].refetch();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 2);
    h.state.enabled = false; h.render(); const before = h.reads.length;
    for (let n = 0; n < 3; n++) await h.cycle();
    assert.equal(h.reads.length, before, "coverage must not restart a disabled observer");
  } finally { h.close(); }
});

test("after covered jobs disappear, the shared hook reads and preserves final detail output", async () => {
  let completed = false;
  const h = fixture({ transport: ({ url }, state) => Response.json(url.includes("?") ? { ok: true, jobs: state.activeJobs } : { ok: true, job: job("saved-job", completed ? "completed" : "running") }) });
  try {
    h.state.ids = []; h.state.activeJobs = [job()];
    h.render(); await settle(); h.render(); await settle();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 0);
    completed = true; h.state.activeJobs = []; await h.readList(); h.render(); await h.cycle();
    assert.equal(h.render().queries[0].data.output.mediaAssetId, "saved-job-asset");
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1);
    await h.cycle();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1, "terminal detail polling stops");
  } finally { h.close(); }
});

test("a failed list refresh removes coverage so the shared hook keeps independent detail recovery", async () => {
  let listFails = false;
  const h = fixture({ transport: ({ url }, state) => url.includes("?")
    ? listFails ? Response.json({ ok: false, error: "Temporary list failure" }, { status: 503 }) : Response.json({ ok: true, jobs: state.activeJobs })
    : Response.json({ ok: true, job: job() }) });
  try {
    h.state.ids = []; h.state.activeJobs = [job()];
    h.render(); await settle(); h.render(); await settle();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 0);
    listFails = true; await h.readList(); h.render(); await h.cycle();
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1);
    assert.equal(h.render().queries[0].data.id, "saved-job");
    assert.match(h.render().recoveryError, /Could not check/);
  } finally { h.close(); }
});

test("inactive panels stop list and detail reads; reactivation recovers completion using the saved ID", async () => {
  let completed = false;
  const h = fixture({ transport: ({ url }) => Response.json(url.startsWith("/api/jobs?") ? { ok: true, jobs: [] } : { ok: true, job: job("saved-job", completed ? "completed" : "running") }) });
  try {
    h.render(); await settle(); assert.equal(h.reads.length, 2);
    await h.cycle(); assert.equal(h.reads.length, 4);
    h.state.enabled = false; h.render(); const before = h.reads.length;
    completed = true;
    for (let i = 0; i < 5; i++) await h.cycle();
    focusManager.setFocused(false); focusManager.setFocused(true);
    onlineManager.setOnline(false); onlineManager.setOnline(true); await settle();
    assert.equal(h.reads.length, before);
    assert.deepEqual(h.state.ids, ["saved-job"]);
    h.state.enabled = true; h.render(); await settle();
    assert.equal(h.render().queries[0].data.output.mediaAssetId, "saved-job-asset");
    assert.equal(h.reads.length, before + 2);
    assert.ok(h.reads.every(({ init }) => init.headers.get("Authorization") === "Bearer owner-a-token"));
  } finally { h.close(); }
});

test("a newer active receipt resumes a same-ID job previously cached terminal after a retry elsewhere", async () => {
  let completed = true;
  const h = fixture({ transport: ({ url }, state) => Response.json(url.includes("?") ? { ok: true, jobs: state.activeJobs } : { ok: true, job: job("saved-job", completed ? "failed" : "running") }) });
  try {
    h.render(); await settle(); assert.equal(h.render().queries[0].data.status, "failed");
    completed = false;
    h.state.activeJobs = [{ ...job(), updatedAt: "2026-10-23T00:00:01.000Z" }];
    await h.readList(); h.render(); await h.cycle();
    assert.equal(h.render().queries[0].data.status, "running");
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1, "new active-list receipt recovers the retry without another detail GET");
  } finally { h.close(); }
});

test("equal-time failed-to-running conflicts resume polling but require an authoritative detail GET", async () => {
  let retried = false;
  const h = fixture({ transport: ({ url }, state) => Response.json(url.includes("?") ? { ok: true, jobs: state.activeJobs } : { ok: true, job: job("saved-job", retried ? "running" : "failed") }) });
  try {
    h.render(); await settle(); assert.equal(h.render().queries[0].data.status, "failed");
    retried = true; h.state.activeJobs = [job()];
    await h.readList(); h.render(); await h.cycle();
    assert.equal(h.render().queries[0].data.status, "running");
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 2, "equal-time conflict must use detail GET instead of guessing list ordering");
  } finally { h.close(); }
});

test("an older running list receipt cannot revive a newer completed detail or discard its output", async () => {
  const terminal = { ...job("saved-job", "completed"), updatedAt: "2026-10-23T00:00:01.000Z" };
  const h = fixture({ transport: ({ url }, state) => Response.json(url.includes("?") ? { ok: true, jobs: state.activeJobs } : { ok: true, job: terminal }) });
  try {
    h.render(); await settle(); assert.equal(h.render().queries[0].data.status, "completed");
    h.state.activeJobs = [job()]; await h.readList(); h.render();
    for (let n = 0; n < 3; n++) await h.cycle();
    assert.equal(h.render().queries[0].data.status, "completed");
    assert.equal(h.render().queries[0].data.output.mediaAssetId, "saved-job-asset");
    assert.equal(h.reads.filter(r => !r.url.includes("?")).length, 1, "older list must not restart stopped terminal detail polling");
  } finally { h.close(); }
});

test("discovered IDs stay attached while inactive and survive removal from the active list", async () => {
  const h = fixture();
  try {
    h.state.ids = []; h.state.activeJobs = [job("discovered")];
    h.render(); await settle(); h.render(); await settle();
    assert.equal(h.render().queries[0].data.id, "discovered");
    h.state.enabled = false; assert.equal(h.render().queries[0].data.id, "discovered");
    h.state.activeJobs = [];
    h.state.enabled = true; h.render(); await settle(); h.render(); await settle();
    assert.equal(h.render().queries[0].data.id, "discovered");
    assert.ok(h.reads.filter(r => !r.url.includes("?")).every(r => r.url === "/api/jobs/discovered"));
  } finally { h.close(); }
});

test("switching inactive during a read allows its own completion without scheduling more reads", async () => {
  let finish;
  const h = fixture({ transport: ({ url }) => url.includes("?") ? Response.json({ ok: true, jobs: [] }) : new Promise(resolve => { finish = () => resolve(Response.json({ ok: true, job: job("saved-job", "completed") })); }) });
  try {
    h.render(); await settle(); assert.ok(finish);
    h.state.enabled = false; h.render(); finish(); await settle();
    assert.equal(h.render().queries[0].data.status, "completed");
    const before = h.reads.length; await h.cycle(); assert.equal(h.reads.length, before);
    assert.equal(h.client.getQueryData(["background-jobs", "owner-a", "saved-job"]).output.mediaAssetId, "saved-job-asset");
  } finally { h.close(); }
});

test("sign-out and changed owners never expose recovered IDs or another owner's output", async () => {
  const h = fixture();
  try {
    h.state.ids = []; h.state.activeJobs = [job("owner-a-only")];
    h.render(); await settle(); h.render(); await settle();
    h.state.owner = null; h.state.enabled = false;
    assert.equal(h.render().queries.length, 0);
    const before = h.reads.length; await h.cycle(); assert.equal(h.reads.length, before);
    h.state.owner = "owner-b"; h.state.ids = ["saved-job"]; h.state.activeJobs = [];
    assert.equal(h.render().queries[0].data, undefined);
    await h.cycle(); assert.equal(h.reads.length, before);
    h.state.enabled = true; h.render(); await settle();
    assert.equal(h.render().queries[0].data.id, "saved-job");
    assert.ok(h.reads.slice(before).every(r => r.init.headers.get("Authorization") === "Bearer owner-b-token"));
  } finally { h.close(); }
});

test("direct multi-job consumers remain enabled by default; auth loading and explicit disable prevent reads", async () => {
  const h = fixture();
  try {
    h.direct(["saved-job"], { enabled: false }); await settle(); assert.equal(h.reads.length, 0);
    h.state.loading = true; h.direct(["saved-job"]); await settle(); assert.equal(h.reads.length, 0);
    h.state.loading = false; h.direct(["saved-job"]); await settle(); assert.equal(h.reads.length, 1);
    assert.equal(h.client.getQueryData(["background-jobs", "owner-a", "saved-job"]).id, "saved-job");
  } finally { h.close(); }
});

test("standalone AI Studio without an Explore format still recovers known jobs", async () => {
  const h = fixture();
  try {
    h.state.format = undefined;
    h.render(); await settle();
    assert.equal(h.reads.length, 1);
    assert.equal(h.reads[0].url, "/api/jobs/saved-job");
    assert.equal(h.render().queries[0].data.id, "saved-job");
    h.state.enabled = false; h.render(); await h.cycle();
    assert.equal(h.reads.length, 1);
    h.state.enabled = true; h.render(); await settle();
    assert.equal(h.reads.length, 2);
    assert.equal(h.render().queries[0].data.id, "saved-job");
  } finally { h.close(); }
});

test("an old owner's in-flight result cannot populate the next owner's same-ID observer", async () => {
  let finishOld;
  const h = fixture({ transport: ({ url, init }) => {
    if (url.includes("?")) return Response.json({ ok: true, jobs: [] });
    if (init.headers.get("Authorization") === "Bearer owner-a-token") {
      return new Promise(resolve => { finishOld = () => resolve(Response.json({ ok: true, job: { ...job("saved-job", "completed"), output: { mediaAssetId: "owner-a-output" } } })); });
    }
    return Response.json({ ok: true, job: { ...job("saved-job", "completed"), output: { mediaAssetId: "owner-b-output" } } });
  } });
  try {
    h.render(); await settle(); assert.ok(finishOld);
    h.state.owner = "owner-b"; h.render(); await settle();
    finishOld(); await settle();
    assert.equal(h.render().queries[0].data.output.mediaAssetId, "owner-b-output");
    assert.equal(h.client.getQueryData(["background-jobs", "owner-b", "saved-job"]).output.mediaAssetId, "owner-b-output");
    assert.equal(h.client.getQueryData(["background-jobs", "owner-a", "saved-job"]), undefined);
  } finally { h.close(); }
});
