import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return exports;
}
const edit = load("worker/src/lib/explore-format-edit.ts", { "./edit-overlay-render-spec.ts": load("worker/src/lib/edit-overlay-render-spec.ts") });
const contract = load("worker/src/lib/explore-finishing-contract.ts", { "../subtitles/styles.ts": load("worker/src/subtitles/styles.ts"), "./explore-format-edit.ts": edit });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const draft = { version: 1, kind: "phone", sourceAssetId: id(1), demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once",
  backgroundAssetId: null, backgroundPlayback: "once", subtitles: null };
const owner = "owner-a", key = id(2), fingerprint = "a".repeat(64);
const receipt = { user_id: owner, request_key: key, job_id: id(3), output_asset_id: id(4), fingerprint, draft, status: "queued" };
const plain = value => JSON.parse(JSON.stringify(value));
function harness({ row = receipt, readError = null, rpcError = null } = {}) {
  const calls = [];
  const query = { select(fields) { calls.push(["select",fields]); return this; }, eq(...args) { calls.push(["eq",...args]); return this; },
    is(...args) { calls.push(["is",...args]); return this; }, async maybeSingle() { return { data: row, error: readError }; } };
  const db = { from(table) { calls.push(["from",table]); return query; }, async rpc(name,args) { calls.push(["rpc",name,plain(args)]); return {data:row,error:rpcError}; } };
  const api = load("lib/explore/workflow-finishing-store.ts", {
    "server-only": {}, "@/worker/src/lib/explore-finishing-contract": contract,
    "@supabase/supabase-js": {createClient:()=>{throw new Error("injected database only");}},
  }, {process:{env:{}}});
  return {store:new api.ExploreFinishingRequestStore(db),calls};
}

test("app store reads only owner-matched receipt fields, never transcript/provider claim or storage details", async () => {
  const h = harness(), result = await h.store.read(owner,key);
  assert.deepEqual(plain(result),receipt); assert.deepEqual(plain(h.calls),[["from","explore_video_finishes"],
    ["select","user_id,request_key,fingerprint,draft,job_id,output_asset_id,status"],["eq","user_id",owner],["eq","request_key",key]]);
  assert.equal(await harness({row:null}).store.read(owner,key),null);
});

test("shared receipt parser rejects foreign, stale, malformed and unsupported receipt/draft identities", () => {
  for (const change of [{user_id:"other"},{request_key:id(99)},{job_id:"bad"},{output_asset_id:"bad"},{fingerprint:"bad"},{status:"failed"},
    {draft:{...draft,sourceAssetId:"https://other/video"}},{draft:{...draft,provider:"another-paid-provider"}}]) {
    assert.throws(()=>contract.parseExploreFinishReceipt({...receipt,...change},owner,key));
  }
  const result = contract.parseExploreFinishReceipt({...receipt,transcript:{private:"speech"},transcription_provider_key:"private-policy"},owner,key);
  assert.equal("transcript" in result,false); assert.equal("transcription_provider_key" in result,false);
});

test("app reservation calls only the reviewed atomic owner/draft RPC and checks its exact result before returning", async () => {
  const h = harness(), result = await h.store.create(owner,key,fingerprint,draft);
  assert.deepEqual(plain(result),receipt); assert.deepEqual(plain(h.calls),[["rpc","explore_create_video_finish",{p_user_id:owner,p_request_key:key,p_fingerprint:fingerprint,p_draft:draft}]]);
  for (const row of [{...receipt,fingerprint:"b".repeat(64)},{...receipt,draft:{...draft,kind:"hook"}}]) await assert.rejects(harness({row}).store.create(owner,key,fingerprint,draft),/different/);
});

test("reservation failures expose only bounded actionable errors, never SQL/secret/provider details", async () => {
  for (const [code,status] of [["explore_finish_conflict",409],["explore_finish_busy",409],["explore_finish_asset_unavailable",409],["private-database-details",503]]) {
    await assert.rejects(harness({rpcError:{message:code}}).store.create(owner,key,fingerprint,draft),error=>error.status === status && !error.message.includes("private-database"));
  }
  await assert.rejects(harness({readError:{message:"private-details"}}).store.read(owner,key),error=>error.status === 503 && !error.message.includes("private-details"));
});

test("finished asset lookup uses owner/ready/not-deleted predicates and rechecks every returned identity", async () => {
  const good = {id:id(4),user_id:owner,collection:"video",status:"ready",deleted_at:null}, h = harness({row:good});
  assert.deepEqual(await h.store.asset(owner,id(4),"video"),good);
  assert.deepEqual(plain(h.calls),[["from","media_assets"],["select","id,user_id,collection,status,deleted_at"],["eq","id",id(4)],["eq","user_id",owner],
    ["eq","collection","video"],["eq","status","ready"],["is","deleted_at",null]]);
  for (const change of [{id:id(99)},{user_id:"other"},{collection:"audio"},{status:"pending"},{deleted_at:"2026-10-04"}]) await assert.rejects(harness({row:{...good,...change}}).store.asset(owner,id(4),"video"),error=>error.status === 404);
  await assert.rejects(harness({row:null}).store.asset(owner,id(4),"video"),error=>error.status === 404);
});

test("app request storage and shared policy never import the worker's files, ASR provider or renderer", () => {
  const source = readFileSync(new URL("../lib/explore/workflow-finishing-store.ts",import.meta.url),"utf8");
  assert.doesNotMatch(source,/node:fs|elevenlabs-provider|ffmpeg|claimSpeech|saveSpeech|explore_claim_transcription/);
  const policy = readFileSync(new URL("../worker/src/subtitles/elevenlabs-contract.ts",import.meta.url),"utf8");
  assert.doesNotMatch(policy,/\bimport\b|ELEVENLABS_API_KEY|fetch\(/);
});
