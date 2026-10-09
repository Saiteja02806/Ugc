import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { applyCarouselSlideImage, restoreOriginalCarouselBackground, validateCarouselSlideImage } from "./carousel-slide-image-selection.ts";

const owner = "owner";
const image = id => ({ id, user_id: owner, deleted_at: null, collection: "image", source_type: "upload",
  project_id: "trending-carousel-slide", status: "ready", mime_type: "image/png",
  width: 1920, height: 1080, storage_key: `media/owner/image/${id}.png`, url: `https://storage.test/${id}.png` });
let owned = new Map();
const lookups = [];
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("../media/media-storage.ts", { namedExports: { getMediaAssetForOwner: async params => {
  lookups.push(params); return owned.get(params.assetId) ?? null;
} } });
mock.module("./creative-edits.ts", { namedExports: { TrendingCreativeEditAccessError: AccessError } });
const { getOwnedCarouselSlideImages } = await import("./carousel-slide-images.ts");

test("manual uploads resolve once under the authenticated owner, while catalogue IDs use existing resolvers", async () => {
  owned = new Map([["image", image("image")]]); lookups.length = 0;
  const assets = await getOwnedCarouselSlideImages(["image", "image", "catalog"], owner);
  assert.deepEqual([...assets.keys()], ["image"]);
  assert.deepEqual(lookups, [{ assetId: "image", userId: owner }, { assetId: "catalog", userId: owner }]);
});

test("foreign, deleted, unready, nonimage and nonupload assets cannot become slide images", async () => {
  for (const mutation of [{ user_id: "foreign" }, { deleted_at: "deleted" }, { status: "uploading" },
    { status: "failed" }, { collection: "video" }, { source_type: "generated_image" },
    { project_id: "explore-slides" }, { mime_type: "image/svg+xml" }, { width: 0 }, { height: -1 },
    { url: "http://untrusted.test/image.png" }]) {
    owned = new Map([["image", { ...image("image"), ...mutation }]]);
    await assert.rejects(getOwnedCarouselSlideImages(["image"], owner), error => error.status === 409);
  }
});

const slides = Array.from({ length: 6 }, (_, index) => ({ slideId: `slide-${index + 1}`, slideNumber: index + 1,
  backgroundAssetId: `original-${index + 1}`, originalBackgroundAssetId: `original-${index + 1}`,
  backgroundUrl: "https://original.test/image.png", originalBackgroundUrl: "https://original.test/image.png",
  originalVisualRole: index === 0 ? "hook" : index === 5 ? "product_asset" : "human",
  visualRole: index === 0 ? "hook" : index === 5 ? "product_asset" : "human",
  headline: "Current text", subtext: "", ctaText: "", textPosition: { x: .5, y: .5 }, structureId: "structure_2" }));
const content = { format: "carousel", version: "trending-creative-edit-v1", slides };

test("all six slides can change independently without losing newer copy or the other backgrounds", () => {
  let current = { ...content, slides: slides.map(slide => ({ ...slide, headline: "Text edited while uploading" })) };
  for (const slide of slides) current = applyCarouselSlideImage(current, slide.slideId, image(slide.slideId));
  assert.deepEqual(current.slides.map(slide => slide.backgroundAssetId), slides.map(slide => slide.slideId));
  assert.ok(current.slides.every(slide => slide.headline === "Text edited while uploading" && slide.backgroundCrop === "centre"));
  const restored = restoreOriginalCarouselBackground(current.slides[3]);
  assert.equal(restored.backgroundAssetId, "original-4"); assert.equal(restored.backgroundCrop, undefined);
  assert.equal(restored.headline, "Text edited while uploading");
  assert.equal(slides[0].backgroundAssetId, "original-1");
});

test("a delayed upload targets its original slide and does nothing in a different editor", () => {
  const updated = applyCarouselSlideImage(content, "slide-2", image("new-image"));
  assert.equal(updated.slides[1].backgroundAssetId, "new-image");
  assert.strictEqual(updated.slides[2], slides[2]);
  assert.strictEqual(applyCarouselSlideImage(content, "another-carousel-slide", image("new-image")), content);
  assert.strictEqual(applyCarouselSlideImage(null, "slide-2", image("new-image")), null);
});

test("upload validation accepts any image ratio and rejects unsupported, empty and oversized files", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"]) validateCarouselSlideImage({ type, size: 25 * 1024 * 1024 });
  for (const file of [{ type: "image/svg+xml", size: 123 }, { type: "image/png", size: 0 }, { type: "image/jpeg", size: 25 * 1024 * 1024 + 1 }]) {
    assert.throws(() => validateCarouselSlideImage(file));
  }
});

// Execute the real save normalizer with controlled external lookups. This
// catches a UI-only implementation that previews uploads but rejects saving.
const source = readFileSync(new URL("./creative-edit-service.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("service.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "validateAndNormalizeSubmittedContent");
const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const originals = slides.map(slide => ({ id: slide.slideId, slideNumber: slide.slideNumber, categoryImageAssetId: slide.backgroundAssetId,
  structureId: "structure_2", productVisualEligibility: slide.slideNumber === 6 ? "preferred" : "forbidden" }));
let structure = "structure_2", hook = null, productLookups = 0;
const normalize = new Function("getCarouselGenerationStatus", "getOwnedCarouselSlideImages", "getCarouselHyperHookAssetById", "getCarouselHyperHookAssetUrl",
  "getCarouselProductAssetsByIds", "resolveCarouselImageLibraryCategory", "TrendingCreativeEditAccessError", `${code}\nreturn validateAndNormalizeSubmittedContent;`)(
  async () => ({ generation: { userId: owner, status: "completed", structureId: structure, businessProfileId: "business", categorySlug: "productivity" }, slides: originals }),
  getOwnedCarouselSlideImages, id => hook?.id === id ? hook : null, asset => asset.url,
  async ({ assetIds }) => { productLookups++; return assetIds.includes("product") ? [{ id: "product", url: "https://storage.test/product.png" }] : []; }, () => "productivity", AccessError,
);
const save = current => normalize({ content: current, previousContent: content, userId: owner, creativeId: "carousel", assignmentId: "assignment", source: null });

test("save accepts six owned uploads in both structures and derives URLs, crop and roles server-side", async () => {
  owned = new Map(slides.map(slide => [slide.slideId, image(slide.slideId)])); productLookups = 0;
  const uploaded = { ...content, slides: slides.map(slide => ({ ...slide, backgroundAssetId: slide.slideId,
    backgroundUrl: "https://attacker.test/injected.png", backgroundCrop: undefined, visualRole: "static" })) };
  for (structure of ["structure_1", "structure_2"]) {
    const saved = await save(uploaded);
    assert.deepEqual(saved.slides.map(slide => slide.backgroundUrl), slides.map(slide => image(slide.slideId).url));
    assert.deepEqual(saved.slides.map(slide => slide.visualRole), slides.map(slide => slide.originalVisualRole));
    assert.ok(saved.slides.every(slide => slide.backgroundCrop === "centre"));
  }
  assert.equal(productLookups, 0);
  structure = "structure_2";
});

test("original restore ignores submitted URL/crop and Hook library remains limited to slide 1", async () => {
  owned = new Map();
  const saved = await save({ ...content, slides: slides.map(slide => ({ ...slide, backgroundUrl: "https://attacker.test/image", backgroundCrop: "centre" })) });
  assert.ok(saved.slides.every(slide => slide.backgroundUrl === slide.originalBackgroundUrl && slide.backgroundCrop === undefined));
  hook = { id: "hook-library", url: "https://storage.test/hook.png" };
  const withHook = index => ({ ...content, slides: slides.map((slide, position) => position === index ? { ...slide, backgroundAssetId: hook.id } : slide) });
  assert.equal((await save(withHook(0))).slides[0].backgroundUrl, hook.url);
  await assert.rejects(save(withHook(2)), error => error.status === 400);
  hook = null;
});

test("app screenshot eligibility still applies, and unavailable uploads cannot save", async () => {
  const onSlide = index => ({ ...content, slides: slides.map((slide, position) => position === index ? { ...slide, backgroundAssetId: "product" } : slide) });
  assert.equal((await save(onSlide(5))).slides[5].visualRole, "product_asset");
  await assert.rejects(save(onSlide(2)), error => error.status === 400);
  owned = new Map([["product", { ...image("product"), status: "uploading" }]]);
  await assert.rejects(save(onSlide(5)), error => error.status === 409);
  owned = new Map();
  await assert.rejects(save({ ...content, slides: slides.map((slide, index) => index === 2 ? { ...slide, backgroundAssetId: "foreign-image" } : slide) }), error => error.status === 409);
});
