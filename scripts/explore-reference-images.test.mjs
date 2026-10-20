import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { readSlideshowGenerationSlot } from "../worker/src/lib/slideshow-generation-batch.ts";

function load(file, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (name === "@/worker/src/lib/slideshow-generation-batch") return { readSlideshowGenerationSlot }; assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return exports;
}

const image = (overrides = {}) => ({ id: "owned-image", collection: "image", status: "ready", sourceType: "upload", mimeType: "image/png", fileName: "reference.png", projectId: "explore-reference", ...overrides });
function client({ assets = [image()], asset = image(), token = "owner-token", status = 200, ok = true } = {}) {
  const reads = [], owners = [];
  const imageLibrary = load("lib/explore/format-reference-images.ts", {
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [{ fileName: "creator-reference-01.png" }] },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { owners.push(owner); return token; } },
  }, { fetch: async (url, options) => { reads.push({ url, options }); return new Response(JSON.stringify({ ok, assets, asset }), { status }); } });
  return { ...imageLibrary, reads, owners };
}

test("saved image listing keeps user uploads and excludes catalogue copies and unsupported or unfinished media", async () => {
  const h = client({ assets: [image(), image({ id: "studio", projectId: "ai-studio" }), image({ id: "carousel", projectId: "trending-carousel-slide" }), image({ id: "unclassified", projectId: null }), image({ id: "new-upload", projectId: "explore-reference" }), image({ id: "catalog", projectId: "explore-catalog-reference" }),
    image({ id: "old-catalog", projectId: "ai-studio", fileName: "creator-reference-01.png" }), image({ id: "user-same-name", projectId: "explore-reference", fileName: "creator-reference-01.png" }),
    image({ id: "failed", status: "failed" }), image({ id: "pending", status: "uploading" }), image({ id: "video", collection: "video" }),
    image({ id: "generated", sourceType: "generated_image" }), image({ id: "gif", mimeType: "image/gif" }), image({ id: "jpeg", mimeType: "image/jpeg" }), image({ id: "webp", mimeType: "image/webp" }),
  ] });
  const controller = new AbortController();
  const result = await h.fetchFormatReferenceImages("owner-a", controller.signal);
  assert.equal(JSON.stringify(result.map(asset => asset.id)), JSON.stringify(["owned-image", "new-upload", "user-same-name", "jpeg", "webp"]));
  assert.deepEqual(h.owners, ["owner-a"]);
  assert.equal(h.reads[0].url, "/api/media?collection=image&sourceTypes=upload&projectId=explore-reference");
  assert.equal(h.reads[0].options.headers.Authorization, "Bearer owner-token");
  assert.equal(h.reads[0].options.cache, "no-store"); assert.equal(h.reads[0].options.signal, controller.signal);
  // A fresh picker loads from the account API again, rather than browser-local URLs.
  assert.equal((await h.fetchFormatReferenceImages("owner-a"))[0].id, "owned-image"); assert.equal(h.reads.length, 2);
});

test("saved image reuse resolves the owned ID and rejects missing, wrong-ID or non-ready records", async () => {
  const h = client({ asset: image({ id: "image/with spaces" }) });
  const ready = await h.fetchFormatReferenceImage("image/with spaces", "owner-a");
  assert.equal(ready.id, "image/with spaces"); assert.deepEqual(h.owners, ["owner-a"]);
  assert.equal(h.reads[0].url, "/api/media/image%2Fwith%20spaces");
  assert.equal(h.reads[0].options.cache, "no-store");
  for (const options of [{ asset: null }, { asset: image({ id: "foreign-id" }) }, { asset: image({ status: "failed" }) }, { asset: image({ projectId: "explore-catalog-reference" }) }, { status: 404, ok: false }]) {
    await assert.rejects(client(options).fetchFormatReferenceImage("owned-image", "owner-a"), /no longer available/);
  }
});

test("signed-out or changed accounts cannot request another owner's saved images", async () => {
  const signedOut = client({ token: null });
  await assert.rejects(signedOut.fetchFormatReferenceImages("owner-a"), /Sign in/);
  await assert.rejects(signedOut.fetchFormatReferenceImage("owned-image", "owner-a"), /Sign in/);
  assert.equal(signedOut.reads.length, 0);
  let reads = 0;
  const changed = load("lib/explore/format-reference-images.ts", {
    "@/lib/ai-studio/creator-references": { CREATOR_REFERENCES: [] },
    "@/lib/firebase/auth": { getCurrentUserIdToken: async expectedOwner => { assert.equal(expectedOwner, "original-owner"); throw new Error("Your signed-in account changed."); } },
  }, { fetch: () => { reads++; } });
  await assert.rejects(changed.fetchFormatReferenceImages("original-owner"), /account changed/);
  assert.equal(reads, 0);
});

test("list failures are reported without presenting a false empty library", async () => {
  for (const options of [{ status: 500, ok: false }, { assets: null }]) {
    await assert.rejects(client(options).fetchFormatReferenceImages("owner-a"), /Could not load your images/);
  }
});

test("Explore origin filtering happens in the owner-scoped database query; other media lists stay broad", async () => {
  const calls = [];
  const query = { then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
  for (const method of ["select", "eq", "is", "in", "order"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  const storage = load("lib/media/media-storage.ts", {
    "server-only": {},
    "@supabase/supabase-js": { createClient: () => ({ from: name => { assert.equal(name, "media_assets"); return query; } }) },
    "@/lib/media/types": { mediaCollections: ["image"] },
    "@/lib/media/media-delivery": {},
    "@/lib/storage/storage": {},
    "@/worker/src/lib/explore-reference-soundtrack": {},
  }, { process: { env: { SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test-only" } } });
  await storage.listMediaAssets({ userId: "owner-a", collection: "image", sourceTypes: ["upload"], projectId: "explore-reference" });
  assert.ok(calls.some(call => JSON.stringify(call) === '["eq","user_id","owner-a"]'));
  assert.ok(calls.some(call => JSON.stringify(call) === '["eq","project_id","explore-reference"]'));
  assert.ok(calls.some(call => JSON.stringify(call) === '["is","deleted_at",null]'));
  calls.length = 0;
  await storage.listMediaAssets({ userId: "owner-a", collection: "image" });
  assert.ok(!calls.some(call => call[1] === "project_id"));
});

test("image uploads persist the chosen origin through the existing prepare, upload and completion flow", async () => {
  for (const purpose of ["explore-reference", "explore-catalog-reference", undefined]) {
    const requests = [], owners = [], released = [];
    let projectId;
    const uploader = load("lib/ai-studio/reference-media-upload.ts", {
      "@/lib/firebase/auth": { getCurrentUserIdToken: async owner => { owners.push(owner); return "owner-token"; } },
    }, {
      URL: { createObjectURL: () => "blob:reference", revokeObjectURL: url => released.push(url) },
      window: { Image: class { naturalWidth = 720; naturalHeight = 1280; set onload(callback) { queueMicrotask(callback); } } },
      fetch: async (url, options) => {
        requests.push({ url, options });
        if (url === "/api/media/create-upload-url") {
          projectId = JSON.parse(options.body).projectId;
          return new Response(JSON.stringify({ ok: true, assetId: "owned-image", key: "owned/image", uploadUrl: "https://storage.test/owned-image", requiredHeaders: { "Content-Type": "image/png" } }));
        }
        if (url === "https://storage.test/owned-image") return new Response(null, { status: 200 });
        assert.equal(url, "/api/media/complete-upload");
        const body = JSON.parse(options.body); assert.equal(body.width, 720); assert.equal(body.height, 1280); assert.equal(body.assetId, "owned-image");
        return new Response(JSON.stringify({ ok: true, asset: image({ projectId }) }));
      },
    });
    const file = new File(["image"], "reference.png", { type: "image/png" });
    const selected = await uploader.uploadAIStudioReferenceMedia(file, "image", 3, "owner-a", purpose ? { purpose } : undefined);
    assert.equal(projectId, purpose ?? "ai-studio"); assert.equal(selected.asset.projectId, projectId);
    assert.deepEqual(owners, ["owner-a"]); assert.deepEqual(released, ["blob:reference"]);
    assert.equal(requests.length, 3); assert.equal(requests[1].options.method, "PUT"); assert.equal(requests[1].options.body, file);
    assert.equal(requests[0].options.headers.Authorization, "Bearer owner-token"); assert.equal(requests[2].options.headers.Authorization, "Bearer owner-token");
    const reopened = client({ assets: [selected.asset] });
    assert.equal((await reopened.fetchFormatReferenceImages("owner-a")).length, purpose === "explore-reference" ? 1 : 0);
  }
});

test("the existing media API authenticates list and single-image requests and ignores a forged owner", async () => {
  const calls = [];
  class AuthError extends Error { constructor() { super("Sign in"); this.status = 401; } }
  const auth = { FirebaseAuthRequestError: AuthError, requireFirebaseUser: async request => {
    if (request.headers.get("Authorization") !== "Bearer owner-token") throw new AuthError();
    return { uid: "owner-a" };
  } };
  const media = { listMediaAssets: async args => { calls.push(args); return [{ source_type: "upload", metadata: {}, status: "ready" }]; },
    serializeMediaAsset: value => value, getMediaAssetForOwner: async args => { calls.push(args); return args.assetId === "owned-image" ? image() : null; } };
  const types = load("lib/media/types.ts", {});
  const list = load("app/api/media/route.ts", {
    "@/lib/ai-studio/generated-video-history-metadata": { getGeneratedVideoHistoryMetadata: () => ({}) },
    "@/lib/ai-studio/generated-image-history-metadata": { getGeneratedImageHistoryMetadata: () => ({}) },
    "@/lib/jobs/background-jobs": { getBackgroundJobsByIds: async () => [] },
    "@/lib/firebase/server-auth": auth, "@/lib/media/media-storage": media, "@/lib/media/types": types,
    "@/lib/media/media-library-visibility": load("lib/media/media-library-visibility.ts", {}),
  }, { Response, URL, console });
  const get = load("app/api/media/[assetId]/route.ts", { "@/lib/ai-studio/generated-image-history-metadata": { getGeneratedImageHistoryMetadata: () => ({}) }, "@/lib/firebase/server-auth": auth, "@/lib/media/media-storage": media,
    "@/lib/jobs/background-jobs": { getBackgroundJobsByIds: async () => [] },
    "@/lib/explore/remix-source": load("lib/explore/remix-source.ts", {}) }, { Response, URL, console });
  const url = "https://www.getugcpilot.com/api/media?collection=image&sourceTypes=upload&projectId=explore-reference&userId=owner-b";
  assert.equal((await list.GET(new Request(url))).status, 401); assert.equal(calls.length, 0);
  const response = await list.GET(new Request(url, { headers: { Authorization: "Bearer owner-token" } }));
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(calls[0].projectId, "explore-reference"); assert.equal(calls[0].userId, "owner-a"); assert.equal(calls[0].collection, "image"); assert.equal(JSON.stringify(calls[0].sourceTypes), JSON.stringify(["upload"]));
  const request = new Request(url, { headers: { Authorization: "Bearer owner-token" } });
  assert.equal((await get.GET(request, { params: Promise.resolve({ assetId: "foreign-image" }) })).status, 404);
  assert.equal(calls.at(-1).userId, "owner-a");
  assert.equal((await get.GET(request, { params: Promise.resolve({ assetId: "owned-image" }) })).status, 200);
});
