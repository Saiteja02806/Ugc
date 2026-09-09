import assert from "node:assert/strict";
import test from "node:test";

import { shouldReuseWallTextContentPlanGeneration } from "./wall-text-content-plan-generation-logic.ts";

test("reuses an attached Wall plan job during publication reconciliation", () => {
  assert.equal(
    shouldReuseWallTextContentPlanGeneration({ status: "generating", generationJobId: "planner-job" }),
    true,
  );
  assert.equal(
    shouldReuseWallTextContentPlanGeneration({ status: "generating", generationJobId: null }),
    false,
  );
  assert.equal(
    shouldReuseWallTextContentPlanGeneration({ status: "active", generationJobId: "planner-job" }),
    false,
  );
});
