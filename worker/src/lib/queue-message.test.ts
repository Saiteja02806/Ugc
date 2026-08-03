import assert from "node:assert/strict";
import test from "node:test";

import { EXECUTABLE_BACKGROUND_JOB_TYPES } from "../types.js";
import { parseWorkerDeliveryMessage } from "./queue-message.js";

test("parses the shared queue message contract", () => {
  assert.deepEqual(
    parseWorkerDeliveryMessage({
      body: JSON.stringify({
        jobId: "job-1",
        jobType: "generate_carousel",
      }),
      id: "message-1",
      providerName: "gcp",
    }),
    {
      jobId: "job-1",
      jobType: "generate_carousel",
    },
  );
});

test("accepts dedicated Trending Hook copy jobs on the AI queue", () => {
  assert.deepEqual(
    parseWorkerDeliveryMessage({
      body: JSON.stringify({
        jobId: "job-2",
        jobType: "generate_trending_hook_copy",
      }),
      id: "message-2",
      providerName: "gcp",
    }),
    {
      jobId: "job-2",
      jobType: "generate_trending_hook_copy",
    },
  );
});

test("accepts every executable background job type", () => {
  for (const jobType of EXECUTABLE_BACKGROUND_JOB_TYPES) {
    assert.equal(
      parseWorkerDeliveryMessage({
        body: JSON.stringify({ jobId: `job-${jobType}`, jobType }),
        id: `message-${jobType}`,
        providerName: "gcp",
      }).jobType,
      jobType,
    );
  }
});

test("rejects invalid worker queue job types", () => {
  assert.throws(
    () =>
      parseWorkerDeliveryMessage({
        body: JSON.stringify({
          jobId: "job-1",
          jobType: "unknown_job",
        }),
        id: "message-1",
        providerName: "gcp",
      }),
    /Invalid worker job type/,
  );
});
