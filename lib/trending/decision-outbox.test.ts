import assert from "node:assert/strict";
import test from "node:test";

import {
  getTrendingDecisionOutboxKey,
  parseTrendingDecisionOutbox,
  removeTrendingDecisionOutboxEntry,
  type TrendingDecisionOutboxEntry,
  upsertTrendingDecisionOutboxEntry,
} from "./decision-outbox.ts";

const first: TrendingDecisionOutboxEntry = {
  assignmentId: "assignment-1",
  creativeId: "creative-1",
  decision: "rejected",
  format: "carousel",
  queuedAt: "2026-08-23T00:00:00.000Z",
};

test("keeps decision queues account scoped", () => {
  assert.notEqual(
    getTrendingDecisionOutboxKey("user-a"),
    getTrendingDecisionOutboxKey("user-b"),
  );
});

test("deduplicates a swipe by assignment while preserving later decisions", () => {
  const replacement = { ...first, decision: "accepted" as const };
  const second = {
    ...first,
    assignmentId: "assignment-2",
    creativeId: "creative-2",
  };

  assert.deepEqual(
    upsertTrendingDecisionOutboxEntry([first, second], replacement),
    [second, replacement],
  );
});

test("parses only valid durable decision payloads and removes synced entries", () => {
  const parsed = parseTrendingDecisionOutbox(
    JSON.stringify([first, { assignmentId: "incomplete" }]),
  );

  assert.deepEqual(parsed, [first]);
  assert.deepEqual(
    removeTrendingDecisionOutboxEntry(parsed, first.assignmentId),
    [],
  );
  assert.deepEqual(parseTrendingDecisionOutbox("not-json"), []);
});
