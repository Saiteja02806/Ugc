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

test("uses the restored readable Wall scale with center alignment and compact section rhythm", () => {
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
  assert.equal(layout.segments[0]?.fontWeight, 400);
  assert.equal(layout.segments[1]?.fontSize, 48);
  assert.equal(layout.segments[1]?.fontWeight, 400);
  assert.match(svg, /font-family="Inter, Arial/);
  assert.match(svg, /letter-spacing="-0\.2"/);
  assert.match(svg, /text-anchor="middle"/);
  assert.match(svg, /stroke-width="4"/);
  assert.match(svg, /fill="#67e8f9"/);
  assert.match(svg, /font-weight="400"/);
  assert.doesNotMatch(svg, /wallTextScrim|radialGradient/);
});

test("uses the widened centered 780px production text box by default", () => {
  const layout = buildWallTextRenderLayout({ content });

  assert.equal(layout.textBox.left, 150);
  assert.equal(layout.textBox.width, 780);
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
  assert.equal(layout.segments[0]?.fontWeight, 400);
  assert.equal(layout.segments[0]?.lineHeight, 55);
  assert.deepEqual(layout.segments[0]?.lines, finalLayoutContent.finalLayout.blocks[0]?.lines);
  assert.equal(layout.textBox.width, 640);
  assert.equal(svg.match(/<text /g)?.length, 3);
  assert.doesNotMatch(svg, /font-weight="700"/);
  assert.match(svg, /font-weight="400"/);
});

test("renders V7 as one centered block with equal line rhythm and a short final line", () => {
  const v7 = {
    finalLayout: {
      blocks: [{
        lines: [
          "I tracked the obvious steps",
          "but missed the quiet habits.",
          "Those small details explained",
          "why the result changed",
          "at once.",
        ],
        role: "text" as const,
      }],
      fontFamily: "Inter" as const,
      fontSizePx: 48 as const,
      fontWeight: 600 as const,
      lineHeightPx: 52,
      textBox: {
        height: 480 / 1920,
        width: 660 / 1080,
        x: 210 / 1080,
        y: 660 / 1920,
      },
      version: "wall-text-final-layout-v2" as const,
    },
    fullText:
      "I tracked the obvious steps but missed the quiet habits. Those small details explained why the result changed at once.",
    segments: [
      { lines: ["I tracked the obvious steps"], role: "lead" as const },
      {
        lines: ["but missed the quiet habits.", "Those small details explained"],
        role: "support" as const,
      },
      {
        lines: ["why the result changed", "at once."],
        role: "closing" as const,
      },
    ],
  };
  const layout = buildWallTextRenderLayout({ content: v7 });
  const svg = buildWallTextOverlaySvg({ content: v7, placement: "middle" });
  assert.equal(layout.segments.length, 1);
  assert.equal(layout.segments[0]?.lineHeight, 52.8);
  assert.equal(layout.textBox.width, 660);
  assert.equal(svg.match(/text-anchor="middle"/g)?.length, 5);
  assert.match(svg, />at once\.<\/text>/);
});

test("never truncates and rejects more than eight semantic lines", () => {
  assert.throws(
    () =>
      buildWallTextRenderLayout({
        content: {
          fullText:
            "One two three four five six seven eight nine ten eleven twelve more words closing words final row.",
          segments: [
            {
              lines: ["One two", "three four", "five six"],
              role: "lead",
            },
            {
              lines: ["seven eight", "nine ten", "eleven twelve"],
              role: "support",
            },
            {
              lines: ["more words", "closing words", "final row."],
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
    /must contain 4–8 rendered lines/,
  );
});
