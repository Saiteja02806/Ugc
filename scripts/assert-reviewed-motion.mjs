import assert from "node:assert/strict";

// The November 14 review permits duplicate opening/ending summaries to be
// omitted. Timed movements, including the final beat, must survive verbatim.
export function assertReviewedMotion(prompt, plan, label = "") {
  assert.ok(prompt, label);
  for (const beat of plan.beats) {
    const action = beat.action.replace(/^PHASE \[[^\]]+\]:\s*/u, "");
    for (const sentence of action.split(/(?<=[.!?])\s+(?=[A-Z])/u)) {
      assert.ok(prompt.includes(sentence), label + " lost timed action: " + sentence);
    }
  }
}
