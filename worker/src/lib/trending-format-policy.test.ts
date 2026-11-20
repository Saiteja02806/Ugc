import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CAROUSEL_GENERATION_PILOT_USER_ID } from "./carousel-generation-hold.js";
import { isTrendingGenerationJobDisabled, TRENDING_SLIDESHOW_ONLY_ENABLED } from "./trending-format-policy.js";
import type { WorkerJobContext } from "../jobs/index.js";

test("Trending video generation runs only for the pilot owner while Explore and publishing keep running for all users", () => {
  const old = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  try {
    assert.equal(TRENDING_SLIDESHOW_ONLY_ENABLED, false);
    for (const jobType of ["generate_trending_hook_copy", "wall_text_content_plan_generation", "wall_text_generation", "reaction_generation"]) {
      assert.equal(isTrendingGenerationJobDisabled(jobType, CAROUSEL_GENERATION_PILOT_USER_ID), false);
      assert.equal(isTrendingGenerationJobDisabled(jobType, "other-owner"), true);
      assert.equal(isTrendingGenerationJobDisabled(jobType, null), true);
      assert.equal(isTrendingGenerationJobDisabled(jobType), true);
    }
    for (const jobType of ["generate_carousel", "carousel_content_plan_generation", "generate_hook_video", "generate_image", "render_wall_text_video", "reaction_render", "publish_social_post", "paid_trending_prebuild"]) {
      assert.equal(isTrendingGenerationJobDisabled(jobType, "other-owner"), false);
      assert.equal(isTrendingGenerationJobDisabled(jobType, CAROUSEL_GENERATION_PILOT_USER_ID), false);
    }
  } finally {
    if (old === undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED = old;
  }
});

test("app and worker ship the same Trending format policy and pass job.user_id in the runner", () => {
  const appPolicy = readFileSync(new URL("../../../lib/trending/format-policy.ts", import.meta.url), "utf8");
  assert.match(appPolicy, new RegExp(`TRENDING_SLIDESHOW_ONLY_ENABLED = ${TRENDING_SLIDESHOW_ONLY_ENABLED}`));
  const jobsIndex = readFileSync(new URL("../jobs/index.ts", import.meta.url), "utf8");
  assert.match(jobsIndex, /isTrendingGenerationJobDisabled\(job\.job_type, job\.user_id\)/);
});

test("the worker settles non-pilot queued video generation before invoking a handler", async () => {
  const old = process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
  try {
    const { runWorkerJob } = await import("../jobs/index.js");
    const jobTypes = ["generate_trending_hook_copy", "wall_text_content_plan_generation", "wall_text_generation", "reaction_generation"] as const;
    for (const jobType of jobTypes) {
      for (const userId of ["other-owner", ""]) {
        const result = await runWorkerJob(
          { job_type: jobType, user_id: userId } as import("../types.js").BackgroundJobRow,
          {
            checkpoint: async () => { throw new Error("A disabled handler ran."); },
            store: new Proxy({} as WorkerJobContext["store"], { get() { throw new Error("A disabled handler accessed the store."); } }),
          },
        );
        assert.deepEqual(result, { skipped: "trending_format_disabled" });
      }
    }
  } finally {
    if (old === undefined) delete process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED;
    else process.env.AUTOMATIC_CAROUSEL_GENERATION_PAUSED = old;
  }
});
