import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/ai-studio/reference-media-upload.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = new File(["original face bytes"], "face.png", { type: "image/png" });
function harness({ delayedImage = false, xhr = false, failCompletion = false } = {}) {
  const calls = [], progress = [], bytes = [], revoked = [], timeouts = [], timers = new Map(), uploadRequests = [];
  let tokenReads = 0, finishImage, timerId = 0;
  const exported = {};
  const ready = { id: "image-1", status: "ready", collection: "image" };
  const context = {
    exports: exported, Error, Promise, Object, Date,
    require: () => ({ getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); tokenReads++; return "token"; } }),
    URL: { createObjectURL: () => "blob:original", revokeObjectURL: url => revoked.push(url) },
    window: { Image: class {
      naturalWidth = 720; naturalHeight = 1280;
      set src(value) {
        assert.equal(value, "blob:original");
        assert.equal(typeof this.onload, "function", "register handlers before assigning src, including instant cache hits");
        finishImage = () => this.onload();
        if (!delayedImage) finishImage();
      }
    } },
    setTimeout: (callback, milliseconds) => { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout: id => timers.delete(id),
    AbortSignal: { timeout: milliseconds => { timeouts.push(milliseconds); return undefined; } },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url === "/api/media/create-upload-url") return Response.json({ ok: true, assetId: "image-1", key: "owned/image", uploadUrl: "https://storage.test/image", requiredHeaders: { "Content-Type": "image/png" } });
      if (url === "https://storage.test/image") return new Response(null, { status: 200 });
      if (url === "/api/media/complete-upload") {
        if (failCompletion) throw Error("lost acknowledgement");
        return Response.json({ ok: true, asset: ready });
      }
      assert.equal(url, "/api/media/image-1");
      return Response.json({ ok: true, asset: ready });
    },
  };
  if (xhr) context.XMLHttpRequest = class {
    upload = {}; headers = {}; status = 200;
    constructor() { uploadRequests.push(this); }
    open(method, url) { assert.equal(method, "PUT"); assert.equal(url, "https://storage.test/image"); }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) { assert.equal(body, file); this.upload.onprogress({ lengthComputable: true, loaded: file.size / 2, total: file.size }); this.onload(); }
  };
  vm.runInNewContext(code, context);
  return { calls, progress, bytes, revoked, timeouts, timers, tokenReads: () => tokenReads, finishImage: () => finishImage(), request: () => uploadRequests.at(-1),
    run: () => exported.uploadAIStudioReferenceMedia(file, "image", 10, "owner", { purpose: "explore-reference", onProgress: stage => progress.push(stage), onUploadProgress: (loaded, total) => bytes.push([loaded, total]) }) };
}

test("auth runs during local decoding, but invalid or unready metadata cannot start remote upload", async () => {
  const h = harness({ delayedImage: true });
  const pending = h.run();
  assert.equal(h.tokenReads(), 1, "authentication must not wait for a large image to decode");
  assert.equal(h.calls.length, 0, "validation still gates remote mutations");
  h.finishImage(); await pending;
  assert.equal(h.calls[1].init.body, file, "preserve the exact original file");
  assert.deepEqual(h.progress, ["preparing", "uploading", "verifying", "ready"]);
  assert.deepEqual(h.timeouts, [30_000, 180_000, 60_000]);
  assert.deepEqual(h.revoked, ["blob:original"]); assert.equal(h.timers.size, 0);
});

test("original PUT reports byte progress with storage headers and never sends the application bearer token", async () => {
  const h = harness({ xhr: true }); await h.run();
  assert.equal(h.request().timeout, 180_000);
  assert.deepEqual(h.request().headers, { "Content-Type": "image/png" });
  assert.deepEqual(h.bytes, [[file.size / 2, file.size]]);
  assert.equal(h.calls.length, 2, "one storage PUT, no duplicate fetch PUT");
});

test("lost completion acknowledgement recovers the owned asset without uploading again", async () => {
  const h = harness({ failCompletion: true }); await h.run();
  assert.equal(h.calls.filter(call => call.init.method === "PUT").length, 1);
  assert.equal(h.calls.at(-1).url, "/api/media/image-1");
  assert.equal(h.progress.at(-1), "ready");
});

test("a stalled decoder fails after a bounded wait and releases its local preview", async () => {
  const h = harness({ delayedImage: true }); const pending = h.run();
  const timer = [...h.timers.values()][0]; assert.equal(timer.milliseconds, 15_000); timer.callback();
  await assert.rejects(pending, /read this file in time/);
  assert.equal(h.calls.length, 0); assert.deepEqual(h.revoked, ["blob:original"]);
});
