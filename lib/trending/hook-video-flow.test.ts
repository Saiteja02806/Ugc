import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_HOOK_VIDEO_FLOW_STATE,
  beginHookVideoComposition,
  selectHookVideoDemo,
  selectHookVideoSuggestion,
} from "./hook-video-flow.ts";

test("the Hook video flow starts in browse without fabricated selections", () => {
  assert.equal(INITIAL_HOOK_VIDEO_FLOW_STATE.stage, "browse");
  assert.deepEqual(INITIAL_HOOK_VIDEO_FLOW_STATE.draft, {
    demoAssetId: null,
    hookSource: null,
    hookText: null,
    id: null,
    influencerId: null,
    influencerVideoId: null,
    selectedHookId: null,
    sourceKind: null,
    trimEnd: null,
    trimStart: 0,
  });
});

test("selecting a real video opens the demo-selection stage", () => {
  const flow = beginHookVideoComposition({
    influencerId: "influencer-1",
    influencerVideoId: "video-1",
    sourceKind: "catalog",
    trimEnd: 4.5,
    trimStart: 0.5,
  });

  assert.equal(flow.stage, "select_demo");
  assert.equal(flow.draft.influencerId, "influencer-1");
  assert.equal(flow.draft.influencerVideoId, "video-1");
  assert.equal(flow.draft.sourceKind, "catalog");
  assert.equal(flow.draft.demoAssetId, null);
  assert.equal(flow.draft.selectedHookId, null);
  assert.equal(flow.draft.hookText, null);
  assert.equal(flow.draft.hookSource, null);
  assert.equal(flow.draft.trimStart, 0.5);
  assert.equal(flow.draft.trimEnd, 4.5);
});

test("demo and persisted suggestion selection advance to review", () => {
  const composition = beginHookVideoComposition({
    influencerId: "catalog:maya",
    influencerVideoId: "avatar-1",
    sourceKind: "catalog",
  });
  const withDemo = selectHookVideoDemo(composition, "demo-1");
  const review = selectHookVideoSuggestion(withDemo, {
    id: "suggestion-1",
    text: "What if your morning routine took half the effort?",
  });

  assert.equal(withDemo.stage, "select_hook");
  assert.equal(review.stage, "review");
  assert.equal(review.draft.selectedHookId, "suggestion-1");
  assert.equal(review.draft.hookSource, "composition");
});

test("a business-profile Hook keeps its text while the user selects a demo", () => {
  const composition = beginHookVideoComposition({
    hookText: "Your reports should not take all morning.",
    influencerId: "catalog:maya",
    influencerVideoId: "avatar-1",
    selectedHookId: "11111111-1111-4111-8111-111111111111",
    sourceKind: "catalog",
    trimEnd: 4,
    trimStart: 0,
  });
  const review = selectHookVideoDemo(composition, "demo-1");

  assert.equal(composition.stage, "select_demo");
  assert.equal(composition.draft.hookSource, "trending");
  assert.equal(review.stage, "review");
  assert.equal(review.draft.demoAssetId, "demo-1");
  assert.equal(
    review.draft.hookText,
    "Your reports should not take all morning.",
  );
});
