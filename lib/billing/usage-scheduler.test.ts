import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBillingUsageFlushAudience,
  buildBillingUsageFlushTargetUrl,
  buildBillingUsageSchedulerRequest,
} from "./usage-scheduler.ts";

test("billing usage URLs separate the OIDC audience from query parameters", () => {
  assert.equal(
    buildBillingUsageFlushAudience("https://getugcpilot.com"),
    "https://getugcpilot.com/api/internal/billing/usage/flush",
  );
  assert.equal(
    buildBillingUsageFlushTargetUrl("https://getugcpilot.com", 500),
    "https://getugcpilot.com/api/internal/billing/usage/flush?limit=100",
  );
});

test("Cloud Scheduler request uses POST with the expected OIDC identity", () => {
  const request = buildBillingUsageSchedulerRequest({
    audience: "https://getugcpilot.com/api/internal/billing/usage/flush",
    jobName: "ugc-billing-usage-flush",
    location: "us-central1",
    projectId: "ugcsaas",
    serviceAccountEmail: "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
    targetUrl:
      "https://getugcpilot.com/api/internal/billing/usage/flush?limit=50",
  });

  assert.equal(
    request.requestBody.httpTarget.oidcToken.audience,
    "https://getugcpilot.com/api/internal/billing/usage/flush",
  );
  assert.equal(request.requestBody.httpTarget.httpMethod, "POST");
  assert.equal(request.requestBody.schedule, "*/5 * * * *");
  assert.equal(request.requestBody.timeZone, "Etc/UTC");
  assert.match(request.updateEndpoint, /updateMask=/);
});

test("billing scheduler refuses non-HTTPS endpoints", () => {
  assert.throws(
    () => buildBillingUsageFlushAudience("http://localhost:3000"),
    /must use HTTPS/,
  );
});
