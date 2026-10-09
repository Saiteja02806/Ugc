import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { ExploreFinishingStorage } from "../worker/dist/lib/explore-finishing-storage.js";
import { EXPLORE_RENDER_VERSION, exploreFinishOutputKey } from "../worker/dist/lib/explore-finishing-contract.js";

const id = "11111111-1111-4111-8111-111111111111", requestKey = "22222222-2222-4222-8222-222222222222";
const receipt = { user_id: "owner-a", request_key: requestKey, output_asset_id: id, fingerprint: "a".repeat(64), draft: { subtitles: { language: "en" } } };
const key = exploreFinishOutputKey(id);
const details = { durationSeconds: 2, width: 256, height: 384, ratio: "9:16", metadata: { subtitleStyle: "clean", subtitleWordCount: 2 } };
const output = { ...details, storageKey: key, fileSizeBytes: 100, url: `https://storage.example/media/${key}` };
function stored(changes = {}) {
  return { contentType: "video/mp4", size: "100", metadata: { ownerId: receipt.user_id, requestKey, fingerprint: receipt.fingerprint,
    renderer: EXPLORE_RENDER_VERSION, output: JSON.stringify(output) }, ...changes };
}
function fixture({ exists = true, metadata = stored(), chunks = [Buffer.from("source-data")], uploadError } = {}) {
  const calls = [];
  const bucket = {
    file(name, options) {
      calls.push({ method: "file", name, options });
      return { name, exists: async () => [exists], getMetadata: async () => [metadata], createReadStream: () => Readable.from(chunks) };
    },
    upload: async (path, options) => { calls.push({ method: "upload", path, options }); if (uploadError) throw uploadError; },
  };
  const storage = new ExploreFinishingStorage({ bucket: name => { assert.equal(name, "offline-media"); return bucket; } });
  return { storage, calls };
}
function env(t, changes = {}) {
  const values = { GCP_STORAGE_BUCKET: "offline-media", GOOGLE_CLOUD_STORAGE_BUCKET: undefined,
    GCP_STORAGE_PUBLIC_BASE_URL: "https://storage.example/media/", GCS_PUBLIC_BASE_URL: undefined, ...changes };
  const before = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  t.after(() => { for (const [name, value] of Object.entries(before)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
}
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), "explore-storage-offline-"));
  t.after(async () => { assert.equal(dirname(resolve(dir)), resolve(tmpdir())); assert.ok(basename(dir).startsWith("explore-storage-offline-")); await rm(dir, { recursive: true, force: true }); });
  return dir;
}

test("recovers only the deterministic owned object with matching request/render provenance and measured output metadata", async t => {
  env(t); const f = fixture(); assert.deepEqual(await f.storage.existing(receipt), output);
  assert.equal(f.calls[0].name, key);
  assert.equal(await fixture({ exists: false }).storage.existing(receipt), null);
});

test("foreign, stale or malformed stored outputs are rejected instead of published", async t => {
  env(t);
  const good = stored();
  for (const change of [{ ownerId: "other" }, { requestKey: id }, { fingerprint: "b".repeat(64) }, { renderer: "other-renderer" }, { output: "not-json" }, { output: "null" }, { output: "[]" }]) {
    await assert.rejects(fixture({ metadata: { ...good, metadata: { ...good.metadata, ...change } } }).storage.existing(receipt));
  }
  for (const change of [{ storageKey: "another-object" }, { fileSizeBytes: 99 }, { durationSeconds: 61 }, { durationSeconds: 0 }, { width: 0 },
    { height: 4097 }, { width: 256.5 }, { ratio: "unexpected" }, { url: "http://storage.example/file" }, { url: "https://user:secret@storage.example/file" },
    { url: "https://storage.example/file?temporary-token=secret" }, { url: "https://storage.example/file#fragment" }]) {
    await assert.rejects(fixture({ metadata: { ...good, metadata: { ...good.metadata, output: JSON.stringify({ ...output, ...change }) } } }).storage.existing(receipt));
  }
  for (const change of [{ contentType: "audio/wav" }, { size: "0" }, { size: "NaN" }, { size: "262144001" }]) await assert.rejects(fixture({ metadata: { ...good, ...change } }).storage.existing(receipt));
});

test("writes once with generation-zero precondition, saves owned recovery metadata, and never overwrites an input", async t => {
  env(t); const dir = await workspace(t), path = join(dir, "output.mp4"); await writeFile(path, Buffer.alloc(100));
  const f = fixture(); assert.deepEqual(await f.storage.upload(receipt, path, details), output);
  const call = f.calls.find(call => call.method === "upload");
  assert.equal(call.options.destination, key); assert.equal(call.options.resumable, false); assert.deepEqual(call.options.preconditionOpts, { ifGenerationMatch: 0 });
  assert.equal(call.options.metadata.contentType, "video/mp4"); assert.equal(call.options.metadata.metadata.ownerId, receipt.user_id);
  assert.equal(call.options.metadata.metadata.requestKey, requestKey); assert.equal(call.options.metadata.metadata.renderer, EXPLORE_RENDER_VERSION);
  assert.deepEqual(JSON.parse(call.options.metadata.metadata.output), output);
  assert.equal((await readFile(path)).length, 100);
});

test("a concurrent generation-zero upload recovers the matching object, but never accepts another request's object", async t => {
  env(t); const dir = await workspace(t), path = join(dir, "output.mp4"); await writeFile(path, Buffer.alloc(100));
  const conflict = Object.assign(new Error("already exists"), { code: 412 });
  assert.deepEqual(await fixture({ uploadError: conflict }).storage.upload(receipt, path, details), output);
  const foreign = stored(); foreign.metadata.ownerId = "other";
  await assert.rejects(fixture({ metadata: foreign, uploadError: conflict }).storage.upload(receipt, path, details));
});

test("bad storage bases or output dimensions/durations fail before upload; no expiring signed URL is stored", async t => {
  const dir = await workspace(t), path = join(dir, "output.mp4"); await writeFile(path, Buffer.alloc(100));
  env(t);
  for (const base of ["http://storage.example/media", "https://user:secret@storage.example/media", "https://storage.example/media?token=x", "https://storage.example/media#part", "https://"]) {
    process.env.GCP_STORAGE_PUBLIC_BASE_URL = base; const f = fixture();
    await assert.rejects(f.storage.upload(receipt, path, details)); assert.equal(f.calls.some(call => call.method === "upload"), false);
  }
  process.env.GCP_STORAGE_PUBLIC_BASE_URL = "storage.example/media";
  assert.deepEqual(await fixture().storage.upload(receipt, path, details), output);
  for (const change of [{ durationSeconds: 61 }, { width: 32 }, { ratio: "unexpected" }]) {
    const f = fixture(); await assert.rejects(f.storage.upload(receipt, path, { ...details, ...change })); assert.equal(f.calls.some(call => call.method === "upload"), false);
  }
});

test("downloads a bounded generation-pinned snapshot instead of racing a mutable GCP object", async t => {
  env(t); const dir = await workspace(t), destination = join(dir, "source");
  const f = fixture({ metadata: { size: "11", generation: "7" } });
  await f.storage.download("owned/source.mp4", destination, 20);
  assert.equal((await readFile(destination)).toString(), "source-data");
  assert.deepEqual(f.calls.find(call => call.options)?.options, { generation: "7" });
  await assert.rejects(f.storage.download("owned/source.mp4", destination, 20), error => error.code === "EEXIST");
});

test("download cancellation destroys the pinned stream instead of waiting for all source bytes", async t => {
  env(t); const dir=await workspace(t), controller=new AbortController();
  let stream, released;
  const storage=new ExploreFinishingStorage({bucket:()=>({file:(name,options)=>({
    getMetadata:async()=>[{size:"11",generation:"7"}],
    createReadStream:()=>{
      assert.equal(options.generation,"7");
      stream=new Readable({read(){}}); released=true; return stream;
    },
  })})});
  const run=storage.download("owned/source.mp4",join(dir,"cancelled"),20,"primary",controller.signal);
  const rejected=assert.rejects(run,error=>error.name === "AbortError");
  for (let i=0;i<100 && !released;i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(stream); controller.abort(); await rejected; assert.equal(stream.destroyed,true);
});

test("only explicitly private inputs use the private bucket; public inputs and output recovery stay primary", async t => {
  env(t, { GCP_PRIVATE_MEDIA_BUCKET: "offline-private" });
  const directory = await workspace(t);
  const buckets = [];
  const storage = new ExploreFinishingStorage({ bucket: name => {
    buckets.push(name);
    return { file: () => ({ exists: async () => [false], getMetadata: async () => [{ size: "3", generation: "9" }],
      createReadStream: () => Readable.from([Buffer.from("mp4")]) }) };
  } });
  await storage.download("owned/private.mp4", join(directory, "private"), 20, "private_user_media");
  assert.deepEqual(buckets.splice(0), ["offline-private", "offline-private"]);
  await storage.download("owned/public.mp4", join(directory, "public"), 20);
  assert.deepEqual(buckets.splice(0), ["offline-media", "offline-media"]);
  assert.equal(await storage.existing(receipt), null);
  assert.deepEqual(buckets.splice(0), ["offline-media"]);
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "offline-media";
  await assert.rejects(storage.download("owned/unsafe.mp4", join(directory, "unsafe"), 20, "private_user_media"), /separate/);
  assert.equal(buckets.length, 0);
});

test("unsafe keys, missing generation, over-limit data or changing size fail safely", async t => {
  env(t); const dir = await workspace(t); let n = 0;
  for (const key of ["/root", "a/../b", "https://other/file", "a\\b", "a\u0000b"]) await assert.rejects(fixture().storage.download(key, join(dir, `bad-${n++}`), 20));
  for (const metadata of [{ size: "11" }, { size: "21", generation: "7" }, { size: "0", generation: "7" }]) await assert.rejects(fixture({ metadata }).storage.download("owned/source", join(dir, `bad-${n++}`), 20));
  await assert.rejects(fixture({ metadata: { size: "10", generation: "7" } }).storage.download("owned/source", join(dir, `bad-${n++}`), 20), /changed/);
  await assert.rejects(fixture({ metadata: { size: "11", generation: "7" }, chunks: [Buffer.alloc(21)] }).storage.download("owned/source", join(dir, `bad-${n++}`), 20), /size limit/);
});
