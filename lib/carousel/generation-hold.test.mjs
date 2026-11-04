import assert from "node:assert/strict";
import {mock,test} from "node:test";
import {readFileSync} from "node:fs";
let feedCalls=0, reservations=0, dispatches=0, attachments=0;
mock.module("@/lib/trending/unified-daily-feed",{namedExports:{ensureUnifiedTrendingDailyFeed:async()=>{feedCalls++;throw Error("Unexpected feed generation");}}});
mock.module("@/lib/trending/wall-text-access",{namedExports:{isWallTextEnabled:()=>false}});
mock.module("@/lib/carousel/content-plan-db",{namedExports:{ensureCurrentCarouselContentPlan:async()=>{reservations++;return {status:"generating",id:"plan-1",planVersion:1,generationAttempt:1,userId:"owner",projectId:"project"};},attachCarouselContentPlanGenerationJob:async()=>{attachments++;}}});
mock.module("@/lib/jobs/background-job-service",{namedExports:{createAndDispatchBackgroundJob:async(_params,options)=>{dispatches++;await options.beforeDispatch({id:"job-1"});return {id:"job-1"};}}});
const {prebuildTrendingAfterOnboarding}=await import("../trending/onboarding-prebuild.ts");
const {ensureCarouselContentPlanGeneration}=await import("./content-plan-generation-job.ts");
const {isAutomaticCarouselGenerationPaused,CAROUSEL_GENERATION_PILOT_USER_ID}=await import("./generation-hold.ts");

test("default hold completes business setup without generating or dispatching content",async()=>{
 const old=process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
 try{
  assert.equal(isAutomaticCarouselGenerationPaused(),true);
  assert.deepEqual(await prebuildTrendingAfterOnboarding({includeHookVideos:false,profile:{},timezone:"UTC"}),[{format:"daily_feed",status:"paused"}]);
  await assert.rejects(ensureCarouselContentPlanGeneration({profile:{},timezone:"UTC"}),/temporarily on hold/);
  assert.equal(feedCalls,0);assert.equal(reservations,0);assert.equal(dispatches,0);assert.equal(attachments,0);
 }finally{if(old===undefined)delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=old;}
});
test("explicit release preserves content-plan reservation, attachment and dispatch",async()=>{
 const old=process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED="false";
 try{const result=await ensureCarouselContentPlanGeneration({profile:{},timezone:"UTC"});assert.equal(result.generationJobId,"job-1");assert.equal(reservations,1);assert.equal(dispatches,1);assert.equal(attachments,1);}
 finally{if(old===undefined)delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=old;}
});
test("daily preparation hold precedes mutations and keeps existing-content reads available",()=>{
 const source=readFileSync(new URL("../trending/unified-daily-feed.ts",import.meta.url),"utf8");
 const ensure=source.slice(source.indexOf("export async function ensureUnifiedTrendingDailyFeed"));
 assert.ok(ensure.indexOf("isAutomaticCarouselGenerationPaused(undefined, params.profile.userId)) return readUnifiedTrendingDailyFeed(params)")<ensure.indexOf("updateBusinessProfileTrendingTimezone"));
 assert.match(source,/if \(isAutomaticCarouselGenerationPaused\(undefined, params.profile.userId\)\) return Promise.resolve\(\);/);
 assert.match(source,/requiresPreparation: !isAutomaticCarouselGenerationPaused\(undefined, params.userId\)/);
});

test("pilot UID alone passes the default hold; other/missing owners remain paused", async()=>{
 const old=process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
 try{
  assert.equal(isAutomaticCarouselGenerationPaused(undefined,CAROUSEL_GENERATION_PILOT_USER_ID),false);
  for(const owner of [undefined,null,"other-owner",CAROUSEL_GENERATION_PILOT_USER_ID+"x"])
    assert.equal(isAutomaticCarouselGenerationPaused(undefined,owner),true);
  const prior=dispatches;
  const result=await ensureCarouselContentPlanGeneration({profile:{userId:CAROUSEL_GENERATION_PILOT_USER_ID},timezone:"UTC"});
  assert.equal(result.generationJobId,"job-1");assert.equal(dispatches,prior+1);
  const before=feedCalls;
  const prebuild=await prebuildTrendingAfterOnboarding({includeHookVideos:false,profile:{userId:CAROUSEL_GENERATION_PILOT_USER_ID},timezone:"UTC"});
  assert.equal(feedCalls,before+1);assert.equal(prebuild[0].status,"failed"); // fixture intentionally rejects; no fake success
 }finally{if(old===undefined)delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=old;}
});
