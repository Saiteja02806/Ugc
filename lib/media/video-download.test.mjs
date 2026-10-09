import assert from "node:assert/strict";
import { mock, test } from "node:test";

const local = path => new URL(path, import.meta.url);
const assetId = "00000000-0000-4000-8000-000000000001";
let row, lookupCalls, headCalls, signCalls, storageError, signingError;
class FirebaseAuthRequestError extends Error { status = 401; }
mock.module(local("../firebase/server-auth.ts"), { namedExports: {
  FirebaseAuthRequestError,
  requireFirebaseUser: async request => {
    if (request.headers.get("Authorization") !== "Bearer fixture-owner") throw new FirebaseAuthRequestError("Sign in to continue.");
    return { uid: "owner" };
  },
} });
mock.module(local("./media-storage.ts"), { namedExports: {
  getMediaAssetForOwner: async params => { lookupCalls.push(params); return params.assetId === assetId ? row : null; },
} });
mock.module(local("../storage/storage.ts"), { namedExports: {
  headStorageObject: async params => { headCalls.push(params); if (storageError) throw storageError; return { ContentLength: 100_000_000 }; },
  createSignedDownloadUrl: async params => { signCalls.push(params); if (signingError) throw signingError; return "https://storage.googleapis.com/fixture/video.mp4?signed"; },
} });
const { POST } = await import("../../app/api/media/[assetId]/download/route.ts");

function reset(overrides = {}) {
  row = { id: assetId, user_id: "owner", collection: "video", status: "ready", deleted_at: null,
    storage_key: "videos/hooks/owner/video.mp4", title: "My video.mp4", mime_type: "video/mp4", file_name: null,
    metadata: {}, ...overrides };
  lookupCalls = []; headCalls = []; signCalls = []; storageError = null; signingError = null;
}
function request(id = assetId, authenticated = true) {
  return POST(new Request(`https://www.getugcpilot.com/api/media/${id}/download?url=https://evil.test/&key=someone-elses-file`, {
    method: "POST", headers: authenticated ? { Authorization: "Bearer fixture-owner" } : {},
    body: JSON.stringify({ key: "someone-elses-file", url: "https://evil.test/" }),
  }), { params: Promise.resolve({ assetId: id }) });
}

test("downloads existing owned videos by saved key, with a short-lived filename and no video buffering", async () => {
  reset();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(lookupCalls, [{ assetId, userId: "owner" }]);
  assert.deepEqual(headCalls, [{ key: row.storage_key }]);
  assert.deepEqual(signCalls, [{ key: row.storage_key, fileName: "my-video.mp4", expiresInSeconds: 300 }]);
  assert.equal((await response.json()).fileName, "my-video.mp4");
});

test("requires authentication before accessing any database or storage object", async () => {
  reset();
  const response = await request(assetId, false);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(lookupCalls, []); assert.deepEqual(headCalls, []); assert.deepEqual(signCalls, []);
});

test("rejects invalid IDs, foreign, deleted, unfinished, non-video and unavailable assets before signing", async () => {
  for (const overrides of [{ user_id: "another-owner" }, { deleted_at: "2026-10-09" },
    { status: "uploading" }, { status: "processing" }, { status: "failed" }, { collection: "image" },
    { storage_key: "" }, { storage_key: "../someone/video.mp4" }, { storage_key: "https://evil.test/video.mp4" },
    { metadata: { storageLocation: "private_user_media" } }]) {
    reset(overrides);
    assert.equal((await request()).status, 404);
    assert.deepEqual(headCalls, []); assert.deepEqual(signCalls, []);
  }
  reset();
  assert.equal((await request("not-an-asset")).status, 404);
  assert.deepEqual(lookupCalls, []);
  row = null;
  assert.equal((await request()).status, 404);
  assert.deepEqual(signCalls, []);
});

test("returns a page-readable error for missing storage objects and signing failures", async () => {
  reset(); storageError = Object.assign(new Error("missing"), { code: "NoSuchKey" });
  assert.equal((await request()).status, 404); assert.deepEqual(signCalls, []);
  reset(); storageError = Object.assign(new Error("storage unavailable"), { code: 503 });
  const log = mock.method(console, "error", () => {});
  try {
    const response = await request();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match((await response.json()).error, /try again/i);
    assert.deepEqual(signCalls, []);
    reset(); signingError = new Error("signing unavailable");
    const signingResponse = await request();
    assert.equal(signingResponse.status, 503);
    assert.match((await signingResponse.json()).error, /try again/i);
  } finally { log.mock.restore(); }
});

test("sanitizes filenames and preserves the video format without trusting a client filename", async () => {
  for (const [overrides, expected] of [
    [{ title: 'A "quoted" video\r\n.mp4' }, "a-quoted-video.mp4"],
    [{ title: "🎥" }, "generated-video.mp4"],
    [{ mime_type: "video/webm", title: "Existing video.mov" }, "existing-video.webm"],
    [{ mime_type: "video/quicktime" }, "my-video.mov"],
    [{ mime_type: "application/octet-stream", storage_key: "videos/existing.webm" }, "my-video.webm"],
  ]) {
    reset(overrides);
    assert.equal((await (await request()).json()).fileName, expected);
    assert.equal(signCalls[0].fileName, expected);
  }
});
