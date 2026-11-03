import assert from "node:assert/strict";
import test from "node:test";
import { calculateVideoGenerationCreditCost, getVideoModelCreditsPerSecond } from "./generation-credit-policy.ts";

test("merchant-approved Kling rates produce exact duration quotes and admissions", () => {
  for (const [model, rate] of [["kling_3_0", 1], ["kling_4_0", 2]] as const) {
    assert.equal(getVideoModelCreditsPerSecond(model), rate);
    for (const duration of [3, 6, 15]) {
      assert.equal(calculateVideoGenerationCreditCost(duration, getVideoModelCreditsPerSecond(model)), duration * rate);
    }
  }
  for (const [model, rate] of [["wan_3_0", 2], ["google_omni", 2], ["seedance_2_5", 3]] as const) {
    assert.equal(getVideoModelCreditsPerSecond(model), rate);
  }
});
