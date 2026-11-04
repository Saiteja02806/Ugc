import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import * as app from "./generation-hold.ts";
import * as worker from "../../worker/src/lib/carousel-generation-hold.ts";
test("app and worker agree on the exact pilot owner under paused/default settings",()=>{
 assert.equal(app.CAROUSEL_GENERATION_PILOT_USER_ID,worker.CAROUSEL_GENERATION_PILOT_USER_ID);
 for(const flag of ["true","",undefined])for(const owner of [app.CAROUSEL_GENERATION_PILOT_USER_ID,"other",null,undefined]){
  assert.equal(app.isAutomaticCarouselGenerationPaused(flag,owner),owner!==app.CAROUSEL_GENERATION_PILOT_USER_ID);
  assert.equal(worker.isAutomaticCarouselGenerationPaused(flag,owner),app.isAutomaticCarouselGenerationPaused(flag,owner));
 }
});
test("worker checks stored job owner and retains other job types",()=>{
 const old=process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED="true";
 try{
  for(const type of ["generate_carousel","carousel_content_plan_generation"]){assert.equal(worker.isCarouselGenerationJobHeld(type,app.CAROUSEL_GENERATION_PILOT_USER_ID),false);assert.equal(worker.isCarouselGenerationJobHeld(type,"other"),true);assert.equal(worker.isCarouselGenerationJobHeld(type),true);}
  for(const type of ["generate_image","generate_hook_video","publish_social_post","render_trending_carousel_edit"])assert.equal(worker.isCarouselGenerationJobHeld(type,"other"),false);
  for(const file of ["worker/src/processor.ts","worker/src/jobs/index.ts"])assert.match(readFileSync(new URL("../../"+file,import.meta.url),"utf8"),/isCarouselGenerationJobHeld\(job.job_type, job.user_id\)/);
 }finally{if(old===undefined)delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=old;}
});
