import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import viewsRegistry from "../lib/explore/slideshow-reference-views.json" with { type: "json" };
import { getSlideshowReferenceViews } from "../lib/explore/slideshow-reference-views.ts";

test("slideshow views registry contains only live-verified entries with real post URLs", () => {
  assert.equal(viewsRegistry.items.length, 28);
  for (const item of viewsRegistry.items) {
    assert.ok(item.id.startsWith("explore-slideshow-"), `Unexpected id: ${item.id}`);
    assert.ok(typeof item.title === "string" && item.title.length > 0);
    assert.ok(typeof item.sourceUrl === "string" && item.sourceUrl.length > 0);
    assert.equal(item.status, "verified_live");
    assert.ok(typeof item.viewCount === "number" && item.viewCount > 0);
    assert.match(item.formattedViews, /^[0-9]+(?:\.[0-9]+)?[KM]$/);
  }
});

test("slideshows with NO link or profile links have NO view badge (zero hallucinated views)", () => {
  // Fitness 01 has NO link
  const fitness01 = getSlideshowReferenceViews("explore-slideshow-fitness-2ac394bae86d6779");
  assert.equal(fitness01, undefined);

  // Calory Tracking 01 has only a profile link (@jessicas_tt), not a specific post
  const calory01 = getSlideshowReferenceViews("explore-slideshow-calory-tracking-4b4e24290206c567");
  assert.equal(calory01, undefined);

  // Creator slideshow accounts have no public post link
  const creator1 = getSlideshowReferenceViews("creator-slideshow-01");
  assert.equal(creator1, undefined);
});

test("getSlideshowReferenceViews retrieves exact real-time views for verified photo carousels", () => {
  // Fitness 07 (TikTok photo carousel 7561011445400456470)
  const fitness07 = getSlideshowReferenceViews("explore-slideshow-fitness-82f920de67e28907");
  assert.ok(fitness07);
  assert.equal(fitness07.verifiedLive, true);
  assert.equal(fitness07.formattedViews, "17M");
  assert.ok(fitness07.viewCount > 16000000);

  // Focus 01 (TikTok photo carousel 7686157916675542294)
  const focus01 = getSlideshowReferenceViews("explore-slideshow-nota-f79553cb5f15c74e");
  assert.ok(focus01);
  assert.equal(focus01.verifiedLive, true);
  assert.equal(focus01.formattedViews, "43M");

  // Calory Tracking 08 (TikTok photo carousel 7617820692473531670)
  const calory08 = getSlideshowReferenceViews("explore-slideshow-calory-tracking-ee89585cf07b2853");
  assert.ok(calory08);
  assert.equal(calory08.verifiedLive, true);
  assert.equal(calory08.formattedViews, "12M");
});

test("recreate-catalog and creator-slideshows attach views to slideshow references only when verified", () => {
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
  // Views badge is rendered conditionally ONLY when formattedViews exists
  assert.match(workspaceSource, /reference\.formattedViews\s*\?\s*<span data-reference-views/);
  assert.match(workspaceSource, /studio\.referenceViewsBadge/);
  assert.match(workspaceSource, /EyeIcon/);
  assert.match(workspaceSource, /reference\.formattedViews/);

  // Slide count badge is retained in ReferenceMedia
  assert.match(workspaceSource, /reference\.slides\.length/);
  assert.match(workspaceSource, /Layers3/);
});
