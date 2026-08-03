import assert from "node:assert/strict";
import test from "node:test";

import { getSchedulePublishFailureMessage } from "./schedule-publish-outcome.ts";

test("accepts a durable scheduled target", () => {
  assert.equal(
    getSchedulePublishFailureMessage(
      {
        status: "scheduled",
        targets: [
          { socialConnectionId: "instagram-one", status: "scheduled" },
        ],
      },
      ["instagram-one"],
    ),
    null,
  );
});

test("rejects an ok response whose post is only partially scheduled", () => {
  assert.equal(
    getSchedulePublishFailureMessage(
      {
        status: "partially_failed",
        targets: [
          { socialConnectionId: "instagram-one", status: "scheduled" },
          { socialConnectionId: "instagram-two", status: "failed" },
        ],
      },
      ["instagram-one", "instagram-two"],
    ),
    "1 selected account could not be scheduled.",
  );
});

test("rejects a failed target even when the parent status is stale", () => {
  assert.equal(
    getSchedulePublishFailureMessage(
      {
        status: "scheduled",
        targets: [
          {
            socialConnectionId: "instagram-one",
            status: "action_required",
          },
        ],
      },
      ["instagram-one"],
    ),
    "The selected account could not be scheduled.",
  );
});

test("rejects a response that omits a requested publishing target", () => {
  assert.equal(
    getSchedulePublishFailureMessage(
      { status: "scheduled", targets: [] },
      ["instagram-one"],
    ),
    "The selected account could not be scheduled.",
  );
});

test("does not report a failed parent schedule as successful", () => {
  assert.equal(
    getSchedulePublishFailureMessage(
      {
        status: "failed",
        targets: [
          { socialConnectionId: "instagram-one", status: "scheduled" },
          { socialConnectionId: "instagram-two", status: "scheduled" },
        ],
      },
      ["instagram-one", "instagram-two"],
    ),
    "2 selected accounts could not be scheduled.",
  );
});
