import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

let currentJob;
let dispatchCalls = 0;
let configurationChecks = 0;
mock.module("../../lib/firebase/server-auth.ts", {
  namedExports: { requireFirebaseUser: async () => ({ uid: "owner" }) },
});
mock.module("../../lib/jobs/background-job-service.ts", {
  namedExports: {
    assertBackgroundJobOwner: async ({ userId }) => userId === "owner" ? currentJob : null,
    retryAndDispatchBackgroundJob: async () => {
      dispatchCalls += 1;
      return { ...currentJob, status: "queued" };
    },
  },
});
mock.module("../../lib/jobs/gcp-cloud-tasks.ts", {
  namedExports: { getMissingBackgroundJobCloudTasksEnvVars: () => { configurationChecks += 1; return []; } },
});
const { POST } = await import("../../app/api/jobs/[jobId]/retry/route.ts");
const request = () => POST(new Request("https://example.com/api/jobs/job/retry", { method: "POST" }), { params: Promise.resolve({ jobId: "job" }) });

test("a terminal provider failure is rejected before queuing or spending another attempt", async () => {
  currentJob = { id: "job", jobType: "generate_hook_video", status: "failed", errorCode: "PROVIDER_INSUFFICIENT_CREDITS", errorMessage: "private request ID", attemptCount: 1, maxAttempts: 3 };
  const response = await request();
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /credit balance is too low/);
  assert.equal(dispatchCalls, 0);
  assert.equal(configurationChecks, 0);
});

test("a recoverable upload failure can still resume its existing job", async () => {
  currentJob = { ...currentJob, errorCode: "OUTPUT_UPLOAD_FAILED", errorMessage: "upload unavailable" };
  const response = await request();
  assert.equal(response.status, 202);
  assert.equal((await response.json()).job.status, "queued");
  assert.equal(dispatchCalls, 1);
});

test("a historical moderation rejection explains the reason and rejects retry without dispatch", async () => {
  currentJob = { id: "job", jobType: "generate_hook_video", status: "failed", errorCode: "JOB_FAILED", errorMessage: "Runway task failed: Your request was blocked by this model provider's content moderation system. token=private-secret", attemptCount: 1, maxAttempts: 3 };
  const priorDispatchCalls = dispatchCalls;
  const priorConfigurationChecks = configurationChecks;
  const response = await request();
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.match(data.error, /blocked this generation through content moderation/);
  assert.doesNotMatch(data.error, /private-secret|You can retry/);
  assert.equal(dispatchCalls, priorDispatchCalls);
  assert.equal(configurationChecks, priorConfigurationChecks);
});

test("a missing or unowned job is not dispatched", async () => {
  currentJob = null;
  const response = await request();
  assert.equal(response.status, 404);
  assert.equal(dispatchCalls, 1);
});

test("a historical OpenRouter image rejection is explained without dispatching a retry", async () => {
  currentJob = {
    id: "job", jobType: "generate_hook_video", status: "failed", errorCode: "JOB_FAILED",
    errorMessage: `HTTP 400: ${JSON.stringify({ error: {
      code: "InputImageSensitiveContentDetected.PrivacyInformation",
      message: "Input image may contain real person. Request id: request-private token=private-secret",
    } })}`,
    attemptCount: 1, maxAttempts: 3,
  };
  const priorDispatchCalls = dispatchCalls;
  const priorConfigurationChecks = configurationChecks;
  const response = await request();
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.match(data.error, /reference image.*may contain a real person's face/);
  assert.doesNotMatch(data.error, /private-secret|request-private|You can retry|cause could not be identified/);
  assert.equal(dispatchCalls, priorDispatchCalls);
  assert.equal(configurationChecks, priorConfigurationChecks);
});
