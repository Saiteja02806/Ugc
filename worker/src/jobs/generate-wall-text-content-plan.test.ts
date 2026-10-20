import assert from "node:assert/strict";
import test from "node:test";
import { runGenerateWallTextContentPlanJob } from "./generate-wall-text-content-plan.js";
import { EmptyWallTextContentPlanResponseError, type GeneratedWallTextContentPlanChunk } from "../lib/wall-text-content-plan.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow, WallTextContentPlanItemRow } from "../types.js";
import type { WorkerJobContext } from "./index.js";

function fixture() {
  const items: WallTextContentPlanItemRow[] = [];
  const plan = { id: "plan", user_id: "user", status: "generating", target_item_count: 20, early_delivery_enabled: false };
  const checkpoints: number[] = [];
  const job = { id: "job", user_id: "user", claim_token: "claim", input_json: {
    operation: "wall_text_content_plan_generation", planId: "plan", userId: "user",
  } } as unknown as BackgroundJobRow;
  const context = {
    checkpoint: async ({ progress }: { progress: number }) => { checkpoints.push(progress); },
    store: {
      getWallTextContentPlan: async () => plan,
      listWallTextContentPlanItems: async () => [...items],
      listPriorWallTextContentPlanItems: async () => [],
      persistWallTextContentPlanBriefChunk: async (chunk: { items: WallTextContentPlanItemRow[]; jobId: string; claimToken: string; expectedItemCount: number }) => {
        assert.equal(chunk.claimToken, "claim");
        assert.equal(chunk.jobId, "job");
        assert.equal(chunk.expectedItemCount, items.length);
        items.push(...chunk.items);
        return chunk.items;
      },
      recordWallTextFailureDiagnostic: async () => {},
      getWallTextPlanPublication: async ({ itemCount }: { itemCount: number }) => ({
        id: `123e4567-e89b-42d3-a456-${itemCount.toString().padStart(12, "0")}`,
      }),
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

test("publishes committed chunks before full activation and retains consumed items", async () => {
  const f = fixture();
  f.plan.early_delivery_enabled = true;
  const published: number[] = [];
  await runGenerateWallTextContentPlanJob(f.job, f.context, {
    generateChunk: async () => generated(),
    enqueuePublication: async ({ publicationId }) => {
      assert.equal(f.plan.status, "generating");
      published.push(Number(publicationId.slice(-12)));
      f.items[0].status = "consumed";
    },
  });
  assert.deepEqual(published, [10, 20]);
  assert.equal(f.items[0].status, "consumed");
  assert.equal(f.plan.status, "active");
});

test("a missed publication wake-up does not fail or restart the planner", async () => {
  const f = fixture();
  f.plan.early_delivery_enabled = true;
  let notifications = 0;
  await runGenerateWallTextContentPlanJob(f.job, f.context, {
    generateChunk: async () => generated(),
    enqueuePublication: async () => { notifications++; throw new Error("Cloud Tasks temporarily unavailable"); },
  });
  assert.equal(notifications, 2);
  assert.equal(f.items.length, 20);
  assert.equal(f.plan.status, "active");
});

test("does not notify readers when the fenced save rejects an obsolete worker", async () => {
  const f = fixture();
  f.plan.early_delivery_enabled = true;
  f.context.store.persistWallTextContentPlanBriefChunk = async () => { throw new Error("wall_text_planner_claim_lost"); };
  let notifications = 0;
  await assert.rejects(runGenerateWallTextContentPlanJob(f.job, f.context, {
    generateChunk: async () => generated(),
    enqueuePublication: async () => { notifications++; },
  }), /wall_text_planner_claim_lost/);
  assert.equal(f.items.length, 0);
  assert.equal(notifications, 0);
});

test("records private planner evidence before retrying a transient model error", async () => {
  const f = fixture();
  const diagnostics: unknown[] = [];
  f.context.store.recordWallTextFailureDiagnostic = async (value: unknown) => {
    diagnostics.push(value);
  };
  const transient = Object.assign(new Error("Request timed out."), {
    name: "APIConnectionTimeoutError",
    request_id: "req_private",
    status: 500,
  });

  await assert.rejects(
    runGenerateWallTextContentPlanJob(f.job, f.context, {
      generateChunk: async () => {
        throw transient;
      },
    }),
    RetryableJobError,
  );

  assert.deepEqual(diagnostics, [{
    backgroundJobId: "job",
    contentPlanId: "plan",
    details: {
      candidateRejections: [],
      errorName: "APIConnectionTimeoutError",
      finishReason: null,
      providerErrorCode: null,
      providerErrorType: null,
      providerRequestId: "req_private",
      providerStatus: 500,
    },
    errorCode: "wall_text_provider_transient",
    errorMessage: "Request timed out.",
    retryable: true,
    stage: "planner",
    userId: "user",
  }]);
});
