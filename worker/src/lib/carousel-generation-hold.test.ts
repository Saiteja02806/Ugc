import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {isAutomaticCarouselGenerationPaused, isCarouselGenerationJobHeld} from "./carousel-generation-hold.js";
import {DeferredJobError} from "../retryable-job-error.js";

test("Carousel pause defaults closed and resumes only on explicit false", () => {
  for (const value of ["", "true", "0", "invalid"]) assert.equal(isAutomaticCarouselGenerationPaused(value), true);
  assert.equal(isAutomaticCarouselGenerationPaused(" FALSE "), false);
  const app = readFileSync(new URL("../../../lib/carousel/generation-hold.ts", import.meta.url), "utf8");
  assert.match(app, /value\?\.trim\(\)\.toLowerCase\(\) !== "false"/);
});

test("held jobs defer without provider/store calls; manual Explore and publishing stay unheld", async () => {
  const previous = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  try {
    const {runWorkerJob} = await import("../jobs/index.js");
    for (const job_type of ["generate_carousel", "carousel_content_plan_generation"] as const) {
      assert.equal(isCarouselGenerationJobHeld(job_type), true);
      await assert.rejects(runWorkerJob({job_type} as import("../types.js").BackgroundJobRow,
        {checkpoint:async()=>{throw Error("Paid checkpoint ran");}, store:new Proxy({} as import("../jobs/index.js").WorkerJobContext["store"], {get(){throw Error("Store called");}})} as import("../jobs/index.js").WorkerJobContext),
        (error:unknown) => error instanceof DeferredJobError && error.code === "carousel_generation_paused");
    }
    for (const type of ["generate_image", "generate_hook_video", "publish_social_post", "render_trending_carousel_edit"]) assert.equal(isCarouselGenerationJobHeld(type),false);
    process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED="false";
    assert.equal(isCarouselGenerationJobHeld("generate_carousel"), false);
  } finally {
    if(previous===undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED=previous;
  }
});
