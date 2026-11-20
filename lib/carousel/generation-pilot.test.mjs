import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import * as app from "./generation-hold.ts";
import * as worker from "../../worker/src/lib/carousel-generation-hold.ts";
import * as appFormatPolicy from "../trending/format-policy.ts";
import * as workerFormatPolicy from "../../worker/src/lib/trending-format-policy.ts";
test("app and worker agree on the exact pilot owner under paused/default settings",()=>{
 assert.equal(app.CAROUSEL_GENERATION_PILOT_USER_ID,worker.CAROUSEL_GENERATION_PILOT_USER_ID);
 assert.equal(appFormatPolicy.TRENDING_SLIDESHOW_ONLY_ENABLED,false);
 assert.equal(workerFormatPolicy.TRENDING_SLIDESHOW_ONLY_ENABLED,false);
 for(const flag of ["true","",undefined])for(const owner of [app.CAROUSEL_GENERATION_PILOT_USER_ID,"other",null,undefined]){
  assert.equal(app.isAutomaticCarouselGenerationPaused(flag,owner),owner!==app.CAROUSEL_GENERATION_PILOT_USER_ID);
  assert.equal(app.isAutomaticTrendingGenerationPaused(flag,owner),owner!==app.CAROUSEL_GENERATION_PILOT_USER_ID);
  assert.equal(worker.isAutomaticCarouselGenerationPaused(flag,owner),app.isAutomaticCarouselGenerationPaused(flag,owner));
 }
});
test("worker checks stored job owner for carousel and multi-format Trending jobs while retaining other job types",()=>{
 const old=process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED="true";
 try{
  for(const type of ["generate_carousel","carousel_content_plan_generation"]){assert.equal(worker.isCarouselGenerationJobHeld(type,app.CAROUSEL_GENERATION_PILOT_USER_ID),false);assert.equal(worker.isCarouselGenerationJobHeld(type,"other"),true);assert.equal(worker.isCarouselGenerationJobHeld(type),true);}
  for(const type of ["generate_trending_hook_copy","wall_text_content_plan_generation","wall_text_generation","reaction_generation"]){assert.equal(workerFormatPolicy.isTrendingGenerationJobDisabled(type,app.CAROUSEL_GENERATION_PILOT_USER_ID),false);assert.equal(workerFormatPolicy.isTrendingGenerationJobDisabled(type,"other"),true);assert.equal(workerFormatPolicy.isTrendingGenerationJobDisabled(type),true);}
  for(const type of ["generate_image","generate_hook_video","publish_social_post","render_trending_carousel_edit","render_wall_text_video","reaction_render"]){assert.equal(worker.isCarouselGenerationJobHeld(type,"other"),false);assert.equal(workerFormatPolicy.isTrendingGenerationJobDisabled(type,"other"),false);}
  for(const file of ["worker/src/processor.ts","worker/src/jobs/index.ts"])assert.match(readFileSync(new URL("../../"+file,import.meta.url),"utf8"),/isCarouselGenerationJobHeld\(job.job_type, job.user_id\)/);
  assert.match(readFileSync(new URL("../../worker/src/jobs/index.ts",import.meta.url),"utf8"),/isTrendingGenerationJobDisabled\(job\.job_type, job\.user_id\)/);
  assert.doesNotThrow(()=>app.assertAutomaticTrendingGenerationEnabled(app.CAROUSEL_GENERATION_PILOT_USER_ID));
  assert.throws(()=>app.assertAutomaticTrendingGenerationEnabled("other"),/temporarily on hold/);
 }finally{if(old===undefined)delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=old;}
});
test("every server-side Hook, Wall-of-text, and Reaction generation entry point enforces single-owner pilot fencing",()=>{
 const read=(file)=>readFileSync(new URL("../../"+file,import.meta.url),"utf8");
 assert.match(read("lib/trending/trending-hook-feed.ts"),/assertAutomaticTrendingGenerationEnabled\(profile\.userId\)/);
 assert.match(read("lib/trending/trending-hook-copy-jobs.ts"),/assertAutomaticTrendingGenerationEnabled\(params\.userId\)/);
 assert.match(read("lib/trending/trending-wall-text-feed.ts"),/assertAutomaticTrendingGenerationEnabled\(profile\.userId\)/);
 assert.match(read("lib/trending/wall-text-jobs.ts"),/assertAutomaticTrendingGenerationEnabled\(params\.userId\)/);
 assert.match(read("lib/trending/wall-text-content-plan-generation-job.ts"),/assertAutomaticTrendingGenerationEnabled\(params\.profile\.userId\)/);
 assert.match(read("lib/reaction-format/generation-jobs.ts"),/assertAutomaticTrendingGenerationEnabled\(profile\.userId\)/);
 assert.match(read("lib/trending/feed-replenishment.ts"),/isAutomaticTrendingGenerationPaused\(undefined, params\.userId\)/);
 assert.match(read("lib/trending/wall-text-early-delivery.ts"),/isAutomaticTrendingGenerationPaused\(undefined, event\.user_id\)/);
 assert.match(read("lib/trending/wall-text-early-delivery.ts"),/isAutomaticTrendingGenerationPaused\(undefined, row\.user_id\)/);
 assert.match(read("app/api/internal/jobs/prepare-wall-text/route.ts"),/isAutomaticTrendingGenerationPaused\(undefined, input\.userId\)/);
 assert.match(read("app/api/internal/jobs/recover-wall-text-terminal/route.ts"),/isAutomaticTrendingGenerationPaused\(undefined, input\.userId\)/);
 assert.match(read("app/api/trending/hook-videos/feed/prepare/route.ts"),/isAutomaticTrendingGenerationPaused\(undefined, auth\.user\.uid\)/);
 assert.match(read("app/api/trending/wall-text/feed/prepare/route.ts"),/isAutomaticTrendingGenerationPaused\(undefined, userId\)/);
 assert.match(read("app/api/trending/feed/route.ts"),/!isAutomaticTrendingGenerationPaused\(undefined, userId\)[\s\S]*restartFailedDailyTrendingFeedSlots/);
});
