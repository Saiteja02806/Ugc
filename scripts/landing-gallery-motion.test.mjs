import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LANDING_GALLERY_INITIAL_POSITION, LANDING_GALLERY_STEP_MS, landingGalleryLayout as layout, landingGalleryPosition as position } from "../lib/marketing/landing-gallery-motion.ts";

test("latest screenshot arrangement centers the primary Hook and hover travel takes three seconds per slot", () => {
  assert.equal(LANDING_GALLERY_INITIAL_POSITION, 3);
  assert.equal(LANDING_GALLERY_STEP_MS, 3000);
  const order = Array.from({ length: 11 }, (_, i) => ({ index: i, p: position(i, LANDING_GALLERY_INITIAL_POSITION, 11) }))
    .filter(item => Math.abs(item.p) <= 3).sort((a, b) => a.p - b.p).map(item => item.index);
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5, 6]);
});

test("approved dimensions and symmetric vertical proportions remain at the seven slots", () => {
  assert.deepEqual([-3, -2, -1, 0, 1, 2, 3].map(p => Math.round(layout(p).scale * 270)), [112, 146, 188, 270, 188, 146, 112]);
  assert.equal(layout(0, true).scale * 270, 252);
});
test("continuous motion preserves gaps while every reference crosses the center", () => {
  for (let phase = 0; phase < 11; phase += 0.025) {
    const visible = Array.from({ length: 11 }, (_, i) => position(i, phase, 11))
      .filter(p => Math.abs(p) < 3.5).map(p => layout(p)).sort((a, b) => a.x - b.x);
    for (let i = 1; i < visible.length; i++) {
      const gap = visible[i].x - visible[i - 1].x - (visible[i].scale + visible[i - 1].scale) * 135;
      assert(gap >= 13.99, `overlap at phase ${phase}: ${gap}`);
    }
  }
  for (let i = 0; i < 11; i++) assert.equal(position(i, i, 11), 0);
});
test("loop boundaries are continuous and teleporting wraps remain invisible", () => {
  for (let i = 0; i < 11; i++) {
    assert(Math.abs(layout(position(i, 11 - 1e-7, 11)).x - layout(position(i, 0, 11)).x) < 0.001);
    const wrap = i + 5.5;
    assert.equal(layout(position(i, wrap - 1e-7, 11)).opacity, 0);
    assert.equal(layout(position(i, wrap + 1e-7, 11)).opacity, 0);
  }
});
test("curated additions retain canonical source identity, explicit demo trim and hashed media", () => {
  const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
  const manifest = read("lib/marketing/landing-preview-assets.json");
  const talking = read("lib/explore/talking-head-source-manifest.json").items;
  const hooks = read("worker/src/lib/explore-hook-reference-release.json").items;
  const walls = read("worker/src/lib/explore-paired-reference-catalog.json").items;
  for (const key of ["talkingDemo", "demoExample", "hookExtra", "wallExtra"]) {
    const asset = manifest.videos[key];
    const sourceId = asset.parentSourceId ?? asset.sourceId;
    const canonical = [...talking, ...hooks, ...walls].find(item => item.id === sourceId);
    assert(canonical);
    assert.equal(asset.sourceSha256, canonical.sourceSha256 ?? canonical.videoSha256);
  }
  assert.equal(manifest.videos.demoExample.sourceStartSeconds, 0);
  assert.equal(manifest.videos.demoExample.sourceEndSeconds, 19);
  assert.equal(manifest.videos.demoExample.durationSeconds, 19);
  assert.deepEqual(
    readFileSync(new URL(`../public${manifest.videos.demoExample.poster}`, import.meta.url)),
    readFileSync(new URL(`../public${manifest.videos.talkingDemo.poster}`, import.meta.url)),
    "Combined-format preview must show the original creator opening, not the old screen-demo poster",
  );
  for (const asset of Object.values(manifest.videos)) {
    for (const url of [asset.src, asset.poster]) {
      const bytes = readFileSync(new URL(`../public${url}`, import.meta.url));
      assert(url.includes(createHash("sha256").update(bytes).digest("hex").slice(0, 16)));
      if (url === asset.src) assert.equal(bytes.length, asset.bytes);
    }
  }
});
