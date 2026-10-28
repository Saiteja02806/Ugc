import assert from "node:assert/strict";
import { mock, test } from "node:test";
import release from "../../worker/src/lib/explore-hook-wall-reclassification-release.json" with { type: "json" };
mock.module(new URL("../../worker/src/lib/explore-hook-reference-release.ts", import.meta.url), {
  namedExports: { getHookReferenceGalleryItems: () => release.items },
});
const { createHookKeyframeDraft, updateHookKeyframeDraft } = await import("./hook-keyframe-draft.ts");
const { getHookKeyframePromptPreview } = await import("./hook-keyframe-prompt-preview.ts");

test("activated fixture routes each source-specific direction through the real preparation preview", () => {
  for (const item of release.items) {
    const draft = createHookKeyframeDraft({ ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: item.id, sourceSha256: item.videoSha256 });
    const preview = getHookKeyframePromptPreview(draft);
    assert.equal(preview.sourceMatched, true);
    assert.ok(preview.animationPrompt);
    assert.match(preview.directions, /PHASE \[/);
    assert.equal(preview.canSubmitPaidAnimation, false);
    const custom = getHookKeyframePromptPreview(updateHookKeyframeDraft(draft, { motionInstructions: "Look at the camera and hold still." }));
    assert.equal(custom.directions, "Look at the camera and hold still.");
  }
});
