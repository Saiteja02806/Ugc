import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";

// Exercise the real client and real API handler, with all external writes replaced.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
class FirebaseAuthRequestError extends Error { status = 401; }
class BillingAccessError extends Error { status = 403; }
const jobs = new Map(), reservations = new Map(), uploads = [];
const audioId = "11111111-1111-4111-8111-111111111111", videoId = "22222222-2222-4222-8222-222222222222";
const ownedAssets = new Map();
let failChild = null;
let approvedFrame = null;
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError } });
mock.module("@/lib/ai-studio/server-access", { namedExports: { requireAIStudioProUser: async (request) => {
  if (request.headers.get("Authorization") !== "Bearer fake-owner-token") throw new FirebaseAuthRequestError("Sign in first.");
  return { uid: "owner-a" };
} } });
mock.module("@/lib/queues/job-queue", { namedExports: { getMissingJobQueueEnvVars: () => [] } });
mock.module("@/lib/jobs/background-jobs", { namedExports: { getMissingBackgroundJobStorageEnvVars: () => [], getBackgroundJobById: async () => null } });
mock.module("@/lib/jobs/background-job-service", { namedExports: { createAndDispatchBackgroundJob: async (input) => {
  if (input.idempotencyKey.endsWith(`:${failChild}`)) throw new BillingAccessError("Second output could not start.");
  const key = `${input.userId}:${input.idempotencyKey}`;
  if (!jobs.has(key)) jobs.set(key, { id: `job-${jobs.size + 1}`, ...input });
  return jobs.get(key);
} } });
mock.module("@/lib/storage/storage", { namedExports: { isTrustedStorageUrl: (url) => new URL(url).hostname === "storage.example.com" } });
mock.module("@/lib/media/media-storage", { namedExports: { getMediaAssetsForOwnerByUrls: async ({ urls, userId }) => [...ownedAssets.values()].filter(asset => asset.user_id === userId && urls.includes(asset.url)), getMediaAssetForOwner: async ({ assetId, userId }) => {
  const asset = ownedAssets.get(assetId); return asset?.user_id === userId ? asset : null;
} } });
mock.module("@/lib/explore/hook-video-library", { namedExports: { isExploreHookVideoId: () => false } });
mock.module("@/lib/explore/wall-text-video-library", { namedExports: { isExploreWallTextVideoId: () => false } });
mock.module("@/lib/billing/subscription-db", { namedExports: {
  BillingAccessError, deliverBillingUsageForJob: async () => {},
  getGenerationCreditCost: (_kind, seconds) => seconds * 4,
  reserveBillingCredits: async (input) => { reservations.set(`${input.userId}:${input.idempotencyKey}`, input); },
  releaseBillingCredits: async (input) => { reservations.delete(`${input.userId}:${input.idempotencyKey}`); },
} });
mock.module(new URL("../lib/explore/hook-keyframe-result.ts", import.meta.url), { namedExports: {
  resolveApprovedHookStartingFrame: async () => approvedFrame ?? assert.fail("Unexpected starting-frame asset"),
} });
const { handleAIStudioVideoGeneration } = await import("../lib/ai-studio/video-generation-api.ts");
const { createWorkflowGenerationClient } = await import("../lib/explore/workflow-generation-client.ts");
const { normalizeWorkflowGenerationSettings } = await import("../lib/explore/workflow-generation-settings.ts");
const initialEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE;
const initialWanEnabled = process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN;
beforeEach(() => { jobs.clear(); reservations.clear(); ownedAssets.clear(); uploads.length = 0; failChild = null; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = "true"; process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = "true"; });
after(() => { if (initialEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_SEEDANCE = initialEnabled; });
after(() => { if (initialWanEnabled === undefined) delete process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN; else process.env.NEXT_PUBLIC_ENABLE_OPENROUTER_WAN = initialWanEnabled; });

const draft = (overrides = {}) => ({ kind: "hook", instructions: "A creator explains a useful app.", settings: normalizeWorkflowGenerationSettings({ model: "google_omni", quantity: 2 }, true), creator: null, appScreen: null, videoReference: null, audioReference: null, ...overrides });
function client(overrides = {}) {
  return createWorkflowGenerationClient({
    assertActive() {}, getOwnerToken: async () => "fake-owner-token", createIdempotencyKey: () => "submission",
    uploadImage: async (image) => {
      uploads.push(image);
      const url = `https://storage.example.com/${uploads.length}.png`, id = crypto.randomUUID();
      ownedAssets.set(id, { id, url, user_id: "owner-a", collection: "image", status: "ready", deleted_at: null,
        mime_type: "image/png", file_size_bytes: 1024 });
      return { url };
    },
    uploadReference: async (source, kind) => {
      uploads.push(source);
      const id = kind === "audio" ? audioId : videoId, url = `https://storage.example.com/${kind}.media`;
      ownedAssets.set(id, { id, url, user_id: "owner-a", collection: kind, status: "ready", deleted_at: null,
        duration_seconds: source.duration, mime_type: source.file.type, file_size_bytes: source.file.size });
      return { assetId: id, url, duration: source.duration };
    },
    fetch: async (url, init) => {
      assert.equal(url, "/api/ai-studio/videos/generate");
      return handleAIStudioVideoGeneration(new Request(`https://www.getugcpilot.com${url}`, init));
    },
    ...overrides,
  });
}

test("both workflow clients reach the real API's text-only contract for every available model", async () => {
  for (const kind of ["hook", "phone"]) {
    for (const model of ["kling_3_0", "google_omni", "seedance_2_5", "wan_3_0"]) for (const quantity of [2, 3]) {
      jobs.clear(); reservations.clear();
      const input = draft({ kind, settings: normalizeWorkflowGenerationSettings({ model, quantity }, true) });
      const batch = await client().generate(input);
      assert.equal(batch.jobs.length, quantity);
      assert.equal(batch.partial, false);
      assert.equal(uploads.length, 0);
      for (const job of jobs.values()) {
        assert.equal(job.jobType, "generate_hook_video");
        assert.equal(job.userId, "owner-a");
        assert.equal(job.projectId, "ai-studio");
        assert.equal(job.input.model, model);
        assert.equal(job.input.hookIdea, input.instructions);
        assert.deepEqual(job.input.referenceImageUrls, []);
        assert.equal(job.input.provider, "reapi");
      }
      assert.equal(reservations.size, quantity);
    }
  }
});

test("creator and app screenshots reach the real API as uploaded multi-image guidance", async () => {
  await assert.rejects(client().generate(draft({ kind: "phone", settings: normalizeWorkflowGenerationSettings({ model: "google_omni" }, true),
    creator: { name: "creator.png", url: "blob:creator" }, appScreen: { name: "app.png", url: "blob:app", kind: "image" },
  })), /one image, or three images/);
  for (const model of ["seedance_2_5", "wan_3_0"]) {
    jobs.clear(); reservations.clear(); uploads.length = 0;
    await client().generate(draft({ kind: "phone", settings: normalizeWorkflowGenerationSettings({ model }, true),
      creator: { name: "creator.png", url: "blob:creator" }, appScreen: { name: "app.png", url: "blob:app", kind: "image" },
    }));
    const job = [...jobs.values()][0];
    assert.deepEqual(job.input.referenceImageUrls, ["https://storage.example.com/1.png", "https://storage.example.com/2.png"]);
    assert.equal(job.input.avatarImageUrl, job.input.referenceImageUrls[0]);
    assert.equal(uploads.length, 2);
    assert.equal(reservations.size, 1);
  }
});

test("Kling 4 long prompts survive both real workflow clients and API admission without truncation", async () => {
  for (const kind of ["hook", "phone"]) for (const length of [4001, 6000, 10_000]) {
    jobs.clear(); reservations.clear();
    const suffix = "KEEP THIS FINAL ACTION";
    const prompt = "x".repeat(length - suffix.length) + suffix;
    const input = draft({ kind, instructions: prompt, settings: normalizeWorkflowGenerationSettings({ model: "kling_4_0", quantity: 1, duration: 3 }, true) });
    await client().generate(input);
    const job = [...jobs.values()][0];
    assert.equal(job.input.hookIdea, prompt);
    assert.equal(job.input.provider, "reapi");
    assert.equal(job.input.model, "kling_4_0");
    assert.equal(reservations.size, 1);
  }
  jobs.clear(); reservations.clear();
  const input = draft({ instructions: "x".repeat(10_001), settings: normalizeWorkflowGenerationSettings({ model: "kling_4_0", quantity: 1 }, true) });
  await assert.rejects(client().generate(input), /too long/);
  assert.equal(jobs.size, 0); assert.equal(reservations.size, 0);
});

test("both Explore workflows send owned Create audio/video to ReAPI, independently of appended demos", async () => {
  for (const kind of ["hook", "phone"]) {
    jobs.clear(); reservations.clear(); uploads.length = 0;
    const reference = (media) => ({ name: `${media}.media`, url: `blob:${media}`, duration: 30, file: { type: `${media}/${media === "audio" ? "mpeg" : "mp4"}`, size: 1024 } });
    await client().generate(draft({ kind, settings: normalizeWorkflowGenerationSettings({ model: "seedance_2_5" }, true),
      videoReference: kind === "hook" ? reference("video") : null,
      appScreen: kind === "phone" ? { ...reference("video"), kind: "video" } : null, audioReference: reference("audio"),
      demo: { url: "blob:not-a-reference" }, demoAudio: { url: "blob:not-reference-audio" },
    }));
    const input = [...jobs.values()][0].input;
    assert.equal(input.provider, "reapi");
    assert.equal(input.referenceVideoAssetId, videoId);
    assert.equal(input.referenceVideoDurationSeconds, 30);
    assert.deepEqual(input.referenceAudioAssetIds, [audioId]);
    assert.deepEqual(input.referenceAudioUrls, ["https://storage.example.com/audio.media"]);
    assert.equal(uploads.length, 2);
    assert.equal(reservations.size, 1);
    assert.doesNotMatch(JSON.stringify(input), /blob:|demoAssetId|demoAudioAssetId|backgroundAssetId/);
  }
});

test("Talking Head and Hook retain all three reference kinds through their real client and API for WAN", async () => {
  for (const kind of ["hook", "phone"]) {
    jobs.clear(); reservations.clear(); uploads.length = 0; ownedAssets.clear();
    const reference = media => ({ name: `${media}.media`, url: `blob:${media}`, duration: 15,
      file: { type: `${media}/${media === "audio" ? "mpeg" : "mp4"}`, size: 1024 } });
    await client().generate(draft({ kind, settings: normalizeWorkflowGenerationSettings({ model: "wan_3_0", duration: 3, durationSeconds: 3 }, true),
      creator: { name: "creator.png", url: "blob:creator" },
      videoReference: kind === "hook" ? reference("video") : null,
      appScreen: kind === "phone" ? { ...reference("video"), kind: "video" } : null,
      audioReference: reference("audio"),
    }));
    const input = [...jobs.values()][0].input;
    assert.equal(input.provider, "reapi"); assert.equal(input.model, "wan_3_0");
    assert.deepEqual(input.referenceImageUrls, ["https://storage.example.com/1.png"]);
    assert.deepEqual(input.referenceAudioUrls, ["https://storage.example.com/audio.media"]);
    assert.deepEqual(input.referenceAudioDurationSeconds, [15]);
    assert.equal(input.referenceVideoUrl, "https://storage.example.com/video.media");
    assert.equal(input.durationSeconds, 3); assert.equal(reservations.size, 1);
  }
});

test("timed-reference ownership is also checked before Explore's atomic startBatch adapter", async () => {
  const body = { model: "seedance_2_5", prompt: "A creator explains an app", durationSeconds: 5, resolution: "720p",
    referenceAudioUrls: ["https://storage.example.com/audio.media"], referenceAudioAssetIds: [audioId] };
  let starts = 0;
  const invoke = () => handleAIStudioVideoGeneration(new Request("https://www.getugcpilot.com/api/ai-studio/videos/workflow-start", {
    method: "POST", headers: { Authorization: "Bearer fake-owner-token" }, body: JSON.stringify(body),
  }), { startBatch: async (batch) => {
    starts++;
    assert.equal(batch.inputs[0].provider, "reapi");
    assert.deepEqual(batch.inputs[0].referenceAudioAssetIds, [audioId]);
    return new Response(null, { status: 202 });
  } });
  assert.equal((await invoke()).status, 400);
  assert.equal(starts, 0);
  ownedAssets.set(audioId, { id: audioId, url: body.referenceAudioUrls[0], user_id: "owner-a", collection: "audio", status: "ready",
    deleted_at: null, duration_seconds: 4.999, mime_type: "audio/mpeg", file_size_bytes: 1024 });
  assert.equal((await invoke()).status, 400, "server must reject short owned audio before reservation");
  assert.equal(starts, 0);
  ownedAssets.set(audioId, { ...ownedAssets.get(audioId), duration_seconds: 5 });
  assert.equal((await invoke()).status, 202);
  assert.equal(starts, 1);
  assert.equal(reservations.size, 0); // Only the adapter owns the atomic reservation.
});

test("a lost API acknowledgement recovers the same durable child IDs and reservation keys", async () => {
  let attempts = 0;
  const actual = client({ fetch: async (url, init) => {
    const result = await handleAIStudioVideoGeneration(new Request(`https://www.getugcpilot.com${url}`, init));
    if (++attempts === 1) throw new Error("acknowledgement lost");
    return result;
  } });
  const input = draft();
  await assert.rejects(actual.generate(input), /acknowledgement lost/);
  const ids = [...jobs.values()].map((job) => job.id);
  const recovered = await actual.generate(input);
  assert.deepEqual(recovered.jobs.map((job) => job.jobId), ids);
  assert.equal(jobs.size, 2);
  assert.equal(reservations.size, 2);
});

test("a real partial acknowledgement keeps started jobs without retrying the missing outputs", async () => {
  failChild = 2;
  const batch = await client().generate(draft({ settings: normalizeWorkflowGenerationSettings({ model: "google_omni", quantity: 4 }, true) }));
  assert.equal(batch.partial, true);
  assert.equal(batch.jobs.length, 1);
  assert.equal(jobs.size, 1);
  assert.equal(reservations.size, 1);
  assert.match(batch.message, /1 of 4/);
});

test("the real API rejects unauthenticated or untrusted references before any billing or job creation", async () => {
  await assert.rejects(client({ getOwnerToken: async () => "wrong-owner-token" }).generate(draft()), /Sign in/);
  await assert.rejects(client({ uploadImage: async () => ({ url: "https://untrusted.example.com/image.png" }) }).generate(draft({ creator: { name: "creator.png", url: "blob:creator" } })), /reference/i);
  assert.equal(jobs.size, 0);
  assert.equal(reservations.size, 0);
});


test("Talking Head sends approved opening and optional face photos through real admission with its script and sound", async () => {
  const previous = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const frame = { assetId: "00000000-0000-4000-8000-000000000001", jobId: "00000000-0000-4000-8000-000000000002", referenceId: "talking-car-story", url: "https://storage.example.com/opening.png", width: 720, height: 1280, durationSeconds: 4, motionInstructions: "Natural talking-head performance", generateAudio: true };
  approvedFrame = { imageUrl: frame.url, assetId: frame.assetId, imageJobId: frame.jobId, referenceId: frame.referenceId, workflow: "talking_head", exploreFormat: "hook", sourceSha256: "a".repeat(64), startingFrameIndex: 0, receipt: { version: 1 }, output: { width: 720, height: 1280, ratio: "9:16" } };
  try {
    await client().generate(draft({ instructions: 'Say "This is my own script."', referenceInstructions: frame.motionInstructions, startingFrame: frame, startingFramePhotos: [], settings: normalizeWorkflowGenerationSettings({model: "google_omni", duration: 4}, true) }));
    const job = [...jobs.values()][0];
    assert.match(job.input.hookIdea, /own script/);
    assert.match(job.input.hookIdea, /natural talking-head performance/i);
    assert.match(job.input.hookIdea, /SOUND SETTING: ON/);
    assert.equal(job.input.referenceId, "talking-car-story");
    assert.equal(job.input.startingFrameImageUrl, frame.url);
    assert.equal(job.input.provider, "reapi");
    assert.deepEqual(job.input.referenceImageUrls, []);
    const photos = [1, 2].map(i => ({ assetId: `face-${i}`, name: `Face ${i}`, url: `https://storage.example.com/face-${i}.png` }));
    // Omni's direct identity route is opt-in, so plain Omni refuses photos before any job.
    await assert.rejects(client().generate(draft({ startingFrame: frame, startingFramePhotos: photos, settings: normalizeWorkflowGenerationSettings({model: "google_omni", duration: 4}, true) })), /Gemini Omni route|face photos/);
    const count = jobs.size;
    // ReAPI models carry the approved frame as Image 1 of a reference job and
    // the identity photos behind it, so Generate stays usable with both inputs.
    await client({ createIdempotencyKey: () => "wan-frame-photos" }).generate(draft({ startingFrame: frame, startingFramePhotos: photos, settings: normalizeWorkflowGenerationSettings({model:"wan_3_0",duration:4},true) }));
    const wanJob = [...jobs.values()].at(-1);
    assert.equal(wanJob.input.model, "wan_3_0");
    assert.equal(wanJob.input.startingFrameImageUrl, frame.url);
    assert.deepEqual(wanJob.input.referenceImageUrls, ["https://storage.example.com/1.png", "https://storage.example.com/2.png"]);
    assert.match(wanJob.input.hookIdea, /Images 2 through 3 are supporting facial identity/);
    assert.equal(jobs.size, count + 1);
    // Kling 3.0 has no reference mode: the approved frame animates alone and the
    // unused photos are not uploaded.
    const uploadsBeforeKling = uploads.length;
    await client({ createIdempotencyKey: () => "kling-frame-photos" }).generate(draft({ startingFrame: frame, startingFramePhotos: photos, settings: normalizeWorkflowGenerationSettings({model:"kling_3_0",duration:4},true) }));
    const klingJob = [...jobs.values()].at(-1);
    assert.equal(klingJob.input.model, "kling_3_0");
    assert.equal(klingJob.input.startingFrameImageUrl, frame.url);
    assert.deepEqual(klingJob.input.referenceImageUrls, []);
    assert.equal(uploads.length, uploadsBeforeKling);
    assert.equal(jobs.size, count + 2);
  } finally { approvedFrame = null; if(previous === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = previous; }
});

test("reviewed Talking Head script crosses client, real API and durable worker input exactly once", async () => {
  const previous = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const frame = { assetId: "00000000-0000-4000-8000-000000000001", jobId: "00000000-0000-4000-8000-000000000002", referenceId: "talking-car-story", url: "https://storage.example.com/opening.png", width: 720, height: 1280, durationSeconds: 4, motionInstructions: "Keep the camera stable.", generateAudio: true };
  approvedFrame = { imageUrl: frame.url, assetId: frame.assetId, imageJobId: frame.jobId, referenceId: frame.referenceId, workflow: "talking_head", exploreFormat: "hook", sourceSha256: "a".repeat(64), startingFrameIndex: 0, receipt: { version: 1 }, output: { width: 720, height: 1280, ratio: "9:16" } };
  const words = "Ready to practice? Let me show you.";
  try {
    await client().generate(draft({ workflow: "talking_head", instructions: words, talkingHeadScript: words, talkingHeadScriptReviewed: true, referenceInstructions: frame.motionInstructions, startingFrame: frame, startingFramePhotos: [], settings: normalizeWorkflowGenerationSettings({ model: "google_omni", duration: 4 }, true) }));
    const job = [...jobs.values()][0];
    assert.equal(job.input.talkingHeadScript, words);
    assert.equal(job.input.talkingHeadScriptReviewed, true);
    assert.equal(job.input.hookIdea.split(JSON.stringify(words)).length - 1, 1);
    assert.doesNotMatch(job.input.hookIdea, /Your instructions:/u);
    assert.match(job.input.hookIdea, /Keep the camera stable/u);
    assert.equal(job.input.provider, "reapi");
    assert.equal(job.input.startingFrameAssetId, frame.assetId);
    const count = jobs.size, reserved = reservations.size;
    for (const [script, sound, reviewed] of [["word ".repeat(80), true, true], [words, false, true], [words, true, false], [words, true, undefined], [words, true, "true"]]) {
      const response = await handleAIStudioVideoGeneration(new Request("https://example.test/api/ai-studio/videos/generate", { method: "POST", headers: { Authorization: "Bearer fake-owner-token", "Content-Type": "application/json" }, body: JSON.stringify({ workflow: "talking_head", prompt: "Keep the camera stable.", talkingHeadScript: script, talkingHeadScriptReviewed: reviewed, startingFrameAssetId: frame.assetId, startingFrameJobId: frame.jobId, referenceId: frame.referenceId, exploreFormat: "hook", generateAudio: sound, model: "google_omni", durationSeconds: 4, resolution: "720p", aspectRatio: "9:16" }) }));
      assert.equal(response.status, 400);
    }
    assert.equal(jobs.size, count); assert.equal(reservations.size, reserved);
  } finally { approvedFrame = null; if (previous === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = previous; }
});

test("Talking Head image plus owned voice reaches real admission in reference mode without frame-role mixing", async () => {
  const previous=process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION="true";
  const frame={assetId:"00000000-0000-4000-8000-000000000001",jobId:"00000000-0000-4000-8000-000000000002",referenceId:"talking-car-story",url:"https://storage.example.com/opening.png",width:720,height:1280,durationSeconds:4,motionInstructions:"Natural delivery",generateAudio:true};
  approvedFrame={imageUrl:frame.url,assetId:frame.assetId,imageJobId:frame.jobId,referenceId:frame.referenceId,workflow:"talking_head",exploreFormat:"hook",sourceSha256:"a".repeat(64),startingFrameIndex:0,receipt:{version:1},output:{width:720,height:1280,ratio:"9:16"}};
  try {
    for(const model of ["wan_3_0","seedance_2_5"])for(const withFace of [false,true]){
      jobs.clear();reservations.clear();ownedAssets.set(frame.assetId,{id:frame.assetId,url:frame.url,user_id:"owner-a",collection:"image",status:"ready",deleted_at:null,mime_type:"image/png",file_size_bytes:1024});
      await client().generate(draft({instructions:'Say "My product saves time."',startingFrame:frame,startingFramePhotos:withFace?[{assetId:"face-owned",name:"Face",url:"https://storage.example.com/face.png"}]:[],audioReference:{url:"blob:voice",name:"Voice.mp3",duration:5,file:{type:"audio/mpeg",size:1024}},settings:normalizeWorkflowGenerationSettings({model,duration:4,quantity:1},true)}));
      const job=[...jobs.values()][0];assert.ok(job);
      assert.equal(job.input.referenceImageUrls[0],frame.url);assert.equal(job.input.referenceImageUrls.length,withFace?2:1);assert.deepEqual(job.input.referenceAudioUrls,["https://storage.example.com/audio.media"]);
      assert.equal(job.input.startingFrameImageUrl,undefined);assert.equal(job.input.startingFrameReceipt,undefined);
      assert.equal(job.input.startingImageReference.assetId,frame.assetId);assert.equal(job.input.startingImageReference.mode,"image_voice_reference");
      assert.equal(job.input.startingImageReference.sourceFrameIndex,0);assert.equal(job.input.generateAudio,true);assert.equal(job.input.provider,"reapi");
      assert.match(job.input.hookIdea,/Audio 1 is a voice reference/);assert.match(job.input.hookIdea,/My product saves time/);assert.match(job.input.hookIdea,/not a strict first-frame input/);
      assert.equal(job.input.personReference,undefined);
      if(withFace)assert.match(job.input.hookIdea,/Images 2 through 2 are supporting facial identity/);
    }
    const base={prompt:'Say "My product saves time."',model:"wan_3_0",durationSeconds:4,quantity:1,resolution:"720p",aspectRatio:"9:16",generateAudio:true,exploreFormat:"hook",startingFrameMode:"image_voice_reference",startingFrameAssetId:frame.assetId,startingFrameJobId:frame.jobId,referenceId:frame.referenceId,referenceAudioUrls:["https://storage.example.com/audio.media"],referenceAudioAssetIds:[audioId]};
    for(const change of [{model:"google_omni"},{generateAudio:false},{startingFrameMode:"unknown"},{referenceAudioUrls:[]},{referenceAudioAssetIds:[]},{referenceId:"different-reference"}]){
      jobs.clear();reservations.clear();const result=await handleAIStudioVideoGeneration(new Request("https://www.getugcpilot.com/api/ai-studio/videos/generate",{method:"POST",headers:{Authorization:"Bearer fake-owner-token","Content-Type":"application/json","Idempotency-Key":"negative"},body:JSON.stringify({...base,...change})}));
      assert.equal(result.status,400);assert.equal(jobs.size,0);assert.equal(reservations.size,0);
    }
    for(const invalid of ["foreign-audio","oversized-image","public-hook"]){
      jobs.clear();reservations.clear();
      const audio=ownedAssets.get(audioId),image=ownedAssets.get(frame.assetId);
      if(invalid==="foreign-audio")ownedAssets.set(audioId,{...audio,user_id:"other-owner"});
      if(invalid==="oversized-image")ownedAssets.set(frame.assetId,{...image,file_size_bytes:17*1024**2});
      if(invalid==="public-hook")approvedFrame={...approvedFrame,workflow:"hook"};
      const result=await handleAIStudioVideoGeneration(new Request("https://www.getugcpilot.com/api/ai-studio/videos/generate",{method:"POST",headers:{Authorization:"Bearer fake-owner-token","Content-Type":"application/json","Idempotency-Key":"negative"},body:JSON.stringify(base)}));
      assert.equal(result.status,400,invalid);assert.equal(jobs.size,0);assert.equal(reservations.size,0);
      ownedAssets.set(audioId,audio);ownedAssets.set(frame.assetId,image);approvedFrame={...approvedFrame,workflow:"talking_head"};
    }
  }finally{approvedFrame=null;if(previous===undefined)delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION=previous;}
});


test("direct Gemini opt-in freezes ordered owned identity references through real client and API", async () => {
  const previous = process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION;
  process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = "true";
  const frame = { assetId: "00000000-0000-4000-8000-000000000001", jobId: "00000000-0000-4000-8000-000000000002", referenceId: "talking-car-story", url: "https://storage.example.com/opening.png", width: 720, height: 1280, durationSeconds: 4, motionInstructions: "Keep the source camera.", generateAudio: false };
  approvedFrame = { imageUrl: frame.url, assetId: frame.assetId, imageJobId: frame.jobId, referenceId: frame.referenceId, workflow: "talking_head", exploreFormat: "hook", sourceSha256: "a".repeat(64), startingFrameIndex: 0, receipt: { version: 1 }, output: { width: 720, height: 1280, ratio: "9:16" } };
  const photos = Array.from({length: 5}, (_, i) => ({ assetId: `00000000-0000-4000-8000-00000000001${i}`, name: `Face ${i}`, url: `https://storage.example.com/face-${i}.png` }));
  for (const photo of photos) ownedAssets.set(photo.assetId, { id: photo.assetId, url: photo.url, user_id: "owner-a", collection: "image", status: "ready", deleted_at: null, mime_type: "image/png", file_size_bytes: 1024 });
  try {
    const input = draft({ startingFrame: frame, startingFramePhotos: photos, startingFrameMode: "first_frame_with_identity", settings: normalizeWorkflowGenerationSettings({ model: "google_omni", duration: 4, quantity: 1 }, true) });
    await client({ uploadImage: async image => ({ url: image.url }) }).generate(input);
    const job = [...jobs.values()][0];
    assert.equal(job.input.provider, "gemini");
    assert.equal(job.input.startingFrameMode, "first_frame_with_identity");
    assert.equal(job.input.startingFrameImageUrl, frame.url);
    assert.deepEqual(job.input.referenceImageUrls, photos.map(p => p.url));
    assert.deepEqual(job.input.personReference, {version: 1, mainImageUrl: photos[0].url, supportingImageUrls: photos.slice(1).map(p => p.url)});
    assert.deepEqual(job.input.ownedImageReferences.images.map(p => p.assetId), [frame.assetId, ...photos.map(p => p.assetId)]);
    jobs.clear(); reservations.clear();
    ownedAssets.delete(photos[0].assetId);
    await assert.rejects(client({ uploadImage: async image => ({ url: image.url }) }).generate(input), /own ready/);
    assert.equal(jobs.size, 0); assert.equal(reservations.size, 0);
    await assert.rejects(client({ uploadImage: async image => ({ url: image.url }) }).generate({...input, startingFrameMode: undefined}), /Gemini Omni route/);
    await assert.rejects(client({ uploadImage: async image => ({ url: image.url }) }).generate({...input, settings: {...input.settings, model: "wan_3_0"}}), /direct Gemini Omni/);
  } finally { approvedFrame = null; if(previous === undefined) delete process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION; else process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION = previous; }
});
