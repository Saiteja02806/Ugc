import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptableCreatedScheduleStatuses,
  decideTrendingCompletionTransition,
  isAcceptableCreatedScheduleStatus,
  isCompletionResultForAction,
  type TrendingCompletionAction,
} from "./completion-integrity-logic.ts";

const completedCases = [
  ["saved", "completed_saved"],
  ["scheduled", "completed_scheduled"],
  ["skipped", "completed_skipped"],
] as const;

test("active assignments can be completed when no action was recorded", () => {
  for (const state of ["pending", "in_progress"] as const) {
    assert.deepEqual(
      decideTrendingCompletionTransition({
        action: "saved",
        assignment: { completionAction: null, state },
      }),
      { kind: "complete" },
    );
  }
});

test("same-action completion retries are idempotent", () => {
  for (const [action, state] of completedCases) {
    assert.deepEqual(
      decideTrendingCompletionTransition({
        action,
        assignment: { completionAction: action, state },
      }),
      { kind: "idempotent" },
    );
  }
});

test("a completed assignment rejects every conflicting action", () => {
  for (const [completedAction, state] of completedCases) {
    for (const requestedAction of [
      "saved",
      "scheduled",
      "skipped",
    ] as const) {
      if (requestedAction === completedAction) {
        continue;
      }

      assert.deepEqual(
        decideTrendingCompletionTransition({
          action: requestedAction,
          assignment: { completionAction: completedAction, state },
        }),
        { completedAction, kind: "conflict" },
      );
    }
  }
});

test("failed and internally inconsistent assignments cannot complete", () => {
  assert.deepEqual(
    decideTrendingCompletionTransition({
      action: "skipped",
      assignment: { completionAction: null, state: "failed" },
    }),
    { kind: "not_active" },
  );

  assert.deepEqual(
    decideTrendingCompletionTransition({
      action: "saved",
      assignment: {
        completionAction: "scheduled",
        state: "completed_saved",
      },
    }),
    { kind: "invalid" },
  );
});

test("only persisted, usable schedule states prove scheduled completion", () => {
  for (const status of acceptableCreatedScheduleStatuses) {
    assert.equal(isAcceptableCreatedScheduleStatus(status), true, status);
  }

  for (const status of ["failed", "cancelled", "unknown"]) {
    assert.equal(isAcceptableCreatedScheduleStatus(status), false, status);
  }
});

test("post-update verification requires the matching state and action", () => {
  for (const [action, state] of completedCases) {
    assert.equal(
      isCompletionResultForAction({
        action,
        completionAction: action,
        state,
      }),
      true,
    );
    assert.equal(
      isCompletionResultForAction({
        action,
        completionAction: anotherAction(action),
        state,
      }),
      false,
    );
  }
});

function anotherAction(action: TrendingCompletionAction) {
  return action === "saved" ? "skipped" : "saved";
}
