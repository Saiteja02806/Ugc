import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const sourceSlides = [1, 2].map(number => ({ id: `slide-${number}`, slideNumber: number,
  status: "ready", renderedUrl: `https://media.fixture.test/original-${number}.png`, headline: "Original" }));
const readyEdit = { id: "edit", revision: 3, renderState: "ready", content: { format: "carousel", slides: sourceSlides.map(slide => ({
  slideId: slide.id, slideNumber: slide.slideNumber, headline: `New copy ${slide.slideNumber}`, ctaText: "", subtext: "", textPosition: { x: .5, y: .5 },
})) }, renderOutput: { slides: sourceSlides.map(slide => ({ slideNumber: slide.slideNumber,
  renderedUrl: `https://media.fixture.test/edited-${slide.slideNumber}.png`, renderedS3Key: `edited-${slide.slideNumber}.png` })) } };
let latest = readyEdit, saved = null;
mock.module("next/server", { namedExports: { NextResponse: { json: (body, options) => Response.json(body, options) } } });
mock.module("@/lib/firebase/server-auth", { namedExports: { FirebaseAuthRequestError: class extends Error {}, requireFirebaseUser: async () => ({ uid: "owner" }) } });
mock.module("@/lib/carousel/db", { namedExports: { getMissingCarouselDbEnvVars: () => [], getCarouselGenerationStatus: async () => ({
  generation: { id: "carousel", userId: "owner", status: "completed", slideCount: 2, selectedAngle: "Ready test" }, slides: sourceSlides,
}) } });
mock.module("@/lib/library/db", { namedExports: { getMissingLibraryDbEnvVars: () => [], saveGeneratedCarouselToLibrary: async params => {
  saved = params; return { created: true, item: { id: "library" } };
} } });
mock.module("@/lib/storage/storage", { namedExports: { isTrustedStorageUrl: value => value.startsWith("https://media.fixture.test/") } });
mock.module("./creative-edit-service.ts", { namedExports: { loadSavedTrendingCreativeEditForDownstream: async params => {
  assert.deepEqual(params, { creativeId: "carousel", format: "carousel", userId: "owner" }); return latest;
} } });
const { POST } = await import("../../app/api/library/carousels/route.ts");
const saveToLibrary = () => POST(new Request("http://fixture/library/carousels", { method: "POST", body: JSON.stringify({ carouselId: "carousel" }) }));

test("pending/failed edits cannot enter the Library scheduling path even with prior rendered output", async () => {
  for (const renderState of ["queued", "rendering", "draft", "failed"]) {
    saved = null; latest = { ...readyEdit, renderState };
    assert.equal((await saveToLibrary()).status, 409); assert.equal(saved, null);
  }
});

test("incomplete or untrusted edited slides cannot enter scheduling", async () => {
  for (const renderOutput of [null, { slides: [] }, { slides: [readyEdit.renderOutput.slides[0]] },
    { slides: readyEdit.renderOutput.slides.map(slide => ({ ...slide, renderedUrl: "blob:temporary" })) }]) {
    latest = { ...readyEdit, renderOutput }; saved = null;
    assert.equal((await saveToLibrary()).status, 409); assert.equal(saved, null);
  }
});

test("confirmed edit passes its current revision, complete new images and copy to the Library", async () => {
  latest = readyEdit; saved = null;
  const response = await saveToLibrary();
  assert.equal(response.ok, true);
  assert.equal(saved.edit.revision, 3);
  assert.deepEqual(saved.slides.map(slide => slide.renderedUrl), readyEdit.renderOutput.slides.map(slide => slide.renderedUrl));
  assert.deepEqual(saved.slides.map(slide => slide.headline), ["New copy 1", "New copy 2"]);
  assert.equal(saved.userId, "owner");
});
