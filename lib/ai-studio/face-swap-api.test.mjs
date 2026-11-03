import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, next) { return next(specifier === "next/server" ? "next/server.js" : specifier, context); } });
const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
let reserved, queued, rejectedId, badKind, blockedUrl;
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 402; }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async () => ({ uid: "owner" }) } });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async input => { queued = input; return { id: "job" }; } } });
mock.module("@/lib/media/media-storage", { namedExports: { getMediaAssetForOwner: async ({ assetId, userId }) => {
  assert.equal(userId, "owner");
  return assetId === rejectedId ? null : { id: assetId, url: `https://owned.test/${assetId}.png`, ratio: "4:5", status: "ready", deleted_at: null, collection: assetId === badKind ? "video" : assetId === ids[1] ? "influencer" : "image", mime_type: "image/png" };
} } });
mock.module("@/lib/media/media-reference", { namedExports: { canonicalMediaReference: async url => url === blockedUrl ? null : url, isTrustedMediaReferenceUrl: url => url.startsWith("https://owned.test/") } });
mock.module("@/lib/billing/subscription-db", { namedExports: { BillingAccessError, getGenerationCreditCost: () => 1, reserveBillingCredits: async () => { reserved++; } } });
const { handleAIStudioFaceSwap } = await import("./face-swap-api.ts");
beforeEach(() => { reserved = 0; queued = null; rejectedId = badKind = blockedUrl = null; });
const submit = body => handleAIStudioFaceSwap(new Request("https://local.test/api", { method: "POST", body: JSON.stringify(body) }));
const base = { targetAssetId: ids[0], influencerAssetId: ids[1], idempotencyKey: "stable", aspectRatio: "9:16" };
test("legacy single-photo requests preserve ordered roles and one charge", async () => {
  assert.equal((await submit(base)).status, 200);
  assert.deepEqual(queued.input.referenceImageUrls, ids.slice(0, 2).map(id => `https://owned.test/${id}.png`));
  assert.equal(queued.idempotencyKey, "stable"); assert.equal(reserved, 1);
});
test("all four owned identity photos reach one durable job in primary/support order", async () => {
  assert.equal((await submit({ ...base, influencerReferenceAssetIds: ids.slice(2, 5) })).status, 200);
  assert.deepEqual(queued.input.referenceImageUrls, ids.slice(0, 5).map(id => `https://owned.test/${id}.png`));
  assert.equal(queued.input.aspectRatio, "9:16"); assert.equal(queued.input.mode, "face_swap"); assert.equal(reserved, 1);
});
test("invalid, duplicate or excessive identities fail before billing", async () => {
  for (const extra of [[ids[1]], ["bad"], ids.slice(2).concat(ids[1]), "bad"]) {
    assert.equal((await submit({ ...base, influencerReferenceAssetIds: extra })).status, 400);
  }
  assert.equal((await submit(null)).status, 400);
  assert.equal(reserved, 0); assert.equal(queued, null);
});
test("missing/foreign, non-image or inaccessible support fails before billing", async () => {
  rejectedId = ids[2]; assert.equal((await submit({ ...base, influencerReferenceAssetIds: [ids[2]] })).status, 404);
  rejectedId = null; badKind = ids[2]; assert.equal((await submit({ ...base, influencerReferenceAssetIds: [ids[2]] })).status, 404);
  badKind = null; blockedUrl = `https://owned.test/${ids[2]}.png`; assert.equal((await submit({ ...base, influencerReferenceAssetIds: [ids[2]] })).status, 400);
  assert.equal(reserved, 0); assert.equal(queued, null);
});
