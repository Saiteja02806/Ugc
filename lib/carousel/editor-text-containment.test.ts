import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clampCarouselOverlayPosition, getCarouselOverlayContainment, type CarouselOverlayGeometry } from "./editor-text-containment.ts";

const geometry: CarouselOverlayGeometry = {
  frameWidth: 300, frameHeight: 375,
  left: 110, right: 110, top: 90, bottom: 90,
};

test("the full text block stays within every edge in both structures and sizes", () => {
  for (const structure of ["structure_1", "structure_2"] as const) {
    for (const format of ["1:1", "4:5"] as const) {
      const measured = { ...geometry, frameHeight: format === "1:1" ? 300 : 375 };
      const { bounds, fits } = getCarouselOverlayContainment(measured, structure, format);
      assert.equal(fits, true);
      for (const point of [{ x: -10, y: -10 }, { x: 10, y: 10 }]) {
        const actual = clampCarouselOverlayPosition(point, bounds);
        assert.ok(actual.x * measured.frameWidth - measured.left > 0);
        assert.ok(actual.x * measured.frameWidth + measured.right < measured.frameWidth);
        assert.ok(actual.y * measured.frameHeight - measured.top > 0);
        assert.ok(actual.y * measured.frameHeight + measured.bottom < measured.frameHeight);
      }
    }
  }
});

test("Structure 2 preserves the horizontal lock and accounts for the whole vertical group", () => {
  const { bounds, fits } = getCarouselOverlayContainment(geometry, "structure_2", "4:5", { minX: 0.5, maxX: 0.5, minY: 0.12, maxY: 0.88 });
  assert.equal(fits, true);
  assert.deepEqual(clampCarouselOverlayPosition({ x: 0.9, y: 0.95 }, bounds), { x: 0.5, y: bounds.maxY });
  assert.ok(bounds.minY > 0.12);
  assert.ok(bounds.maxY < 0.88);
});

test("responsive resizes preserve proportional bounds and asymmetric pill extents", () => {
  const first = getCarouselOverlayContainment({ ...geometry, left: 105, right: 115 }, "structure_1", "4:5");
  const second = getCarouselOverlayContainment({ frameWidth: 150, frameHeight: 187.5, left: 52.5, right: 57.5, top: 45, bottom: 45 }, "structure_1", "4:5");
  assert.deepEqual(first, second);
  assert.ok(first.bounds.minX < 1 - first.bounds.maxX);
});

test("larger edited text tightens the limits without changing its font or copy", () => {
  const small = getCarouselOverlayContainment(geometry, "structure_1", "4:5");
  const large = getCarouselOverlayContainment({ ...geometry, top: 120, bottom: 120 }, "structure_1", "4:5");
  assert.equal(large.fits, true);
  assert.ok(large.bounds.minY > small.bounds.minY);
  assert.ok(large.bounds.maxY < small.bounds.maxY);
});

test("oversized and invalid geometry is rejected rather than inverted or shrunk", () => {
  for (const overrides of [{ left: 500 }, { bottom: 500 }, { frameWidth: 0 }, { frameHeight: Number.NaN }, { top: -1 }]) {
    assert.equal(getCarouselOverlayContainment({ ...geometry, ...overrides }, "structure_1", "1:1").fits, false);
  }
});

test("keyboard positions and nonfinite inputs use the same containment limits", () => {
  const { bounds } = getCarouselOverlayContainment(geometry, "structure_1", "4:5");
  assert.deepEqual(clampCarouselOverlayPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, bounds), { x: 0.5, y: 0.5 });
  assert.deepEqual(clampCarouselOverlayPosition({ x: 0.5, y: 0.5 }, bounds), { x: 0.5, y: 0.5 });
});

test("only Carousel opts into measured containment; saved renders and other editors stay separate", () => {
  const editor = readFileSync(new URL("../../components/trending/trending-creative-editor.tsx", import.meta.url), "utf8");
  const overlay = readFileSync(new URL("../../components/trending/carousel-draggable-overlay.tsx", import.meta.url), "utf8");
  assert.equal((editor.match(/<CarouselDraggableOverlay\b/g) ?? []).length, 1);
  assert.equal((editor.match(/<DraggableOverlay\b/g) ?? []).length, 2);
  assert.match(editor, /enabled=\{!showExactRender\}/);
  assert.match(overlay, /new ResizeObserver/);
  assert.match(overlay, /document\.fonts\.ready/);
  assert.match(overlay, /range\.getClientRects/);
  assert.match(overlay, /role="alert"/);
});
