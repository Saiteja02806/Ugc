import assert from "node:assert/strict";
import test from "node:test";
import { generateWallTextContentPlanChunk, EmptyWallTextContentPlanResponseError } from "./wall-text-content-plan.js";

test("one empty model response yields immediately to durable retry", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-key-no-network";
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: null } }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(generateWallTextContentPlanChunk({
      businessDescription: "An example business", count: 10,
      existingItems: [], planningContext: {},
    }), EmptyWallTextContentPlanResponseError);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
