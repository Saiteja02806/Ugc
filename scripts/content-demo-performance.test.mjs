import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createDemoUploadQueue } from "../lib/demo/upload-queue.ts";
import { withReadDeadline } from "../lib/http/read-deadline.ts";

const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const file = name => ({ name, size: 100, type: "video/mp4" });
function load(path, imports = {}, globals = {}, append = "") {
  const exported = {};
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8") + append;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, AbortController, AbortSignal, Error, Map, Set, console, setTimeout, clearTimeout,
    require: name => imports[name] ?? new Proxy({}, { get: (_, key) => String(key) }), ...globals });
  return exported;
}

test("Demo transfer slots are shared across batches/retries; queued cancellation never starts an upload", async () => {
  const calls = [], waits = new Map(); let idle = 0;
  const queue = createDemoUploadQueue(async (item, signal) => {
    calls.push(item.id); const wait = deferred(); waits.set(item.id, wait);
    signal.addEventListener("abort", wait.resolve, { once: true }); await wait.promise;
  }, () => idle++);
  queue.activate();
  for (const id of ["a", "b", "c", "d"]) queue.enqueue({ id });
  queue.enqueue({ id: "a" }); queue.cancel("c"); await tick();
  assert.deepEqual(calls, ["a", "b"]);
  waits.get("a").resolve(); await tick(); assert.deepEqual(calls, ["a", "b", "d"]);
  queue.cancel("b"); waits.get("d").resolve(); await tick();
  assert.equal(idle, 1);
  queue.enqueue({ id: "later" }); await tick(); assert.equal(calls.at(-1), "later");
  queue.dispose(); await tick(); assert.equal(idle, 1, "Unmount cannot start an inventory read");
});

function decoderHarness() {
  const timers = new Map(), players = [], images = [], revoked = []; let timerId = 0;
  const createElement = () => { const media = { duration: 5, videoWidth: 720, videoHeight: 1280, removeAttribute() { this.detached = true; }, load() {} }; players.push(media); return media; };
  const globals = {
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    document: { createElement },
    Image: class { constructor() { images.push(this); } removeAttribute() { this.detached = true; } },
    URL: { createObjectURL: () => "blob:pending", revokeObjectURL: url => revoked.push(url) },
  };
  const local = load("components/explore/use-local-workflow-media.ts", {}, globals);
  const demo = load("components/demos/demos-workspace.tsx", {}, globals, "\nexport { readVideoMetadata };\n");
  return { timers, players, images, revoked, local, demo };
}

test("stalled image/video metadata reads end after 15 seconds and detach their decoders", async () => {
  const h = decoderHarness();
  const image = h.local.readDuration("blob:image", "image");
  [...h.timers.values()][0](); await assert.rejects(image, /took too long/);
  assert.equal(h.images[0].onload, null); assert.equal(h.images[0].detached, true); assert.equal(h.timers.size, 0);
  const video = h.demo.readVideoMetadata(file("stalled.mp4"));
  [...h.timers.values()][0](); await assert.rejects(video, /took too long/);
  assert.equal(h.players[0].onloadedmetadata, null); assert.equal(h.players[0].detached, true);
  assert.deepEqual(h.revoked, ["blob:pending"]); assert.equal(h.timers.size, 0);
});

test("cancelling metadata releases image, audio and Demo decoders immediately, before timeout", async () => {
  for (const kind of ["image", "audio", "demo"]) {
    const h = decoderHarness(), controller = new AbortController();
    const pending = kind === "demo" ? h.demo.readVideoMetadata(file("cancel.mp4"), controller.signal) : h.local.readDuration("blob:pending", kind, controller.signal);
    controller.abort(); await assert.rejects(pending);
    assert.equal(h.timers.size, 0); assert.equal((h.images[0] ?? h.players[0]).detached, true);
    if (kind === "demo") assert.deepEqual(h.revoked, ["blob:pending"]);
  }
});

test("stalled Demo token, reservation and completion waits expire without retrying their mutation", async () => {
  for (const stage of ["auth", "create", "complete"]) {
    const calls = [];
    const fixtureModule = load("components/demos/demos-workspace.tsx", {
      "@/lib/http/read-deadline": { withReadDeadline: (read, signal) => withReadDeadline(read, signal, 5) },
      "@/lib/firebase/auth": { getCurrentUserIdToken: async () => new Promise(() => {}) },
    }, { fetch: async (url, options) => { calls.push({ url, options }); return new Promise(() => {}); } },
    "\nexport { getAuthToken, createUploadTarget, completeUpload };\n");
    const pending = stage === "auth" ? fixtureModule.getAuthToken("owner") : stage === "create"
      ? fixtureModule.createUploadTarget({ contentType: "video/mp4", file: file("wait.mp4"), token: "token" })
      : fixtureModule.completeUpload({ demoId: "same-id", key: "same-key", metadata: { durationSeconds: 5, width: 720, height: 1280, ratio: "9:16" }, token: "token" });
    await Promise.all([assert.rejects(pending, /took too long/), new Promise(resolve => setTimeout(resolve, 15))]);
    assert.equal(calls.length, stage === "auth" ? 0 : 1);
    if (calls.length) assert.equal(calls[0].options.signal.aborted, true);
  }
});

function workspaceHarness({ failCompletionOnce = false, deleteFailure = null, cleanupWait = null, initialDemos = [] } = {}) {
  const slots = [], effects = [], calls = [], xhrs = []; let cursor = 0, nextId = 0, completionFailed = false;
  let inventory = initialDemos;
  const user = { uid: "owner" }, fakeTimers = new Map(); let timerId = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(create, deps) { const i = cursor++; if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) slots[i] = { deps, value: create() }; return slots[i].value; },
    useCallback(callback, deps) { return this.useMemo(() => callback, deps); },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); }); } },
  };
  // transpiled hooks call the functions without a receiver.
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const queue = { run: read => read(new AbortController().signal) };
  const timers = { setTimeout(fn) { const id = ++timerId; fakeTimers.set(id, fn); return id; }, clearTimeout(id) { fakeTimers.delete(id); } };
  const imports = {
    react, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" },
    "@/contexts/auth-context": { useAuth: () => ({ user }) },
    "@/components/hooks/use-refresh-queue": { useRefreshQueue: () => queue },
    "@/components/hooks/use-visible-refresh": { useVisibleRefresh() {} },
    "@/lib/http/read-deadline": { withReadDeadline }, "@/lib/demo/upload-queue": { createDemoUploadQueue },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { if (owner) assert.equal(owner, "owner"); return "token"; } },
    "@tanstack/react-query": { replaceEqualDeep: (_previous, next) => next },
    "@/lib/utils": { cn: () => "" }, "@/lib/demo/demo-display": { isActiveDemoStatus: () => false },
  };
  const fixtureModule = load("components/demos/demos-workspace.tsx", imports, {
    ...timers, window: timers, navigator: { onLine: true, userAgent: "Demo fixture" }, URL: { createObjectURL: () => "blob:video", revokeObjectURL() {} },
    document: { createElement: () => ({ duration: 5, videoWidth: 720, videoHeight: 1280, removeAttribute() {}, load() {}, set src(_) { queueMicrotask(() => this.onloadedmetadata?.()); } }) },
    XMLHttpRequest: class {
      constructor() { this.upload = {}; xhrs.push(this); }
      open() {} setRequestHeader() {} send(body) { this.body = body; }
      abort() { this.onabort?.(); }
      fail() { this.status = 503; this.onload?.(); }
      finish() { this.status = 200; this.onload?.(); }
    },
    fetch: async (url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
      if (url.startsWith("/api/demo/list")) return Response.json({ ok: true, demos: inventory });
      if (url === "/api/demo/create-upload-url") return Response.json({ ok: true, demoId: `demo-${++nextId}`, key: `key-${nextId}`, uploadUrl: "https://upload.test/file" });
      if (url === "/api/demo/complete-upload") {
        if (failCompletionOnce && !completionFailed) { completionFailed = true; throw new Error("Lost completion response"); }
        return Response.json({ ok: true });
      }
      if (url === "/api/demo/delete") { const id = JSON.parse(init.body).demoId; if (cleanupWait) await cleanupWait.promise; if (id === deleteFailure) return Response.json({ ok: false }, { status: 503 }); inventory = inventory.filter(d => d.id !== id); return Response.json({ ok: true }); }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  let tree;
  const render = () => { cursor = 0; tree = fixtureModule.UploadedPostsTab({ embeddedInLibrary: true }); while (effects.length) effects.shift()(); return tree; };
  const workspace = () => nodes(render()).find(n => n.type?.name === "EmbeddedDemoWorkspace").props;
  return { calls, xhrs, render, workspace, async refresh() { await workspace().onRefresh(); await tick(); }, get tree() { return tree; } };
}

test("real Demo callbacks upload two files concurrently, cancel queued files, refresh once and release completed Files", async () => {
  const h = workspaceHarness();
  await h.workspace().onFiles([file("a.mp4"), file("b.mp4"), file("cancel.mp4")]); await tick();
  assert.equal(h.xhrs.length, 2);
  const cancelled = h.workspace().uploadQueue.find(item => item.fileName === "cancel.mp4");
  assert.equal(cancelled.status, "idle"); h.workspace().onCancelQueueItem(cancelled.id);
  h.xhrs.forEach(xhr => xhr.finish()); await tick(); await tick();
  assert.equal(h.calls.filter(call => call.url.startsWith("/api/demo/list")).length, 1);
  assert.equal(h.calls.filter(call => call.url === "/api/demo/create-upload-url").length, 2);
  const completed = h.workspace().uploadQueue;
  assert.equal(completed.length, 2); assert.ok(completed.every(item => item.status === "done" && item.file === null && item.request === null));
});

test("an uncertain Demo completion retries the same uploaded object instead of deleting or reuploading it", async () => {
  const h = workspaceHarness({ failCompletionOnce: true });
  await h.workspace().onFiles([file("demo.mp4")]); await tick(); h.xhrs[0].finish(); await tick(); await tick();
  const failed = h.workspace().uploadQueue[0]; assert.equal(failed.status, "failed"); assert.equal(failed.completion.demoId, "demo-1");
  assert.equal(failed.file, null, "A saved completion receipt can recover without retaining the original File");
  h.workspace().onRetryQueueItem(failed.id); await tick(); await tick();
  assert.equal(h.workspace().uploadQueue[0].status, "done");
  assert.equal(h.xhrs.length, 1); assert.equal(h.calls.filter(call => call.url === "/api/demo/create-upload-url").length, 1);
  assert.equal(h.calls.filter(call => call.url === "/api/demo/delete").length, 0);
  assert.deepEqual(h.calls.filter(call => call.url === "/api/demo/complete-upload").map(call => call.body.demoId), ["demo-1", "demo-1"]);
});

test("a failed Demo transfer exposes Retry only after its cleanup releases the queue slot", async () => {
  const cleanup = deferred(), h = workspaceHarness({ cleanupWait: cleanup });
  await h.workspace().onFiles([file("retry.mp4")]); await tick();
  h.xhrs[0].fail(); await tick();
  const pending = h.workspace().uploadQueue[0];
  assert.notEqual(pending.status, "failed", "Retry must not appear while cleanup still owns the transfer slot");
  assert.match(pending.message, /Cleaning up/);
  cleanup.resolve(); await tick(); await tick();
  const failed = h.workspace().uploadQueue[0]; assert.equal(failed.status, "failed");
  h.workspace().onRetryQueueItem(failed.id); await tick();
  assert.equal(h.xhrs.length, 2, "The visible Retry starts a new transfer");
  h.xhrs[1].finish(); await tick(); await tick();
  assert.equal(h.workspace().uploadQueue[0].status, "done");
});

test("real Demo bulk-delete callbacks keep failed HTTP deletions visible and selected", async () => {
  const demos = ["a", "b", "c"].map(id => ({ id, status: "ready", updated_at: "now", project_id: "project", source_s3_key: id }));
  const h = workspaceHarness({ initialDemos: demos, deleteFailure: "b" }); await h.refresh();
  for (const demo of demos) h.workspace().onToggleSelect(demo.id);
  const action = nodes(h.render()).find(n => n.type?.name === "BulkActionBar"); action.props.onDeleteSelected();
  const confirm = nodes(h.render()).find(n => n.type === "button" && n.props.onClick && nodes(n).some(child => child.type === "span" && Array.isArray(child.props.children) && child.props.children[0] === "Delete "));
  assert.ok(confirm, "Bulk deletion must expose its confirmation action");
  await confirm.props.onClick(); await tick();
  assert.deepEqual(Array.from(h.workspace().selectedDemoIds), ["b"]); assert.deepEqual(h.workspace().demos.map(demo => demo.id), ["b"]);
  assert.match(h.workspace().errorMessage, /could not be deleted/);
});
