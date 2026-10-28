import assert from "node:assert/strict";
import test from "node:test";
import { resolveAutomationGenerationMix } from "./slideshow-automation-generation-mix.ts";
const manual = { mix: { carousel: 100, hook_video: 0, reaction: 0, wall_text: 0 }, preferenceVersion: 4,
  slideshowStyleMix: { helpfulTips: 0, productStoriesCta: 100 }, updatedAt: null };
test("active automation supplies both requested structures without mutating manual Adjust or paused preferences", () => {
  const row = { status: "active", config: { counts: { dailyTotal: 3, educationalTipsCount: 1, productStoriesCount: 2 } } };
  assert.deepEqual(resolveAutomationGenerationMix(manual, row).slideshowStyleMix, { helpfulTips: 50, productStoriesCta: 50 });
  assert.deepEqual(resolveAutomationGenerationMix(manual, { status: "active", config: { counts: { dailyTotal: 5, educationalTipsCount: 1, productStoriesCount: 4 } } }).slideshowStyleMix, { helpfulTips: 50, productStoriesCta: 50 });
  assert.equal(resolveAutomationGenerationMix(manual, { ...row, status: "paused" }), manual);
  assert.equal(resolveAutomationGenerationMix(manual, null), manual);
  assert.deepEqual(manual.slideshowStyleMix, { helpfulTips: 0, productStoriesCta: 100 });
  assert.throws(() => resolveAutomationGenerationMix(manual, { status: "active", config: { counts: { dailyTotal: 0 } } }), /invalid content counts/);
});
