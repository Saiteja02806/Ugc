import assert from "node:assert/strict";
import test from "node:test";
import { planReactionGeneration } from "./reaction-generation.js";
import { RetryableJobError } from "../retryable-job-error.js";

const input: Parameters<typeof planReactionGeneration>[0] = {
  backgrounds: [{ id: "bg", status: "active", sourceStorageKey: "bg.png", foregroundPlacement: "bottom_center", contextTags: ["office"] }],
  clips: [{ id: "clip", status: "active", sourceStorageKey: "clip.webm", hasAlpha: true,
    foregroundAnchor: "bottom_center", foregroundHeightPercent: 50, reactions: ["shock"],
    composition: null, durationSeconds: 6, subjectCount: "one" }],
  context: { audience: ["office workers"], commonSituations: ["changing plans"], desiredOutcomes: ["clarity"], pains: ["confusion"] },
  historyByClipId: new Map(), requestedCount: 1, seed: "test",
};

test("Reaction empty output and HTTP outages yield to durable retry after one SDK request", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  let calls = 0;
  let status = 200;
  let refusal = false;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify(status === 200
      ? { choices: [{ message: { content: null, ...(refusal ? { refusal: "declined" } : {}) } }] }
      : { error: { message: "temporary provider outage" } }), {
      status, headers: { "content-type": "application/json" },
    });
  };
  try {
    for (const nextStatus of [200, 429, 503]) {
      status = nextStatus;
      calls = 0;
      await assert.rejects(planReactionGeneration(input), RetryableJobError);
      assert.equal(calls, 1);
    }
    calls = 0;
    status = 200;
    refusal = true;
    await assert.rejects(planReactionGeneration(input), (error) => error instanceof Error && !(error instanceof RetryableJobError));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
