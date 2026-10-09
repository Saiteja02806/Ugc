import assert from "node:assert/strict";
import test from "node:test";
import { buildTrendingReconciliationTask } from "./trending-feed-reconciliation-dispatch.js";

test("durable reconciliation is an independent authenticated task with retry-stable identity", () => {
  const params = { sourceJobId: "10000000-0000-4000-8000-000000000001", userId: "owner", dispatchRevision: "2026-10-10T01:00:00Z" };
  const env = { GCP_PROJECT_ID: "project", UGC_INTERNAL_APP_URL: "https://www.getugcpilot.com" };
  const task = buildTrendingReconciliationTask(params, env);
  assert.match(task.endpoint, /queues\/ugc-trending-reconciliation\/tasks$/);
  assert.equal(task.requestBody.task.httpRequest.url, "https://www.getugcpilot.com/api/internal/trending/reconcile");
  assert.deepEqual(JSON.parse(Buffer.from(task.requestBody.task.httpRequest.body, "base64").toString()), { sourceJobId: params.sourceJobId, userId: params.userId });
  assert.equal(task.requestBody.task.httpRequest.oidcToken.serviceAccountEmail, "ugc-scheduler-sa@project.iam.gserviceaccount.com");
  assert.deepEqual(buildTrendingReconciliationTask(params, env), task);
  assert.notEqual(buildTrendingReconciliationTask({ ...params, dispatchRevision: "later-terminal-transition" }, env).requestBody.task.name, task.requestBody.task.name);
  assert.throws(() => buildTrendingReconciliationTask(params, { ...env, UGC_INTERNAL_APP_URL: "http://insecure.test" }), /HTTPS/);
});
