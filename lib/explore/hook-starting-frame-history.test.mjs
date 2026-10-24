import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import curatedFrames from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
const local = file => new URL(file, import.meta.url);
const JOB = "11111111-1111-4111-8111-111111111111", ASSET = "22222222-2222-4222-8222-222222222222", DRAFT = "33333333-3333-4333-8333-333333333333";
let jobs, reads, lookup, review, listOptions, authError, reviewedDrafts;
class HookKeyframeGenerationError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
class FirebaseAuthRequestError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
class BillingAccessError extends Error {}
mock.module(local("../jobs/background-jobs.ts"), { namedExports: { listBackgroundJobsForUser: async params => { listOptions = params; return jobs; } } });
mock.module(local("./hook-keyframe-result.ts"), { namedExports: { HookKeyframeGenerationError, resolveApprovedHookStartingFrame: async params => {
  reads.push(params); if (lookup) return lookup(params);
  return { receipt: { draftId: DRAFT, version: 1, sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) } }, referenceId: "hook-15", sourceSha256: "a".repeat(64), assetId: params.assetId,
    imageUrl: "https://media.example.test/frame.png", output: { width: 720, height: 1280 } };
} } });
mock.module(local("./hook-keyframe-prompt-preview.ts"), { namedExports: { getHookKeyframePromptPreview: draft => { reviewedDrafts.push(draft); return review; } } });
mock.module(local("../ai-studio/server-access.ts"), { namedExports: { requireAIStudioProUser: async () => { if (authError) throw authError; return { uid: "owner" }; } } });
mock.module(local("../firebase/server-auth.ts"), { namedExports: { FirebaseAuthRequestError } });
mock.module(local("../billing/subscription-db.ts"), { namedExports: { BillingAccessError } });
mock.method(globalThis, "fetch", async () => assert.fail("No network or paid generation"));
const { listRecentHookStartingFrames, resolveRecentHookStartingFrame } = await import("./hook-starting-frame-history.ts");
const { GET } = await import("../../app/api/explore/hook-starting-frames/route.ts");
beforeEach(() => {
  jobs = [{ id: JOB, output: { mediaAssetId: ASSET } }]; reads = []; reviewedDrafts = []; lookup = null; authError = null; listOptions = undefined;
  review = { requiresDecision: false, animationError: null, directions: "Turn toward the camera.", durationSeconds: 8 };
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
});
const request = query => new Request(`https://www.getugcpilot.com/api/explore/hook-starting-frames${query ?? ""}`);
test("recent frames verify each owned job/asset and carry source, dimensions and reviewed motion", async () => {
  const frames = await listRecentHookStartingFrames("owner");
  assert.deepEqual(listOptions, { userId: "owner", jobType: "generate_image", projectId: "hook-starting-frame", completedOnly: true, limit: 48 });
  assert.deepEqual(reads, [{ ownerId: "owner", imageJobId: JOB, assetId: ASSET }]);
  assert.equal(frames[0].jobId, JOB); assert.equal(frames[0].assetId, ASSET); assert.equal(frames[0].draftId, DRAFT);
  assert.equal(frames[0].durationSeconds, 8); assert.equal(frames[0].generateAudio, false); assert.equal(frames[0].motionInstructions, review.directions);
});

test("history derives motion from the saved frame, including curated later frames and legacy openings", async () => {
  const selected = curatedFrames.frames[0];
  for (const version of [3, 2]) {
    const sourceFrame = { index: version === 3 ? selected.index : 0, timeSeconds: version === 3 ? selected.timeSeconds : 0,
      width: selected.width, height: selected.height, sha256: version === 3 ? selected.sha256 : "b".repeat(64) };
    lookup = () => ({ receipt: { draftId: DRAFT, version, imageModel: "gemini_3_pro", sourceFrame }, referenceId: selected.referenceId,
      sourceSha256: selected.sourceSha256, assetId: ASSET, imageUrl: "https://media.example.test/frame.png", output: { width: 720, height: 1280 } });
    await resolveRecentHookStartingFrame("owner", JOB, ASSET);
    assert.equal(reviewedDrafts.at(-1).version, version); assert.deepEqual(reviewedDrafts.at(-1).sourceFrame, sourceFrame);
  }
});

test("other workflow drafts restore their exact frame without entering the Hook starting-frame shelf", async () => {
  jobs = [
    { id: "wall", input: { exploreFormat: "wall_text" }, output: { mediaAssetId: ASSET } },
    { id: "talking", input: { hookKeyframe: { referenceId: "talking-car-story" } }, output: { mediaAssetId: ASSET } },
  ];
  assert.deepEqual(await listRecentHookStartingFrames("owner"), []); assert.equal(reads.length, 0);
  for (const workflow of ["wall_text", "talking_head"]) {
    lookup = () => ({ workflow, receipt: { draftId: DRAFT }, referenceId: `${workflow}-example`, sourceSha256: "a".repeat(64), assetId: ASSET,
      imageUrl: "https://media.example.test/frame.png", output: { width: 720, height: 1280 } });
    const frame = await resolveRecentHookStartingFrame("owner", JOB, ASSET);
    assert.equal(frame.durationSeconds, 4);
    assert.match(frame.motionInstructions, workflow === "talking_head" ? /own spoken script/ : /editable text overlay/);
  }
});
test("missing/changed frames are omitted while transient verification errors remain visible", async () => {
  for (const status of [404, 409]) { lookup = () => { throw new HookKeyframeGenerationError("Unavailable", status); }; assert.deepEqual(await listRecentHookStartingFrames("owner"), []); }
  lookup = () => { throw new Error("Database unavailable"); }; await assert.rejects(listRecentHookStartingFrames("owner"), /Database/);
});
test("frames without a reviewed motion plan cannot silently enter animation", async () => {
  for (const patch of [{ requiresDecision: true }, { animationError: "Missing motion" }, { directions: "" }]) {
    const original = review; review = { ...review, ...patch };
    await assert.rejects(resolveRecentHookStartingFrame("owner", JOB, ASSET), error => error.status === 409); review = original;
  }
});
test("recent list is bounded to 24 results and keeps newest-first query order", async () => {
  jobs = Array.from({ length: 48 }, (_, i) => ({ id: `job-${i}`, output: { mediaAssetId: ASSET } }));
  const frames = await listRecentHookStartingFrames("owner"); assert.equal(frames.length, 24); assert.equal(reads.length, 24);
  assert.equal(frames[0].jobId, "job-0"); assert.equal(frames[23].jobId, "job-23");
});
test("route is gated, authenticated and only reads the signed-in owner's frames", async () => {
  delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; assert.equal((await GET(request())).status, 404); assert.equal(reads.length, 0);
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  authError = new FirebaseAuthRequestError("Sign in"); assert.equal((await GET(request())).status, 401); assert.equal(reads.length, 0);
  authError = null; const response = await GET(request()); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("vary"), "Authorization");
  assert.equal((await response.json()).frames[0].ownerId, "owner");
});
test("selection re-verifies its asset/job pair and rejects URL, owner and malformed query injection", async () => {
  for (const query of ["?jobId=bad&assetId=bad", `?jobId=${JOB}&assetId=${ASSET}&ownerId=other`, "?url=https://example.com", `?jobId=${JOB}&jobId=${JOB}`]) {
    assert.equal((await GET(request(query))).status, 400);
  }
  assert.equal(reads.length, 0);
  const response = await GET(request(`?jobId=${JOB}&assetId=${ASSET}`)); assert.equal(response.status, 200);
  assert.deepEqual(reads, [{ ownerId: "owner", imageJobId: JOB, assetId: ASSET }]);
  lookup = () => { throw new Error("Internal secret details"); };
  const failed = await GET(request(`?jobId=${JOB}&assetId=${ASSET}`)); assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /Internal secret/);
});
