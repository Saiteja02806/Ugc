import assert from "node:assert/strict";
import { test } from "node:test";
import { readSlideshowComposerDraft, requiresScreenshotAttachment, slideshowComposerDraftKey } from "./slideshow-composer-draft.ts";
test("composer drafts retain text and ordered IDs, scoped to owner and source", () => {
  const draft = { version: 1, prompt: 'Put my uploaded screenshot inside the laptop. Keep "UGC Pilot".', imageIds: ["7a025351-906c-43d1-83d7-166fe8580004"] };
  assert.deepEqual(readSlideshowComposerDraft(JSON.stringify(draft)), draft);
  assert.notEqual(slideshowComposerDraftKey("a", "source"), slideshowComposerDraftKey("b", "source"));
  assert.notEqual(slideshowComposerDraftKey("a", "source"), slideshowComposerDraftKey("a", "other"));
  assert.throws(() => readSlideshowComposerDraft(JSON.stringify({ ...draft, imageIds: [draft.imageIds[0], draft.imageIds[0]] })));
  assert.throws(() => readSlideshowComposerDraft('{"version":1,"prompt":"yes","imageIds":["https://foreign/image.png"]}'));
});
test("explicit screenshot requests require an attachment; ordinary edits and exclusions do not", () => {
  for (const prompt of ["Place my uploaded screenshot inside the laptop.", "Use the provided screen image inside this desktop.", "Keep my actual screenshot inside the device."]) assert.equal(requiresScreenshotAttachment(prompt), true);
  for (const prompt of ["Change the heading to Start a SaaS.", "Do not use my uploaded screenshot.", "Create a screenshot of a white dashboard."]) assert.equal(requiresScreenshotAttachment(prompt), false);
});

test("preservation instructions cannot negate a separate screenshot placement action", () => {
  for (const prompt of [
    "Use my uploaded screenshot inside the laptop, do not change anything else.",
    "Do not change the laptop, place my screenshot in its screen.",
    "Use my screenshot and keep the rest without changes.",
    "Never change the font and use the provided screen image inside the laptop.",
    "Don't use a generated dashboard, use my supplied screenshot.",
  ]) assert.equal(requiresScreenshotAttachment(prompt), true, prompt);
  for (const prompt of [
    "Do not use my uploaded screenshot, keep the existing screen.",
    "Don't use my screenshot.",
    "Don’t use my screenshot.",
    "Never add my provided screen image.",
    "I do not want to use my uploaded screenshot.",
  ]) assert.equal(requiresScreenshotAttachment(prompt), false, prompt);
});
