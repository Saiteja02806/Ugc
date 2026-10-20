import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("a stalled demo metadata read releases the upload instead of waiting indefinitely", async () => {
  const exported = {}, timers = new Map(), revoked = [];
  const video = { duration: 8, videoWidth: 720, videoHeight: 1280 };
  let authenticated = false;
  const code = ts.transpileModule(readFileSync(new URL("../lib/trending/hook-video-client-upload.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, require() { return { getCurrentUserIdToken: async () => { authenticated = true; return null; } }; },
    document: { createElement: () => video }, URL: { createObjectURL: () => "blob:pending", revokeObjectURL: value => revoked.push(value) },
    setTimeout(fn, ms) { assert.equal(ms, 15_000); timers.set(1, fn); return 1; }, clearTimeout(id) { timers.delete(id); },
  });
  const pending = exported.uploadHookVideoDemo({ name: "demo.mp4", type: "video/mp4", size: 100 });
  timers.get(1)();
  await assert.rejects(pending, /Reading this demo took too long/);
  assert.equal(authenticated, false); assert.equal(timers.size, 0);
  assert.equal(video.onloadedmetadata, null); assert.equal(video.onerror, null);
  assert.deepEqual(revoked, ["blob:pending"]);
});
