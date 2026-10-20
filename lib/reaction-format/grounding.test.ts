import assert from "node:assert/strict";
import test from "node:test";

import {
  getReactionContentGrounding,
  getReactionGroundingIssue,
} from "./grounding.ts";

const content = {
  grounding: {
    factId: "capability-1",
    factText: "Take a meal photo instead of calculating every ingredient",
    factType: "capability",
    mode: "business_fact",
  },
};

test("business-specific Reaction copy keeps its backend-owned fact visible", () => {
  assert.deepEqual(getReactionContentGrounding(content), content.grounding);
  assert.equal(
    getReactionGroundingIssue({
      content,
      text: "Me taking meal photos instead of calculating ingredients",
    }),
    null,
  );
  assert.match(
    getReactionGroundingIssue({
      content,
      text: "When the day finally starts behaving itself again",
    }) ?? "",
    /approved business fact/u,
  );
  assert.match(
    getReactionGroundingIssue({
      content,
      text: "When a meal photo gives me an actual calorie count",
    }) ?? "",
    /accuracy level or guarantee/u,
  );
});

test("intentionally generic awareness Reactions are explicitly not business-specific", () => {
  assert.equal(
    getReactionGroundingIssue({
      content: { grounding: { mode: "awareness_generic" } },
      text: "When the group chat makes a new plan again",
    }),
    null,
  );
});
