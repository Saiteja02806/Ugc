import assert from "node:assert/strict";
import test from "node:test";

import { toWallTextRenderTransportContent } from "./wall-text-render-transport.ts";
import type { TrendingWallTextContent } from "./wall-text-types.ts";

const CURRENT_V4_CONTENT = {
  finalLayout: {
    blocks: [{
      lines: [
        "I logged every meal but",
        "skipped drinks oil and small",
        "bites. Those missing details",
        "quietly changed the final",
        "total.",
      ],
      role: "text" as const,
    }],
    fontFamily: "Arial" as const,
    fontSizePx: 48 as const,
    fontWeight: 400 as const,
    lineHeightPx: 52.8,
    textBox: {
      height: 480 / 1920,
      width: 780 / 1080,
      x: 150 / 1080,
      y: 660 / 1920,
    },
    version: "wall-text-final-layout-v4" as const,
  },
  formatId: "freeform" as const,
  fullText:
    "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
  kind: "wall_text" as const,
  layoutVersion: "wall-text-overlay-v8" as const,
  pattern: "freeform" as const,
  renderSafetyVersion: "wall-text-inner-safe-v2" as const,
  renderFontSize: 48 as const,
  segments: [
    { lines: ["I logged every meal but"], role: "lead" as const },
    {
      lines: ["skipped drinks oil and small", "bites. Those missing details"],
      role: "support" as const,
    },
    {
      lines: ["quietly changed the final", "total."],
      role: "closing" as const,
    },
  ],
  sourceContent: {
    kind: "text" as const,
    text:
      "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
  },
} satisfies TrendingWallTextContent;

test("sends V4 Arial Regular through the V3-compatible rollout envelope", () => {
  const transport = toWallTextRenderTransportContent(CURRENT_V4_CONTENT);

  assert.equal(CURRENT_V4_CONTENT.finalLayout?.version, "wall-text-final-layout-v4");
  assert.equal(transport.finalLayout?.version, "wall-text-final-layout-v3");
  assert.equal(transport.finalLayout?.fontFamily, "Arial");
  assert.equal(transport.finalLayout?.fontWeight, 500);
  assert.equal(transport.layoutVersion, "wall-text-overlay-v8");
  assert.equal(transport.fullText, CURRENT_V4_CONTENT.fullText);
  assert.deepEqual(transport.finalLayout?.blocks, CURRENT_V4_CONTENT.finalLayout?.blocks);
});

test("does not rewrite a pre-V4 saved creative", () => {
  const legacy: TrendingWallTextContent = {
    ...CURRENT_V4_CONTENT,
    finalLayout: {
      ...CURRENT_V4_CONTENT.finalLayout,
      fontFamily: "Inter",
      version: "wall-text-final-layout-v2",
    },
    layoutVersion: "wall-text-overlay-v6",
  };

  assert.equal(toWallTextRenderTransportContent(legacy), legacy);
});
