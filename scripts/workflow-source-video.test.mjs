import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const load = (path, imports, globals = {}) => {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) { assert.ok(name in imports, name); return imports[name]; }, AbortController, Error, ...globals });
  return exports;
};
const policy = load("lib/explore/workflow-source-video.ts", {});
const asset = (n = 1, changes = {}) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, title: `Video ${n}`, url: `https://media.example/${n}.mp4`,
  status: "ready", collection: "video", mimeType: "video/mp4", fileSizeBytes: 2000, durationSeconds: 5, ...changes });
const file = name => ({ name, type: "video/mp4", size: 2000 });
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((ok, no) => { resolve = ok; reject = no; }); return { promise, resolve, reject }; };

function harness(enabled = true, ownerId = "owner", minDuration = 0) {
  let cursor = 0, urlNumber = 0;
  const slots = [], effects = [], players = [], uploads = [], revoked = [];
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((d, n) => !Object.is(d, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const local = load("components/explore/use-local-workflow-media.ts", { react }, {
    URL: { createObjectURL: () => `blob:video-${++urlNumber}`, revokeObjectURL: url => revoked.push(url) },
    document: { createElement() { const player = { duration: 5, pause() {}, removeAttribute() {}, load() {} }; players.push(player); return player; } },
    setTimeout: () => 1, clearTimeout() {},
  });
  const source = load("components/explore/use-workflow-source-video.ts", {
    react, "@/components/explore/use-local-workflow-media": local, "@/lib/explore/workflow-source-video": policy,
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia(...args) { const request = deferred(); uploads.push({ args, ...request }); return request.promise; } },
  });
  return { players, uploads, revoked,
    render() { cursor = 0; const result = source.useWorkflowSourceVideo({ enabled, ownerId, minDuration }); while (effects.length) effects.shift()(); return result; },
    metadata(duration = 5) { const player = players.at(-1); player.duration = duration; player.onloadedmetadata(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("source policy accepts only playable ready videos in both Creative Assets collections with renderer limits", () => {
  for (const collection of ["video", "influencer"]) assert.equal(policy.workflowSourceVideoError(asset(1, { collection })), null);
  for (const change of [{ collection: "image" }, { mimeType: "image/png" }, { status: "uploading" }, { url: "" }, { id: "not-a-uuid" },
    { durationSeconds: 121 }, { durationSeconds: 0 }, { durationSeconds: NaN }, { fileSizeBytes: 250 * 1024 * 1024 + 1 }]) assert.ok(policy.workflowSourceVideoError(asset(1, change)));
  assert.equal(policy.workflowSourceVideoError(asset(1, { durationSeconds: null, fileSizeBytes: null })), null);
});

test("live upload cannot continue until owned completion and keeps modes' separate selections", async () => {
  const h = harness(); assert.equal(h.render().mode, "generate"); h.render().setMode("upload");
  const pending = h.render().chooseUpload(file("opening.mp4")); assert.equal(h.render().ready, false);
  h.metadata(); await tick(); assert.equal(h.render().busy, true); assert.equal(h.render().source, null);
  assert.equal(h.uploads.length, 1);
  const [uploadedFile, kind, duration, owner, options] = h.uploads[0].args;
  assert.equal(uploadedFile.name, "opening.mp4"); assert.equal(kind, "video"); assert.equal(duration, 120); assert.equal(owner, "owner");
  assert.equal(options.requireVideoReferenceRatio, false); assert.equal(options.purpose, "explore-source");
  h.uploads[0].resolve({ asset: asset() }); await pending;
  assert.equal(h.render().ready, true); assert.equal(h.render().source.id, asset().id);
  h.render().setMode("assets"); assert.equal(h.render().source, null); h.render().selectAsset(asset(2, { collection: "influencer" }));
  assert.equal(h.render().source.id, asset(2).id);
  h.render().setMode("generate"); assert.equal(h.render().source, null); assert.equal(h.render().dirty, true);
  h.render().setMode("upload"); assert.equal(h.render().source.id, asset().id);
  h.render().setMode("assets"); assert.equal(h.render().source.id, asset(2).id); h.unmount();
});

test("layout preview never uploads and can preview a local opening clip", async () => {
  const h = harness(false, null); h.render().setMode("upload");
  const pending = h.render().chooseUpload(file("local.mp4")); h.metadata(); assert.equal(await pending, true);
  assert.equal(h.render().preview.name, "local.mp4"); assert.equal(h.render().ready, true); assert.equal(h.render().source, null);
  assert.equal(h.uploads.length, 0); h.unmount(); assert.ok(h.revoked.includes("blob:video-1"));
});

test("format inputs reject sub-second footage before uploading and before choosing a saved asset", async () => {
  const h = harness(true, "owner", 1); h.render().setMode("upload");
  const pending = h.render().chooseUpload(file("short.mp4")); h.metadata(.5);
  assert.equal(await pending, false); assert.equal(h.uploads.length, 0); assert.equal(h.render().ready, false);
  assert.match(h.render().error, /at least 1 second/);
  h.render().setMode("assets"); assert.equal(h.render().selectAsset(asset(1, { durationSeconds: .5 })), false);
  assert.equal(h.render().ready, false); assert.match(h.render().error, /at least 1 second/);
  assert.equal(h.render().selectAsset(asset(2, { durationSeconds: 1 })), true); assert.equal(h.render().ready, true); h.unmount();
});

test("invalid and long uploads stay blocked without API work or losing an assets draft", async () => {
  const h = harness(); h.render().selectAsset(asset(2)); h.render().setMode("upload");
  assert.equal(await h.render().chooseUpload({ ...file("bad.png"), type: "image/png" }), false); assert.match(h.render().error, /MP4/);
  const pending = h.render().chooseUpload(file("long.mp4")); h.metadata(121); assert.equal(await pending, false);
  assert.equal(h.render().ready, false); assert.match(h.render().error, /120 seconds/); assert.equal(h.uploads.length, 0);
  h.render().setMode("assets"); assert.equal(h.render().error, null); assert.equal(h.render().ready, true); h.unmount();
});

test("upload failure preserves local preview, blocks finishing, and a retry can succeed", async () => {
  const h = harness(); h.render().setMode("upload");
  const pending = h.render().chooseUpload(file("opening.mp4")); h.metadata(); await tick();
  h.uploads[0].reject(new Error("Storage unavailable")); assert.equal(await pending, false);
  assert.equal(h.render().preview.name, "opening.mp4"); assert.equal(h.render().ready, false); assert.equal(h.render().source, null);
  const retry = h.render().chooseUpload(file("opening.mp4")); h.metadata(); await tick();
  h.uploads[1].resolve({ asset: asset() }); assert.equal(await retry, true); assert.equal(h.render().ready, true); h.unmount();
});

test("replacement and removal ignore late upload completions", async () => {
  const h = harness(); h.render().setMode("upload");
  const first = h.render().chooseUpload(file("first.mp4")); h.metadata(); await tick();
  const second = h.render().chooseUpload(file("second.mp4")); h.metadata(); await tick();
  h.uploads[1].resolve({ asset: asset(2) }); await second;
  h.uploads[0].resolve({ asset: asset(1) }); assert.equal(await first, false); assert.equal(h.render().source.id, asset(2).id);
  const third = h.render().chooseUpload(file("third.mp4")); h.metadata(); await tick(); h.render().removeUpload();
  h.uploads[2].resolve({ asset: asset(3) }); assert.equal(await third, false); assert.equal(h.render().source, null); assert.equal(h.render().preview, null); h.unmount();
});

test("invalid or failed replacements retain the accepted owned upload and explicit reuse restores readiness", async () => {
  const h = harness(true, "owner", 1); h.render().setMode("upload");
  const first = h.render().chooseUpload(file("first.mp4")); h.metadata(); await tick();
  h.uploads[0].resolve({ asset: asset(1) }); assert.equal(await first, true);
  for (const bad of [{ ...file("wrong.png"), type: "image/png" }, { ...file("huge.mp4"), size: 250 * 1024 ** 2 + 1 }]) {
    assert.equal(await h.render().chooseUpload(bad), false); assert.equal(h.render().source.id, asset(1).id);
    assert.equal(h.render().ready, false); h.render().clearUploadError(); assert.equal(h.render().ready, true);
  }
  const long = h.render().chooseUpload(file("long.mp4")); h.metadata(121); assert.equal(await long, false);
  assert.equal(h.render().source.id, asset(1).id); h.render().clearUploadError(); assert.equal(h.render().ready, true);
  const failed = h.render().chooseUpload(file("replacement.mp4")); h.metadata(); await tick();
  assert.equal(h.render().source.id, asset(1).id); assert.equal(h.render().preview.url, asset(1).url); assert.equal(h.render().ready, false);
  h.uploads[1].reject(new Error("Storage rejected upload")); assert.equal(await failed, false);
  assert.equal(h.render().source.id, asset(1).id); assert.equal(h.render().canKeepUpload, true);
  h.render().clearUploadError(); assert.equal(h.render().ready, true); h.unmount();
});

test("unmount during upload prevents completion from restoring a source", async () => {
  const h = harness(); h.render().setMode("upload"); const pending = h.render().chooseUpload(file("opening.mp4"));
  h.metadata(); await tick(); h.unmount(); h.uploads[0].resolve({ asset: asset() }); assert.equal(await pending, false); assert.equal(h.render().source, null);
});

test("an existing owned asset remains usable while an independent upload is in progress", async () => {
  const h = harness(); h.render().setMode("upload"); const pending = h.render().chooseUpload(file("opening.mp4")); h.metadata(); await tick();
  h.render().selectAsset(asset(2)); h.render().setMode("assets"); assert.equal(h.render().ready, true); assert.equal(h.render().busy, false);
  h.uploads[0].reject(new Error("Upload failed")); await pending; assert.equal(h.render().error, null); assert.equal(h.render().source.id, asset(2).id); h.unmount();
});

test("sign-in and invalid completion checks block uploads without creating a playable source", async () => {
  const signedOut = harness(true, null); signedOut.render().setMode("upload");
  assert.equal(await signedOut.render().chooseUpload(file("opening.mp4")), false); assert.equal(signedOut.uploads.length, 0); signedOut.unmount();
  const h = harness(); h.render().setMode("upload"); const pending = h.render().chooseUpload(file("opening.mp4")); h.metadata(); await tick();
  h.uploads[0].resolve({ asset: asset(1, { status: "uploading" }) }); assert.equal(await pending, false); assert.equal(h.render().source, null); h.unmount();
});
