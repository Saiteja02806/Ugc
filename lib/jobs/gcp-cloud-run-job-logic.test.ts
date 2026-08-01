import assert from "node:assert/strict";
import test from "node:test";

import { buildCloudRunJobExecutionRequest } from "./gcp-cloud-run-job-logic.ts";

test("builds a one-shot Cloud Run Job execution request", () => {
  const request = buildCloudRunJobExecutionRequest({
    jobId: "8b423218-f658-4af1-83bf-95eef8841147",
    jobName: "ugc-video-render-job",
    jobType: "render_edit_video",
    location: "us-central1",
    projectId: "ugcsaas",
    timeoutSeconds: 3_600,
  });

  assert.equal(
    request.endpoint,
    "https://run.googleapis.com/v2/projects/ugcsaas/locations/us-central1/jobs/ugc-video-render-job:run",
  );
  assert.deepEqual(request.requestBody.overrides.containerOverrides[0]?.env, [
    {
      name: "BACKGROUND_JOB_ID",
      value: "8b423218-f658-4af1-83bf-95eef8841147",
    },
    { name: "BACKGROUND_JOB_TYPE", value: "render_edit_video" },
    { name: "WORKER_RUN_ONCE", value: "true" },
  ]);
  assert.equal(request.requestBody.overrides.timeout, "3600s");
});

test("caps Cloud Run Job execution timeout at 24 hours", () => {
  const request = buildCloudRunJobExecutionRequest({
    jobId: "job-1",
    jobName: "ugc-video-render-job",
    jobType: "final_render",
    location: "us-central1",
    projectId: "ugcsaas",
    timeoutSeconds: 200_000,
  });

  assert.equal(request.requestBody.overrides.timeout, "86400s");
});
