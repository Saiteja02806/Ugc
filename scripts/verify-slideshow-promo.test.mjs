import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as remotion from "remotion";

const root = process.cwd();
const require = createRequire(import.meta.url);
let testFrame = 0;
const remotionMock = {
  ...remotion,
  useCurrentFrame: () => testFrame,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 210 }),
  staticFile: name => `/${name}`,
  AbsoluteFill: props => React.createElement("div", props),
  Img: props => React.createElement("img", props),
};
const moduleCache = new Map();
function loadTsx(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  moduleCache.set(file, loaded);
  vm.runInNewContext(compiled, {
    exports: loaded.exports,
    require: name => name === "remotion" ? remotionMock
      : name.startsWith(".") ? loadTsx(path.resolve(path.dirname(file), `${name}.tsx`)).exports : require(name),
  });
  return loaded;
}
const promo = loadTsx(path.join(root, "remotion/SlideshowPromo.tsx")).exports.SlideshowPromo;
const renderAt = frame => {
  testFrame = frame;
  return renderToStaticMarkup(React.createElement(promo));
};

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("SlideshowPromo uses exact v6/ss sourcegeneration and ouput generation assets byte-for-byte", () => {
  const v6SourceDir = path.join(
    root,
    "design/explore-hook-motion/Media/v6/ss/sourcegeneration"
  );
  const v6OutputDir = path.join(
    root,
    "design/explore-hook-motion/Media/v6/ss/ouput generation"
  );
  const remotionSourcesDir = path.join(
    root,
    "remotion/public/explore/covers/sources"
  );

  const expectedSources = ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg"];
  const expectedOutputs = ["1.png", "1.5.png", "2.png", "3.png", "4.png", "5.png"];

  for (let i = 0; i < 6; i++) {
    const origSrc = path.join(v6SourceDir, expectedSources[i]);
    const stagedSrc = path.join(remotionSourcesDir, `slideshow-source-${i}.jpg`);
    assert.ok(fs.existsSync(stagedSrc), `slideshow-source-${i}.jpg must exist`);
    assert.equal(
      sha256File(stagedSrc),
      sha256File(origSrc),
      `slideshow-source-${i}.jpg must match v6/ss/sourcegeneration/${expectedSources[i]} byte-for-byte`
    );

    const origOut = path.join(v6OutputDir, expectedOutputs[i]);
    const stagedOut = path.join(remotionSourcesDir, `slideshow-result-${i}.png`);
    assert.ok(fs.existsSync(stagedOut), `slideshow-result-${i}.png must exist`);
    assert.equal(
      sha256File(stagedOut),
      sha256File(origOut),
      `slideshow-result-${i}.png must match v6/ss/ouput generation/${expectedOutputs[i]} byte-for-byte`
    );
  }
});

test("SlideshowPromo uses clean studio colors (zero emerald/teal green gradients) and Higgsfield 'WHAT IF' cylindrical neon-rim finale", () => {
  const srcPath = path.join(root, "remotion/SlideshowPromo.tsx");
  assert.ok(fs.existsSync(srcPath), "remotion/SlideshowPromo.tsx must exist");
  const src = fs.readFileSync(srcPath, "utf8");

  assert.match(src, /export const SLIDESHOW_PROMO_FRAMES = 210/);
  assert.match(src, /WIDE_X = \[-765, -459, -153, 153, 459, 765\]/);
  assert.match(src, /WIDE_Y = \[-24, -40, -50, -50, -40, -24\]/);
  assert.match(src, /SPLASH_DROPLETS/);
  assert.ok(src.includes('data-pushable-layer="front"') && src.includes('data-regenerate-splash'));
  assert.ok(!src.includes("loadProgress") && !src.includes("loadPct") && !src.includes("shimmerX"));
  assert.match(src, /slideshow-source-\$\{i\}\.jpg/);
  assert.match(src, /slideshow-result-\$\{i\}\.png/);
  assert.match(src, /Regenerate/);
  assert.match(src, /HERO_LETTERS = "SLIDESHOWS"\.split\(""\)/);
  assert.match(src, /targetScaleY = 0\.86 \+ 0\.52 \* u2/);
  assert.match(src, /#FF1E6E/);
  assert.match(src, /WebkitTextStroke/);

  // Must not use one-by-one spotlightIndex card hopping
  assert.ok(
    !src.includes("spotlightIndex"),
    "Must not use one-by-one spotlightIndex card hopping; all 6 cards push up and widen simultaneously"
  );

  // Must not repeat WallOfTextPromo's 3-line descending sparkle finale
  assert.ok(
    !src.includes("✦ NEW SLIDES & COPY ✦"),
    "Must not repeat WallOfTextPromo's 3-line descending sparkle subtitle"
  );

  // Must not contain any of the rejected emerald/teal/cyan green palette codes
  for (const forbidden of [
    "#10B981",
    "#34D399",
    "#059669",
    "#06B6D4",
    "#064E3B",
    "#065F46",
  ]) {
    assert.ok(
      !src.toUpperCase().includes(forbidden),
      `SlideshowPromo.tsx must not contain rejected green/teal color ${forbidden}`
    );
  }

  assert.ok(!src.includes("wotOrbitGrad"), "Must not include orbital dashed ellipse");
  assert.ok(!src.includes("FourPointStar"), "Must not include floating background stars");
  assert.ok(!src.includes("ribbons.map("), "Must not include rectangular ribbon background slabs");
});

test("UGC-VID-061: raised action presses through shadow/edge/front layers and uses a finite splash without filling", () => {
  const frontY = frame => Number(renderAt(frame).match(/data-front-y="([^"]+)"/)[1]);
  const shadowY = frame => Number(renderAt(frame).match(/data-shadow-y="([^"]+)"/)[1]);
  assert.equal(frontY(55), -10);
  assert.equal(frontY(66), -16);
  assert.equal(frontY(70), -4);
  assert.equal(frontY(74), -18);
  assert.equal(frontY(80), -10);
  assert.equal(shadowY(55), 4);
  assert.equal(shadowY(66), 8);
  assert.equal(shadowY(70), 2);
  assert.equal(shadowY(80), 4);
  for (let frame=46;frame<=110;frame++) {
    const markup=renderAt(frame);
    assert.equal((markup.match(/data-pushable-layer=/g) ?? []).length,3);
    assert.ok(!markup.includes("NaN") && !markup.includes("Infinity"));
    assert.doesNotMatch(markup, /Regenerating\s+\d+%|data-generate-progress|data-progress-fill/);
    const droplets=(markup.match(/data-splash-droplet=/g) ?? []).length;
    assert.equal(droplets,frame>=71 && frame<=81 ? 12 : 0,`bounded droplets at ${frame}`);
  }
  assert.ok(renderAt(66).includes('data-regenerate-state="hover"'));
  assert.ok(renderAt(70).includes('data-regenerate-state="pressed"'));
  assert.ok(renderAt(75).includes('data-regenerate-state="splash"'));
  assert.ok(renderAt(85).includes("Regenerating…"));
  assert.ok(renderAt(92).includes("6 Slides Ready"));
  for (const frame of [0,45,111,152,209]) assert.ok(!renderAt(frame).includes("data-regenerate-state"));
});

test("UGC-VID-061: splash finishes before result slides appear and all six original outputs are revealed", () => {
  for (let frame=0;frame<=81;frame++) {
    assert.doesNotMatch(renderAt(frame),/src="[^"]*slideshow-result-/);
  }
  const result=renderAt(112);
  assert.equal((result.match(/src="[^"]*slideshow-result-/g) ?? []).length,6);
  assert.ok(!result.includes("data-regenerate-state"));
});

test("UGC-VID-061: all 145 unaffected source/ending frames exactly match frozen v1 component output", () => {
  const fixture=JSON.parse(fs.readFileSync(path.join(root,"remotion/__fixtures__/slideshow-v1-preserved-frames.json"),"utf8"));
  assert.equal(Object.keys(fixture.hashes).length,145);
  for (const [frame,hash] of Object.entries(fixture.hashes)) {
    assert.equal(crypto.createHash("sha256").update(renderAt(Number(frame))).digest("hex"),hash,`preserved frame ${frame}`);
  }
});

test("SlideshowPromo rendered MP4, WebP poster, and 12 milestone stills exist and are non-empty", () => {
  const mp4Path = path.join(root, "public/explore/covers/slideshow-promo-v1.mp4");
  const webpPath = path.join(root, "public/explore/covers/slideshow-promo-v1.webp");
  const sheetPath = path.join(root, "output/remotion-review/slideshow-promo-contact-sheet.png");

  assert.ok(fs.existsSync(mp4Path), "slideshow-promo-v1.mp4 must exist");
  assert.ok(fs.statSync(mp4Path).size > 200_000, "slideshow-promo-v1.mp4 must be non-empty");
  assert.ok(fs.existsSync(webpPath), "slideshow-promo-v1.webp must exist");
  assert.ok(fs.statSync(webpPath).size > 10_000, "slideshow-promo-v1.webp must be non-empty");
  assert.ok(fs.existsSync(sheetPath), "slideshow-promo-contact-sheet.png must exist");
});
