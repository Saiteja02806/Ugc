import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { withReadDeadline } from "../lib/http/read-deadline.ts";
import * as pollingPolicy from "../lib/jobs/background-job-polling-policy.ts";

function load(file, imports, globals = {}) {
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, require: name => {
    if (name === "@/lib/http/read-deadline") return { withReadDeadline };
    if (name === "./background-job-polling-policy") return pollingPolicy;
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  }, Headers, ...globals });
  return exported;
}

function jobs({ token = async () => "owner-token", fetch: transport = async () => Response.json({ ok: true, job: { id: "saved-job", status: "running" }, jobs: [] }) } = {}) {
  const reads = [], tokens = [];
  const client = load("lib/jobs/background-job-client.ts", {
    react: {}, "@tanstack/react-query": { useQueryClient: () => ({}), useQuery: options => options, useQueries: options => options.queries },
    "@/contexts/auth-context": { useAuth: () => ({ user: { uid: "owner" }, loading: false }) },
    "@/lib/firebase/auth": { getCurrentUserIdToken: expected => { tokens.push(expected); return token(expected); } },
  }, { fetch: (url, init) => { reads.push({ url, init }); return transport(url, init); } });
  return { client, reads, tokens };
}

test("job reads bind cached owner, consume query cancellation, and refresh nonterminal status on return", async () => {
  const h = jobs();
  const all = h.client.useActiveBackgroundJobs();
  const single = h.client.useBackgroundJob("saved-job");
  const multi = h.client.useBackgroundJobs(["saved-job"])[0];
  for (const options of [all, single, multi]) {
    await options.queryFn({ signal: new AbortController().signal });
  }
  assert.deepEqual(h.tokens, ["owner", "owner", "owner"]);
  assert.equal(h.reads.length, 3);
  assert.ok(h.reads.every(({ init }) => init.signal instanceof AbortSignal && init.headers.get("Authorization") === "Bearer owner-token"));
  for (const options of [single, multi]) {
    assert.equal(options.staleTime({ state: { status: "success", data: { status: "running" } } }), 0);
    assert.equal(options.refetchOnWindowFocus({ state: { data: { status: "running" } } }), true);
    assert.equal(options.refetchOnWindowFocus({ state: { data: { status: "completed" } } }), false);
    assert.equal(options.refetchInterval({ state: { data: { status: "completed" } } }), false);
  }
});

test("cancel or timeout during authentication releases fetching and prevents a late request", async t => {
  for (const timeout of [false, true]) {
    const controller = new AbortController(); let resolveToken;
    if (timeout) t.mock.method(AbortSignal, "timeout", () => controller.signal);
    const h = jobs({ token: () => new Promise(resolve => { resolveToken = resolve; }) });
    const options = h.client.useBackgroundJob("saved-job");
    const pending = options.queryFn({ signal: timeout ? new AbortController().signal : controller.signal });
    controller.abort();
    await assert.rejects(pending, timeout ? /Loading took too long/ : { name: "AbortError" });
    resolveToken("owner-token"); await new Promise(setImmediate);
    assert.equal(h.reads.length, 0, "Authentication resolving after cancellation must not fetch");
    t.mock.restoreAll();
  }
});

test("a changed account cannot fill another owner's job cache", async () => {
  const h = jobs({ token: async expected => { assert.equal(expected, "owner"); throw Error("Your signed-in account changed."); } });
  await assert.rejects(h.client.useActiveBackgroundJobs().queryFn({ signal: new AbortController().signal }), /account changed/);
  assert.equal(h.reads.length, 0);
});

test("job JSON parsing and media list/detail reads cannot hang indefinitely", async t => {
  for (const kind of ["jobs", "detail", "list"]) {
    const controller = new AbortController(); t.mock.method(AbortSignal, "timeout", () => controller.signal);
    let readStarted;
    const started = new Promise(resolve => { readStarted = resolve; });
    const transport = async () => ({ ok: true, json: () => { readStarted(); return new Promise(() => {}); } });
    const h = jobs({ fetch: transport });
    const media = load("lib/ai-studio/media-client.ts", {}, { fetch: transport, URLSearchParams });
    const pending = kind === "jobs" ? h.client.useBackgroundJob("saved-job").queryFn({ signal: new AbortController().signal })
      : kind === "detail" ? media.fetchAIStudioMediaAsset("saved-image", "owner-token")
        : media.fetchAIStudioMediaAssets({ collection: "image", sourceType: "upload", token: "owner-token" });
    await started; controller.abort(); await assert.rejects(pending, /Loading took too long/);
    t.mock.restoreAll();
  }
});

test("cancelled media requests do not fetch, and wrong-ID detail responses are rejected", async () => {
  const reads = [];
  const media = load("lib/ai-studio/media-client.ts", {}, { URLSearchParams,
    fetch: async (url, init) => { reads.push({ url, init }); return Response.json({ ok: true, asset: { id: "different-image" } }); } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(media.fetchAIStudioMediaAsset("saved-image", "owner-token", { signal: controller.signal }));
  await assert.rejects(media.fetchAIStudioMediaAssets({ collection: "image", sourceType: "upload", token: "owner-token", signal: controller.signal }));
  assert.equal(reads.length, 0);
  await assert.rejects(media.fetchAIStudioMediaAsset("saved-image", "owner-token"), /Could not load/);
  assert.ok(reads[0].init.signal instanceof AbortSignal);
});
