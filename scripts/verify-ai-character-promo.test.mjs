import {ensureCharacterCatalogCache,catalogCacheRoot} from './character-catalog-test-cache.mjs';
await ensureCharacterCatalogCache();
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as remotion from "remotion";
import { createHash } from "node:crypto";

const root = process.cwd();
const require = createRequire(import.meta.url);
let testFrame = 0;
const remotionMock = {
    ...remotion,
    useCurrentFrame: () => testFrame,
    useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 450 }),
    staticFile: (name) => `/${name}`,
    AbsoluteFill: (props) => React.createElement("div", props),
    Img: (props) => React.createElement("img", props),
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
    require: (name) => name === "remotion" ? remotionMock
      : name.startsWith(".") ? loadTsx(path.resolve(path.dirname(file), `${name}.tsx`)).exports : require(name),
  });
  return loaded;
}
const promoModule = loadTsx(path.join(root, "remotion/AICharacterPromo.tsx"));
const renderAt = (frame) => {
  testFrame = frame;
  return renderToStaticMarkup(React.createElement(promoModule.exports.AICharacterPromo));
};
const traitOptions = (markup) => [...markup.matchAll(
  /<div\b[^>]*data-trait-beat="([^"]+)"[^>]*data-trait-option="(-?\d+)"[^>]*data-selected="(true|false)"[^>]*>/g
)];

test("AICharacterPromo strictly excludes all 4 forbidden old creator images", () => {
  const promoSource = fs.readFileSync(
    path.join(root, "remotion/AICharacterPromo.tsx"),
    "utf8"
  );
  const renderScriptSource = fs.readFileSync(
    path.join(root, "scripts/render-ai-character-promo.mjs"),
    "utf8"
  );

  const forbiddenAssets = [
    "creator-office-v2.webp",
    "creator-bedroom.webp",
    "creator-selfie.webp",
    "creator-window.webp",
  ];

  for (const forbidden of forbiddenAssets) {
    assert.ok(
      !promoSource.includes(forbidden),
      `remotion/AICharacterPromo.tsx must NEVER reference ${forbidden}`
    );
    assert.ok(
      !renderScriptSource.includes(forbidden),
      `scripts/render-ai-character-promo.mjs must NEVER reference ${forbidden}`
    );
  }
});

test("AICharacterPromo uses authentic Influencer Studio trait assets and exact final outcome image", () => {
  const expectedOutcomeSource = path.join(
    root,
    "design/explore-hook-motion/Media/v6/aichar/ChatGPT Image Nov 2, 2026, 11_48_01 PM.png"
  );
  const stagedOutcomeRemotion = path.join(
    root,
    "remotion/public/explore/covers/sources/aichar/aichar-final-outcome.png"
  );
  const stagedOutcomePublic = path.join(
    root,
    "public/explore/covers/sources/aichar/aichar-final-outcome.png"
  );

  assert.ok(fs.existsSync(expectedOutcomeSource), "Original v6/aichar outcome image must exist");
  assert.ok(fs.existsSync(stagedOutcomeRemotion), "Remotion staged outcome image must exist");
  assert.ok(fs.existsSync(stagedOutcomePublic), "Public staged outcome image must exist");

  const origBuf = fs.readFileSync(expectedOutcomeSource);
  const remotionBuf = fs.readFileSync(stagedOutcomeRemotion);
  const publicBuf = fs.readFileSync(stagedOutcomePublic);

  assert.equal(
    Buffer.compare(origBuf, remotionBuf),
    0,
    "Remotion staged aichar-final-outcome.png must match ChatGPT Image Nov 2, 2026, 11_48_01 PM.png byte-for-byte"
  );
  assert.equal(
    Buffer.compare(origBuf, publicBuf),
    0,
    "Public staged aichar-final-outcome.png must match ChatGPT Image Nov 2, 2026, 11_48_01 PM.png byte-for-byte"
  );

  // Walk public/explore/influencer-studio and verify all 36 staged trait assets match an authentic studio image byte-for-byte
  const studioRoot = path.join(catalogCacheRoot, "explore/influencer-studio");
  const studioBuffers = [];
  function collectStudioFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectStudioFiles(full);
      } else if (entry.isFile()) {
        studioBuffers.push({ rel: path.relative(root, full), buf: fs.readFileSync(full) });
      }
    }
  }
  collectStudioFiles(studioRoot);

  const stagedDir = path.join(root, "remotion/public/explore/covers/sources/aichar");
  const stagedFiles = fs.readdirSync(stagedDir).filter((f) => f !== "aichar-final-outcome.png");
  assert.ok(stagedFiles.length >= 30, `Expected >= 30 staged trait images, found ${stagedFiles.length}`);

  for (const stagedFile of stagedFiles) {
    const stagedFull = path.join(stagedDir, stagedFile);
    const stagedBuf = fs.readFileSync(stagedFull);
    const match = studioBuffers.find((s) => Buffer.compare(s.buf, stagedBuf) === 0);
    assert.ok(
      match,
      `Staged trait asset ${stagedFile} must match an authentic image in public/explore/influencer-studio/ byte-for-byte`
    );
  }
});

test("AICharacterPromo implements all 6 step-by-step trait selection stages, Generate click, and distinct Editorial Serif finale", () => {
  const promoSource = fs.readFileSync(
    path.join(root, "remotion/AICharacterPromo.tsx"),
    "utf8"
  );

  // Verify 450 frames (15.0s @ 30fps)
  assert.ok(
    promoSource.includes("export const AI_CHARACTER_PROMO_FRAMES = 450;"),
    "Must be 450 frames (15.0s @ 30fps)"
  );

  // Verify all 6 steps and key selections are present
  const requiredSelections = [
    "Extreme",
    "Studio Wall",
    "Male",
    "Adult (25)",
    "Middle Eastern",
    "Light Olive",
    "Chiseled",
    "Round",
    "Deep Espresso",
    "Voluminous Curls",
    "Jet Black",
    "Platinum Ash",
    "Crew Tee & Denim",
    "#111111",
    "Half Portrait",
    "4K PORTRAIT",
  ];

  for (const label of requiredSelections) {
    assert.ok(
      promoSource.includes(label),
      `AICharacterPromo must include step option/label: ${label}`
    );
  }

  // Verify pure black, flashy typography, and persistent 3D cursor with independent stage accents.
  assert.ok(
    promoSource.includes('backgroundColor: "#000000"'),
    "Must use pure #000000 black background"
  );
  assert.ok(
    promoSource.includes("getStageTiltProgress") &&
      promoSource.includes("Interactive3DCursorActor"),
    "Must retain the sculpted cursor and independent stage-tilt choreography"
  );
  assert.ok(
    promoSource.includes("ZERO PHOTOSHOOTS • 100% STUDIO") &&
      promoSource.includes("AI INFLUENCER"),
    "Must retain the influencer headline meaning and supporting studio message"
  );
});

test("UGC-VID-045 retained contracts: no full configurator, no click ripples, sculpted cursor and larger finale type", () => {
  const promoSource = fs.readFileSync(
    path.join(root, "remotion/AICharacterPromo.tsx"),
    "utf8"
  );

  // The current request supersedes selected-only direction with exactly three choices.
  assert.ok(!promoSource.includes("LeftStepConfigurator"), "Option-grid configurator must be removed");

  // No ripple / target rings around the cursor
  for (const banned of ["rippleRadius", "rippleOpacity", "dashed"]) {
    assert.ok(!promoSource.includes(banned), `Cursor must not draw ring effects (${banned})`);
  }

  // Sculpted 3D cursor: real extrusion + glossy face + specular rim
  assert.ok(promoSource.includes("aicharCursorFace") && promoSource.includes("aicharCursorRim"));

  // New reference-based typography supersedes the old font sizes/outline.
  const finale = renderAt(430);
  assert.equal((finale.match(/data-finale-row=/g) ?? []).length, 3);
  assert.ok(finale.includes('data-finale-title="BUILD YOUR OWN AI INFLUENCER"'));
  assert.ok(finale.includes("AI Character Anton") && !finale.includes("-webkit-text-stroke"));
  assert.ok(!promoSource.includes("rotate(-2.2deg) skewX(-6deg) scale("), "Old tilted finale line must be gone");
});

test("Continuous flow retains three choices, balanced picks, original traits and camera-synchronized cursor hits", () => {
  const beats = [
    ["type", 0, 30, 56, "char-extreme.png", ["char-average.png", "char-bold.png"], 0],
    ["scene", 56, 76, 104, "bg-normal-wall.png", ["bg-workspace.png", "bg-cream-room.png"], 1],
    ["heritage", 104, 124, 152, "eth-middle-eastern.png", ["eth-east-asian.png", "eth-latina.png"], -1],
    ["face", 152, 170, 200, "head-chiseled.png", ["head-oval.png", "head-square.png"], 1],
    ["hair", 200, 222, 254, "hair-voluminous-curls.png", ["hair-bob.png", "hair-textured-crop.png"], 0],
    ["outfit", 254, 272, 300, "outfit-white-tee.png", ["outfit-streetwear.png", "outfit-leather-jacket.png"], -1],
  ];
  const slotCounts = { "-1": 0, "0": 0, "1": 0 };
  for (const [id, start, click, end, chosen, alternatives, slot] of beats) {
    const before = renderAt(click - 3);
    assert.ok(before.includes('data-selection-flow="full"'));
    assert.ok(before.includes(`data-active-group="${id}"`));
    const options = traitOptions(before).filter((m) => m[1] === id);
    assert.equal(options.length, 3, `${id}: exactly three options before click`);
    assert.ok(options.every((m) => m[1] === id && m[3] === "false"));
    assert.deepEqual(options.map((m) => Number(m[2])), [-1, 0, 1]);
    slotCounts[slot]++;
    const chosenBefore = options.find((m) => Number(m[2]) === slot);
    const chosenImage = before.slice(chosenBefore.index).match(/<img\b[^>]*src="([^"]+)"/)[1];
    assert.ok(chosenImage.endsWith(`/aichar/${chosen}`), `${id}: original trait in the intended slot`);
    const clickMarkup = renderAt(click);
    const cursorX = Number(clickMarkup.match(/data-cursor-x="([^"]+)"/)[1]);
    const expectedX = (24 + (slot + 1) * 262 + 248 * 0.52 - 410) * 1.5 + 140;
    assert.ok(Math.abs(cursorX - expectedX) < 0.01, `${id}: pointer matches the camera-transformed tile`);
    assert.equal(Number(clickMarkup.match(/data-cursor-y="([^"]+)"/)[1]), 24.5);
    const gi = beats.findIndex((b) => b[0] === id);
    assert.equal(Number(clickMarkup.match(/data-camera-focus="([^"]+)"/)[1]), 197 + gi * 416);
    for (const asset of [chosen, ...alternatives]) {
      assert.ok(before.includes(`/aichar/${asset}`), `${id}: ${asset} is visible before click`);
      assert.ok(fs.existsSync(path.join(root, "remotion/public/explore/covers/sources/aichar", asset)));
    }
    for (const frame of [click, click + 4, click + 8, end - 1]) {
      const markup = renderAt(frame);
      const selected = traitOptions(markup).filter((m) => m[1] === id && m[3] === "true");
      assert.equal(selected.length, 1, `${id} at ${frame}: one selected card`);
      assert.equal(Number(selected[0][2]), slot);
      assert.equal(traitOptions(markup).filter((m) => m[1] === id).length, 3, `${id}: group remains continuous`);
    }
    assert.equal(traitOptions(renderAt(start + 10)).filter((m) => m[1] === id).length, 3);
    assert.ok(renderAt(end).includes(chosen), `${id}: original choice persists in the recipe`);
    if (end < 300) assert.ok(renderAt(end).includes(`data-active-group="${beats[gi + 1][0]}"`));
  }
  assert.deepEqual(slotCounts, { "-1": 2, "0": 2, "1": 2 });
  assert.equal(traitOptions(renderAt(312)).length, 0);
});

test("UGC-VID-056: black sculpted 3D cursor persists through every visible travel and selection frame", () => {
  for (let frame = 7; frame < 350; frame++) {
    const markup = renderAt(frame);
    assert.ok(markup.includes('data-cursor-style="black-3d"'), `frame ${frame}: persistent 3D cursor`);
    assert.match(markup, /fill="url\(#(?:aichar|study)CursorFace\)"/, `frame ${frame}: glossy black face`);
    assert.match(markup, /stroke="url\(#(?:aichar|study)CursorRim\)"/, `frame ${frame}: sculpted rim`);
    assert.doesNotMatch(markup, /fill="#FFFFFF" stroke="#000000" stroke-width="1.6"/);
  }
  for (const frame of [0, 4, 350, 430]) assert.ok(!renderAt(frame).includes("data-cursor-style"));
});

test("Full selection preserves secondary values, all six picked traits and a continuous cursor handoff", () => {
  for (const [id, at] of [["scene",84],["heritage",132],["face",178],["hair",232],["outfit",280]]) {
    assert.ok(!renderAt(at - 1).includes(`data-selection-detail="${id}"`));
    assert.ok(renderAt(at).includes(`data-selection-detail="${id}"`));
  }
  assert.equal((renderAt(280).match(/data-picked-trait=/g) ?? []).length, 6);
  const coordinate = (frame, axis) => Number(renderAt(frame).match(new RegExp(`data-cursor-${axis}="([^"]+)"`))[1]);
  assert.ok(Math.abs(coordinate(299,"x") - coordinate(300,"x")) < 1);
  assert.ok(Math.abs(coordinate(299,"y") - coordinate(300,"y")) < 1);
  assert.ok(!renderAt(300).includes("data-selection-flow"));
});

test("UGC-VID-057: Picked chips and recipe pills never overlap during the ending handoff", () => {
  for (let frame=284;frame<300;frame++) {
    const markup=renderAt(frame);
    const picked=Number(markup.match(/data-picked-summary-opacity="([^"]+)"/)[1]);
    const recipe=Number(markup.match(/data-recipe-handoff-opacity="([^"]+)"/)?.[1] ?? 0);
    assert.equal(picked * recipe,0,`frame ${frame}: only one summary text treatment`);
  }
});

test("UGC-VID-059: every selection frame 0-299 matches frozen v4 while Generate/title may change", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(root,"remotion/__fixtures__/ai-character-v4-selection.json"),"utf8"));
  assert.equal(Object.keys(baseline.hashes).length,300);
  for (let frame=0;frame<300;frame++) {
    assert.equal(createHash("sha256").update(renderAt(frame)).digest("hex"),baseline.hashes[frame],`selection frame ${frame}`);
  }
});

test("The original isolated study still has two picks and its next-group preview", () => {
  const study = loadTsx(path.join(root,"remotion/AICharacterSelectionStudy.tsx")).exports.AICharacterSelectionStudy;
  testFrame=70;
  const markup=renderToStaticMarkup(React.createElement(study));
  assert.ok(markup.includes('data-selection-flow="study"'));
  assert.equal(traitOptions(markup).filter((m)=>m[3]==="true").length,2);
  assert.equal(traitOptions(markup).filter((m)=>m[1]==="heritage").length,3);
});

test("UGC-VID-055: Generate has legible separate progress, a finite click shake, and the finale has no model label", () => {
  const ready = renderAt(318);
  assert.ok(ready.includes('data-generate-state="ready"'));
  assert.ok(ready.includes("GENERATE") && ready.includes("4K PORTRAIT"));
  assert.ok(!ready.includes("data-generate-progress"));
  const shakeAt = (frame) => Number(renderAt(frame).match(/data-shake-x="([^"]+)"/)[1]);
  assert.equal(shakeAt(321), 0);
  const shakes = Array.from({ length: 11 }, (_, i) => shakeAt(323 + i));
  assert.ok(shakes.some((x) => x > 1) && shakes.some((x) => x < -1));
  assert.ok(shakes.every((x) => Math.abs(x) <= 8));
  assert.equal(shakeAt(334), 0);
  assert.equal(shakeAt(344), 0);
  let lastProgress = 0;
  for (let frame = 322; frame <= 344; frame++) {
    const markup = renderAt(frame);
    assert.ok(markup.includes('data-generate-state="loading"'));
    const progress = Number(markup.match(/data-generate-progress="(\d+)"/)[1]);
    assert.ok(progress >= lastProgress && progress <= 100);
    lastProgress = progress;
    assert.match(markup, /data-generate-progress="\d+"[^>]*height:6px/);
  }
  assert.equal(lastProgress, 100);
  for (const frame of [352, 372, 430, 449]) {
    const finale = renderAt(frame);
    assert.doesNotMatch(finale, /gemini|data-generate-state|data-trait-beat/i);
    assert.ok(finale.includes("BUILD YOUR") && finale.includes("AI INFLUENCER"));
    assert.ok(finale.includes("aichar-final-outcome.png"));
  }
});

test("UGC-VID-059: circular Generate action has a finite tactile press, one pixel burst and correct pointer target", () => {
  const idle = renderAt(310);
  assert.ok(idle.includes('data-generate-feedback="ready"'));
  assert.ok(idle.includes('data-generate-action="spark"') && idle.includes("#131519"));
  const hover = renderAt(318);
  assert.ok(hover.includes('data-generate-feedback="hover"'));
  assert.ok(hover.includes("rgba(255,230,0,0.66)"));
  assert.ok(renderAt(325).includes('data-generate-feedback="press"'));
  const scaleAt = (frame) => Number(renderAt(frame).match(/data-press-scale="([^"]+)"/)[1]);
  assert.equal(scaleAt(322), 1);
  assert.equal(scaleAt(325), 0.82);
  assert.equal(scaleAt(330), 1.13);
  assert.equal(scaleAt(336), 1);
  for (let frame=304;frame<352;frame++) {
    const count=(renderAt(frame).match(/data-generate-pixel=/g) ?? []).length;
    assert.equal(count,frame>=325 && frame<339 ? 28 : 0,`burst has a single bounded window at ${frame}`);
  }
  const click=renderAt(322);
  assert.equal(Number(click.match(/data-cursor-x="([^"]+)"/)[1]),269);
  assert.equal(Number(click.match(/data-cursor-y="([^"]+)"/)[1]),0);
  const loading = renderAt(340);
  assert.ok(loading.includes('data-generate-feedback="loading"') && loading.includes("GENERATING"));
});

test("UGC-VID-059: condensed title folds once, remains fully labelled and settles to unwarped glyphs", () => {
  for (let frame=352;frame<450;frame++) {
    const markup=renderAt(frame);
    assert.ok(markup.includes('data-finale-title="BUILD YOUR OWN AI INFLUENCER"'));
    const glyphs=[...markup.matchAll(/data-title-glyph="([^"]+)" style="([^"]+)"/g)];
    assert.equal(glyphs.length,26);
    assert.ok(!markup.includes("NaN") && !markup.includes("Infinity"));
    if(frame>=398) {
      assert.ok(markup.includes('data-title-settled="true"'));
      assert.ok(glyphs.every(m=>m[2].includes("transform:none")),`settled glyphs at ${frame}`);
    } else assert.ok(markup.includes('data-title-settled="false"'));
  }
  assert.ok(fs.existsSync(path.join(root,"remotion/public/fonts/anton-latin-400-normal.woff2")));
});

test("AICharacterPromo rendered MP4, WebP, contact sheet, and 12 milestone stills exist", () => {
  const mp4Cover = path.join(root, "public/explore/covers/ai-character-promo-v1.mp4");
  const webpCover = path.join(root, "public/explore/covers/ai-character-promo-v1.webp");
  const liveMp4 = path.join(root, "public/explore/characters/ai-character-create-yours-v5.mp4");
  const liveWebp = path.join(root, "public/explore/characters/ai-character-create-yours-v5.webp");
  const contactSheet = path.join(root, "output/remotion-review/ai-character-promo-contact-sheet.png");

  for (const p of [mp4Cover, webpCover, liveMp4, liveWebp, contactSheet]) {
    assert.ok(fs.existsSync(p), `Expected rendered output ${p} to exist`);
    assert.ok(fs.statSync(p).size > 10_000, `Expected ${p} to be non-empty (>10KB)`);
  }

  const expectedStills = [
    "aichar-034-type-extreme-3d-pick.png",
    "aichar-050-type-docks-to-stack.png",
    "aichar-090-scene-studio-wall-male25.png",
    "aichar-138-heritage-middle-eastern-olive.png",
    "aichar-186-face-chiseled-round-eyes.png",
    "aichar-226-hair-curls-3d-pick.png",
    "aichar-242-hair-black-platinum.png",
    "aichar-286-outfit-crew-tee-black-half.png",
    "aichar-312-generate-traits-orbit.png",
    "aichar-330-generate-3d-click.png",
    "aichar-372-finale-reveal.png",
    "aichar-430-finale-hold.png",
  ];

  for (const still of expectedStills) {
    const stillPath = path.join(root, "output/remotion-review", still);
    assert.ok(fs.existsSync(stillPath), `Expected milestone still ${still} to exist`);
    assert.ok(fs.statSync(stillPath).size > 15_000, `Expected ${still} to be non-empty`);
  }
});
