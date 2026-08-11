import assert from "node:assert/strict";
import test from "node:test";

import { hasScheduleTargetSelection } from "./schedule-target-requirement.ts";

test("rejects a schedule request without a selected publishing account", () => {
  assert.equal(hasScheduleTargetSelection({}), false);
  assert.equal(
    hasScheduleTargetSelection({ plannedTargets: [], targets: [] }),
    false,
  );
});

test("accepts direct and recoverable planned publishing targets", () => {
  const target = {
    connectionId: "connection-1",
    platform: "instagram" as const,
  };

  assert.equal(hasScheduleTargetSelection({ targets: [target] }), true);
  assert.equal(hasScheduleTargetSelection({ plannedTargets: [target] }), true);
});
