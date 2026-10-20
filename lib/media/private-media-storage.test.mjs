import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { after, mock, test } from "node:test";

const names = ["GCP_PRIVATE_MEDIA_BUCKET", "GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET", "PRIVATE_USER_MEDIA_ENABLED"];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
let buckets = [], calls = [];
const bucket = { file: (name, options) => {
  calls.push({ name, options });
  return { name, bucket, getMetadata: async () => [{ size: "5", generation: "8", contentType: "audio/mpeg" }],
    createReadStream: options => { calls.push({ stream: options }); return Readable.from([Buffer.from("audio")]); } };
} };
mock.module("@google-cloud/storage", { namedExports: { Storage: class {
  bucket(name) { buckets.push(name); return bucket; }
} } });
mock.module("@/lib/gcp/credentials", { namedExports: { getGoogleServiceAccountCredentials: () => null } });
const { assertPrivateMediaWritesDisabled, privateMediaBucketName, validPrivateStorageKey, privateMediaObject } = await import("./private-media-storage.ts");
after(() => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});

test("private uploads cannot accidentally activate, and a separate bucket is mandatory", () => {
  delete process.env.PRIVATE_USER_MEDIA_ENABLED;
  assert.doesNotThrow(assertPrivateMediaWritesDisabled);
  process.env.PRIVATE_USER_MEDIA_ENABLED = "true";
  assert.throws(assertPrivateMediaWritesDisabled, /not enabled/);
  process.env.GCP_STORAGE_BUCKET = "public";
  delete process.env.GCP_PRIVATE_MEDIA_BUCKET;
  assert.throws(privateMediaBucketName, /separate/);
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "public";
  assert.throws(privateMediaBucketName, /separate/);
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "private";
  assert.equal(privateMediaBucketName(), "private");
});

test("storage reads pin an object generation and reject invalid keys and byte ranges before streaming", async () => {
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "private";
  process.env.GCP_STORAGE_BUCKET = "public";
  for (const key of ["/a", "a/../b", "a//b", "a\\b", "gs://b", "a\u0000b"]) assert.throws(() => validPrivateStorageKey(key));
  for (const range of ["bytes=8-9", "bytes=3-1", "bytes=-0", "bytes=-", "bytes=0-1,3-4"]) {
    calls = [];
    await assert.rejects(privateMediaObject({ key: "audio/sample.mp3", range }), /Invalid media byte range/);
    assert.equal(calls.some(call => call.stream), false);
  }
  calls = []; buckets = [];
  const result = await privateMediaObject({ key: "audio/sample.mp3", range: "bytes=1-3" });
  assert.equal(result.size, 3); assert.equal(result.contentRange, "bytes 1-3/5");
  assert.deepEqual(buckets, ["private"]);
  assert.ok(calls.some(call => call.options?.generation === "8"));
  assert.deepEqual(calls.find(call => call.stream).stream, { start: 1, end: 3 });
  await result.body.cancel();
});
