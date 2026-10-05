import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleSlideshow,
  filterReferences,
  interleaveReferenceCategories,
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

test("gallery formats appear in the requested order", () => {
  assert.deepEqual(RECREATE_FORMATS, ["slideshow", "wall_text", "hook"]);
  assert.deepEqual(RECREATE_FORMATS.map((format) => RECREATE_FORMAT_LABELS[format]), ["Slideshows", "Wall of Text", "Hook videos"]);
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
