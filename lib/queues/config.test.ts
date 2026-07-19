import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJobMessageBody,
  getGcpPubSubTopicNameForJobType,
  getMissingQueueEnvVars,
  getQueueNameForJobType,
  getQueueProviderName,
} from "./config.ts";

test("uses AWS queue provider by default", () => {
  assert.equal(getQueueProviderName({}), "aws");
});

test("accepts GCP queue provider aliases", () => {
  assert.equal(getQueueProviderName({ QUEUE_PROVIDER: "gcp" }), "gcp");
  assert.equal(getQueueProviderName({ QUEUE_PROVIDER: "pubsub" }), "gcp");
});

test("reports AWS queue requirements without requiring GCP values", () => {
  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      QUEUE_PROVIDER: "aws",
    }),
    [
      "AWS_REGION",
      "AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
      "UGC_CAROUSEL_QUEUE_URL",
    ],
  );
});

test("reports GCP queue requirements without requiring AWS values", () => {
  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      QUEUE_PROVIDER: "gcp",
    }),
    ["GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT"],
  );

  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      GCP_PROJECT_ID: "ugcsaas",
      QUEUE_PROVIDER: "gcp",
    }),
    [],
  );

  assert.deepEqual(
    getMissingQueueEnvVars(["generate_carousel"], {
      GCP_PROJECT_ID: "ugcsaas",
      QUEUE_PROVIDER: "gcp",
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
      QUEUE_PROVIDER: "gcp",
      VERCEL: "1",
    }),
    [],
  );
});

test("keeps the existing background job message payload shape", () => {
  assert.deepEqual(
    JSON.parse(
      buildJobMessageBody({
        jobId: "job-1",
        jobType: "generate_carousel",
      }),
    ),
    {
      jobId: "job-1",
      jobType: "generate_carousel",
    },
  );
});

test("maps carousel jobs to the GCP topic created by Terraform", () => {
  assert.equal(getQueueNameForJobType("generate_carousel"), "carousel");
  assert.equal(
    getGcpPubSubTopicNameForJobType("generate_carousel", {}),
    "ugc-carousel",
  );
  assert.equal(
    getGcpPubSubTopicNameForJobType("generate_carousel", {
      UGC_CAROUSEL_PUBSUB_TOPIC: "custom-carousel-topic",
    }),
    "custom-carousel-topic",
  );
});

test("maps all active production job types to migrated GCP queues", () => {
  assert.deepEqual(
    [
      ["generate_avatar", getQueueNameForJobType("generate_avatar")],
      ["generate_image", getQueueNameForJobType("generate_image")],
      ["generate_hook_video", getQueueNameForJobType("generate_hook_video")],
      ["generate_carousel", getQueueNameForJobType("generate_carousel")],
      ["render_edit_video", getQueueNameForJobType("render_edit_video")],
      [
        "render_schedule_combination",
        getQueueNameForJobType("render_schedule_combination"),
      ],
      ["publish_social_post", getQueueNameForJobType("publish_social_post")],
    ],
    [
      ["generate_avatar", "ai-generation"],
      ["generate_image", "ai-generation"],
      ["generate_hook_video", "ai-generation"],
      ["generate_carousel", "carousel"],
      ["render_edit_video", "video-render"],
      ["render_schedule_combination", "video-render"],
      ["publish_social_post", "social-publish"],
    ],
  );

  assert.equal(getQueueNameForJobType("test_worker_job"), "media-processing");
  assert.equal(
    getGcpPubSubTopicNameForJobType("test_worker_job", {}),
    "ugc-media-processing",
  );
});
