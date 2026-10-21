import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const sha = "a".repeat(64), png = Buffer.from("decoded PNG fixture"), pngSha = createHash("sha256").update(png).digest("hex");
function fixture({ token = "owner-token", headerChanges = {}, body = png, status = 200, error } = {}) {
  const calls = [], owners = [];
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../lib/explore/hook-starting-frame-client.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, crypto: webcrypto, Uint8Array, AbortController, fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response(error ? JSON.stringify({ message: error }) : body, { status, headers: error ? {} : {
      "Content-Type": "image/png", "X-Hook-Reference-Id": "hook-01", "X-Hook-Source-Sha256": sha,
      "X-Hook-Frame-Sha256": pngSha, "X-Hook-Frame-Index": "0", "X-Hook-Frame-Time": "0",
      "X-Hook-Frame-Width": "720", "X-Hook-Frame-Height": "1280", ...headerChanges,
    } });
  }, require(name) {
    if (name === "../firebase/auth") return { getCurrentUserIdToken: async owner => { owners.push(owner); return token; } };
    if (name === "../http/read-deadline") return { withReadDeadline: (fn, signal) => fn(signal ?? new AbortController().signal) };
    throw Error(`Unexpected import ${name}`);
  } });
  return { exports, calls, owners, run: () => exports.fetchHookStartingFrame({ ownerId: "owner", referenceId: "hook-01", sourceSha256: sha }) };
}

test("client sends only catalogue identity, verifies the actual bytes and retains full frame provenance", async () => {
  const h = fixture(), result = await h.run();
  assert.deepEqual(h.owners, ["owner"]); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "/api/explore/hook-starting-frame");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { referenceId: "hook-01" });
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer owner-token");
  assert.equal(result.sourceSha256, sha); assert.equal(result.frame.sha256, pngSha);
  assert.equal(result.frame.index, 0); assert.equal(result.frame.width, 720); assert.equal(result.frame.height, 1280);
  assert.equal(Buffer.from(await result.blob.arrayBuffer()).compare(png), 0);
});
test("stale source, poster/nonzero frame, malformed dimensions and partial downloads cannot become the starting image", async () => {
  for (const headerChanges of [{ "X-Hook-Source-Sha256": "b".repeat(64) }, { "X-Hook-Frame-Index": "1" },
    { "X-Hook-Frame-Time": "0.1" }, { "X-Hook-Frame-Width": "0" }, { "X-Hook-Frame-Height": "9000" },
    { "X-Hook-Reference-Id": "another-hook" }, { "Content-Type": "image/jpeg" }]) {
    await assert.rejects(fixture({ headerChanges }).run(), /does not match/);
  }
  await assert.rejects(fixture({ body: Buffer.from("incomplete PNG") }).run(), /incomplete/);
});
test("authentication and server admission failures are actionable and never retried as generation", async () => {
  const signedOut = fixture({ token: null }); await assert.rejects(signedOut.run(), /Sign in/); assert.equal(signedOut.calls.length, 0);
  const denied = fixture({ status: 403, error: "Your account cannot prepare this reference." });
  await assert.rejects(denied.run(), /Your account cannot prepare/); assert.equal(denied.calls.length, 1);
});
test("canonical hash hints come only from the immutable video filename, never from poster names or query text", () => {
  const { hookSourceSha256 } = fixture().exports;
  assert.equal(hookSourceSha256(`https://media.example.test/videos/${sha}.mp4`), sha);
  assert.equal(hookSourceSha256(`https://media.example.test/poster.png?video=${sha}.mp4`), null);
  assert.equal(hookSourceSha256(`/videos/${sha}.mp4`), null); assert.equal(hookSourceSha256(undefined), null);
});
