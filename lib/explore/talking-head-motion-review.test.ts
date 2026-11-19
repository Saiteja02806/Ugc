import assert from "node:assert/strict";
import test from "node:test";
import catalog from "./talking-head-reference-catalog.json" with { type: "json" };
import sources from "./talking-head-source-manifest.json" with { type: "json" };
import transcripts from "./talking-head-transcripts.json" with { type: "json" };
import { getTalkingHeadSceneDirections } from "./talking-head-scene-directions.ts";
import { createHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { buildStartingFrameAnimationPrompt } from "./starting-frame-workflow.ts";

// Source-observed distinctions catch adjacent-record mix-ups as well as lost endings.
const reviewed: Record<string, RegExp[]> = {
  "talking-discovery-hook-v2": [/0\.43–0\.70s: the screen-right index finger/u, /upper teeth visible, gently raised inner brows/u],
  "talking-carla-eatsss-hook-v2": [/1\.93–2\.20s: close the jaw/u, /hold that pout, tense raised inner brows and narrowed eyes/u],
  "talking-taliameals-hook-v2": [/screen-right hand rises/u, /More ceiling appears, and the enlarged face sits lower/u],
  "talking-kamile-car-what": [/screen-right fingertips release the temple/u, /blurred fingertip can remain at the bottom-right/u],
  "talking-nicki-kitchen-reaction": [/2\.40–2\.73s:/u],
  "talking-kamile-mirror-discovery": [/lips still parted and upper teeth visible/u],
  "talking-kamile-lowlight-what": [/1\.23–1\.47s:[\s\S]+fingertips release/u],
  "talking-websites-explainer": [/flatten the fingers across the lower foreground/u, /rounded parted lips/u],
  "talking-car-explainer": [/upper-left lens edge, blurred/u, /half-lowered upper lids near the lens/u],
  "talking-tessam-bible": [/rotates the recording phone toward upright/u, /lower the eyes below the lens/u],
  "talking-kamile-kitchen-discovery": [/small disbelieving smile showing the upper teeth/u, /Stop before the phone or app-screen cutaway/u],
  "talking-car-story-full": [/raise the index beside the straw again/u, /cup low and the index upright/u],
  "talking-warm-story": [/lower the hand beside the lamp/u, /small closed-lip smile/u],
  "talking-room-explainer-full": [/Raise the screen-right index beside the face/u, /broad smile soften to slightly parted lips/u],
  "talking-mug-story": [/both hands still on the cup/u, /direct open eyes and lips just parted/u],
  "talking-sophia-designsthings": [/palm toward camera and fingers spread/u, /very wide eyes, raised brows and upper teeth/u],
  "talking-emmgr4c3": [/small thumb-index circle/u, /mouth softly pursed after the last word/u],
  "talking-katiemeidt8": [/drink turns red/u, /one raised index near the chin/u],
  "talking-studyfetchlauren": [/tablet settle onto the table/u, /extend that arm toward the lower-left/u],
  "talking-sidghst": [/middle pause face-focused with hands low/u, /parted lips, relaxed brows and steady open eyes/u],
  "talking-studywithsab": [/return to the lens/u, /knife low beside the wedge/u],
  "talking-studywithsawyer": [/blurred hand edge briefly appears/u, /centered, intent gaze near the lens/u],
  "talking-mumtipswithginny": [/Curl it toward the thumb/u, /hint of upper teeth and a gentle questioning expression/u],
};

test("reviewed Talking Head movements and endings reach the selected-source preview and final speech compiler", () => {
  for (const [id, details] of Object.entries(reviewed)) {
    const item = catalog.items.find(row => row.id === id)!;
    const source = sources.items.find(row => row.id === id)!;
    const transcript = transcripts.items.find(row => row.referenceId === id)!;
    assert.equal(getTalkingHeadSceneDirections(id, source.sourceSha256), item.generationPrompt);
    assert.equal(getTalkingHeadSceneDirections(id, "f".repeat(64)), undefined);
    const preview = getHookKeyframePromptPreview(createHookKeyframeDraft({ ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: id, sourceSha256: source.sourceSha256 }), "talking_head");
    assert.equal(preview.animationError, null);
    assert.ok(preview.animationPrompt);
    assert.ok(item.generationPrompt.includes(transcript.hookText), `${id}: default words stay bound`);
    for (const expression of details) {
      assert.match(preview.directions, expression, id);
      assert.match(preview.animationPrompt, expression, id);
    }
    for (const voiceReference of [false, true]) for (const identityPhotoCount of [0, 5]) {
      const script = "Can this work for my business?";
      const prompt = buildStartingFrameAnimationPrompt({ workflow: "talking_head", directions: preview.directions, durationSeconds: 6, generateAudio: true, spokenScript: script, voiceReference, voiceIdentityPhotoCount: identityPhotoCount, identityPhotoCount, removePhysicalText: true });
      assert.equal(prompt.split(JSON.stringify(script)).length - 1, 1);
      assert.doesNotMatch(prompt, /Speak this line out loud:|speaks once, out loud:|SPOKEN SCRIPT:|“What\?”/iu);
      assert.ok(!prompt.includes(transcript.hookText), `${id}: embedded default dialogue removed`);
      for (const expression of details) assert.match(prompt, expression, id);
      assert.ok(prompt.length <= (voiceReference ? 10_000 : 2_000), `${id}: ${prompt.length}`);
    }
  }
});
