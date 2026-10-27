import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { bundleStatus, claimBundleDownload, readBundleState, validateBundleItems, type BundleState, type BundleStateStore } from "./hook-video-bundle.ts";
import { bundleZipSize, streamBundleZip, type BundleZipEntry } from "./hook-video-bundle-zip.ts";
import { createHookBundleHandlers } from "./hook-video-bundle-api.ts";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const bundleHash = hash("test bundle");
function memory(): BundleStateStore {
  let state: BundleState | null = null, generation = 0;
  return {
    async read() { return state ? { value: structuredClone(state), generation: String(generation) } : null; },
    async replace(expected, value) { if (expected !== String(generation)) return false; generation++; state = structuredClone(value); return true; },
  };
}
function entry(name = "Hook-001.mp4", data = Buffer.from("video bytes")): BundleZipEntry {
  return { name, size: data.length, sha256: hash(data), async *open() { yield data.subarray(0, 2); yield data.subarray(2); } };
}
function handlers(store = memory(), prepare: (signal: AbortSignal) => Promise<BundleZipEntry[]> = async () => [entry()]) {
  return { store, ...createHookBundleHandlers({ store, prepare, bundleHash, videoCount: 1 }) };
}
function post(id: string = randomUUID(), origin = "https://getugcpilot.com") {
  return new Request("https://getugcpilot.com/api/resources/hook-video-bundle", { method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ requestId: id }) });
}
const statusRequest = () => new Request("https://getugcpilot.com/api/resources/hook-video-bundle");

test("frozen bundle contains exactly the 104 active ordinary public references", () => {
  const m = JSON.parse(readFileSync(new URL("./hook-video-bundle-manifest.json", import.meta.url), "utf8"));
  assert.equal(m.items.length, 104); assert.match(validateBundleItems(m.items), /^[a-f0-9]{64}$/);
  const names = ["explore-hook-reference-release", "explore-hook-reference-addition-release", "explore-hook-reference-new-batch-release", "explore-hook-reference-oct23-release", "explore-hook-reference-oct23-refresh-release"];
  const active = names.map(name => JSON.parse(readFileSync(new URL(`../../worker/src/lib/${name}.json`, import.meta.url), "utf8"))).filter(r => r.mediaStatus === "published" && r.activation === "active");
  const excluded = new Set(active.flatMap(r => r.excludedReferenceIds));
  assert.deepEqual(m.items.map((item: { id: string }) => item.id), active.flatMap(r => r.items).filter(item => !excluded.has(item.id)).map(item => item.id));
  assert.throws(() => validateBundleItems([{ ...m.items[0], key: "users/private.mp4" }]));
});
test("110 concurrent claims accept exactly 100 and reject the remaining 10", async () => {
  const store = memory();
  const results = await Promise.all(Array.from({ length: 110 }, () => claimBundleDownload(store, bundleHash, randomUUID(), { pause: async () => undefined, maxAttempts: 120 })));
  assert.equal(results.filter(r => r === "accepted").length, 100); assert.equal(results.filter(r => r === "exhausted").length, 10);
  assert.equal((await bundleStatus(store, bundleHash)).count, 100);
});
test("concurrent repeated request IDs get only one admission", async () => {
  const store = memory(), id = randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, () => claimBundleDownload(store, bundleHash, id, { pause: async () => undefined })));
  assert.equal(results.filter(r => r === "accepted").length, 1); assert.equal((await bundleStatus(store, bundleHash)).count, 1);
});
test("lost storage acknowledgement recovers exactly its own write", async () => {
  const real = memory(); let once = true;
  const store = { ...real, async replace(g: string, v: BundleState) { const result = await real.replace(g, v); if (once) { once = false; throw new Error("Lost reply"); } return result; } };
  const id = randomUUID(); assert.equal(await claimBundleDownload(store, bundleHash, id), "accepted");
  assert.equal(await claimBundleDownload(store, bundleHash, id), "duplicate"); assert.equal((await bundleStatus(store, bundleHash)).count, 1);
});
test("changed bundle, malformed counter and duplicate receipts fail closed", () => {
  assert.throws(() => readBundleState({ version: 1, bundleHash: hash("other"), starts: [] }, bundleHash));
  const r = { requestId: randomUUID(), executionId: randomUUID() };
  assert.throws(() => readBundleState({ version: 1, bundleHash, starts: [r, r] }, bundleHash));
  assert.throws(() => readBundleState({ version: 1, bundleHash, starts: [{ requestId: "bad", executionId: randomUUID() }] }, bundleHash));
});
test("anonymous GET, refresh and prefetch never consume a slot", async () => {
  const api = handlers();
  for (let i = 0; i < 3; i++) { const r = await api.GET(statusRequest()); assert.equal(r.status, 200); assert.equal((await r.json()).count, 0); }
});
test("anonymous native POST streams a ZIP attachment and rejects replay", async () => {
  const api = handlers(), id = randomUUID(), response = await api.POST(post(id));
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/zip");
  assert.match(response.headers.get("content-disposition")!, /attachment.*UGCPilot-Hook-Video-Bundle.zip/);
  const zip = Buffer.from(await response.arrayBuffer()); assert.equal(zip.length, Number(response.headers.get("content-length")));
  assert.equal(zip.readUInt32LE(), 0x04034b50); assert.equal((await api.POST(post(id))).status, 409);
  assert.equal((await bundleStatus(api.store, bundleHash)).count, 1);
});
test("100th succeeds; 101st returns 410 without opening any media", async () => {
  const store = memory(); for (let i = 0; i < 99; i++) await claimBundleDownload(store, bundleHash, randomUUID());
  let prepared = 0; const api = handlers(store, async () => { prepared++; return [entry()]; });
  const last = await api.POST(post()); assert.equal(last.status, 200); await last.arrayBuffer();
  const closed = await api.POST(post()); assert.equal(closed.status, 410); assert.equal((await closed.json()).error, "Batch 1 is fully downloaded. Wait for Batch 2.");
  assert.equal(prepared, 1); assert.equal((await bundleStatus(store, bundleHash)).count, 100);
});
test("invalid requests and cross-origin forms do not consume slots", async () => {
  const api = handlers(); assert.equal((await api.POST(post("bad"))).status, 400);
  assert.equal((await api.POST(post(randomUUID(), "https://attacker.example"))).status, 403);
  const invalid = new Request(statusRequest(), { method: "POST", headers: { origin: "https://getugcpilot.com", "content-type": "application/x-www-form-urlencoded" }, body: "requestId=" + "x".repeat(300) });
  assert.equal((await api.POST(invalid)).status, 400); assert.equal((await bundleStatus(api.store, bundleHash)).count, 0);
});
test("metadata failure and missing first file consume no slots", async () => {
  for (const prepare of [async () => { throw new Error("Missing object"); }, async () => [{ ...entry(), async *open() { throw new Error("read denied"); yield Buffer.alloc(0); } }]]) {
    const api = handlers(memory(), prepare); assert.equal((await api.POST(post())).status, 503); assert.equal((await bundleStatus(api.store, bundleHash)).count, 0);
  }
});
test("independent Python ZIP reader verifies exact entries, CRCs and bytes", async () => {
  const entries = [entry(), entry("Hook-002.mp4", Buffer.from("another video"))], chunks: Buffer[] = [];
  for await (const b of streamBundleZip(entries)) chunks.push(b);
  const zip = Buffer.concat(chunks); assert.equal(zip.length, bundleZipSize(entries));
  const r = spawnSync("python", ["-c", "import sys,io,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert z.namelist()==['Hook-001.mp4','Hook-002.mp4']; assert z.read('Hook-001.mp4')==b'video bytes'; assert z.read('Hook-002.mp4')==b'another video'"], { input: zip, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr?.toString());
});
test("ZIP rejects bad hashes, changed sizes, unsafe names and oversize files", async () => {
  for (const bad of [{ ...entry(), sha256: hash("wrong") }, { ...entry(), size: 2 }]) await assert.rejects(async () => { for await (const b of streamBundleZip([bad])) void b; });
  assert.throws(() => bundleZipSize([{ ...entry(), name: "../private.mp4" }]));
  assert.throws(() => bundleZipSize([{ ...entry(), size: 65 * 1024 ** 2 }]));
});
test("cancellation closes the current source and never opens a later file", async () => {
  let closed = false, later = false;
  const first = { ...entry(), async *open() { try { yield Buffer.from("video bytes"); } finally { closed = true; } } };
  const second = { ...entry("Hook-002.mp4"), async *open() { later = true; yield Buffer.from("video bytes"); } };
  const zip = streamBundleZip([first, second]); await zip.next(); await zip.return(undefined);
  assert.equal(closed, true); assert.equal(later, false);
});
