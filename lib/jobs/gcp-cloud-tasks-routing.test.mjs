import assert from "node:assert/strict";
import test from "node:test";
import { getBackgroundJobDispatchUrl, getMissingBackgroundJobCloudTasksEnvVars } from "./gcp-cloud-tasks.ts";
import { getQueueNameForJobType } from "../queues/config.ts";

test("slideshow edits route to their dedicated service while generation retains the serial worker", () => {
  const env = { GCP_PROJECT_ID: "project", GCP_CAROUSEL_TASK_URL: "https://generation.example.test",
    GCP_CAROUSEL_EDIT_TASK_URL: "https://edits.example.test", GCP_BACKGROUND_JOB_TASK_URL: "https://generation.example.test" };
  assert.equal(getQueueNameForJobType("render_trending_carousel_edit"), "carousel-edit");
  assert.equal(getQueueNameForJobType("generate_carousel"), "carousel");
  assert.equal(getBackgroundJobDispatchUrl("carousel-edit", env), "https://edits.example.test/tasks/jobs");
  assert.equal(getBackgroundJobDispatchUrl("carousel", env), "https://generation.example.test/tasks/jobs");
});
test("missing edit configuration cannot silently send interactive updates to the generation queue", () => {
  const env = { GCP_PROJECT_ID: "project", GCP_CAROUSEL_TASK_URL: "https://generation.example.test",
    GCP_BACKGROUND_JOB_TASK_URL: "https://generation.example.test" };
  assert.equal(getBackgroundJobDispatchUrl("carousel-edit", env), "");
  const missing = getMissingBackgroundJobCloudTasksEnvVars(["render_trending_carousel_edit"], env);
  assert.ok(missing.includes("GCP_CAROUSEL_EDIT_TASK_URL"));
});
