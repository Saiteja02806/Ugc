export type CarouselOverlayPosition = { x: number; y: number };
export type CarouselOverlayBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
export type CarouselOverlayGeometry = {
  frameWidth: number;
  frameHeight: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const DEFAULT_BOUNDS: CarouselOverlayBounds = {
  minX: 0.1, maxX: 0.9, minY: 0.1, maxY: 0.9,
};

/** Constrain the full measured preview, not just its centre anchor. */
export function getCarouselOverlayContainment(
  geometry: CarouselOverlayGeometry,
  structureId: "structure_1" | "structure_2",
  format: "1:1" | "4:5",
  anchorBounds: CarouselOverlayBounds = DEFAULT_BOUNDS,
) {
  if (!Object.values(geometry).every(Number.isFinite) ||
      geometry.frameWidth <= 0 || geometry.frameHeight <= 0 ||
      [geometry.left, geometry.right, geometry.top, geometry.bottom].some((value) => value < 0)) {
    return { bounds: anchorBounds, fits: false };
  }
  const height = format === "1:1" ? 1080 : 1350;
  const safeX = structureId === "structure_2" ? 72 : format === "1:1" ? 108 : 96;
  const safeTop = structureId === "structure_2" ? 84 : format === "1:1" ? 112 : 136;
  const safeBottom = structureId === "structure_2" ? 92 : safeTop;
  const bounds = {
    minX: Math.max(anchorBounds.minX, safeX / 1080 + geometry.left / geometry.frameWidth),
    maxX: Math.min(anchorBounds.maxX, 1 - safeX / 1080 - geometry.right / geometry.frameWidth),
    minY: Math.max(anchorBounds.minY, safeTop / height + geometry.top / geometry.frameHeight),
    maxY: Math.min(anchorBounds.maxY, 1 - safeBottom / height - geometry.bottom / geometry.frameHeight),
  };
  return { bounds, fits: bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY };
}

export function clampCarouselOverlayPosition(
  position: CarouselOverlayPosition,
  bounds: CarouselOverlayBounds,
): CarouselOverlayPosition {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0.5));
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}
