import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGcpCloudTasksCreateTaskRequest,
  buildSocialPublishDispatchUrl,
  getDefaultGcpSchedulerServiceAccountEmail,
  getGcpSocialPublishScheduleName,
  isGcpSocialPublishScheduleName,
} from "./gcp-cloud-tasks-scheduler-logic.ts";

const TARGET_ID = "00000000-0000-4000-8000-000000000101";
const JOB_ID = "00000000-0000-4000-8000-000000000102";
const SCHEDULED_FOR = "2026-07-18T14:00:00.000Z";

test("builds a Cloud Tasks request for scheduled social publish dispatch", () => {
  const taskName = getGcpSocialPublishScheduleName(TARGET_ID);
  const request = buildGcpCloudTasksCreateTaskRequest({
    audience: "https://getugcpilot.com/api/internal/schedules/dispatch",
    dispatchUrl: "https://getugcpilot.com/api/internal/schedules/dispatch",
    input: {
      jobId: JOB_ID,
      scheduledFor: SCHEDULED_FOR,
      targetId: TARGET_ID,
    },
    location: "us-central1",
    projectId: "ugcsaas",
    queueName: "ugc-social-publish-scheduler",
    serviceAccountEmail: "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
    taskName,
  });

  assert.equal(
    request.endpoint,
    "https://cloudtasks.googleapis.com/v2/projects/ugcsaas/locations/us-central1/queues/ugc-social-publish-scheduler/tasks",
  );
  assert.equal(
    request.taskPath,
    `projects/ugcsaas/locations/us-central1/queues/ugc-social-publish-scheduler/tasks/${taskName}`,
  );
  assert.equal(request.requestBody.task.scheduleTime, SCHEDULED_FOR);
  assert.equal(request.requestBody.task.httpRequest.httpMethod, "POST");
  assert.equal(
    request.requestBody.task.httpRequest.oidcToken.serviceAccountEmail,
    "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
  );

  const decodedBody = JSON.parse(
    Buffer.from(request.requestBody.task.httpRequest.body, "base64").toString(
      "utf8",
    ),
  );
  assert.deepEqual(decodedBody, {
    jobId: JOB_ID,
    jobType: "publish_social_post",
    targetId: TARGET_ID,
  });
});

test("uses the app base URL for the dispatch route", () => {
  assert.equal(
    buildSocialPublishDispatchUrl("https://getugcpilot.com"),
    "https://getugcpilot.com/api/internal/schedules/dispatch",
  );
});

test("derives the default scheduler service account from the project", () => {
  assert.equal(
    getDefaultGcpSchedulerServiceAccountEmail({ projectId: "ugcsaas" }),
    "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
  );
});

test("recognizes only GCP social publish schedule names", () => {
  const name = getGcpSocialPublishScheduleName(TARGET_ID);

  assert.equal(isGcpSocialPublishScheduleName(name), true);
  assert.equal(isGcpSocialPublishScheduleName("ugc-social-invalid-target"), false);
  assert.equal(isGcpSocialPublishScheduleName("ugc-social-gcp-bad.name"), false);
});
