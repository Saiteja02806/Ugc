import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWallTextOverlaySvg,
  buildWallTextRenderLayout,
} from "./wall-text-render-spec.js";

const content = {
  fullText:
    "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
  segments: [
    {
      lines: ["I logged every meal"],
      role: "lead" as const,
    },
    {
      lines: ["but skipped drinks", "oil and small bites."],
      role: "support" as const,
    },
    {
      lines: ["Those missing details", "quietly changed", "the final total."],
      role: "closing" as const,
    },
  ],
};

test("uses Inter Bold, center alignment, outline, and compact section rhythm", () => {
  const layout = buildWallTextRenderLayout({
    content,
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });
  const svg = buildWallTextOverlaySvg({
    content,
    placement: "middle",
    textColor: "#67e8f9",
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });

  assert.equal(layout.segments[0]?.fontSize, 48);
  assert.equal(layout.segments[0]?.fontWeight, 700);
  assert.equal(layout.segments[1]?.fontSize, 48);
  assert.equal(layout.segments[1]?.fontWeight, 700);
  assert.match(svg, /font-family="Inter, Arial/);
  assert.match(svg, /letter-spacing="-0\.2"/);
  assert.match(svg, /text-anchor="middle"/);
  assert.match(svg, /stroke-width="4"/);
  assert.match(svg, /fill="#67e8f9"/);
  assert.doesNotMatch(svg, /wallTextScrim|radialGradient/);
});

test("never truncates and rejects more than seven semantic lines", () => {
  assert.throws(
    () =>
      buildWallTextRenderLayout({
        content: {
          fullText:
            "One two three four five six seven eight nine ten eleven twelve more words closing words.",
          segments: [
            {
              lines: ["One two", "three four", "five six", "seven eight"],
              role: "lead",
            },
            {
              lines: ["nine ten", "eleven twelve", "more words", "closing words"],
              role: "closing",
            },
          ],
        },
        textBox: {
          height: 480 / 1920,
          width: 620 / 1080,
          x: 230 / 1080,
          y: 660 / 1920,
        },
      }),
    /must contain 5–7 rendered lines/,
  );
});
