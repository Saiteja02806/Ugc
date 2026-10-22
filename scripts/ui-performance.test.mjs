import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { pollInForeground } from "../lib/http/foreground-polling.ts";

test("30 minutes hidden does no polling; resume and reconnect read once without overlaps or replay", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const page = new EventTarget(), events = new EventTarget();
  page.visibilityState = "visible";
  let online = true, calls = 0, release;
  const stop = pollInForeground({ page, events, isOnline: () => online, intervalMs: 1000, immediate: true,
    poll: async () => { calls++; await new Promise(resolve => { release = resolve; }); } });
  assert.equal(calls, 1);
  page.dispatchEvent(new Event("visibilitychange"));
  events.dispatchEvent(new Event("online"));
  assert.equal(calls, 1, "Resume events cannot overlap an outstanding read");
  page.visibilityState = "hidden";
  page.dispatchEvent(new Event("visibilitychange"));
  release(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(30 * 60_000);
  assert.equal(calls, 1);
  page.visibilityState = "visible";
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 2, "Return performs one current read, never catches up missed intervals");
  release(); await Promise.resolve(); await Promise.resolve();
  online = false; events.dispatchEvent(new Event("offline"));
  t.mock.timers.tick(30_000); assert.equal(calls, 2);
  online = true; events.dispatchEvent(new Event("online")); assert.equal(calls, 3);
  stop(); release(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(60_000);
  page.dispatchEvent(new Event("visibilitychange"));
  events.dispatchEvent(new Event("online"));
  assert.equal(calls, 3, "Unmount removes timers and listeners even with a pending read");
});

test("poll errors are reported and the next foreground read can recover", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const page = new EventTarget(); page.visibilityState = "visible";
  let calls = 0; const errors = [];
  const stop = pollInForeground({ page, events: new EventTarget(), isOnline: () => true, intervalMs: 1000, immediate: true,
    poll: async () => { calls++; if (calls === 1) throw Error("Temporary read failure"); }, onError: error => errors.push(error.message) });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(errors, ["Temporary read failure"]);
  t.mock.timers.tick(1000); assert.equal(calls, 2); stop();
});

let owner = "owner", rowCalls = [], jobCalls = [], tokenCalls = [], clientCalls = [];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const image = (n, patch = {}) => ({ id: id(n), collection: "image", status: "ready", sourceType: "upload", projectId: "image-library",
  mimeType: "image/png", width: 1080, height: 1350, url: `https://owned.test/${n}.png`, metadata: {}, ...patch });
let inventory = [image(1), image(2), image(3)];
class AuthError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!owner) throw new AuthError("Sign in", 401); return { uid: owner }; } } });
mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetsForOwnerByIds: async params => { rowCalls.push(params); return inventory.filter(asset => params.assetIds.includes(asset.id)); }, serializeMediaAsset: row => row,
} });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getBackgroundJobsByIds: async ids => {
  jobCalls.push(ids); return [{ id: "job", userId: "owner", jobType: "generate_image", input: {} }];
} } });
mock.module("@/lib/ai-studio/generated-image-history-metadata", { namedExports: { getGeneratedImageHistoryMetadata: () => ({ model: "verified-model" }) } });
mock.module("@/lib/explore/remix-source", { namedExports: { remixSourceFromJob: () => ({ referenceId: "verified-reference" }) } });
mock.module("@/lib/firebase/auth", { namedExports: { getCurrentUserIdToken: async expected => { tokenCalls.push(expected); return "token"; } } });
const { POST } = await import("../app/api/media/image-library/resolve/route.ts");
const { resolveLibraryImages, imageLibraryRequest } = await import("../lib/media/image-library-client.ts");
const request = body => new Request("https://app.test/api/media/image-library/resolve", { method: "POST", body: JSON.stringify(body) });

test("six selected backgrounds use one owner-filtered lookup and retain selected order", async () => {
  inventory = Array.from({ length: 6 }, (_, index) => image(index + 1)); rowCalls = []; jobCalls = [];
  const ids = [id(6), id(2), id(4), id(1), id(3), id(5)];
  const response = await POST(request({ mediaAssetIds: [...ids, id(6)] }));
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(rowCalls, [{ assetIds: ids, userId: "owner" }]);
  assert.deepEqual(jobCalls, [], "Uploads need no generation-job lookup");
  assert.deepEqual((await response.json()).assets.map(asset => asset.id), ids);
});

test("batch admission fails atomically for missing, foreign, archived or invalid image sources", async () => {
  for (const patch of [null, { status: "uploading" }, { metadata: { imageLibraryArchived: true } }, { collection: "video" }, { projectId: "explore-catalog-reference" }]) {
    inventory = patch ? [image(1), image(2, patch)] : [image(1)];
    const response = await POST(request({ mediaAssetIds: [id(1), id(2)] }));
    assert.equal(response.status, 409); assert.equal((await response.json()).assets, undefined);
  }
  for (const ids of [[], ["invalid"], Array.from({ length: 21 }, (_, n) => id(n))]) {
    assert.equal((await POST(request({ mediaAssetIds: ids }))).status, 400);
  }
  owner = ""; assert.equal((await POST(request({ mediaAssetIds: [id(1)] }))).status, 401); owner = "owner";
});

test("generated backgrounds keep authoritative generation and Remix provenance with one job lookup", async () => {
  inventory = [image(1, { sourceType: "generated_image", source_record_id: "job", source_type: "generated_image", sourceRecordId: "job" })]; jobCalls = [];
  const response = await POST(request({ mediaAssetIds: [id(1)] }));
  assert.equal(response.status, 200);
  const { assets } = await response.json();
  assert.deepEqual(jobCalls, [["job"]]);
  assert.equal(assets[0].metadata.model, "verified-model");
  assert.equal(assets[0].metadata.remixTextSource.referenceId, "verified-reference");
});

test("client batches images, preserves order despite DB order, and rejects incomplete responses", async t => {
  clientCalls = []; tokenCalls = [];
  t.mock.method(globalThis, "fetch", async (path, init) => {
    const ids = JSON.parse(init.body).mediaAssetIds; clientCalls.push({ path, ids });
    return Response.json({ ok: true, assets: ids.toReversed().map(value => image(Number(value.slice(-12)))) });
  });
  const ids = Array.from({ length: 23 }, (_, index) => id(index + 1));
  assert.deepEqual([...(await resolveLibraryImages("owner", [...ids, id(1)])).keys()], ids);
  assert.equal(clientCalls.length, 2); assert.equal(clientCalls[0].ids.length, 20); assert.equal(clientCalls[1].ids.length, 3);
  assert.deepEqual(tokenCalls, ["owner", "owner"]);
  globalThis.fetch = async () => Response.json({ ok: true, assets: [image(1)] });
  await assert.rejects(resolveLibraryImages("owner", [id(1), id(2)]), /no longer available/);
});

test("cancelled library reads stop before a network call", async t => {
  const controller = new AbortController(); controller.abort();
  const network = t.mock.method(globalThis, "fetch", async () => { throw Error("Must not fetch"); });
  await assert.rejects(imageLibraryRequest("owner", "/api/media/image-library", { signal: controller.signal }));
  assert.equal(network.mock.callCount(), 0);
});
