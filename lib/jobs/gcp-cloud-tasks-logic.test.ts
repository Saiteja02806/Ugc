import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBackgroundJobCloudTaskRequest,
  getBackgroundJobTaskName,
  isVideoRenderLauncherDispatchUrl,
  resolveBackgroundJobDispatchUrl,
  resolveBackgroundJobDispatchUrlFromEnv,
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

test("requires the exact internal launcher path for video-render tasks", () => {
  assert.equal(
    isVideoRenderLauncherDispatchUrl(
      "https://getugcpilot.com/api/internal/jobs/launch-render",
    ),
    true,
  );
  assert.equal(
    isVideoRenderLauncherDispatchUrl(
      "http://localhost:3000/api/internal/jobs/launch-render/",
    ),
    false,
  );
  assert.equal(
    isVideoRenderLauncherDispatchUrl("https://worker.example.com/tasks/jobs"),
    false,
  );
});

test("keeps the explicit task URL ahead of the common fallback", () => {
  const legacyWorkerUrl = resolveBackgroundJobDispatchUrlFromEnv({
    explicitUrl: "https://legacy-worker.example/tasks/jobs",
    fallbackUrl: "https://getugcpilot.com/api/internal/jobs/launch-render",
  });

  assert.equal(legacyWorkerUrl, "https://legacy-worker.example/tasks/jobs");
  assert.equal(isVideoRenderLauncherDispatchUrl(legacyWorkerUrl), false);
});

test("rejects a legacy common fallback and permits the launcher fallback", () => {
  const legacyFallback = resolveBackgroundJobDispatchUrlFromEnv({
    fallbackUrl: "https://legacy-worker.example",
  });
  const launcherFallback = resolveBackgroundJobDispatchUrlFromEnv({
    fallbackUrl: "https://getugcpilot.com/api/internal/jobs/launch-render",
  });

  assert.equal(legacyFallback, "https://legacy-worker.example/tasks/jobs");
  assert.equal(isVideoRenderLauncherDispatchUrl(legacyFallback), false);
  assert.equal(
    launcherFallback,
    "https://getugcpilot.com/api/internal/jobs/launch-render",
  );
  assert.equal(isVideoRenderLauncherDispatchUrl(launcherFallback), true);
});
