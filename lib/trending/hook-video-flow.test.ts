import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_HOOK_VIDEO_FLOW_STATE,
  beginHookVideoComposition,
} from "./hook-video-flow.ts";

test("the Hook video flow starts in browse without fabricated selections", () => {
  assert.equal(INITIAL_HOOK_VIDEO_FLOW_STATE.stage, "browse");
  assert.deepEqual(INITIAL_HOOK_VIDEO_FLOW_STATE.draft, {
    demoAssetId: null,
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
  assert.equal(flow.draft.trimStart, 0.5);
  assert.equal(flow.draft.trimEnd, 4.5);
});
