import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports, globals = {}) {
  const exported = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: exported, require(name) { assert.ok(name in imports, name); return imports[name]; },
    Response, Request, Map, Date, Number, Error, encodeURIComponent, console, setTimeout, clearTimeout, ...globals });
  return exported;
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("registered demo sources require exact owner/project/media linkage and a trusted registration marker", async () => {
  for (const [metadata, accepted] of [
    [{ mcpUpload: true, mcpDemo: true }, true],
    [{ demoImportedFromUpload: true, demoId: id(1) }, true],
    [{ demoImportedFromUpload: true, demoId: id(2) }, false],
    [{ demoImportedFromUpload: "true", demoId: id(1) }, false],
    [{ mcpDemo: true }, false], [{}, false], [null, false],
  ]) {
    const filters = {};
    const { isRegisteredMcpDemoForOwner } = load("lib/demo/demo-library.ts", {
      "server-only": {}, "@/lib/mcp/store": { getMcpStore: () => ({ from(table) {
        assert.equal(table, "media_assets");
        return { select(value) { assert.equal(value, "id,metadata"); return this; },
          eq(key, value) { filters[key] = value; return this; },
          is(key, value) { filters[key] = value; return this; },
          async maybeSingle() { return { data: { id: id(1), metadata }, error: null }; } };
      } }) },
    });
    assert.equal(await isRegisteredMcpDemoForOwner({ userId: "owner", demoId: id(1), projectId: "default", key: "original-key" }), accepted);
    assert.deepEqual(filters, { id: id(1), user_id: "owner", project_id: "default", source_type: "demo_upload", source_record_id: id(1), storage_key: "original-key", collection: "video", deleted_at: null });
  }
});

test("Content inventory requires both an owned demo and its ready projection, retaining the current Content title", async () => {
  const row = (n, patch = {}) => ({ id: id(n), status: "ready", user_id: "owner", source_type: "demo_upload", ...patch });
  const mod = load("lib/demo/content-demo-sources.ts", {
    "server-only": {}, "@/lib/demo/demo-api": { DEFAULT_DEMO_PROJECT_ID: "default" },
    "@/lib/demo/demo-storage": { listDemoVideos: async query => {
      assert.deepEqual(JSON.parse(JSON.stringify(query)), { userId: "owner", projectId: "default" });
      return [1, 2, 3, 4, 5].map(n => ({ id: id(n), status: n === 5 ? "processing" : "ready", title: `Renamed demo ${n}`, updated_at: "current" }));
    } },
    "@/lib/media/media-storage": {
      listMediaAssets: async query => {
        assert.equal(query.userId, "owner"); assert.equal(query.collection, "video"); assert.deepEqual(Array.from(query.sourceTypes), ["demo_upload"]);
        return [row(1), row(2, { status: "uploading" }), row(3, { user_id: "other" }), row(4, { source_type: "upload" }), row(5), row(6)];
      }, serializeMediaAsset: value => ({ id: value.id, title: "Stale media title", sourceType: value.source_type }),
    },
  });
  const assets = await mod.listContentDemoSources("owner");
  assert.equal(assets.length, 1); assert.equal(assets[0].id, id(1)); assert.equal(assets[0].title, "Renamed demo 1");
});

test("Content source route authenticates and returns only its current owner inventory; failures remain actionable", async () => {
  for (const state of ["ready", "unauthenticated", "unavailable"]) {
    let reads = 0;
    const mod = load("app/api/demo/sources/route.ts", {
      "@/lib/demo/demo-api": { authenticateDemoRequest: async () => state === "unauthenticated" ? { ok: false, response: Response.json({}, { status: 401 }) } : { ok: true, user: { uid: "owner" } }, jsonResponse: (value, status = 200) => Response.json(value, { status }) },
      "@/lib/demo/content-demo-sources": { listContentDemoSources: async owner => { reads++; assert.equal(owner, "owner"); if (state === "unavailable") throw new Error("offline"); return [{ id: id(1) }]; } },
    });
    const response = await mod.GET(new Request("https://offline.invalid/api/demo/sources"));
    assert.equal(response.status, state === "ready" ? 200 : state === "unauthenticated" ? 401 : 503);
    assert.equal(reads, state === "unauthenticated" ? 0 : 1);
  }
});

test("Content saved-edit discovery is owner-bound, demo-only, batched, and refuses foreign rows", async () => {
  const ids = Array.from({ length: 205 }, (_, i) => id(i + 1)), batches = [];
  let foreign = false;
  const db = { from(table) {
    assert.equal(table, "explore_clip_drafts"); const filters = {};
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, async in(key, values) {
      assert.equal(key, "source_asset_id"); assert.equal(filters.user_id, "owner"); assert.equal(filters.scope, "hook:demo"); batches.push(values);
      return { error: null, data: values.map(source_asset_id => ({ user_id: foreign ? "other" : "owner", scope: "hook:demo", source_asset_id, revision: 2, updated_at: "2026-10-14T00:00:00Z" })) };
    } };
  } };
  class DraftError extends Error {}
  const { ExploreClipDraftStore } = load("lib/explore/clip-draft-store.ts", {
    "server-only": {},
    "@supabase/supabase-js": {},
    "./clip-draft-contract": { ExploreClipDraftError: DraftError },
    "../../worker/src/lib/hook-source-timeline.ts": { parseHookSourceTimeline() {} },
    "../../worker/src/lib/hook-keyframe-generation-contract.ts": { parseHookKeyframeGenerationReceipt() {} },
  });
  const store = new ExploreClipDraftStore(db);
  assert.equal((await store.listContentDemoEdits("owner", ids)).size, 205);
  assert.deepEqual(batches.map(batch => batch.length), [100, 100, 5]);
  foreign = true; await assert.rejects(store.listContentDemoEdits("owner", [ids[0]]), /verify/);
  batches.length = 0; assert.equal((await store.listContentDemoEdits("owner", [])).size, 0); assert.equal(batches.length, 0);
});

test("Content list associates saved edits with the existing demo and still loads footage during draft-service failure", async () => {
  for (const unavailable of [false, true]) {
    const { GET } = load("app/api/demo/list/route.ts", {
      "@/lib/demo/demo-api": { authenticateDemoRequest: async () => ({ ok: true, user: { uid: "owner" } }), getMissingDemoRuntimeEnvVars: () => [], getProjectIdFromUrl: () => "default", jsonResponse: (value, status = 200) => Response.json(value, { status }) },
      "@/lib/demo/demo-storage": { listDemoVideos: async () => [{ id: id(1), title: "Keep this title", status: "rendered", rendered_video_url: "existing.mp4" }] },
      "@/lib/explore/clip-draft-store": { ExploreClipDraftStore: class { async listContentDemoEdits(owner, ids) {
        assert.equal(owner, "owner"); assert.deepEqual(Array.from(ids), [id(1)]);
        if (unavailable) throw new Error("temporarily unavailable"); return new Map([[id(1), { scope: "hook:demo", revision: 2 }]]);
      } } },
    });
    const response = await GET(new Request("https://offline.invalid/api/demo/list")), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.demos[0].title, "Keep this title"); assert.equal(result.demos[0].rendered_video_url, "existing.mp4");
    assert.equal(result.demoEditsUnavailable, unavailable); assert.equal(result.demos[0].explore_edit?.revision ?? null, unavailable ? null : 2);
  }
});

test("a lost demo completion response recovers the same saved Content asset and never deletes it", async () => {
  for (const recoverable of [true, false]) {
    const calls = [];
    const { uploadHookVideoDemo } = load("lib/trending/hook-video-client-upload.ts", {
      "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { assert.equal(owner, "owner"); return "token"; } },
    }, {
      URL: { createObjectURL: () => "blob:demo", revokeObjectURL() {} },
      document: { createElement() { const video = { duration: 5, videoWidth: 720, videoHeight: 1280 }; Object.defineProperty(video, "src", { set() { queueMicrotask(() => video.onloadedmetadata()); } }); return video; } },
      fetch: async (url, init) => {
        calls.push({ url, init });
        if (url === "/api/demo/create-upload-url") return Response.json({ ok: true, demoId: id(1), key: "demo-key", uploadUrl: "https://upload.invalid/demo" });
        if (url === "https://upload.invalid/demo") return new Response(null, { status: 200 });
        if (url === "/api/demo/complete-upload") throw new Error("lost acknowledgement");
        assert.equal(url, `/api/media/${id(1)}`);
        return Response.json({ ok: true, asset: recoverable ? { id: id(1), sourceType: "demo_upload", status: "ready" } : null });
      },
    });
    const pending = uploadHookVideoDemo({ name: "demo.mp4", type: "video/mp4", size: 100 }, "owner");
    if (recoverable) assert.equal((await pending).id, id(1)); else await assert.rejects(pending, /lost acknowledgement/);
    assert.equal(calls.filter(call => call.init.method === "DELETE").length, 0);
    assert.equal(calls.filter(call => call.url === "/api/demo/create-upload-url").length, 1);
  }
});
