import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWallTextPlanPublicationTaskRequest,
  getWallTextPlanPublicationDispatchConfig,
} from "./wall-text-plan-publication-dispatch.js";

const planId = "123e4567-e89b-42d3-a456-426614174000";
const publicationId = "123e4567-e89b-42d3-a456-426614174001";

test("builds a deterministic OIDC Cloud Task for the exact publication outbox row", () => {
  const config = getWallTextPlanPublicationDispatchConfig({
    GCP_CLOUD_TASKS_LOCATION: "us-central1",
    GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
    GCP_PROJECT_ID: "ugcsaas",
    GCP_RESOURCE_NAME_PREFIX: "ugc",
    UGC_INTERNAL_APP_URL: "https://getugcpilot.com",
  });
  const task = buildWallTextPlanPublicationTaskRequest({
    ...config,
    planId,
    publicationId,
  });

  assert.equal(task.taskName, `wall-plan-publication-${publicationId}`);
  assert.equal(task.requestBody.task.httpRequest.url, "https://getugcpilot.com/api/internal/trending/wall-plan-ready");
  assert.equal(task.requestBody.task.httpRequest.oidcToken.serviceAccountEmail, "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com");
  assert.deepEqual(
    JSON.parse(Buffer.from(task.requestBody.task.httpRequest.body, "base64").toString("utf8")),
    { planId, publicationId },
  );
});

test("does not build a publication task for a non-UUID outbox identifier", () => {
  const config = getWallTextPlanPublicationDispatchConfig({
    GCP_PROJECT_ID: "ugcsaas",
    UGC_INTERNAL_APP_URL: "https://getugcpilot.com",
  });

  assert.throws(
    () => buildWallTextPlanPublicationTaskRequest({
      ...config,
      planId,
      publicationId: "not-a-publication",
    }),
    /UUID identifiers/,
  );
});
