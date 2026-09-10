import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getWallTextProportionalPreviewDimension,
  getWallTextReviewCardCappedDimension,
  WALL_TEXT_RENDER_CANVAS_WIDTH,
  WALL_TEXT_REVIEW_CARD_REFERENCE_WIDTH,
} from "./wall-text-visual-style.ts";

const editorSource = readFileSync(
  new URL("../../components/trending/trending-creative-editor.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../components/trending/trending-workspace.tsx", import.meta.url),
  "utf8",
);

test("caps the approved B review treatment at its 277px reference card", () => {
  assert.equal(WALL_TEXT_RENDER_CANVAS_WIDTH, 1080);
  assert.equal(WALL_TEXT_REVIEW_CARD_REFERENCE_WIDTH, 277);
  assert.equal(
    getWallTextProportionalPreviewDimension(52),
    "4.814814814814815cqw",
  );
  assert.equal(
    getWallTextReviewCardCappedDimension(52),
    "min(13.337037px, 4.814814814814815cqw)",
  );
  assert.equal(
    getWallTextReviewCardCappedDimension(4),
    "min(1.025926px, 0.37037037037037035cqw)",
  );
  assert.equal(
    getWallTextReviewCardCappedDimension(15),
    "min(3.847222px, 1.3888888888888888cqw)",
  );
  assert.equal(
    getWallTextReviewCardCappedDimension(57.2),
    "min(14.670741px, 5.296296296296296cqw)",
  );
});

test("caps negative historical tracking without changing its direction", () => {
  assert.equal(
    getWallTextReviewCardCappedDimension(-0.2),
    "max(-0.051296px, -0.018518518518518517cqw)",
  );
  assert.equal(getWallTextReviewCardCappedDimension(0), "0px");
});

test("uses the approved capped B treatment in the Wall editor preview", () => {
  const editorWallTextOverlay =
    editorSource.match(/function WallTextOverlayText[\s\S]+?function StaticCreativeTextOverlay/)?.[0] ??
    "";

  assert.match(editorWallTextOverlay, /getWallTextReviewCardCappedDimension/);
  assert.match(editorWallTextOverlay, /getWallTextLetterSpacing/);
  assert.match(editorWallTextOverlay, /fontSize: previewDimension\(typography\.fontSize\)/);
  assert.match(
    editorWallTextOverlay,
    /WebkitTextStroke: `\$\{previewDimension\(typography\.outlineWidth\)\} #000`/,
  );
  assert.doesNotMatch(editorWallTextOverlay, /typography\.fontSize \/ 10\.8/);
  assert.doesNotMatch(editorWallTextOverlay, /-0\.2 \/ 10\.8/);
});

test("uses the 277px B reference frame for Wall review cards when space allows", () => {
  assert.match(
    workspaceSource,
    /WALL_TEXT_REVIEW_CARD_WIDTH_CLASS\s*=\s*\n\s*"w-\[min\(76vw,277px,calc\(\(100dvh-348px\)\*0\.5625\)\)\] min-\[1024px\]:w-\[min\(277px,calc\(\(100dvh-252px\)\*0\.5625\)\)\]"/,
  );

  const wallDeckCard =
    workspaceSource.match(/function TrendingWallTextDeckCard[\s\S]+?function TrendingReactionDeckCard/)?.[0] ??
    "";

  assert.match(wallDeckCard, /WALL_TEXT_REVIEW_CARD_FRAME_CLASS/);
  assert.match(wallDeckCard, /scaleMode="review-card-capped"/);
});
