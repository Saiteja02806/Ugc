import assert from "node:assert/strict";
import test from "node:test";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { getRecreateReference } from "./recreate-catalog.ts";
import { getReferenceVideoPrompt, REFERENCE_PERFORMANCE_INTRO } from "./reference-video-prompts.ts";
import { getHookKeyframeMotionReviewDraft, buildHookAnimationPrompt } from "./hook-keyframe-motion.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { buildExploreGenerationInstructions } from "./generation-input-instructions.ts";

test("all selectable Hook defaults fit the Omni budget with their timed movements and final actions", () => {
  const gallery = getHookReferenceGalleryItems();
  assert.equal(gallery.length, 129);
  for (const row of gallery) {
    const card = getRecreateReference(row.id)!;
    const sourcePrompt = getReferenceVideoPrompt(row.id, card.videoUrl)!;
    assert.equal(sourcePrompt, card.generationPrompt);
    assert.doesNotMatch(sourcePrompt, /PHASE \[/u);
    const frame = getCuratedHookFrame(row.id, row.videoSha256);
    const plan = getHookKeyframeMotionReviewDraft(row.id, row.videoSha256, frame?.index ?? 0)!.candidatePlan!;
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft({ ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: row.id, sourceSha256: row.videoSha256 }), {
      sourceFrame: { index: 0, timeSeconds: 0, width: row.width, height: row.height, sha256: "a".repeat(64) },
    });
    const preview = getHookKeyframePromptPreview(draft, "hook", undefined, undefined, undefined, row.durationSeconds);
    assert.equal(preview.animationError, null, row.title);
    for (const durationSeconds of Array.from({length: 28}, (_, index) => index + 3)) for (const generateAudio of [false, true]) {
      const prompts = [0, 1, 2, 5].map(identityPhotoCount => buildHookAnimationPrompt({ directions: preview.directions, durationSeconds, generateAudio, identityPhotoCount, actionDurationSeconds: Math.min(row.durationSeconds, durationSeconds), removePhysicalText: true, maxDurationSeconds: 30 }));
      for (const prompt of prompts) assert.ok(prompt.length <= 2000, `${row.title} ${durationSeconds}s Sound ${generateAudio}: ${prompt.length}`);
      const roles = buildExploreGenerationInstructions({ model: "google_omni", personPhotos: true, imageCount: 3, hasVideo: true, generateAudio, compact: true, referenceVideoMode: "edit" }).instructions;
      assert.ok(`${roles}\n\nReference instructions:\n${sourcePrompt.replace(`${REFERENCE_PERFORMANCE_INTRO}\n\n`, "")}\n\nYour instructions:\n`.length <= 2000, `${row.title}: complete source-video request`);
      // Every timed sentence survives. Only static opening prose and reviewed
      // duplicate summaries are omitted when the literal first frame is attached.
      for (const beat of plan.beats) {
        const action = beat.action.replace(/^PHASE \[[^\]]+\]:\s*/u, "");
        for (const sentence of action.split(/(?<=[.!?])\s+(?=[A-Z])/u)) {
          for (const prompt of prompts) assert.ok(prompt.includes(sentence), `${row.title}: animation lost ${sentence}`);
          assert.ok(sourcePrompt.includes(sentence), `${row.title}: source prompt lost ${sentence}`);
        }
      }
    }
  }
});
