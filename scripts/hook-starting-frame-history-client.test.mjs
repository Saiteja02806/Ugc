import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const frame = { ownerId: "owner", assetId: "11111111-1111-4111-8111-111111111111", jobId: "22222222-2222-4222-8222-222222222222",
  draftId: "33333333-3333-4333-8333-333333333333", referenceId: "hook-15", sourceSha256: "a".repeat(64), url: "https://media.example.test/frame.png",
  width: 720, height: 1280, durationSeconds: 8, motionInstructions: "Turn toward camera", generateAudio: false };
let body, requests = [], tokenOwner;
const exports = {};
const code = ts.transpileModule(readFileSync(new URL("../lib/explore/hook-starting-frame-history-client.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports, URL, AbortController, fetch: async (url, options) => { requests.push({ url, options }); return Response.json(body); }, require(name) {
  if (name.endsWith("firebase/auth")) return { getCurrentUserIdToken: async owner => { tokenOwner = owner; return "test-token"; } };
  if (name.endsWith("read-deadline")) return { withReadDeadline: fn => fn(new AbortController().signal) };
  throw new Error(name);
} });
test("client rejects wrong owner, malformed IDs, unsafe URLs and incomplete scene metadata", () => {
  assert.equal(exports.readRecentStartingFrame(frame, "owner"), frame);
  for (const patch of [{ ownerId: "other" }, { assetId: "bad" }, { jobId: "bad" }, { referenceId: undefined }, { sourceSha256: "bad" },
    { url: "javascript:alert(1)" }, { url: "https://user:pass@host/frame.png" }, { width: 0 }, { height: 10000 }, { durationSeconds: 5 }, { motionInstructions: "" }]) {
    assert.throws(() => exports.readRecentStartingFrame({ ...frame, ...patch }, "owner"));
  }
});
test("list and selected frame reads use authenticated GET with cancellation and no-store", async () => {
  requests = []; body = { ok: true, frames: [frame] };
  assert.equal((await exports.fetchRecentStartingFrames("owner"))[0].assetId, frame.assetId);
  body = { ok: true, frame }; await exports.fetchRecentStartingFrame(frame, "owner");
  assert.equal(tokenOwner, "owner"); assert.equal(requests.length, 2); assert.ok(requests[1].url.includes(`jobId=${frame.jobId}&assetId=${frame.assetId}`));
  for (const { options } of requests) { assert.equal(options.cache, "no-store"); assert.equal(options.headers.Authorization, "Bearer test-token"); assert.ok(options.signal); assert.equal(options.body, undefined); }
  body = { ok: true, frame: { ...frame, assetId: frame.jobId } };
  await assert.rejects(exports.fetchRecentStartingFrame(frame, "owner"), /changed/);
});
