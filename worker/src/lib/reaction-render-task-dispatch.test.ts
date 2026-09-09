import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReactionRenderTaskRequest,
  getReactionRenderDispatchConfig,
} from "./reaction-render-task-dispatch.js";

const jobId = "0df128f9-839a-4b43-b3bb-2dc30d40fdd9";

test("builds a deterministic OIDC Cloud Task for one Reaction render job", () => {
  const config = getReactionRenderDispatchConfig({
    GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
    GCP_PROJECT_ID: "ugcsaas",
    GCP_REACTION_RENDER_TASK_URL: "https://ugc-reaction-render-worker.example.run.app/tasks/jobs",
  });
  const task = buildReactionRenderTaskRequest({ ...config, attempt: 2, jobId });

  assert.equal(task.taskName, `reaction-render-${jobId}`);
  assert.equal(task.requestBody.task.httpRequest.oidcToken.audience, "https://ugc-reaction-render-worker.example.run.app");
  assert.match(task.requestBody.task.name, /queues\/ugc-reaction-render\/tasks\/reaction-render-/);
  assert.deepEqual(
    JSON.parse(Buffer.from(task.requestBody.task.httpRequest.body, "base64").toString("utf8")),
    { attempt: 2, jobId, jobType: "reaction_render", schemaVersion: 1 },
  );
});

test("rejects the legacy Cloud Run Job launcher as a Reaction task target", () => {
  assert.throws(
    () => getReactionRenderDispatchConfig({
      GCP_PROJECT_ID: "ugcsaas",
      GCP_REACTION_RENDER_TASK_URL: "https://getugcpilot.com/api/internal/jobs/launch-render",
    }),
    /Reaction worker \/tasks\/jobs endpoint/,
  );
});
