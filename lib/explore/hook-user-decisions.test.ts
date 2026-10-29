import assert from "node:assert/strict";
import test from "node:test";
import { getHookReferenceGalleryItems, getHookReferenceReleaseItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { getRecreateReference, getArchivedHookReferences } from "./recreate-catalog.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { hookKeyframeMotionCatalog, hookKeyframeMotionRewrites } from "./hook-keyframe-motion.ts";
import { resolveStartingFrameSource } from "./hook-source-frame.ts";

const airplane = "explore-paired-hook-e683292d4cd22b2a8b5a9cd8";
const approved = [
  "explore-paired-hook-99ff813ebc24c61f1c92828e",
  "explore-paired-hook-d7a0b28cd22cc29d618a5a6d",
  "explore-paired-hook-743919c25a4f61942184a81b",
  "explore-paired-hook-775bf4f0fc41f253d04663e2",
  "explore-paired-hook-b7c86d6729a69666ddf46ed5",
  "explore-paired-hook-607bfccda5e91e0d8731fa94",
];
process.env.GCP_STORAGE_BUCKET ??= "hook-decisions-fixture";
process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= "https://hook-decisions.example.test";

test("only airplane retires from browsing while its historical identity remains recoverable", () => {
  const gallery = getHookReferenceGalleryItems();
  assert.equal(gallery.length, 106);
  assert.equal(gallery.some(item => item.id === airplane), false);
  assert.ok(getHookReferenceReleaseItems().some(item => item.id === airplane));
  assert.ok(getArchivedHookReferences().some(item => item.id === airplane));
  assert.equal(getRecreateReference(airplane)?.archived, true);
  assert.ok(approved.every(id => gallery.some(item => item.id === id)));
});

test("all remaining selectable Hooks resolve canonical sources and valid original-opening prompts without unresolved decisions", async () => {
  for (const hook of getHookReferenceGalleryItems()) {
    const source = await resolveStartingFrameSource(hook.id);
    assert.equal(source.videoSha256, hook.videoSha256, hook.id);
    assert.equal(source.videoStorageKey, hook.videoStorageKey, hook.id);
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft({ ownerId: "owner", draftId: crypto.randomUUID(), referenceId: hook.id, sourceSha256: hook.videoSha256 }), {
      imageAssetIds: ["00000000-0000-4000-8000-000000000002"],
    });
    const preview = getHookKeyframePromptPreview(draft, "hook", undefined, undefined, undefined, hook.durationSeconds);
    assert.equal(preview.requiresDecision, false, hook.id);
    assert.equal(preview.sourceMatched, true, hook.id);
    assert.equal(preview.animationError, null, hook.id);
    assert.ok(preview.directions.trim(), hook.id);
    assert.match(preview.imagePrompt!, /first decoded frame at elapsed t=0/, hook.id);
    assert.match(preview.imagePrompt!, /Image2 and later images/, hook.id);
    assert.match(preview.imagePrompt!, /logos/, hook.id);
    assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/, hook.id);
    assert.match(preview.animationPrompt!, /do not regenerate removed lettering/, hook.id);
  }
});

test("six explicit decisions unblock original-opening preparation and keep cleanup, silent motion and untested quality", () => {
  for (const id of approved) {
    const entry = hookKeyframeMotionCatalog[id], rewrite = hookKeyframeMotionRewrites[id];
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft({ ownerId: "owner", draftId: crypto.randomUUID(), referenceId: id, sourceSha256: entry.sourceSha256 }), {
      imageAssetIds: ["00000000-0000-4000-8000-000000000002"],
    });
    const preview = getHookKeyframePromptPreview(draft);
    assert.equal(preview.requiresDecision, false, entry.displayTitle);
    assert.equal(preview.animationError, null, entry.displayTitle);
    assert.deepEqual(preview.decisionIssues, []);
    assert.equal(rewrite.review.status, "static_reviewed");
    assert.equal(rewrite.review.startingFrameIndex, 0);
    assert.equal(rewrite.review.visualQualification, "not_tested");
    assert.match(preview.imagePrompt!, /original-opening/);
    assert.match(preview.imagePrompt!, /Image2 and later images/);
    assert.match(preview.imagePrompt!, /logos/);
    assert.match(preview.animationPrompt!, /SOUND SETTING: OFF/);
    assert.match(preview.animationPrompt!, /do not regenerate removed lettering/);
  }
  const plan = (index: number) => JSON.stringify(hookKeyframeMotionRewrites[approved[index]].plan);
  assert.match(plan(1), /deliberate hard cut/);
  assert.match(plan(2), /can must leave below the picture before the same empty hand returns/);
  assert.match(plan(3), /Retreat and lower the viewpoint/);
  assert.match(plan(4), /purple handled bottle/);
  assert.match(plan(4), /Preserve this repeated period/);
  assert.match(plan(5), /Do not invent a full portrait/);
});
