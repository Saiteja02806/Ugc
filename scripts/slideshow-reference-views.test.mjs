import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import viewsRegistry from "../lib/explore/slideshow-reference-views.json" with { type: "json" };
import { getSlideshowReferenceViews, getAllSlideshowReferenceViews } from "../lib/explore/slideshow-reference-views.ts";

test("slideshow views registry contains all 86 entries with valid counts and formats", () => {
  assert.equal(viewsRegistry.items.length, 86);
  for (const item of viewsRegistry.items) {
    assert.ok(
      item.id.startsWith("explore-slideshow-") || item.id.startsWith("creator-slideshow-"),
      `Unexpected id: ${item.id}`
    );
    assert.ok(typeof item.title === "string" && item.title.length > 0);
    assert.ok(typeof item.viewCount === "number" && item.viewCount >= 80000);
    assert.match(item.formattedViews, /^[0-9]+(?:\.[0-9]+)?[KM]$/);
    assert.ok(typeof item.slidesCount === "number" && item.slidesCount >= 2);
  }
});

test("getSlideshowReferenceViews retrieves exact views for published and creator slideshows", () => {
  const published1 = getSlideshowReferenceViews("explore-slideshow-fitness-2ac394bae86d6779");
  assert.ok(published1);
  assert.equal(published1.formattedViews, "2.5M");
  assert.equal(published1.viewCount, 2510000);

  const fullItem = getAllSlideshowReferenceViews().find(item => item.id === "explore-slideshow-fitness-2ac394bae86d6779");
  assert.ok(fullItem);
  assert.equal(fullItem.slidesCount, 6);

  const published2 = getSlideshowReferenceViews("explore-slideshow-fitness-a71a84ea4c2dc19f");
  assert.ok(published2);
  assert.equal(published2.formattedViews, "390K");

  const creator1 = getSlideshowReferenceViews("creator-slideshow-01");
  assert.ok(creator1);
  assert.equal(creator1.formattedViews, "370K");

  const creator10 = getSlideshowReferenceViews("creator-slideshow-10");
  assert.ok(creator10);
  assert.equal(creator10.formattedViews, "2.4M");
});

test("recreate-catalog and creator-slideshows attach views to slideshow references", () => {
  const catalogSource = fs.readFileSync(path.resolve("lib/explore/recreate-catalog.ts"), "utf8");
  assert.match(catalogSource, /getSlideshowReferenceViews/);
  assert.match(catalogSource, /views\s*=\s*item\.format === "slideshow"\s*\?\s*getSlideshowReferenceViews/);
  assert.match(catalogSource, /formattedViews:\s*views\.formattedViews/);

  const creatorSource = fs.readFileSync(path.resolve("lib/explore/creator-slideshows.ts"), "utf8");
  assert.match(creatorSource, /getSlideshowReferenceViews/);
  assert.match(creatorSource, /formattedViews:\s*views\.formattedViews/);
});

test("ReferenceCard renders views badge without colliding with bottom-left slide count badge", () => {
  const workspaceSource = fs.readFileSync(path.resolve("components/explore/recreate-workspace.tsx"), "utf8");
  // Views badge is rendered on ReferenceCard
  assert.match(workspaceSource, /data-reference-views/);
  assert.match(workspaceSource, /studio\.referenceViewsBadge/);
  assert.match(workspaceSource, /EyeIcon/);
  assert.match(workspaceSource, /reference\.formattedViews/);

  // Slide count badge is retained in ReferenceMedia
  assert.match(workspaceSource, /reference\.slides\.length/);
  assert.match(workspaceSource, /Layers3/);
});
