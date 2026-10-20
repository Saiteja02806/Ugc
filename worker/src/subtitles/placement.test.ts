import assert from "node:assert/strict";
import test from "node:test";
import { getSubtitleLayout, groupSubtitleWords, serializeAss } from "./captions.js";
import { planEditorialPages, serializeEditorialAss } from "./editorial.js";
import { parsePlacement, subtitlePlacementGeometry, type SubtitleCue } from "./contracts.js";

const cue: SubtitleCue = { startMs: 100, endMs: 1000, lines: [[0, 1, 2]], words: [
  { text: "Make", startMs: 100, endMs: 300 }, { text: "it", startMs: 310, endMs: 450 }, { text: "simple.", startMs: 500, endMs: 1000 },
] };

test("placement parser defaults only omission to Bottom and rejects unsupported inputs", () => {
  assert.equal(parsePlacement(undefined), "bottom");
  for (const value of ["bottom", "middle", "top"]) assert.equal(parsePlacement(value), value);
  for (const value of [null, "center", "TOP", 0, {}]) assert.throws(() => parsePlacement(value), /bottom, middle, or top/);
});

test("all styles use the selected safe region without changing speech timings or wrapping", async () => {
  for (const [width, height] of [[720, 1280], [1280, 720], [720, 720], [256, 384]]) {
    for (const placement of ["bottom", "middle", "top"] as const) {
      const geometry = subtitlePlacementGeometry(placement);
      for (const style of ["clean", "bold-box", "active-word", "editorial"] as const) {
        const layout = getSubtitleLayout(width, height, style);
        if (style === "editorial") {
          const pages = await planEditorialPages([cue], layout, placement,
            async (text, size) => ({ left: -2, top: 3, width: text.length * size * .45, height: size * .7 }));
          for (const b of pages[0].blocks) {
            assert.ok(b.x + b.ink.left >= width * .1 - 1);
            assert.ok(b.x + b.ink.left + b.ink.width <= width * .9 + 1);
            assert.ok(b.y + b.ink.top >= height * geometry.editorialTop);
            assert.ok(b.y + b.ink.top + b.ink.height <= height * geometry.editorialBottom);
          }
          assert.equal(pages[0].cue, cue);
          assert.doesNotMatch(serializeEditorialAss(pages, layout), /NaN|Infinity/);
        } else {
          const cues = await groupSubtitleWords(cue.words, layout, async text => text.length * layout.fontSize * .55);
          assert.equal(cues[0].startMs, cue.startMs); assert.equal(cues[0].endMs, cue.endMs);
          const ass = serializeAss(cues, layout, style, placement);
          assert.ok(ass.includes(`\\pos(${Math.round(width / 2)},${Math.round(height * geometry.anchor)})`));
          assert.doesNotMatch(ass, /NaN|Infinity/);
          assert.ok(height * geometry.anchor - layout.fontSize * 1.5 > 0);
          assert.ok(height * geometry.anchor + layout.fontSize * 1.5 < height);
        }
      }
    }
  }
});
