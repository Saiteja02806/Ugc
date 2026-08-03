import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJobMessageBody,
  getMissingQueueEnvVars,
  getQueueNameForJobType,
  getQueueProviderName,
} from "./config.ts";

test("uses only the GCP queue provider", () => {
  assert.equal(getQueueProviderName({}), "gcp");
  assert.equal(getQueueProviderName({ QUEUE_PROVIDER: "unexpected" }), "gcp");
});

test("reports GCP queue requirements", () => {
  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {}),
    ["GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT"],
  );

  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      GCP_PROJECT_ID: "ugcsaas",
    }),
    [],
  );

  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      GCP_PROJECT_ID: "ugcsaas",
      VERCEL: "1",
    }),
    [
      "GOOGLE_CLOUD_CREDENTIALS_JSON or GOOGLE_CLOUD_CLIENT_EMAIL/GOOGLE_CLOUD_PRIVATE_KEY",
    ],
  );

  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      GCP_PROJECT_ID: "ugcsaas",
      GOOGLE_CLOUD_CREDENTIALS_JSON: "{}",
      VERCEL: "1",
    }),
    [],
  );
});

test("adds a version and attempt to the background job message", () => {
  assert.deepEqual(
    JSON.parse(
      buildJobMessageBody({
        jobId: "job-1",
        jobType: "generate_carousel",
      }),
    ),
    {
      attempt: 0,
      jobId: "job-1",
      jobType: "generate_carousel",
      schemaVersion: 1,
    },
  );
});

test("maps carousel jobs to the logical GCP queue", () => {
  assert.equal(getQueueNameForJobType("generate_carousel"), "carousel");
});

test("maps all active production job types to migrated GCP queues", () => {
  assert.deepEqual(
    [
      ["generate_avatar", getQueueNameForJobType("generate_avatar")],
      ["generate_image", getQueueNameForJobType("generate_image")],
      ["generate_hook_video", getQueueNameForJobType("generate_hook_video")],
      [
        "generate_trending_hook_copy",
        getQueueNameForJobType("generate_trending_hook_copy"),
      ],
      ["wall_text_generation", getQueueNameForJobType("wall_text_generation")],
      ["media_analysis", getQueueNameForJobType("media_analysis")],
      ["analytics_sync", getQueueNameForJobType("analytics_sync")],
      ["generate_carousel", getQueueNameForJobType("generate_carousel")],
      ["render_edit_video", getQueueNameForJobType("render_edit_video")],
      [
        "render_schedule_combination",
        getQueueNameForJobType("render_schedule_combination"),
      ],
      ["render_wall_text_video", getQueueNameForJobType("render_wall_text_video")],
      ["publish_social_post", getQueueNameForJobType("publish_social_post")],
    ],
    [
      ["generate_avatar", "ai-generation"],
      ["generate_image", "ai-generation"],
      ["generate_hook_video", "ai-generation"],
      ["generate_trending_hook_copy", "ai-generation"],
      ["wall_text_generation", "ai-generation"],
      ["media_analysis", "ai-generation"],
      ["analytics_sync", "ai-generation"],
      ["generate_carousel", "carousel"],
      ["render_edit_video", "video-render"],
      ["render_schedule_combination", "video-render"],
      ["render_wall_text_video", "video-render"],
      ["publish_social_post", "social-publish"],
    ],
  );

  assert.equal(getQueueNameForJobType("test_worker_job"), "media-processing");
});
