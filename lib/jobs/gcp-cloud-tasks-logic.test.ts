import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBackgroundJobCloudTaskRequest,
  getBackgroundJobTaskName,
  resolveBackgroundJobDispatchUrl,
} from "./gcp-cloud-tasks-logic.ts";

test("builds a deterministic Cloud Tasks request with OIDC", () => {
  const request = buildBackgroundJobCloudTaskRequest({
    attempt: 2,
    audience: "https://worker.example.com",
    dispatchUrl: "https://worker.example.com/tasks/jobs",
    jobId: "8b423218-f658-4af1-83bf-95eef8841147",
    jobType: "video_generation",
    location: "us-central1",
    projectId: "ugcsaas",
    queueName: "ugc-ai-generation",
    serviceAccountEmail: "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
  });

  assert.equal(
    request.taskName,
    "job-8b423218-f658-4af1-83bf-95eef8841147-attempt-2",
  );
  assert.equal(request.payload.schemaVersion, 1);
  assert.equal(
    request.requestBody.task.httpRequest.oidcToken.audience,
    "https://worker.example.com",
  );
  assert.deepEqual(
    JSON.parse(
      Buffer.from(request.requestBody.task.httpRequest.body, "base64").toString(
        "utf8",
      ),
    ),
    request.payload,
  );
});

test("normalizes negative attempts in task identity", () => {
  assert.equal(
    getBackgroundJobTaskName({ attempt: -4, jobId: "job-id" }),
    "job-job-id-attempt-0",
  );
});

test("preserves an explicit launcher route and expands worker base URLs", () => {
  assert.equal(
    resolveBackgroundJobDispatchUrl(
      "https://www.getugcpilot.com/api/internal/jobs/launch-render",
    ),
    "https://www.getugcpilot.com/api/internal/jobs/launch-render",
  );
  assert.equal(
    resolveBackgroundJobDispatchUrl("https://worker.example.com"),
    "https://worker.example.com/tasks/jobs",
  );
});
