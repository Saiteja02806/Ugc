import assert from "node:assert/strict";
import test from "node:test";

import type { CreateContentCard } from "./card-contract.ts";
import {
  buildCreateContentRenderOverlay,
  createCreateContentWallTextLayout,
} from "./render-contract.ts";

const baseCard: Omit<CreateContentCard, "overlay"> = {
  revision: 3,
  sourceMediaAssetId: "source-video-1",
  updatedAt: "2026-09-07T12:00:00.000Z",
  version: "create-content-card-v1",
};

test("Create Content export preserves the user's Wall position and Trending visual contract", () => {
  const overlay = buildCreateContentRenderOverlay({
    ...baseCard,
    overlay: {
      format: "wall_text",
      position: { x: 0.68, y: 0.32 },
      text: "A useful decision starts with the person doing the work every day",
    },
  });

  assert.equal(overlay.format, "wall_text");
  if (overlay.format !== "wall_text") return;
  const finalLayout = overlay.wall.content.finalLayout;
  assert.ok(finalLayout);
  if (!finalLayout) return;

  assert.equal(finalLayout.version, "wall-text-final-layout-v7");
  assert.equal(finalLayout.fontFamily, "Arial");
  assert.equal(finalLayout.fontWeight, 700);
  assert.equal(finalLayout.blocks[0]?.lines.length, 5);
  assert.deepEqual(overlay.wall.layout.safeArea, {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  });
  assert.equal(overlay.wall.layout.textBox.x, 0.2777777777777778);
  assert.equal(overlay.wall.layout.textBox.y, 0.195);
});

test("Create Content export keeps the fixed Trending Hook treatment", () => {
  const overlay = buildCreateContentRenderOverlay({
    ...baseCard,
    overlay: {
      format: "hook_text",
      position: { x: 0.5, y: 0.5 },
      text: "The simple change I wish I made earlier",
    },
  });

  assert.equal(overlay.format, "hook_text");
  if (overlay.format !== "hook_text") return;

  assert.equal(overlay.hook.fontSize, 52);
  assert.equal(overlay.hook.layoutVersion, "hook-overlay-layout-v2-fixed");
  assert.ok(overlay.hook.lines.length >= 1);
  assert.ok(overlay.hook.lines.length <= 3);
  assert.deepEqual(overlay.position, { x: 0.5, y: 0.5 });
});

test("Create Content does not queue an invalid one-word Wall-of-Text render", () => {
  assert.throws(
    () =>
      buildCreateContentRenderOverlay({
        ...baseCard,
        overlay: {
          format: "wall_text",
          position: { x: 0.5, y: 0.5 },
          text: "Hello",
        },
      }),
    /at least five readable lines/i,
  );
});

test("Create Content uses its full canvas for manually moved Wall text", () => {
  const layout = createCreateContentWallTextLayout({ x: 0.04, y: 0.96 });

  assert.equal(layout.textBox.x, 0);
  assert.equal(layout.textBox.y, 0.75);
});
