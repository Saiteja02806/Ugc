import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

const assetId = "a39e12d2-b1f4-43f1-8107-af2bc27643cc";
const key = "users/owner/reference.mp4";
const canonical = `https://storage.googleapis.com/offline-private/${key}`;
let row, reads, streams;
const initial = { APP_BASE_URL: process.env.APP_BASE_URL, GCP_PRIVATE_MEDIA_BUCKET: process.env.GCP_PRIVATE_MEDIA_BUCKET,
  MEDIA_DELIVERY_SIGNING_SECRET: process.env.MEDIA_DELIVERY_SIGNING_SECRET };
process.env.APP_BASE_URL = "https://www.getugcpilot.com";
process.env.GCP_PRIVATE_MEDIA_BUCKET = "offline-private";
process.env.MEDIA_DELIVERY_SIGNING_SECRET = "offline-only-media-delivery-secret-with-32-characters";

mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetForOwner: async params => { reads.push(params); return row; },
  getReadyMediaAssetByKeyForOwner: async (key, owner) => { reads.push({ key, owner }); return row; },
  getReadyMediaAssetForDelivery: async id => { reads.push(id); return row; },
} });
mock.module("@/lib/storage/storage", { namedExports: {
  isTrustedStorageUrl: value => new URL(value).hostname === "public.example.com",
} });
mock.module("@/lib/media/private-media-storage", { namedExports: {
  validPrivateStorageKey: key => {
    if (key.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid key.");
    return key;
  },
  privateMediaObject: async params => {
    streams.push(params);
    return { body: "mp4", size: 3, contentType: "video/mp4", contentRange: params.range ? "bytes 0-2/3" : null };
  },
} });
const { canonicalMediaReference, isTrustedMediaReferenceUrl } = await import("./media-reference.ts");
const { getProtectedMediaDeliveryUrl } = await import("./media-delivery.ts");
const { GET } = await import("../../app/api/media/delivery/[assetId]/route.ts");
beforeEach(() => {
  row = { id: assetId, user_id: "owner", url: canonical, storage_key: key, status: "ready", deleted_at: null,
    mime_type: "video/mp4", metadata: { storageLocation: "private_user_media" } };
  reads = []; streams = [];
});
after(() => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(initial)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
const deliver = (url, range) => GET(new Request(url, { headers: range ? { range } : {} }), { params: Promise.resolve({ assetId }) });

test("an authenticated owner resolves even an expired browser link to a durable reference before queueing", async () => {
  const expired = getProtectedMediaDeliveryUrl(assetId, Date.now() - 600000);
  assert.equal(await canonicalMediaReference(expired, "owner"), canonical);
  assert.deepEqual(reads, [{ assetId, userId: "owner" }]);
  assert.equal(await canonicalMediaReference(canonical, "owner"), canonical);
  assert.equal(isTrustedMediaReferenceUrl(canonical), true);
  assert.equal(isTrustedMediaReferenceUrl("https://untrusted.example.com/file.mp4"), false);
});

test("foreign, deleted, incomplete, public and mismatched private rows cannot become owned generation references", async () => {
  const link = getProtectedMediaDeliveryUrl(assetId);
  for (const change of [{ user_id: "other" }, { deleted_at: "deleted" }, { status: "uploading" }, { metadata: {} },
    { storage_key: "different" }, { url: "https://untrusted.example.com/file.mp4" }]) {
    const previous = row; row = { ...row, ...change };
    await assert.rejects(canonicalMediaReference(link, "owner"));
    await assert.rejects(canonicalMediaReference(canonical, "owner"));
    row = previous;
  }
  await assert.rejects(canonicalMediaReference(getProtectedMediaDeliveryUrl(assetId, Date.now(), "thumbnail"), "owner"));
});

test("public references remain unchanged and never query private ownership", async () => {
  const publicUrl = "https://public.example.com/reference.mp4";
  assert.equal(await canonicalMediaReference(publicUrl, "owner"), publicUrl);
  assert.equal(isTrustedMediaReferenceUrl(publicUrl), true);
  assert.equal(reads.length, 0);
});

test("invalid, expired and thumbnail-replayed delivery tokens fail before any database or storage read", async () => {
  const valid = new URL(getProtectedMediaDeliveryUrl(assetId));
  valid.searchParams.set("signature", "0".repeat(64));
  assert.equal((await deliver(valid)).status, 404);
  assert.equal((await deliver(getProtectedMediaDeliveryUrl(assetId, Date.now() - 600000))).status, 404);
  const thumbnail = new URL(getProtectedMediaDeliveryUrl(assetId, Date.now(), "thumbnail"));
  thumbnail.searchParams.delete("variant");
  assert.equal((await deliver(thumbnail)).status, 404);
  assert.equal(reads.length, 0); assert.equal(streams.length, 0);
});

test("signed delivery rechecks deletion and readiness; byte-range streams are never cached", async () => {
  const valid = getProtectedMediaDeliveryUrl(assetId);
  for (const change of [{ deleted_at: "deleted" }, { status: "uploading" }, { metadata: {} }]) {
    const previous = row; row = { ...row, ...change };
    assert.equal((await deliver(valid)).status, 404); row = previous;
  }
  assert.equal(streams.length, 0);
  const response = await deliver(valid, "bytes=0-2");
  assert.equal(response.status, 206); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-range"), "bytes 0-2/3");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "mp4");
  assert.deepEqual(streams, [{ key, range: "bytes=0-2" }]);
});
