import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { GoogleAuth } from "google-auth-library";
import { backgroundJobCloudTaskExists } from "./gcp-cloud-tasks.ts";

test("queue lookup retains older live attempts and treats only 404 as missing", async () => {
  const previousFetch = globalThis.fetch;
  const previousProject = process.env.GCP_PROJECT_ID;
  process.env.GCP_PROJECT_ID = "test-project";
  const auth = mock.method(GoogleAuth.prototype, "getRequestHeaders", async () => new Headers({ Authorization: "Bearer test-only" }));
  const urls = [];
  let status = 200;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(null, { status: String(url).endsWith("attempt-1") ? 404 : status });
  };
  const job = { id: "job-id", jobType: "generate_carousel", attemptCount: 1 };
  try {
    assert.equal(await backgroundJobCloudTaskExists(job), true);
    assert.match(urls[0], /queues\/ugc-carousel\/tasks\/job-job-id-attempt-1$/);
    assert.match(urls[1], /attempt-0$/);
    status = 404;
    assert.equal(await backgroundJobCloudTaskExists(job), false);
    status = 403;
    await assert.rejects(backgroundJobCloudTaskExists(job), /403/);
  } finally {
    auth.mock.restore();
    globalThis.fetch = previousFetch;
    if (previousProject === undefined) delete process.env.GCP_PROJECT_ID; else process.env.GCP_PROJECT_ID = previousProject;
  }
});
