import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { runFinishExploreVideoJob } from "../worker/dist/jobs/finish-explore-video.js";
import { ExploreFinishingStore } from "../worker/dist/lib/explore-finishing-store.js";
import { SCRIBE_PROVIDER_KEY } from "../worker/dist/subtitles/elevenlabs-provider.js";
import { hasWorkerJobHandler } from "../worker/dist/jobs/index.js";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const fp = "a".repeat(64), hash = "b".repeat(64);
const transcript = { schemaVersion:1,provider:"elevenlabs",model:"scribe_v2",language:"en",durationMs:2000,
  words:[{text:"Hook",startMs:100,endMs:500},{text:"Demo",startMs:1100,endMs:1500}] };
function fixture({ subtitles = true, claimState = "submit", receiptStatus = "queued", recovered = null, draftChanges = {} } = {}) {
  const events = []; let submits = 0, composed = 0, sourcePath;
  const receipt = { user_id:"owner-a",request_key:id(10),job_id:id(11),output_asset_id:id(12),fingerprint:fp,status:receiptStatus,
    draft:{version:1,kind:"hook",sourceAssetId:id(1),demoAssetId:id(2),demoAudioAssetId:id(3),demoAudioPlayback:"once",
      backgroundAssetId:null,backgroundPlayback:"once",subtitles:subtitles ? {language:"en",style:"clean",placement:"bottom"} : null,...draftChanges} };
  const job = { id:receipt.job_id,job_type:"render_demo_video",project_id:"explore",user_id:receipt.user_id,claim_token:id(20),
    idempotency_key:`explore-finish:${receipt.request_key}`,input_json:{version:1,userId:receipt.user_id,requestKey:receipt.request_key,fingerprint:fp,outputAssetId:receipt.output_asset_id} };
  const output = { storageKey:`explore/finishes/${receipt.output_asset_id}/video.mp4`,url:"https://storage.example/video.mp4",fileSizeBytes:1000 };
  const deps = {
    store:{
      read:async (owner,key)=>{assert.equal(owner,receipt.user_id);assert.equal(key,receipt.request_key);return receipt;},
      asset:async (owner,assetId,collection)=>{assert.equal(owner,receipt.user_id);events.push(`asset:${assetId}`);return {id:assetId,user_id:owner,collection,storage_key:assetId,ratio:"9:16"};},
      claimSpeech:async (r,token,sourceHash,duration,policy)=>{assert.equal(r,receipt);assert.equal(token,job.claim_token);assert.equal(sourceHash,hash);assert.equal(duration,2000);assert.equal(policy,SCRIBE_PROVIDER_KEY);events.push("claim");return {state:claimState,...(claimState === "ready" ? {transcript} : {})};},
      saveSpeech:async (r,sourceHash,duration,value,policy)=>{assert.equal(r,receipt);assert.equal(value,transcript);assert.equal(policy,SCRIBE_PROVIDER_KEY);events.push("save");return value;},
      finalize:async (r,token,value)=>{assert.equal(r,receipt);assert.equal(token,job.claim_token);assert.deepEqual(value,recovered ?? output);events.push("finalize");return r.output_asset_id;},
    },
    storage:{
      existing:async ()=>recovered,
      download:async ()=>{events.push("download");},
      upload:async (r,path,details)=>{assert.equal(r,receipt);assert.equal(details.metadata.subtitleWordCount,subtitles ? 2 : 0);events.push("upload");return output;},
    },
    transcription:{id:SCRIBE_PROVIDER_KEY,prepare:async ()=>{events.push("prepare");return {sourceHash:hash,submit:async ()=>{submits++;events.push("submit");return transcript;}};}},
    finish:async options=>{composed++;sourcePath=options.sourcePath;assert.equal(options.demoAudioPlayback,"once");
      assert.ok(options.demoAudioPath);assert.ok(options.demoPath);assert.equal(options.backgroundMusicPath,undefined);
      if (options.subtitles) await options.subtitles.loadTranscript({audioPath:"worker-prepared.wav",sourceHash:hash,durationMs:2000,language:"en"});
      return {outputPath:"worker-result.mp4",durationMs:2000,width:256,height:384,sourceHashes:{opening:hash},segments:[],demoAudioTiming:null,
        backgroundMusicTiming:null,subtitleStyle:options.subtitles?.style ?? null,subtitleWordCount:subtitles ? 2 : 0};},
  };
  const context = {checkpoint:async ({stage})=>{events.push(`checkpoint:${stage}`);}};
  return {receipt,job,deps,context,events,output,submits:()=>submits,composed:()=>composed,sourcePath:()=>sourcePath};
}

test("Explore finishing is registered without changing existing renderer handlers", () => {
  for (const type of ["render_demo_video","render_edit_video","render_schedule_combination","render_wall_text_video","final_render","generate_hook_video"]) assert.equal(hasWorkerJobHandler(type),true);
});

test("verifies all owned assets before downloads and persists validated Scribe-format results before rendering/upload/finalization", async () => {
  const f = fixture(), result = await runFinishExploreVideoJob(f.job,f.context,f.deps);
  assert.deepEqual(result,{mediaAssetId:f.receipt.output_asset_id,requestKey:f.receipt.request_key});
  assert.equal(f.submits(),1); assert.equal(f.composed(),1);
  assert.ok(f.events.indexOf(`asset:${id(3)}`) < f.events.indexOf("download"));
  for (const [a,b] of [["prepare","claim"],["claim","submit"],["submit","save"],["save","upload"],["upload","finalize"]]) assert.ok(f.events.indexOf(a) < f.events.indexOf(b), `${a} must precede ${b}`);
  await assert.rejects(access(f.sourcePath()),error=>error.code === "ENOENT");
});

test("a saved transcript is reused without a new paid submission", async () => {
  const f = fixture({claimState:"ready"}); await runFinishExploreVideoJob(f.job,f.context,f.deps);
  assert.equal(f.submits(),0); assert.equal(f.events.includes("save"),false); assert.equal(f.events.includes("finalize"),true);
});

test("all four approved subtitle styles reach the owned finishing renderer without substitution", async () => {
  for (const style of ["clean", "bold-box", "active-word", "editorial"]) {
    const f = fixture({ draftChanges:{ subtitles:{ language:"en",style,placement:"bottom" } } });
    const finish = f.deps.finish, upload = f.deps.storage.upload;
    f.deps.finish = async options => {
      assert.equal(options.subtitles.style,style);
      return finish(options);
    };
    f.deps.storage.upload = async (receipt,path,details) => {
      assert.equal(details.metadata.subtitleStyle,style);
      return upload(receipt,path,details);
    };
    await runFinishExploreVideoJob(f.job,f.context,f.deps);
    assert.equal(f.submits(),1);
    assert.equal(f.composed(),1);
  }
});

test("an uncertain paid claim stops before provider, output upload and publication", async () => {
  const f = fixture({claimState:"uncertain"});
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),error=>error.code === "provider_submission_uncertain");
  assert.equal(f.submits(),0); assert.equal(f.events.includes("upload"),false); assert.equal(f.events.includes("finalize"),false);
  await assert.rejects(access(f.sourcePath()),error=>error.code === "ENOENT");
});

test("subtitles off does not need Scribe configuration or claim speech", async () => {
  const f = fixture({subtitles:false}); delete f.deps.transcription;
  await runFinishExploreVideoJob(f.job,f.context,f.deps);
  assert.equal(f.submits(),0); for (const event of ["prepare","claim","submit","save"]) assert.equal(f.events.includes(event),false);
});

test("both workflow kinds forward the owned framing path unchanged to rendering and saved metadata", async () => {
  const framing = {version:1,width:.375,height:1,points:[[0,0,0],[1000,0,0],[1800,.625,0],[2000,.625,0]]};
  for (const kind of ["hook","phone"]) {
    const f=fixture({subtitles:false,draftChanges:{kind,demoFraming:framing}});
    const before=JSON.stringify(f.receipt.draft), finish=f.deps.finish, upload=f.deps.storage.upload;
    f.deps.finish=async options=>{assert.deepEqual(options.demoFraming,framing);return finish(options);};
    f.deps.storage.upload=async (receipt,path,details)=>{assert.deepEqual(details.metadata.demoFraming,framing);return upload(receipt,path,details);};
    await runFinishExploreVideoJob(f.job,f.context,f.deps);
    assert.equal(JSON.stringify(f.receipt.draft),before);
    assert.equal(f.composed(),1);assert.equal(f.submits(),0);
  }
});

test("legacy finishing jobs omit framing from renderer options and output metadata", async () => {
  const f=fixture({subtitles:false}), finish=f.deps.finish, upload=f.deps.storage.upload;
  f.deps.finish=async options=>{assert.equal(Object.hasOwn(options,"demoFraming"),false);return finish(options);};
  f.deps.storage.upload=async (receipt,path,details)=>{assert.equal(Object.hasOwn(details.metadata,"demoFraming"),false);return upload(receipt,path,details);};
  await runFinishExploreVideoJob(f.job,f.context,f.deps);
});

test("an invalid saved crop path is rejected before downloads or provider work", async () => {
  const f=fixture({draftChanges:{demoFraming:{version:1,width:.5,height:1,points:[[0,.9,0]]}}});
  // Exercise the real store boundary: the general fixture intentionally mocks
  // an already validated receipt for the other worker orchestration tests.
  const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:f.receipt,error:null})};
  const store=new ExploreFinishingStore({from:()=>query});
  f.deps.store.read=(...args)=>store.read(...args);
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps));
  assert.equal(f.events.includes("download"),false);assert.equal(f.composed(),0);assert.equal(f.submits(),0);
});

test("stored GCP output recovers without composing, transcription, uploads, or Scribe configuration", async () => {
  const f = fixture({recovered:{url:"https://storage.example/owned.mp4",storageKey:"owned-finished-video"}}); delete f.deps.transcription;
  await runFinishExploreVideoJob(f.job,f.context,f.deps);
  assert.equal(f.composed(),0); assert.equal(f.submits(),0); assert.equal(f.events.includes("finalize"),true);
  assert.equal(f.events.includes("download"),false); assert.equal(f.events.includes("upload"),false);
});

test("completed receipts re-check output ownership and do no work", async () => {
  const f = fixture({receiptStatus:"completed"}); delete f.deps.transcription;
  await runFinishExploreVideoJob(f.job,f.context,f.deps);
  assert.deepEqual(f.events,[`asset:${f.receipt.output_asset_id}`]); assert.equal(f.composed(),0);
});

test("invalid job namespace, owner, IDs, project, type, or stale receipt fails before all provider work", async () => {
  for (const change of [{project_id:"another"},{job_type:"render_edit_video"},{user_id:"owner-b"},{claim_token:null},{idempotency_key:"legacy"},
    {input_json:{version:1,userId:"owner-a",requestKey:"invalid"}}]) {
    const f = fixture(); await assert.rejects(runFinishExploreVideoJob({...f.job,...change},f.context,f.deps)); assert.equal(f.submits(),0); assert.equal(f.composed(),0);
  }
  for (const change of [{job_id:id(99)},{fingerprint:"c".repeat(64)},{output_asset_id:id(99)}]) {
    const f = fixture(); Object.assign(f.receipt,change); await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps)); assert.equal(f.submits(),0);
  }
});

test("missing configuration, unsupported style, or an unavailable owned source fails before paid claims", async () => {
  const missing = fixture(); delete missing.deps.transcription;
  await assert.rejects(runFinishExploreVideoJob(missing.job,missing.context,missing.deps),/configured provider/); assert.equal(missing.composed(),0);
  const unsupported = fixture({draftChanges:{subtitles:{language:"en",style:"unsupported-style",placement:"bottom"}}});
  await assert.rejects(runFinishExploreVideoJob(unsupported.job,unsupported.context,unsupported.deps),error=>error.code === "INVALID_STYLE"); assert.equal(unsupported.composed(),0);
  const unavailable = fixture(); unavailable.deps.store.asset=async ()=>{throw new Error("source removed");};
  await assert.rejects(runFinishExploreVideoJob(unavailable.job,unavailable.context,unavailable.deps),/source removed/); assert.equal(unavailable.events.includes("download"),false);
});

test("changed speech snapshot is rejected before durable claim or provider submission", async () => {
  const f = fixture(); f.deps.transcription.prepare=async ()=>({sourceHash:"c".repeat(64),submit:async ()=>{throw new Error("must not submit");}});
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),/speech file changed/); assert.equal(f.events.includes("claim"),false);
});

test("a failed durable transcript save never uploads an unrecorded result", async () => {
  const f = fixture(); f.deps.store.saveSpeech=async ()=>{throw new Error("database ack lost");};
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),/ack lost/); assert.equal(f.submits(),1); assert.equal(f.events.includes("upload"),false);
});

test("stored output with a lost finalization ACK is retryable without generating another video", async () => {
  const f = fixture(); f.deps.store.finalize=async ()=>{throw new Error("database temporarily unavailable");};
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),error=>error.code === "explore_finish_finalization_pending");
  assert.equal(f.events.includes("upload"),true); assert.equal(f.submits(),1);
});

test("recovered GCP output keeps finalization retryable while the database remains unavailable", async () => {
  const f = fixture({recovered:{url:"https://storage.example/owned.mp4",storageKey:"owned-finished-video"}});
  delete f.deps.transcription;
  f.deps.store.finalize=async ()=>{throw new Error("database temporarily unavailable");};
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),error=>error.code === "explore_finish_finalization_pending");
  assert.equal(f.composed(),0); assert.equal(f.submits(),0); assert.equal(f.events.includes("download"),false);
});

test("an unconfirmed GCP upload schedules owned-object recovery, not another paid transcript", async () => {
  const f = fixture(); f.deps.storage.upload=async ()=>{throw new Error("storage response lost");};
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),error=>error.code === "explore_finish_upload_uncertain");
  assert.equal(f.submits(),1); assert.equal(f.events.includes("save"),true); assert.equal(f.events.includes("finalize"),false);
});

test("cancellation at transcription checkpoint prevents preparing, claiming, and submitting speech", async () => {
  const f = fixture(); f.context.checkpoint=async ({stage})=>{if (stage === "transcribing_original_speech") throw new Error("cancelled");};
  await assert.rejects(runFinishExploreVideoJob(f.job,f.context,f.deps),/cancelled/);
  assert.equal(f.submits(),0); assert.equal(f.events.includes("prepare"),false); assert.equal(f.events.includes("claim"),false);
});
