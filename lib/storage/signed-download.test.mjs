import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mock, test } from "node:test";

// Exercise the installed Google SDK's real V4 signer with a disposable local key.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
process.env.GCP_STORAGE_BUCKET = "fixture-download-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://media.example.test";
process.env.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({ client_email: "fixture@example.test", private_key: privateKey });
const { createSignedDownloadUrl, buildPublicStorageUrl } = await import("./storage.ts");
mock.method(globalThis, "fetch", async () => assert.fail("Signing must not fetch or buffer the video"));

test("V4 download URLs force an attachment only for that request and expire in five minutes", async () => {
  const url = new URL(await createSignedDownloadUrl({ key: "videos/existing file.mp4", fileName: "my-video.mp4" }));
  assert.equal(url.origin, "https://storage.googleapis.com");
  assert.equal(url.pathname, "/fixture-download-bucket/videos/existing%20file.mp4");
  assert.equal(url.searchParams.get("response-content-disposition"), 'attachment; filename="my-video.mp4"');
  assert.equal(url.searchParams.get("X-Goog-Algorithm"), "GOOG4-RSA-SHA256");
  assert.equal(url.searchParams.get("X-Goog-Expires"), "300");
  assert.match(url.searchParams.get("X-Goog-Signature"), /^[0-9a-f]+$/);
  assert.equal(buildPublicStorageUrl("videos/existing file.mp4"), "https://media.example.test/videos/existing file.mp4");
});

test("rejects unsafe filenames and excessive or invalid expiry times", async () => {
  for (const fileName of ['video".mp4', "video\r\n.mp4", "../video.mp4", ""]) {
    await assert.rejects(createSignedDownloadUrl({ key: "video.mp4", fileName }), /filename/);
  }
  for (const expiresInSeconds of [0, -1, 601, 1.5, NaN]) {
    await assert.rejects(createSignedDownloadUrl({ key: "video.mp4", fileName: "video.mp4", expiresInSeconds }), /lifetime/);
  }
});
