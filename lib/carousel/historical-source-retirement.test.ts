import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canReadPreservedRetiredCarouselSlide,
  isPreservedRetiredCarouselSource,
} from "./historical-source-retirement.ts";

const retiredAsset = {
  is_active: false,
  runtime_exclusion_reason: "user_requested_retirement",
  source_metadata: { retirement: { preserveHistoricalRenders: true } },
  status: "archived",
  subject_review_status: "approved",
};
const renderedSlide = {
  rendered_url: "https://example.test/already-rendered-slide.webp",
  status: "ready",
};

test("keeps a completed rendered slide readable after explicit source retirement", () => {
  assert.equal(canReadPreservedRetiredCarouselSlide({
    asset: retiredAsset,
    generationStatus: "completed",
    slide: renderedSlide,
  }), true);
});

test("retirement cannot admit pending or failed generations", () => {
  for (const generationStatus of ["processing", "failed", "queued", ""]) {
    assert.equal(canReadPreservedRetiredCarouselSlide({
      asset: retiredAsset,
      generationStatus,
      slide: renderedSlide,
    }), false);
  }
});

test("a retirement marker cannot stand in for an existing ready rendered artifact", () => {
  for (const slide of [
    { ...renderedSlide, status: "processing" },
    { ...renderedSlide, status: "failed" },
    { ...renderedSlide, rendered_url: null },
    { ...renderedSlide, rendered_url: "" },
    { ...renderedSlide, rendered_url: "  " },
  ]) {
    assert.equal(canReadPreservedRetiredCarouselSlide({
      asset: retiredAsset,
      generationStatus: "completed",
      slide,
    }), false);
  }
});

test("generic rejected, excluded, unreviewed or otherwise archived assets stay blocked", () => {
  for (const asset of [
    { ...retiredAsset, is_active: true },
    { ...retiredAsset, status: "ready" },
    { ...retiredAsset, subject_review_status: "rejected" },
    { ...retiredAsset, subject_review_status: "unreviewed" },
    { ...retiredAsset, runtime_exclusion_reason: "wrong_broad_bucket" },
    { ...retiredAsset, runtime_exclusion_reason: null },
    { ...retiredAsset, source_metadata: {} },
    { ...retiredAsset, source_metadata: { retirement: { preserveHistoricalRenders: false } } },
  ]) {
    assert.equal(isPreservedRetiredCarouselSource(asset), false);
    assert.equal(canReadPreservedRetiredCarouselSlide({
      asset,
      generationStatus: "completed",
      slide: renderedSlide,
    }), false);
  }
});

test("malformed retirement metadata cannot bypass the explicit boolean opt-in", () => {
  for (const source_metadata of [
    null,
    true,
    "preserveHistoricalRenders",
    [{ retirement: { preserveHistoricalRenders: true } }],
    { retirement: null },
    { retirement: [{ preserveHistoricalRenders: true }] },
    { retirement: { preserveHistoricalRenders: "true" } },
    { retirement: { preserveHistoricalRenders: 1 } },
  ]) {
    assert.equal(isPreservedRetiredCarouselSource({ ...retiredAsset, source_metadata }), false);
  }
});

test("a six-slide saved carousel remains complete while unsafe generic archives are removed", () => {
  const savedSlides = Array.from({ length: 6 }, (_, index) => ({
    ...renderedSlide,
    slideNumber: index + 1,
  }));
  const read = (asset: typeof retiredAsset) => savedSlides.filter((slide) =>
    canReadPreservedRetiredCarouselSlide({ asset, generationStatus: "completed", slide }),
  );
  assert.equal(read(retiredAsset).length, 6);
  assert.equal(read({ ...retiredAsset, runtime_exclusion_reason: "manual_reject" }).length, 0);
});

test("the background resolver exception stays in an owned existing-slide edit path", () => {
  const service = readFileSync(new URL("../trending/creative-edit-service.ts", import.meta.url), "utf8");
  const defaultContent = service.slice(service.indexOf("async function buildDefaultContent"), service.indexOf('if (params.format === "hook_video")', service.indexOf("async function buildDefaultContent")));
  assert.match(defaultContent, /status\.generation\.userId !== params\.userId/);
  assert.match(defaultContent, /status\.generation\.status !== "completed"/);
  assert.match(defaultContent, /getCarouselEditBackgrounds\([\s\S]*status\.slides\.flatMap/);
});
