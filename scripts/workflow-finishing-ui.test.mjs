import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as finishClient from "../lib/explore/workflow-finishing-client.ts";
import * as scheduleClient from "../lib/explore/workflow-schedule-client.ts";
import * as defaultMusicClient from "../lib/explore/workflow-default-music-client.ts";

const load = (path, imports, globals = {}) => {
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: exported, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, Error, ...globals });
  return exported;
};
const tick = () => new Promise(setImmediate);
const source = { id: randomUUID(), status: "ready", collection: "video", durationSeconds: 5 };
const output = { id: randomUUID(), status: "ready", collection: "video", url: "https://storage.googleapis.com/test/finished.mp4" };
function harness({ saved = null, lost = false, completed = false, subtitles = false, backgroundMusic = false, musicUnavailable = false } = {}) {
  let cursor = 0, pendingFailure = lost;
  const slots = [], effects = [], calls = [], musicReads = [], uploads = [], store = new Map();
  const musicAssetId = randomUUID();
  const storageKey = finishClient.finishStorageKey("owner", "hook");
  if (saved) store.set(storageKey, JSON.stringify(saved));
  const props = { ownerId: "owner", enabled: true, kind: "hook", source, demo: null, demoAudio: null, playback: "once", options: { subtitles, style: "clean", backgroundMusic }, onRestoreOptions(value) { props.options = value; } };
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) slots[i] = { deps, fn }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; const prior = slots[i]; if (!prior || deps.some((v, n) => !Object.is(v, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const module = load("components/explore/use-workflow-finishing.ts", {
    react, "@/lib/explore/workflow-finishing-client": finishClient,
    "@/lib/explore/workflow-default-music-client": defaultMusicClient,
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owner-token"; } },
    "@/lib/ai-studio/media-client": { fetchAIStudioMediaAsset: async id => { assert.equal(id, output.id); return output; } },
    "@/lib/ai-studio/reference-media-upload": { uploadAIStudioReferenceMedia: async (file, kind, _limit, owner, options) => {
      assert.equal(owner, "owner"); assert.equal(kind, "audio"); assert.equal(options.purpose, "explore-demo");
      assert.equal(file.name, "default-background.mp3"); uploads.push(file); return { asset: { id: musicAssetId } };
    } },
  }, {
    crypto: { randomUUID },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    navigator: { locks: { request: async (_key, _opts, run) => run({}) } },
    setInterval: () => 1, clearInterval() {},
    fetch: async (url, init) => {
      if (url === "/api/explore/default-music") {
        musicReads.push({ url, ...init });
        return musicUnavailable ? Response.json({ error: "Default background music is not configured yet." }, { status: 503 }) : new Response("offline-music", { headers: { "Content-Type": "audio/mpeg", "X-Explore-Music-Loopable": "true" } });
      }
      calls.push({ url, ...init });
      if (init.method === "POST" && pendingFailure) { pendingFailure = false; throw new Error("lost response"); }
      const entry = init.method === "POST" ? JSON.parse(init.body) : JSON.parse(store.get(storageKey));
      return Response.json({ ok: true, receiptVersion: 1, requestKey: entry.requestKey, outcome: completed || init.method === "POST" ? "completed" : "unconfirmed", mediaAssetId: completed || init.method === "POST" ? output.id : null, message: "Saved output." });
    },
  });
  return { props, calls, musicReads, uploads, musicAssetId, store, storageKey, render() { cursor = 0; const view = module.useWorkflowFinishing(props); while (effects.length) effects.shift()(); return view; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test("background OFF never fetches or uploads music and always submits a null background", async () => {
  const h = harness(); h.render(); await tick(); h.render().action.onAction(); await tick();
  assert.equal(h.musicReads.length, 0); assert.equal(h.uploads.length, 0);
  assert.equal(JSON.parse(h.calls[0].body).draft.backgroundAssetId, null); h.unmount();
});

test("background ON snapshots owned approved audio only on Apply; retry retains that exact ID", async () => {
  const h = harness({ backgroundMusic: true, lost: true }); h.render(); await tick();
  assert.equal(h.musicReads.length, 0); h.render().action.onAction(); await tick(); await tick();
  let view = h.render(); assert.match(view.action.error, /lost response/);
  const first = JSON.parse(h.calls[0].body).draft;
  assert.equal(first.backgroundAssetId, h.musicAssetId); assert.equal(first.backgroundPlayback, "repeat");
  assert.equal(first.demoAudioAssetId, null); assert.equal(h.musicReads[0].headers.Authorization, "Bearer owner-token");
  view.action.onAction(); await tick();
  assert.equal(h.calls[1].body, h.calls[0].body); assert.equal(h.musicReads.length, 1); assert.equal(h.uploads.length, 1);
  h.props.options = { ...h.props.options, backgroundMusic: false }; view = h.render(); assert.equal(view.output, null);
  view.action.onAction(); await tick();
  assert.equal(JSON.parse(h.calls.at(-1).body).draft.backgroundAssetId, null); assert.equal(h.musicReads.length, 1); h.unmount();
});

test("missing approved default fails before uploading or dispatching any finishing job", async () => {
  const h = harness({ backgroundMusic: true, musicUnavailable: true }); h.render(); await tick(); h.render().action.onAction(); await tick(); await tick();
  assert.match(h.render().action.error, /not configured/); assert.equal(h.calls.length, 0); assert.equal(h.uploads.length, 0); assert.equal(h.store.size, 0); h.unmount();
});

test("reload restores the music switch and turning it OFF invalidates the saved music-bearing output", async () => {
  const saved = { version: 1, ownerId: "owner", kind: "hook", requestKey: randomUUID(), draft: { version: 1, kind: "hook", sourceAssetId: source.id, demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: randomUUID(), backgroundPlayback: "repeat", subtitles: null } };
  const h = harness({ saved, completed: true }); h.render(); await tick(); let view = h.render();
  assert.equal(h.props.options.backgroundMusic, true); assert.equal(view.output.id, output.id); assert.equal(h.musicReads.length, 0); assert.equal(h.uploads.length, 0);
  h.props.options = { ...h.props.options, backgroundMusic: false }; view = h.render(); assert.equal(view.output, null); h.unmount();
});
test("Apply edits is enabled only after hydration and a saved source; lost responses retain the exact request", async () => {
  const h = harness({ lost: true });
  assert.equal(h.render().action.disabled, true);
  await tick(); let view = h.render(); assert.equal(view.action.disabled, false);
  view.action.onAction(); await tick(); view = h.render(); assert.match(view.action.error, /lost response/);
  const first = h.calls[0]; assert.equal(first.method, "POST"); assert.ok(h.store.get(h.storageKey));
  view.action.onAction(); await tick(); view = h.render();
  assert.equal(h.calls[1].body, first.body); assert.equal(h.calls[1].headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
  assert.equal(view.output.id, output.id);
  view.action.onAction(); await tick(); h.render();
  assert.equal(h.calls.filter(c => c.method === "POST").length, 2); assert.equal(h.calls.at(-1).method, "GET");
  h.unmount();
});
test("reload reads the owned saved finish, restores subtitle controls and offers its actual output without resubmitting", async () => {
  const saved = { version: 1, ownerId: "owner", kind: "hook", requestKey: randomUUID(), draft: { version: 1, kind: "hook", sourceAssetId: source.id, demoAssetId: null, demoAudioAssetId: null, demoAudioPlayback: "once", backgroundAssetId: null, backgroundPlayback: "once", subtitles: { language: "en", style: "active-word", placement: "bottom" } } };
  const h = harness({ saved, completed: true }); h.render(); await tick(); const view = h.render();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, "GET");
  assert.equal(h.props.options.subtitles, true); assert.equal(h.props.options.style, "active-word"); assert.equal(view.output.id, output.id);
  h.props.options = { subtitles: true, style: "bold-box" }; assert.equal(h.render().output, null);
  h.unmount();
});
test("a missing source or malformed recovery record cannot create a replacement finishing job", async () => {
  for (const malformed of [false, true]) {
    const h = harness(); h.props.source = null;
    if (malformed) h.store.set(h.storageKey, "broken-json");
    h.render(); await tick(); const view = h.render(); assert.equal(view.action.disabled, true);
    view.action.onAction(); await tick(); assert.equal(h.calls.length, 0); h.unmount();
  }
});

test("a lost upload completion response is recovered through GET and never deletes committed media", async () => {
  for (const recoverable of [true, false]) {
    const calls = [];
    class FakeImage { naturalWidth = 720; naturalHeight = 1280; set src(_) { queueMicrotask(() => this.onload?.()); } }
    const upload = load("lib/ai-studio/reference-media-upload.ts", { "@/lib/firebase/auth": { getCurrentUserIdToken: async () => "owner-token" } }, {
      window: { Image: FakeImage }, URL: { createObjectURL: () => "blob:fixture", revokeObjectURL() {} },
      fetch: async (url, init) => {
        calls.push({ url, ...init });
        if (url === "/api/media/create-upload-url") return Response.json({ ok: true, assetId: "asset-1", key: "owned/key", uploadUrl: "https://storage.googleapis.com/test/upload" });
        if (url.endsWith("/upload")) return new Response("", { status: 200 });
        if (url === "/api/media/complete-upload") throw new Error("lost completion response");
        if (url === "/api/media/asset-1") return Response.json(recoverable ? { ok: true, asset: { id: "asset-1", status: "ready", collection: "image" } } : { ok: false });
        throw new Error("Unexpected request");
      },
    });
    const attempt = upload.uploadAIStudioReferenceMedia({ type: "image/png", name: "image.png", size: 100 }, "image", undefined, "owner");
    if (recoverable) assert.equal((await attempt).asset.id, "asset-1"); else await assert.rejects(attempt, /lost completion/);
    assert.equal(calls.some(c => c.method === "DELETE"), false); assert.equal(calls.at(-1).cache, "no-store");
  }
});

function schedulingHarness({ kind = "hook", saved = null, lost = false, storageFails = false, locks = true, finished = output } = {}) {
  let cursor = 0, pendingFailure = lost;
  const slots = [], effects = [], calls = [], store = new Map();
  const storageKey = `ugc-explore:schedule:v1:owner:${kind}`;
  if (saved) store.set(storageKey, JSON.stringify(saved));
  const connectionId = saved?.input.targets[0].connectionId ?? randomUUID();
  const props = { enabled: true, ownerId: "owner", kind, source, demo: null, demoAudio: null, playback: "once", scheduleDraft: { connectionId, platform: "instagram", caption: "My caption", date: "2026-10-06", time: "15:30" }, children: value => value };
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) slots[i] = { deps, fn }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; const prior = slots[i]; if (!prior || deps.some((v, n) => !Object.is(v, prior.deps[n]))) effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const jsx = (type, value) => ({ type, props: value });
  const Editor = () => null;
  const module = load("components/explore/workflow-finishing-boundary.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    "next/dynamic": { default: (_loader, options) => { assert.equal(options.ssr, false); return Editor; } },
    "@/components/explore/use-workflow-finishing": { DEFAULT_FINISHING_OPTIONS: { subtitles: false, style: "clean" }, useWorkflowFinishing: () => ({ action: {}, output: finished }) },
    "@/lib/explore/workflow-schedule-client": scheduleClient,
    "@/lib/explore/workflow-connected-accounts": { parseWorkflowConnectedAccounts: value => { assert.equal(value.ok, true); return value.connections; } },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "owner-token"; } },
  }, {
    crypto: { randomUUID },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { if (storageFails) throw new Error("storage unavailable"); store.set(key, value); } },
    navigator: { locks: locks ? { request: async (_key, _opts, run) => run({}) } : undefined },
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      assert.equal(init.cache, "no-store"); assert.equal(init.headers.Authorization, "Bearer owner-token");
      if (url === "/api/social/connections") return Response.json({ ok: true, connections: [{ id: connectionId, platform: "instagram" }] });
      if (url === "/api/schedules?configOnly=1") return Response.json({ ok: true, minimumScheduleLeadMinutes: 5 });
      if (init.method === "POST") {
        const input = JSON.parse(init.body);
        assert.equal(JSON.parse(store.get(storageKey)).input.idempotencyKey, input.idempotencyKey, "persist before POST");
        if (pendingFailure) { pendingFailure = false; throw new Error("lost schedule response"); }
        return Response.json({ ok: true, schedule: { id: saved?.scheduleId ?? randomUUID(), mediaAssetId: input.source.id, idempotencyKey: input.idempotencyKey, status: "scheduled", targets: [{ socialConnectionId: input.targets[0].connectionId, platform: input.targets[0].platform }] } });
      }
      if (url === "/api/schedules") return Response.json({ ok: true, schedules: [] });
      if (saved?.scheduleId && url === `/api/schedules/${saved.scheduleId}`) return Response.json({ ok: true, schedule: { id: saved.scheduleId, mediaAssetId: saved.input.source.id, idempotencyKey: saved.input.idempotencyKey, status: "scheduled", targets: [{ socialConnectionId: connectionId, platform: "instagram" }] } });
      throw new Error(`Unexpected schedule request ${url}`);
    },
  });
  const submission = { caption: "Confirmed caption", scheduledSource: { kind: "media_asset", id: finished?.id ?? output.id }, targets: [{ connectionId, platform: "instagram", settings: { placement: "reels" } }], scheduledFor: "2026-10-06T10:00:00.000Z", scheduledDate: "2026-10-06", scheduledTime: "15:30", timezone: "Asia/Calcutta" };
  return { calls, props, store, storageKey, submission, render() {
    cursor = 0; const tree = module.WorkflowFinishingBoundary(props); while (effects.length) effects.shift()();
    return { view: tree.props.children[0].props.value, editor: tree.props.children[1]?.props ?? null };
  }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test("both Explore workflows open account confirmation before posting and keep the exact confirmed settings on retry", async () => {
  for (const kind of ["hook", "phone"]) {
    const h = schedulingHarness({ kind, lost: true });
    assert.equal(h.render().view.schedule.disabled, true);
    await tick(); let screen = h.render(); assert.equal(screen.view.schedule.disabled, false);
    screen.view.schedule.onAction(); await tick(); screen = h.render();
    assert.ok(screen.editor); assert.equal(h.calls.some(c => c.method === "POST"), false);
    assert.equal(screen.editor.initialDemoMediaId, output.id); assert.equal(screen.editor.initialCaption, h.props.scheduleDraft.caption);
    assert.equal(screen.editor.initialPlannedTargets[0].connectionId, h.submission.targets[0].connectionId);
    assert.equal(screen.editor.requireScheduleTarget, true); assert.equal(screen.editor.minimumScheduleLeadMinutes, 5);
    screen.editor.onSave(h.submission); await tick(); screen = h.render();
    assert.match(screen.view.schedule.error, /lost schedule response/);
    const first = h.calls.find(c => c.method === "POST"); const input = JSON.parse(first.body);
    assert.equal(input.source.id, output.id); assert.equal(input.caption, h.submission.caption);
    assert.equal(input.timezone, h.submission.timezone); assert.deepEqual(input.targets, h.submission.targets);
    h.props.scheduleDraft = { ...h.props.scheduleDraft, caption: "Changed draft", connectionId: randomUUID() };
    screen.view.schedule.onAction(); await tick(); screen = h.render();
    const posts = h.calls.filter(c => c.method === "POST"); assert.equal(posts.length, 2); assert.equal(posts[1].body, first.body);
    assert.match(screen.view.schedule.message, /is scheduled/); assert.equal(screen.view.schedule.disabled, true); assert.equal(screen.editor, null);
    h.unmount();
  }
});

test("scheduling reload only reads and can explicitly resume the original video/account even without local draft media", async () => {
  const saved = { version: 1, owner: "owner", kind: "hook", input: { caption: "Original caption", source: { kind: "media_asset", id: output.id }, targets: [{ connectionId: randomUUID(), platform: "instagram" }], scheduledFor: "2026-10-06T10:00:00.000Z", timezone: "Asia/Calcutta", idempotencyKey: `explore:${randomUUID()}` } };
  const h = schedulingHarness({ saved, finished: null }); h.render(); await tick(); const screen = h.render();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, "/api/schedules"); assert.equal(h.calls[0].method, undefined);
  assert.equal(screen.view.schedule.disabled, false); screen.view.schedule.onAction(); await tick();
  assert.deepEqual(JSON.parse(h.calls.find(c => c.method === "POST").body), saved.input);
  assert.equal(h.render().view.schedule.disabled, true); h.unmount();
});

test("a restored confirmed schedule is checked rather than posted again", async () => {
  const saved = { version: 1, owner: "owner", kind: "hook", scheduleId: randomUUID(), input: { caption: "Original caption", source: { kind: "media_asset", id: output.id }, targets: [{ connectionId: randomUUID(), platform: "instagram" }], scheduledFor: "2026-10-06T10:00:00.000Z", timezone: "Asia/Calcutta", idempotencyKey: `explore:${randomUUID()}` } };
  const h = schedulingHarness({ saved }); h.render(); await tick(); const screen = h.render();
  assert.equal(screen.view.schedule.disabled, true); assert.match(screen.view.schedule.message, /is scheduled/);
  screen.view.schedule.onAction(); await tick(); assert.equal(h.calls.some(c => c.method === "POST"), false); h.unmount();
});

test("scheduling refuses wrong media/accounts, missing durable storage and unsafe cross-tab dispatch", async () => {
  for (const mode of ["source", "account", "storage", "locks"]) {
    const h = schedulingHarness({ storageFails: mode === "storage", locks: mode !== "locks" });
    h.render(); await tick(); h.render().view.schedule.onAction(); await tick(); let screen = h.render();
    if (mode === "locks") assert.match(screen.view.schedule.error, /Web Locks/);
    else {
      const invalid = { ...h.submission, ...(mode === "source" ? { scheduledSource: { kind: "media_asset", id: randomUUID() } } : mode === "account" ? { targets: [{ connectionId: randomUUID(), platform: "instagram" }] } : {}) };
      screen.editor.onSave(invalid); await tick(); screen = h.render(); assert.ok(screen.view.schedule.error);
    }
    assert.equal(h.calls.some(c => c.method === "POST"), false); h.unmount();
  }
});
