import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleSlideshow,
  filterReferences,
  interleaveReferenceCategories,
  orderReferenceGallery,
  RECREATE_FORMATS,
  RECREATE_FORMAT_LABELS,
  referenceCategories,
  type RecreateReference,
} from "./recreate-types.ts";

const references: RecreateReference[] = [
  {
    category: "fitness",
    categoryLabel: "Fitness",
    format: "slideshow",
    id: "fitness-carousel",
    posterUrl: "https://example.test/fitness-1.webp",
    slides: [
      { height: 1350, id: "fitness-1", url: "https://example.test/fitness-1.webp", width: 1080 },
      { height: 1350, id: "fitness-2", url: "https://example.test/fitness-2.webp", width: 1080 },
    ],
    title: "Fitness 01",
  },
  {
    category: "study",
    categoryLabel: "Study",
    format: "slideshow",
    id: "study-carousel",
    posterUrl: "https://example.test/study-1.webp",
    slides: [
      { height: 1350, id: "study-1", url: "https://example.test/study-1.webp", width: 1080 },
      { height: 1350, id: "study-2", url: "https://example.test/study-2.webp", width: 1080 },
    ],
    title: "Study 01",
  },
  {
    category: "productivity",
    categoryLabel: "Productivity",
    format: "wall_text",
    id: "wall-productivity",
    posterUrl: "https://example.test/productivity.webp",
    slides: [],
    title: "Productivity 01",
    videoUrl: "https://example.test/productivity.mp4",
  },
];

test("Hook platform filters use source provenance and clear back to the whole gallery", () => {
  const base = { ...references[0], format: "hook" as const, category: null, categoryLabel: null };
  const items = [
    { ...base, id: "ig", instagramUrl: "https://www.instagram.com/reel/example/" },
    { ...base, id: "tt", sourceUrl: "https://www.tiktok.com/@creator/video/123" },
    { ...base, id: "unknown" },
    { ...base, id: "archived", sourcePlatform: "instagram" as const, archived: true as const },
  ];
  assert.deepEqual(referenceCategories(items, "hook"), [{ id: "instagram", label: "Instagram", count: 1 }, { id: "tiktok", label: "TikTok", count: 1 }]);
  assert.deepEqual(filterReferences(items, "hook", ["instagram"]).map(item => item.id), ["ig"]);
  assert.deepEqual(filterReferences(items, "hook", ["tiktok"]).map(item => item.id), ["tt"]);
  assert.deepEqual(filterReferences(items, "hook", []).map(item => item.id), ["ig", "tt", "unknown"]);
});

test("gallery formats appear in the requested order", () => {
  assert.deepEqual(RECREATE_FORMATS, ["slideshow", "wall_text", "hook"]);
  assert.deepEqual(RECREATE_FORMATS.map((format) => RECREATE_FORMAT_LABELS[format]), ["Slideshows", "Wall of Text", "Hook videos"]);
});

test("video galleries mix platforms stably, including newer single-platform batches and unknown sources", () => {
  for (const format of ["hook", "wall_text"] as const) {
    const base = { ...references[2], format };
    const items: RecreateReference[] = [
      { ...base, id: "ig-old", instagramUrl: "https://www.instagram.com/reel/old/" },
      { ...base, id: "ig-new-1", sourcePlatform: "instagram", uploadBatchSequence: 2, isNew: true },
      { ...base, id: "ig-new-2", sourcePlatform: "instagram", uploadBatchSequence: 2, isNew: true },
      { ...base, id: "tt-old", sourceUrl: "https://www.tiktok.com/@creator/video/123" },
      { ...base, id: "tt-new", sourcePlatform: "tiktok", uploadBatchSequence: 1 },
    ];
    const original = JSON.stringify(items);
    const mixed = orderReferenceGallery(items, format);
    assert.deepEqual(mixed.map(item => item.id), ["ig-new-1", "tt-new", "ig-new-2", "tt-old", "ig-old"]);
    assert.equal(JSON.stringify(items), original);
    assert.equal(mixed[0], items[1]); assert.equal(mixed[2].isNew, true);
    assert.deepEqual(orderReferenceGallery(items, format), mixed, "Renders and scroll expansion keep the same order");
    for (const platform of ["instagram", "tiktok"]) {
      const filtered = filterReferences(items, format, [platform]);
      assert.deepEqual(orderReferenceGallery(filtered, format).map(item => item.id),
        platform === "instagram" ? ["ig-new-1", "ig-new-2", "ig-old"] : ["tt-new", "tt-old"]);
    }
    const unknown = { ...base, id: "unknown" };
    const withUnknown = orderReferenceGallery([...items, unknown], format);
    assert.equal(withUnknown.length, items.length + 1); assert.ok(withUnknown.includes(unknown));
    assert.deepEqual(orderReferenceGallery([], format), []);
  }
});

test("slideshow categories alternate while their original cards and slides stay intact", () => {
  const items = [
    references[0], { ...references[0], id: "fitness-2" }, { ...references[0], id: "fitness-3" },
    references[1], { ...references[1], id: "study-2" },
    { ...references[1], category: "skincare", id: "skincare-1" },
  ];
  const original = JSON.stringify(items);
  const mixed = interleaveReferenceCategories(items);
  assert.deepEqual(mixed.map((item) => item.id), ["fitness-carousel", "study-carousel", "skincare-1", "fitness-2", "study-2", "fitness-3"]);
  assert.equal(JSON.stringify(items), original);
  assert.equal(mixed.every((item) => items.includes(item) && item.slides === items.find((source) => source.id === item.id)?.slides), true);
  assert.deepEqual(interleaveReferenceCategories(items), mixed);
});

test("category filters constrain the mix and empty or uncategorized lists are safe", () => {
  const items = [references[0], { ...references[0], id: "fitness-2" }, references[1], { ...references[1], category: null, id: "uncategorized" }];
  assert.deepEqual(interleaveReferenceCategories(filterReferences(items, "slideshow", ["fitness"])).map((item) => item.id), ["fitness-carousel", "fitness-2"]);
  assert.deepEqual(interleaveReferenceCategories(filterReferences(items, "slideshow", ["fitness", "study"])).map((item) => item.id), ["fitness-carousel", "study-carousel", "fitness-2"]);
  assert.deepEqual(interleaveReferenceCategories(items).map((item) => item.id), ["fitness-carousel", "study-carousel", "uncategorized", "fitness-2"]);
  assert.deepEqual(interleaveReferenceCategories([]), []);
});

test("Recreate filters categories inside the selected format", () => {
  assert.deepEqual(
    filterReferences(references, "slideshow", ["fitness"]).map((item) => item.id),
    ["fitness-carousel"],
  );
  assert.deepEqual(
    filterReferences(references, "wall_text", []).map((item) => item.id),
    ["wall-productivity"],
  );
});

test("retired Wall cards cannot appear in frontend galleries or filter metadata from stale data", () => {
  const stale = ["explore-wall-text-08", "explore-wall-text-09"].map(id => ({
    ...references[2], id, category: "removed", categoryLabel: "Removed",
  }));
  const items = [...stale, references[2]];
  assert.deepEqual(filterReferences(items, "wall_text", []).map(item => item.id), ["wall-productivity"]);
  assert.deepEqual(referenceCategories(items, "wall_text"), [{ count: 1, id: "productivity", label: "Productivity" }]);
});

test("Recreate exposes compact filter metadata only for the active format", () => {
  assert.deepEqual(referenceCategories(references, "slideshow"), [
    { count: 1, id: "fitness", label: "Fitness" },
    { count: 1, id: "study", label: "Study" },
  ]);
  assert.deepEqual(referenceCategories(references, "wall_text"), [
    { count: 1, id: "productivity", label: "Productivity" },
  ]);
});

test("slideshow recreation replaces only explicitly changed slides and preserves order", () => {
  const [first, second] = references[0].slides;
  const assembled = assembleSlideshow(references[0].slides, {
    [second.id]: "https://example.test/fitness-2-new.webp",
  });

  assert.deepEqual(assembled.map((slide) => slide.id), [first.id, second.id]);
  assert.equal(assembled[0].url, first.url);
  assert.equal(assembled[1].url, "https://example.test/fitness-2-new.webp");
  assert.notEqual(assembled[0], first);
});
