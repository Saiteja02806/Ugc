import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getTalkingHeadReferences } from "../lib/explore/talking-head-reference-catalog.ts";
import { visibleTalkingHeadReferences } from "../lib/explore/talking-head-reference.ts";
import { getTalkingHeadScript } from "../lib/explore/talking-head-script-store.ts";
import frames from "../lib/explore/talking-head-frames.json" with { type: "json" };
import sources from "../lib/explore/talking-head-source-manifest.json" with { type: "json" };
import { getRecreateReference } from "../lib/explore/recreate-catalog.ts";
import { getReferenceText } from "../lib/explore/reference-text-store.ts";
import { getHookKeyframeMotionReviewDraft, hookMotionPlanDirections } from "../lib/explore/hook-keyframe-motion.ts";
import { buildStartingFrameAnimationPrompt } from "../lib/explore/starting-frame-workflow.ts";

process.env.GCP_STORAGE_BUCKET ??= "ugcsaas-media";
process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= "https://storage.googleapis.com/ugcsaas-media";

const replacements = [
  ["talking-discovery-full", "talking-discovery-hook-v2", 2.233333],
  ["talking-bittenbyaturtle", "talking-bittenbyaturtle-hook-v2", 2.933333],
  ["talking-carla-eatsss", "talking-carla-eatsss-hook-v2", 3],
  ["talking-taliameals", "talking-taliameals-hook-v2", 1.566016],
];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

test("the gallery replaces exactly four demo sources with hosted opening-only versions", () => {
  const all = getTalkingHeadReferences();
  const visible = visibleTalkingHeadReferences(all);
  for (const [oldId, id, duration] of replacements) {
    const old = all.find(row => row.id === oldId);
    const current = visible.find(row => row.id === id);
    assert.ok(old);
    assert.ok(current);
    assert.equal(visible.some(row => row.id === oldId), false);
    assert.equal(current.sourceUrl, old.sourceUrl);
    assert.equal(current.durationSeconds, duration);
    assert.match(current.generationPrompt, /Opening at t=0/);
    assert.match(current.generationPrompt, /user's own spoken message/);
    assert.match(current.generationPrompt, /finish the described action by the source endpoint/);
    assert.match(current.videoUrl, /^https:\/\/storage\.googleapis\.com\/ugcsaas-media\/explore\/talking-head-hook-trims\/v1\/[a-f0-9]{64}\.mp4$/);
    const source = sources.items.find(row => row.id === id);
    assert.equal(sha(readFileSync("public" + source.file)), current.sourceSha256);
    assert.ok(current.videoUrl.endsWith(current.sourceSha256 + ".mp4"));
    const frame = frames.items.find(row => row.id === id);
    assert.equal(frame.sourceSha256, current.sourceSha256);
    assert.equal(frame.frameIndex, 0);
    assert.equal(frame.frameTimeSeconds, 0);
    assert.equal(sha(readFileSync("public" + frame.path)), frame.frameSha256);
  }
});

test("approved trimmed Remix records use their new source identity and remain available", () => {
  for (const [, id, duration] of replacements) {
    const script = getTalkingHeadScript(id);
    const current = getTalkingHeadReferences().find(row => row.id === id);
    assert.equal(script.sourceSha256, current.sourceSha256);
    assert.ok(script.hookEndMs <= Math.round(duration * 1000));
    assert.doesNotMatch(script.hookText, /budget|grocery list|meal plan/i);
  }
});

test("the approved Talia Hook uses the same exact MP4 with its own editable caption and timed Recreate prompt", () => {
  const id = "explore-paired-hook-573ce74ab0b1421f00e93add";
  const hook = getRecreateReference(id);
  const talking = getTalkingHeadReferences().find(row => row.id === "talking-taliameals-hook-v2");
  assert.ok(hook);
  assert.equal(hook.archived, undefined);
  assert.equal(hook.videoUrl, talking.videoUrl);
  assert.equal(hook.durationSeconds, talking.durationSeconds);
  assert.equal(hook.sourceUrl, talking.sourceUrl);
  const text = getReferenceText(id, null, "hook");
  assert.equal(text.status, "ready");
  assert.equal(text.sourceSha256, talking.sourceSha256);
  assert.match(text.blocks[0].text, /been shopping at Trader Joe’s/);
  assert.equal(text.blocks[0].endMs, 1566);
  const review = getHookKeyframeMotionReviewDraft(id, talking.sourceSha256, 0);
  assert.ok(review.candidatePlan);
  const prompt = buildStartingFrameAnimationPrompt({
    workflow: "hook",
    directions: hookMotionPlanDirections(review.candidatePlan),
    durationSeconds: 3,
    actionDurationSeconds: talking.durationSeconds,
    generateAudio: false,
    removePhysicalText: true,
  });
  assert.match(prompt, /SOUND SETTING: OFF/);
  assert.match(prompt, /ceiling/);
});
