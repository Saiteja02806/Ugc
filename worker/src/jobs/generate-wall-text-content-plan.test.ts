import assert from "node:assert/strict";
import test from "node:test";
import { runGenerateWallTextContentPlanJob } from "./generate-wall-text-content-plan.js";
import { EmptyWallTextContentPlanResponseError, type GeneratedWallTextContentPlanChunk } from "../lib/wall-text-content-plan.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow, WallTextContentPlanItemRow } from "../types.js";
import type { WorkerJobContext } from "./index.js";

function fixture() {
  const items: WallTextContentPlanItemRow[] = [];
  const plan = { id: "plan", user_id: "user", status: "generating", target_item_count: 20 };
  const checkpoints: number[] = [];
  const job = { id: "job", user_id: "user", input_json: {
    operation: "wall_text_content_plan_generation", planId: "plan", userId: "user",
  } } as unknown as BackgroundJobRow;
  const context = {
    checkpoint: async ({ progress }: { progress: number }) => { checkpoints.push(progress); },
    store: {
      getWallTextContentPlan: async () => plan,
      listWallTextContentPlanItems: async () => [...items],
      listPriorWallTextContentPlanItems: async () => [],
      persistWallTextContentPlanBriefChunk: async (chunk: { items: WallTextContentPlanItemRow[] }) => {
        items.push(...chunk.items);
        return chunk.items;
      },
      completeWallTextContentPlanGeneration: async () => {
        assert.equal(items.length, 20, "never activate an incomplete plan");
        plan.status = "active";
        return plan;
      },
    },
  } as unknown as WorkerJobContext;
  return { job, context, items, plan, checkpoints };
}

function generated(): GeneratedWallTextContentPlanChunk {
  const brief = {
    audienceContext: "audience", creativeSeed: "seed", emotionalTension: "tension",
    humanMoment: "moment", supportedAngle: "angle",
  };
  return {
    briefs: [0, 1].map((briefSlotIndex) => ({ ...brief, briefSlotIndex })),
    items: Array.from({ length: 10 }, (_, index) => ({
      briefSlotIndex: Math.floor(index / 5), itemSlotIndex: index % 5,
      contentIdea: `Idea ${index}`, feeling: "relief", planningBrief: brief,
    })),
  };
}

for (const failure of [
  new EmptyWallTextContentPlanResponseError("length"),
  Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" }),
]) {
  test(`resumes saved chunks after ${failure.name} without generating them again`, async () => {
    const f = fixture();
    let calls = 0;
    await assert.rejects(runGenerateWallTextContentPlanJob(f.job, f.context, {
      generateChunk: async () => { if (++calls === 2) throw failure; return generated(); },
    }), RetryableJobError);
    assert.equal(f.items.length, 10);
    assert.equal(f.plan.status, "generating");
    await runGenerateWallTextContentPlanJob(f.job, f.context, {
      generateChunk: async (request) => {
        assert.equal(request.briefIndexStart, 3);
        assert.equal(request.existingItems.length, 10);
        return generated();
      },
    });
    assert.deepEqual(f.items.map((item) => item.sequence_index), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(f.plan.status, "active");
    assert.deepEqual(f.checkpoints, [45, 90]);
  });
}

test("stops before another model call when a checkpoint loses the worker claim", async () => {
  const f = fixture();
  f.context.checkpoint = async () => { throw new Error("claim superseded"); };
  let calls = 0;
  await assert.rejects(runGenerateWallTextContentPlanJob(f.job, f.context, {
    generateChunk: async () => { calls++; return generated(); },
  }), /claim superseded/);
  assert.equal(calls, 1);
  assert.equal(f.items.length, 10);
  assert.equal(f.plan.status, "generating");
});
