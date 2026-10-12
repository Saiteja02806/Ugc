import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

let owner, asset, job, queried, mutations;
class FirebaseAuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError, requireFirebaseUser: async () => ({ uid: owner }) } });
mock.module("@/lib/media/media-storage", { namedExports: {
  getMediaAssetForOwner: async params => params.userId === "owner-a" ? asset : null,
  serializeMediaAsset: row => ({ id: row.id, metadata: {} }),
  softDeleteMediaAsset: () => { mutations++; }, updateMediaAssetForOwner: () => { mutations++; },
} });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getBackgroundJobForUser: async params => { queried.push(params); return job; } } });
const { GET } = await import("../../app/api/media/[assetId]/route.ts");
after(() => mock.restoreAll());
beforeEach(() => {
  owner = "owner-a"; mutations = 0; queried = [];
  asset = { id: "asset-a", source_record_id: "job-a", source_type: "generated_video" };
  job = { input: { exploreFormat: "hook", referenceType: "hook", referenceId: "hook-original", referenceUrl: "https://catalog.test/original.mp4", hookIdea: "PRIVATE PROMPT", businessContext: "PRIVATE FACTS" } };
});
const get = query => GET(new Request(`https://app.test/api/media/asset-a${query}`), { params: Promise.resolve({ assetId: "asset-a" }) });
test("an opt-in owned read exposes only the original source identifiers", async () => {
  const response = await get("?remixSource=1"); const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(queried, [{ jobId: "job-a", userId: "owner-a" }]);
  assert.deepEqual(body.asset.metadata.remixTextSource, { format: "hook", referenceId: "hook-original", sourceUrl: "https://catalog.test/original.mp4" });
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE/); assert.equal(mutations, 0);
});
test("ordinary reads and uploads add no job lookup; unrelated owners cannot read a source", async () => {
  assert.equal((await get("")).status, 200); assert.equal(queried.length, 0);
  asset.source_type = "upload";
  const upload = await (await get("?remixSource=1")).json();
  assert.equal(upload.asset.metadata.remixTextSource, null); assert.equal(queried.length, 0);
  owner = "owner-b";
  assert.equal((await get("?remixSource=1")).status, 404); assert.equal(queried.length, 0); assert.equal(mutations, 0);
});
test("an unavailable original job yields no invented reference", async () => {
  job = null;
  const body = await (await get("?remixSource=1")).json();
  assert.equal(body.asset.metadata.remixTextSource, null); assert.equal(mutations, 0);
});
