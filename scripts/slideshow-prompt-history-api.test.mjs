import assert from "node:assert/strict";
import { mock, test } from "node:test";

const local = path => new URL(`../${path}`, import.meta.url);
const prompt = 'Use my actual screenshot.\nKeep "Start A SaaS".';
const row = { id: "asset", user_id: "owner", source_type: "generated_image", source_record_id: "job", project_id: "ai-studio", metadata: { provider: "openai" }, status: "ready" };
let noJob = false;
mock.module(local("lib/firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError: class extends Error {}, requireFirebaseUser: async () => ({ uid: "owner" }) } });
mock.module(local("lib/jobs/background-jobs.ts"), { namedExports: {
  getBackgroundJobsByIds: async ids => { assert.deepEqual(ids, ["job"]); return noJob ? [] : [{ id: "job", userId: "owner", jobType: "generate_image", input: { prompt, model: "gpt_image_2_5_flare" } }, { id: "foreign-job", userId: "other", jobType: "generate_image", input: { prompt: "SECRET" } }]; },
  getBackgroundJobForUser: async ({ userId, jobId }) => { assert.equal(userId, "owner"); assert.equal(jobId, "job"); return noJob ? null : { id: "job", userId: "owner", jobType: "generate_image", input: { prompt, model: "gpt_image_2_5_flare" } }; },
} });
mock.module(local("lib/media/media-storage.ts"), { namedExports: {
  listMediaAssets: async ({ userId }) => { assert.equal(userId, "owner"); return [row]; },
  serializeMediaAsset: value => ({ id: value.id, sourceType: value.source_type, sourceRecordId: value.source_record_id, metadata: value.metadata }),
  getMediaAssetForOwner: async ({ assetId, userId }) => { assert.equal(userId, "owner"); return assetId === row.id ? row : null; },
  softDeleteMediaAsset: async () => assert.fail("read-only test"), updateMediaAssetForOwner: async () => assert.fail("read-only test"),
} });
mock.module(local("lib/explore/remix-source.ts"), { namedExports: { remixSourceFromJob: () => null } });
const list = await import(local("app/api/media/route.ts"));
const detail = await import(local("app/api/media/[assetId]/route.ts"));
test("clean-browser image history recovers exact prompts from owned jobs without localStorage", async () => {
  const response = await list.GET(new Request("https://www.getugcpilot.com/api/media?collection=image"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.assets[0].metadata.prompt, prompt); assert.equal(body.assets[0].metadata.model, "gpt_image_2_5_flare");
  assert.ok(!JSON.stringify(body).includes("SECRET"));
});
test("ordinary image detail and provenance detail both recover saved prompts", async () => {
  for (const suffix of ["", "?remixSource=1"]) {
    const response = await detail.GET(new Request(`https://www.getugcpilot.com/api/media/asset${suffix}`), { params: Promise.resolve({ assetId: "asset" }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).asset.metadata.prompt, prompt);
  }
  assert.equal((await detail.GET(new Request("https://www.getugcpilot.com/api/media/foreign"), { params: Promise.resolve({ assetId: "foreign" }) })).status, 404);
});
test("orphaned legacy images retain metadata without inventing a prompt", async () => {
  noJob = true;
  try { const response = await list.GET(new Request("https://www.getugcpilot.com/api/media")); const body = await response.json(); assert.equal(body.assets[0].metadata.prompt, undefined); assert.equal(body.assets[0].metadata.provider, "openai"); }
  finally { noJob = false; }
});
