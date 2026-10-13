import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isTrendingGenerationJobDisabled, TRENDING_SLIDESHOW_ONLY_ENABLED } from "./trending-format-policy.js";
import type { WorkerJobContext } from "../jobs/index.js";

test("queued Trending video generation is disabled while Explore and publishing keep running", () => {
  for (const jobType of ["generate_trending_hook_copy", "wall_text_content_plan_generation", "wall_text_generation", "reaction_generation"]) {
    assert.equal(isTrendingGenerationJobDisabled(jobType), true);
  }
  for (const jobType of ["generate_carousel", "carousel_content_plan_generation", "generate_hook_video", "generate_image", "render_wall_text_video", "reaction_render", "publish_social_post", "paid_trending_prebuild"]) {
    assert.equal(isTrendingGenerationJobDisabled(jobType), false);
  }
});

test("app and worker ship the same slideshow-only policy", () => {
  const appPolicy = readFileSync(new URL("../../../lib/trending/format-policy.ts", import.meta.url), "utf8");
  assert.match(appPolicy, new RegExp(`TRENDING_SLIDESHOW_ONLY_ENABLED = ${TRENDING_SLIDESHOW_ONLY_ENABLED}`));
});

test("the worker settles queued video generation before invoking a handler", async () => {
  const { runWorkerJob } = await import("../jobs/index.js");
  const jobTypes = ["generate_trending_hook_copy", "wall_text_content_plan_generation", "wall_text_generation", "reaction_generation"] as const;
  for (const jobType of jobTypes) {
    const result = await runWorkerJob(
      { job_type: jobType } as import("../types.js").BackgroundJobRow,
      {
        checkpoint: async () => { throw new Error("A disabled handler ran."); },
        store: new Proxy({} as WorkerJobContext["store"], { get() { throw new Error("A disabled handler accessed the store."); } }),
      },
    );
    assert.deepEqual(result, { skipped: "trending_format_disabled" });
  }
});
