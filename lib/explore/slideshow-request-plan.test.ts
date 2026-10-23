import assert from "node:assert/strict";
import test from "node:test";
import { assignSlideshowUploadNames } from "./slideshow-image-names.ts";
import { readSlideshowComposerDraft } from "./slideshow-composer-draft.ts";
import { compileSlideshowOutputPlan, validateSlideshowRequestPlan, type SlideshowPlanningInput, type SlideshowRequestPlan } from "./slideshow-request-plan.ts";
import { parseSlideshowReferenceContract } from "../../worker/src/lib/slideshow-generation-contract.ts";

const input: SlideshowPlanningInput = { version: 1, prompt: "Recreate these two slides", images: [
  { id: "source:1", label: "Source slide 1", kind: "source", sourceSlideNumber: 1, url: "https://owned.test/1.png" },
  { id: "source:4", label: "Source slide 4", kind: "source", sourceSlideNumber: 4, url: "https://owned.test/4.png" },
  { id: "upload:a", label: "Upload A", kind: "upload", sourceSlideNumber: null, url: "https://owned.test/product.png" },
  { id: "upload:c", label: "Upload C", kind: "upload", sourceSlideNumber: null, url: "https://owned.test/screen.png" },
], targetIds: ["source:1", "source:4"] };
const valid = (): SlideshowRequestPlan => ({ version: 1, clarifications: [], unusedUploadIds: [], slides: [
  { targetId: "source:1", baseUploadId: null, instructions: 'Use Upload A as the product. Set the headline to "A simple start".', preserve: ["Keep the original font"], attachments: [{ imageId: "upload:a", role: "product" }] },
  { targetId: "source:4", baseUploadId: null, instructions: "Insert Upload C into the screen.", preserve: ["Keep the device and background"], attachments: [{ imageId: "upload:c", role: "screenshot" }] },
] });

test("stable upload names retain gaps and identities through removal, readdition and reload", () => {
  const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", c = "33333333-3333-4333-8333-333333333333";
  const first = assignSlideshowUploadNames([a, b]);
  const after = assignSlideshowUploadNames([b, c], first);
  assert.deepEqual(after.map(image => image.name), ["Upload A", "Upload B", "Upload C"]);
  const saved = readSlideshowComposerDraft(JSON.stringify({ version: 1, prompt: "Use Upload B", imageIds: [b, c], uploadNames: after }));
  assert.equal(assignSlideshowUploadNames([b, c, a], saved.uploadNames).find(image => image.assetId === b)?.name, "Upload B");
  assert.throws(() => readSlideshowComposerDraft(JSON.stringify({ ...saved, uploadNames: [after[0], { ...after[1], name: "Upload A" }] })));
});

test("each output keeps the original source number and only its assigned upload", () => {
  const plan = validateSlideshowRequestPlan(valid(), input);
  const cover = compileSlideshowOutputPlan(input, plan, 0), laptop = compileSlideshowOutputPlan(input, plan, 1);
  assert.deepEqual(cover.urls, [input.images[0].url, input.images[2].url]);
  assert.deepEqual(laptop.urls, [input.images[1].url, input.images[3].url]);
  assert.equal(laptop.plan.sourceSlideNumber, 4); assert.equal(laptop.plan.outputSlideIndex, 2);
  assert.deepEqual(laptop.plan.images.map(image => [image.label, image.imageIndex, image.role]), [["Source slide 4", 1, "source"], ["Upload C", 2, "screenshot"]]);
});

test("unknown, duplicate, missing and orphaned assignments are rejected", () => {
  for (const mutate of [
    (plan: SlideshowRequestPlan) => { plan.slides.reverse(); },
    (plan: SlideshowRequestPlan) => { plan.slides.pop(); },
    (plan: SlideshowRequestPlan) => { plan.slides[1].attachments[0].imageId = "invented"; },
    (plan: SlideshowRequestPlan) => { plan.slides[1].attachments = []; },
    (plan: SlideshowRequestPlan) => { plan.slides[0].attachments.push(plan.slides[0].attachments[0]); },
    (plan: SlideshowRequestPlan) => { plan.unusedUploadIds.push("upload:a"); },
  ]) { const plan = valid(); mutate(plan); assert.throws(() => validateSlideshowRequestPlan(plan, input)); }
  const clarify = { ...valid(), slides: [], clarifications: ["Where should Upload C go?"] };
  assert.deepEqual(validateSlideshowRequestPlan(clarify, input), clarify);
  assert.throws(() => compileSlideshowOutputPlan(input, clarify, 0));
});

test("one upload can intentionally serve both slides while duplicate pixels keep separate roles", () => {
  const shared = valid(); shared.slides[0].attachments.push({ imageId: "upload:c", role: "style" });
  assert.equal(compileSlideshowOutputPlan(input, shared, 0).urls.length, 3);
  const duplicate = structuredClone(input); duplicate.images[3].url = duplicate.images[1].url;
  const output = compileSlideshowOutputPlan(duplicate, valid(), 1);
  assert.equal(output.urls.length, 1); assert.deepEqual(output.attachmentReferenceIndices, [1]);
  assert.doesNotThrow(() => parseSlideshowReferenceContract({ version: 4, ...output, plan: output.plan }, 1));
});

test("an existing result stays the edit base and only the requested upload follows it", () => {
  const current = { id: "current:accepted", label: "Current slide", url: "https://owned.test/accepted.png", kind: "current" as const, sourceSlideNumber: null };
  const edit = { ...input, images: [...input.images, current], targetIds: [current.id] };
  const plan = { ...valid(), unusedUploadIds: ["upload:a"], slides: [{ ...valid().slides[1], targetId: current.id }] };
  const result = compileSlideshowOutputPlan(edit, plan, 0);
  assert.deepEqual(result.urls, [current.url, input.images[3].url]); assert.equal(result.regenerationReferenceIndex, 1);
  assert.deepEqual(result.styleReferenceIndices, []);
  assert.equal(result.plan.images[0].role, "edit_base");
});

test("uploads without source slides use the explicitly chosen upload as base, even when it is not first", () => {
  const uploadsOnly = { ...input, targetIds: ["new:slide"], images: input.images.filter(image => image.kind === "upload") };
  const plan: SlideshowRequestPlan = { version: 1, clarifications: [], unusedUploadIds: [], slides: [{ targetId: "new:slide", baseUploadId: "upload:c",
    instructions: "Recreate Upload C using the product from Upload A.", preserve: [], attachments: [{ imageId: "upload:a", role: "product" }] }] };
  const result = compileSlideshowOutputPlan(uploadsOnly, plan, 0);
  assert.deepEqual(result.urls, [input.images[3].url, input.images[2].url]);
  assert.equal(result.plan.images[0].label, "Upload C (base)"); assert.equal(result.regenerationReferenceIndex, 1);
  assert.throws(() => validateSlideshowRequestPlan({ ...plan, slides: [{ ...plan.slides[0], baseUploadId: null }] }, uploadsOnly));
  assert.throws(() => validateSlideshowRequestPlan({ ...valid(), slides: [{ ...valid().slides[0], baseUploadId: "upload:a" }, valid().slides[1]] }, input));
});
