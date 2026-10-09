import assert from "node:assert/strict";
import { mock, test } from "node:test";

let signedIn = true, failPut = false, loseAcknowledgement = false;
const rows = new Map(), objects = new Map(), trace = [];
class AuthError extends Error { status = 401; }
mock.module("../firebase/auth.ts", { namedExports: { getCurrentUserIdToken: async () => signedIn ? "owner-token" : null } });
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async request => { assert.equal(request.headers.get("Authorization"), "Bearer owner-token"); return { uid: "owner" }; },
} });
const serialize = row => ({ id: row.id, collection: row.collection, status: row.status, width: row.width,
  height: row.height, url: row.url, projectId: row.project_id, mimeType: row.mime_type });
mock.module("../media/media-storage.ts", { namedExports: {
  createUploadingMediaAsset: async input => {
    const row = { id: input.assetId, user_id: input.userId, collection: input.collection, status: "uploading", mime_type: input.mimeType,
      storage_key: input.storageKey, project_id: input.projectId, url: input.url, width: null, height: null };
    rows.set(row.id, row); return row;
  },
  getMediaAssetForOwner: async ({ assetId, userId }) => rows.get(assetId)?.user_id === userId ? rows.get(assetId) : null,
  markMediaAssetReady: async params => {
    const row = rows.get(params.assetId); assert.equal(row.user_id, params.userId);
    Object.assign(row, { status: "ready", width: params.width, height: params.height }); return row;
  },
  serializeMediaAsset: serialize,
} });
mock.module("../storage/storage.ts", { namedExports: {
  buildPublicStorageUrl: key => `https://storage.test/${key}`,
  getMissingStorageEnvVars: () => [],
  createSignedPutUrl: async ({ key }) => `https://uploads.test/${key}`,
  headStorageObject: async ({ key }) => { trace.push("HEAD"); return objects.get(key); },
} });
const { POST: prepare } = await import("../../app/api/media/create-upload-url/route.ts");
const { POST: complete } = await import("../../app/api/media/complete-upload/route.ts");
const { uploadAIStudioReferenceMedia } = await import("../ai-studio/reference-media-upload.ts");
mock.method(globalThis, "fetch", async (url, init) => {
  const path = String(url); trace.push(`${init?.method ?? "GET"} ${path.startsWith("https://uploads.test/") ? "signed-upload" : path}`);
  if (path === "/api/media/create-upload-url") return prepare(new Request("https://www.getugcpilot.com" + path, init));
  if (path.startsWith("https://uploads.test/")) {
    if (failPut) return new Response(null, { status: 503 });
    objects.set(path.slice("https://uploads.test/".length), { ContentType: init.body.type, ContentLength: init.body.size });
    return new Response(null, { status: 200 });
  }
  if (path === "/api/media/complete-upload") {
    const response = await complete(new Request("https://www.getugcpilot.com" + path, init));
    if (loseAcknowledgement) throw new Error("Connection lost after completion");
    return response;
  }
  if (path.startsWith("/api/media/")) return Response.json({ ok: true, asset: serialize(rows.get(path.split("/").at(-1))) });
  throw new Error(`Unexpected request ${path}`);
});
globalThis.window = { Image: class {
  naturalWidth = 1920; naturalHeight = 1080;
  set src(_) { queueMicrotask(() => this.onload()); }
} };
const file = new File([new Uint8Array([137, 80, 78, 71])], "custom-slide.png", { type: "image/png" });
const upload = () => uploadAIStudioReferenceMedia(file, "image", 3, undefined, { purpose: "trending-carousel-slide" });

test("per-slide upload traverses signed PUT and completion, retaining landscape dimensions and its own purpose", async () => {
  trace.length = 0;
  const { asset } = await upload();
  assert.equal(asset.status, "ready"); assert.equal(asset.collection, "image");
  assert.equal(asset.width, 1920); assert.equal(asset.height, 1080);
  assert.equal(asset.projectId, "trending-carousel-slide");
  assert.deepEqual(trace, ["POST /api/media/create-upload-url", "PUT signed-upload", "POST /api/media/complete-upload", "HEAD"]);
  assert.equal(rows.get(asset.id).user_id, "owner");
});

test("failed upload stays unready and a lost completion acknowledgement recovers without deleting the image", async () => {
  failPut = true;
  await assert.rejects(upload(), /could not be uploaded/);
  assert.equal([...rows.values()].at(-1).status, "uploading");
  failPut = false; loseAcknowledgement = true; trace.length = 0;
  assert.equal((await upload()).asset.status, "ready");
  assert.ok(trace.at(-1).startsWith("GET /api/media/"));
  assert.ok(trace.every(value => !value.startsWith("DELETE")));
  loseAcknowledgement = false;
});

test("signed-out uploads issue no API or storage request", async () => {
  signedIn = false; trace.length = 0;
  await assert.rejects(upload(), /Sign in/);
  assert.deepEqual(trace, []);
  signedIn = true;
});
