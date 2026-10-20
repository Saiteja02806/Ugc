import assert from "node:assert/strict";
import test from "node:test";
import { getSubtitleLayout } from "./captions.js";
import { parseStyle, type SubtitleCue } from "./contracts.js";
import { planEditorialPages, serializeEditorialAss, selectEditorialKeyword } from "./editorial.js";

const cue: SubtitleCue = { startMs: 100, endMs: 1000, lines: [[0, 1, 2]], words: [
  { text: "Make", startMs: 100, endMs: 300 }, { text: "it", startMs: 310, endMs: 450 }, { text: "simple.", startMs: 500, endMs: 1000 },
] };
const measure = async (text: string, size: number) => ({ left: -2, top: 3, width: text.length * size * .45, height: size * .7 });

test("Editorial is a supported style with predictable typography, not invented speech timings", async () => {
  assert.equal(parseStyle("editorial"), "editorial"); assert.equal(selectEditorialKeyword(cue), 2);
  for (const [width, height] of [[720, 1280], [1280, 720], [256, 384]]) {
    const layout = getSubtitleLayout(width, height, "editorial"), pages = await planEditorialPages([cue], layout, "bottom", measure);
    const page = pages[0]; assert.equal(page.cue, cue);
    assert.deepEqual(page.blocks.flatMap(b => b.indices).sort(), [0, 1, 2]);
    for (const block of page.blocks) {
      assert.ok(block.x + block.ink.left >= width * .1 - 1);
      assert.ok(block.x + block.ink.left + block.ink.width <= width * .9 + 1);
      assert.ok(block.y + block.ink.top >= height * .64);
      assert.ok(block.y + block.ink.top + block.ink.height <= height * .88);
    }
    const ass = serializeEditorialAss(pages, layout);
    assert.match(ass, /UGCPilot Editorial Study/); assert.match(ass, /\\b900\\i1/); assert.match(ass, /Make/); assert.match(ass, /simple/);
    assert.doesNotMatch(ass, /NaN|Infinity/);
  }
});

test("Editorial fails closed on unsupported layout and escapes transcript commands", async () => {
  const layout = getSubtitleLayout(720, 1280, "editorial");
  await assert.rejects(planEditorialPages([cue], layout, "bottom", async () => ({ left: 0, top: 0, width: 2000, height: 500 })), /cannot fit/);
  const hostile = { ...cue, words: [{ text: "{\\pos(0,0)}", startMs: 100, endMs: 200 }], endMs: 200 };
  const pages = await planEditorialPages([hostile], layout, "bottom", measure), ass = serializeEditorialAss(pages, layout);
  assert.doesNotMatch(ass, /\{\\pos\(0,0\)\}/); assert.match(ass, /\(\/pos\(0,0\)\)/);
});

test("overlapping timed words cannot produce a zero-length animation or invalid ASS numbers", async () => {
  const overlap = { ...cue, endMs: 450 };
  const layout = getSubtitleLayout(720, 1280, "editorial"), pages = await planEditorialPages([overlap], layout, "bottom", measure);
  assert.doesNotMatch(serializeEditorialAss(pages, layout), /NaN|Infinity/);
});
