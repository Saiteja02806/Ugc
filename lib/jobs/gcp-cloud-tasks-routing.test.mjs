import assert from "node:assert/strict";
import test from "node:test";
import { enqueueBackgroundJobCloudTask, getBackgroundJobDispatchUrl, getMissingBackgroundJobCloudTasksEnvVars } from "./gcp-cloud-tasks.ts";
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

test("local app routes owned generation only to the same-checkout worker", async t => {
  const env = {
    LOCAL_APP_WORKER: "true", NODE_ENV: "development", LOCAL_APP_WORKER_OWNER_ID: "tester-uid",
    LOCAL_STARTING_FRAME_WORKER_SECRET: "a".repeat(64),
    SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    APP_BASE_URL: "https://localhost:3000", UGC_INTERNAL_APP_URL: "https://localhost:3000",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode", LOCAL_APP_WORKER_PUBLISH: "false",
  };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, env);
  const delivery = t.mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(url, "http://127.0.0.1:4317/local-starting-frame");
    assert.deepEqual(JSON.parse(request.body), { jobId: "job", ownerId: "tester-uid" });
    return new Response(null, { status: 202 });
  });
  const job = { id: "job", userId: "tester-uid" };
  for (const jobType of ["generate_image", "generate_hook_video", "generate_avatar"]) {
    assert.deepEqual(getMissingBackgroundJobCloudTasksEnvVars([jobType]), []);
    assert.equal((await enqueueBackgroundJobCloudTask({ ...job, jobType })).messageId, "local:job");
  }
  await assert.rejects(enqueueBackgroundJobCloudTask({ ...job, jobType: "publish_social_post" }));
  await assert.rejects(enqueueBackgroundJobCloudTask({ ...job, jobType: "generate_image", userId: "other" }));
  process.env.SUPABASE_URL = "https://production.example.test";
  await assert.rejects(enqueueBackgroundJobCloudTask({ ...job, jobType: "generate_image" }));
  assert.equal(delivery.mock.callCount(), 3);
});
