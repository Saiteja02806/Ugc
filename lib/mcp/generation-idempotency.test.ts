import assert from "node:assert/strict";
import test from "node:test";

import { generationChildIdempotencyKey, generationRequestFingerprint } from "./generation-idempotency.ts";

test("generation fingerprint compares normalized work, not the client request ID", () => {
  const request = {
    kind: "image" as const,
    prompt: "Product photo",
    aspectRatio: "9:16",
    count: 2 as const,
    referenceAssetId: "11111111-1111-4111-8111-111111111111",
  };
  const fingerprint = generationRequestFingerprint(request);
  assert.equal(fingerprint, generationRequestFingerprint({
    ...request, prompt: " Product photo ", referenceAssetId: request.referenceAssetId.toUpperCase(),
  }));
  assert.notEqual(fingerprint, generationRequestFingerprint({ ...request, prompt: "Other product" }));
  assert.notEqual(fingerprint, generationRequestFingerprint({ ...request, count: 1 }));
  assert.notEqual(fingerprint, generationRequestFingerprint({ ...request, aspectRatio: "1:1" }));
  assert.notEqual(fingerprint, generationRequestFingerprint({ ...request, referenceAssetId: null }));
});

test("idempotency keys are stable and scoped to owner, operation and child", () => {
  const input = { userId: "owner-a", kind: "image" as const, clientRequestId: "request-1", childIndex: 1 };
  const key = generationChildIdempotencyKey(input);
  assert.equal(key, generationChildIdempotencyKey({ ...input, clientRequestId: " request-1 " }));
  assert.notEqual(key, generationChildIdempotencyKey({ ...input, userId: "owner-b" }));
  assert.notEqual(key, generationChildIdempotencyKey({ ...input, kind: "video" }));
  assert.notEqual(key, generationChildIdempotencyKey({ ...input, childIndex: 2 }));
  assert.ok(!key.includes("owner-a") && !key.includes("request-1"));
});
