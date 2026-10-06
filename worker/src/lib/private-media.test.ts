import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyFromUrl, validatePrivateMediaKey, workerMediaReadUrl } from "./private-media.js";

const row = { user_id: "owner", status: "ready", deleted_at: null, metadata: {},
  storage_key: "media/owner/video/test.mp4", url: "https://cdn.example/video.mp4" };
test("configuring a private bucket does not move public outputs or change public reads", async () => {
  process.env.GCP_PRIVATE_MEDIA_BUCKET = "test-private";
  process.env.GCP_STORAGE_BUCKET = "test-primary";
  let calls = 0;
  assert.equal(await workerMediaReadUrl(row, "owner", async () => { calls++; return "signed"; }), row.url);
  assert.equal(calls, 0);
});
test("private reads are freshly signed from the owned storage key", async () => {
  const params: string[][] = [];
  const privateRow = { ...row, metadata: { storageLocation: "private_user_media" }, url: "expired-browser-url" };
  const sign = async (bucket: string, key: string) => { params.push([bucket, key]); return "fresh"; };
  assert.equal(await workerMediaReadUrl(privateRow, "owner", sign), "fresh");
  assert.deepEqual(params, [["test-private", row.storage_key]]);
  await assert.rejects(workerMediaReadUrl(privateRow, "other", sign), /account/);
  await assert.rejects(workerMediaReadUrl({ ...privateRow, deleted_at: "now" }, "owner", sign), /account/);
});
test("private bucket and key validation fail closed", async () => {
  assert.equal(privateKeyFromUrl("https://storage.googleapis.com/other/a.mp4"), null);
  assert.equal(privateKeyFromUrl("https://storage.googleapis.com/test-private/media/a.mp4?expired=1"), "media/a.mp4");
  for (const key of ["../secret", "/root", "a/../b", "a\\b", "gs://bucket"]) assert.throws(() => validatePrivateMediaKey(key));
  const previous = process.env.GCP_PRIVATE_MEDIA_BUCKET;
  try {
    process.env.GCP_PRIVATE_MEDIA_BUCKET = "test-primary";
    await assert.rejects(workerMediaReadUrl({ ...row, metadata: { storageLocation: "private_user_media" } }, "owner"), /separate/);
  } finally { process.env.GCP_PRIVATE_MEDIA_BUCKET = previous; }
});
