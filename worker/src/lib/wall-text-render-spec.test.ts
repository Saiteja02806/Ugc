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
const fourLineContent = {
  fullText:
    "Reviewing weekly progress shows where effort actually went. The next choice feels less like a guess.",
  segments: [
    {
      lines: ["Reviewing weekly progress shows", "where effort actually went."],
      role: "lead" as const,
    },
    {
      lines: ["The next choice feels", "less like a guess."],
      role: "closing" as const,
    },
  ],
};

test("uses Inter Bold, center alignment, outline, and one consistent line rhythm", () => {
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
  assert.equal(
    (layout.segments[1]?.top ?? 0) - (layout.segments[0]?.top ?? 0),
    layout.segments[0]?.lineHeight,
  );
  assert.equal(
    (layout.segments[2]?.top ?? 0) - (layout.segments[1]?.top ?? 0),
    (layout.segments[1]?.lineHeight ?? 0) *
      (layout.segments[1]?.lines.length ?? 0),
  );
  assert.match(svg, /font-family="Inter, Arial/);
  assert.match(svg, /letter-spacing="-0\.2"/);
  assert.match(svg, /text-anchor="middle"/);
  assert.match(svg, /stroke-width="4"/);
  assert.match(svg, /fill="#67e8f9"/);
  assert.doesNotMatch(svg, /wallTextScrim|radialGradient/);
});

test("accepts four-line compact Wall blocks", () => {
  const layout = buildWallTextRenderLayout({
    content: fourLineContent,
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });
  const svg = buildWallTextOverlaySvg({
    content: fourLineContent,
    placement: "middle",
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });

  assert.equal(layout.segments[0]?.fontSize, 52);
  assert.equal(svg.match(/<text /g)?.length, 4);
});

test("renders the saved v6 final layout without reflowing its lines", () => {
  const finalLayoutContent = {
    finalLayout: {
      blocks: [
        {
          lines: [
            "A useful routine works",
            "on ordinary days too.",
            "That is what makes it repeatable.",
          ],
          role: "prose" as const,
        },
      ],
      fontFamily: "Inter" as const,
      fontSizePx: 50 as const,
      fontWeight: 700 as const,
      lineHeightPx: 54.17,
      textBox: {
        height: 480 / 1920,
        width: 640 / 1080,
        x: 220 / 1080,
        y: 660 / 1920,
      },
      version: "wall-text-final-layout-v1" as const,
    },
    fullText:
      "A useful routine works on ordinary days too. That is what makes it repeatable.",
    segments: [
      { lines: ["A useful routine works"], role: "lead" as const },
      {
        lines: ["on ordinary days too."],
        role: "support" as const,
      },
      {
        lines: ["That is what makes it repeatable."],
        role: "closing" as const,
      },
    ],
  };
  const layout = buildWallTextRenderLayout({ content: finalLayoutContent });
  const svg = buildWallTextOverlaySvg({
    content: finalLayoutContent,
    placement: "middle",
  });

  assert.equal(layout.segments[0]?.fontSize, 50);
  assert.equal(layout.segments[0]?.lineHeight, 54.17);
  assert.deepEqual(layout.segments[0]?.lines, finalLayoutContent.finalLayout.blocks[0]?.lines);
  assert.equal(layout.textBox.width, 640);
  assert.equal(svg.match(/<text /g)?.length, 3);
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
    /must contain 4–7 rendered lines/,
  );
});
