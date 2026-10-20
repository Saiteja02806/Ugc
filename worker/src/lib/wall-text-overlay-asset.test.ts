import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  packageWallTextOverlay, validateWallTextOverlayAsset, wallTextOverlayInputHash, wallTextOverlayContentHash,
} from "./wall-text-overlay-asset.js";
import { prepareWallTextOverlayAsset, type WallTextOverlayInput } from "./render-engine.js";

const textBox = { x: 150 / 1080, y: 800 / 1920, width: 780 / 1080, height: 480 / 1920 };
const lines = ["I plan the next step", "before I feel ready.", "I choose one task", "and finish it today,", "building real momentum."];
const input: WallTextOverlayInput = {
  placement: "lower-middle", textBox, textColor: "#FFFFFF",
  safeArea: { top: .1, bottom: .1, left: .1, right: .1 },
  text: {
    fullText: lines.join(" "), segments: [{ role: "lead", lines: lines.slice(0, 2) },
      { role: "closing", lines: lines.slice(2) }],
    finalLayout: {
      blocks: [{ role: "text", lines }], fontFamily: "Arial", fontSizePx: 52,
      fontWeight: 700, lineHeightPx: 57.2, textBox, version: "wall-text-final-layout-v9",
    },
  },
};

test("export content identity ignores stripped product metadata but detects actual edits", () => {
  const saved = { ...input, text: { ...input.text, kind: "wall_text", formatId: "freeform",
    layoutVersion: "wall-text-overlay-v13", sourceContent: { kind: "text", text: input.text.fullText } } };
  assert.equal(wallTextOverlayContentHash(saved), wallTextOverlayContentHash(input));
  assert.notEqual(wallTextOverlayContentHash(input), wallTextOverlayContentHash({ ...input, textColor: "#fde047" }));
  assert.notEqual(wallTextOverlayContentHash(input), wallTextOverlayContentHash({ ...input,
    text: { ...input.text, fullText: "Different copy" } }));
  assert.notEqual(wallTextOverlayContentHash(input), wallTextOverlayContentHash({ ...input,
    textBox: { ...input.textBox, y: .3 } }));
});

test("prepared text is reusable without drawing again; changed inputs reject the old asset", async () => {
  const asset = await prepareWallTextOverlayAsset(input);
  assert.strictEqual(await validateWallTextOverlayAsset(asset, asset.inputHash), asset.png);
  const repeated = await prepareWallTextOverlayAsset(input);
  assert.equal(repeated.sha256, asset.sha256);
  assert.equal(repeated.inputHash, asset.inputHash);
  const edited = await prepareWallTextOverlayAsset({ ...input, textColor: "#fde047" });
  assert.notEqual(edited.inputHash, asset.inputHash);
  assert.notEqual(edited.sha256, asset.sha256);
  await assert.rejects(validateWallTextOverlayAsset(asset, edited.inputHash), /stale/);
  const corrupted = Buffer.from(asset.png);
  corrupted[corrupted.length - 10] ^= 1;
  await assert.rejects(validateWallTextOverlayAsset({ ...asset, png: corrupted }, asset.inputHash), /integrity/);
});

test("input identity is stable across object ordering and changes with every layout edit", () => {
  assert.equal(wallTextOverlayInputHash({ a: 1, b: 2 }), wallTextOverlayInputHash({ b: 2, a: 1 }));
  for (const change of [{ text: "edited" }, { font: "other" }, { stroke: 3 }, { lines: ["new"] }]) {
    assert.notEqual(wallTextOverlayInputHash(input), wallTextOverlayInputHash({ ...input, ...change }));
  }
});

test("invalid image size, empty and opaque images fail rather than producing blank reviews", async () => {
  const hash = wallTextOverlayInputHash(input);
  for (const [width, alpha, expected] of [[100, 0, /1080/], [1080, 0, /empty/], [1080, 1, /opaque/]] as const) {
    const png = await sharp({ create: { width, height: 1920, channels: 4,
      background: { r: 255, g: 255, b: 255, alpha } } }).png().toBuffer();
    await assert.rejects(validateWallTextOverlayAsset(packageWallTextOverlay(png, hash), hash), expected);
  }
});

test("a layout outside its text fence cannot become a preview asset", async () => {
  const smallBox = { ...textBox, height: .01 };
  await assert.rejects(prepareWallTextOverlayAsset({ ...input, textBox: smallBox,
    text: { ...input.text, finalLayout: { ...input.text.finalLayout!, textBox: smallBox } },
  }));
});
