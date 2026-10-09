import assert from "node:assert/strict";
import test from "node:test";

import type { MediaAssetRow } from "@/lib/media/media-storage";
import { prepareMcpUploadTarget, validateMcpUploadConfirmation } from "./upload-validation.ts";

process.env.GCP_STORAGE_BUCKET = "local-mcp-test-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://local-mcp-storage.example.test";

const image = {
  collection: "image", duration_seconds: null, file_size_bytes: 1024,
  height: null, mime_type: "image/png", source_type: "upload", status: "uploading",
  width: null, metadata: { mcpUpload: true },
} as unknown as MediaAssetRow;
const base = {
  asset: image,
  object: { ContentType: "image/png", ContentLength: 1024 },
  input: { width: 640, height: 640 },
};

function code(action: () => unknown) {
  try { action(); return null; } catch (error) { return (error as { code?: string }).code; }
}

test("prepares an owned upload using the shared media rules", () => {
  const input = {
    collection: "image" as const,
    fileName: "dashboard.png",
    fileSizeBytes: 1024,
    mimeType: "image/png",
    title: "Dashboard",
    userId: "owner-a",
  };
  const target = prepareMcpUploadTarget(input);
  assert.match(target.assetId, /^[0-9a-f-]{36}$/i);
  assert.match(target.key, /^media\/owner-a\/image\//);
  assert.equal(target.publicUrl, `https://local-mcp-storage.example.test/${target.key}`);
  assert.equal(target.title, "Dashboard");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, collection: "video" })), "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, mimeType: "application/pdf" })), "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, fileSizeBytes: 26 * 1024 * 1024 })), "FILE_TOO_LARGE");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, fileSizeBytes: 0 })), "INVALID_INPUT");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, fileName: "../dashboard.png" })), "INVALID_INPUT");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, title: " " })), "INVALID_INPUT");
  assert.equal(code(() => prepareMcpUploadTarget({ ...input, title: "x".repeat(141) })), "INVALID_INPUT");
});

test("confirms an existing matching object without a confirmation deadline", () => {
  assert.deepEqual(validateMcpUploadConfirmation(base), {
    alreadyReady: false, durationSeconds: null, ratio: "1:1",
  });
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, asset: { ...image, metadata: {} } })), "NOT_FOUND");
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, object: { ContentType: "image/jpeg", ContentLength: 1024 } })), "UPLOAD_MISMATCH");
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, object: { ContentType: "image/png", ContentLength: 512 } })), "UPLOAD_MISMATCH");
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, object: { ContentType: "application/pdf", ContentLength: 1024 } })), "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, object: { ContentType: "image/png", ContentLength: 0 } })), "UPLOAD_NOT_READY");
});

test("an already ready upload is retryable only with matching object and metadata", () => {
  const ready = { ...image, status: "ready" as const, width: 640, height: 640 };
  assert.equal(validateMcpUploadConfirmation({ ...base, asset: ready }).alreadyReady, true);
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, asset: ready, input: { width: 800, height: 640 } })), "UPLOAD_MISMATCH");
  assert.equal(code(() => validateMcpUploadConfirmation({ ...base, asset: ready, object: { ContentType: "image/png", ContentLength: 512 } })), "UPLOAD_MISMATCH");
});

test("video confirmation requires duration and enforces the collection limit", () => {
  const video = { ...image, collection: "video" as const, mime_type: "video/mp4", file_size_bytes: 1024 };
  const params = { ...base, asset: video, object: { ContentType: "video/mp4", ContentLength: 1024 } };
  assert.equal(code(() => validateMcpUploadConfirmation(params)), "INVALID_INPUT");
  assert.deepEqual(validateMcpUploadConfirmation({ ...params, input: { width: 1080, height: 1920, durationSeconds: 4 } }), {
    alreadyReady: false, durationSeconds: 4, ratio: "9:16",
  });
  assert.equal(code(() => validateMcpUploadConfirmation({ ...params, object: { ContentType: "video/mp4", ContentLength: 251 * 1024 * 1024 }, input: { width: 1080, height: 1920, durationSeconds: 4 } })), "FILE_TOO_LARGE");
});
