import type { TrendingWallTextLayout, WallTextNormalizedBox } from "./wall-text-types.ts";

export const WALL_TEXT_EDIT_MIN_WIDTH = 0.4;
export const WALL_TEXT_EDIT_MAX_WIDTH = 0.94;
export const WALL_TEXT_EDIT_EDGE_PADDING = 0.03;

export function getWallTextEditSafeArea(safeArea: TrendingWallTextLayout["safeArea"]) {
  return { ...safeArea, left: WALL_TEXT_EDIT_EDGE_PADDING, right: WALL_TEXT_EDIT_EDGE_PADDING };
}

export function resizeWallTextEditBox(
  layout: TrendingWallTextLayout,
  requestedWidth: number,
  fixedEdge?: "left" | "right",
): WallTextNormalizedBox {
  const { textBox } = layout;
  const left = WALL_TEXT_EDIT_EDGE_PADDING;
  const right = 1 - WALL_TEXT_EDIT_EDGE_PADDING;
  const maximum = fixedEdge === "left" ? right - textBox.x
    : fixedEdge === "right" ? textBox.x + textBox.width - left : WALL_TEXT_EDIT_MAX_WIDTH;
  const width = clamp(requestedWidth, WALL_TEXT_EDIT_MIN_WIDTH, Math.min(WALL_TEXT_EDIT_MAX_WIDTH, maximum));
  const x = fixedEdge === "left" ? textBox.x
    : fixedEdge === "right" ? textBox.x + textBox.width - width
    : textBox.x + (textBox.width - width) / 2;
  return { ...textBox, width, x: clamp(x, left, right - width) };
}

export function moveWallTextEditBox(layout: TrendingWallTextLayout, x: number, y: number) {
  const { textBox, safeArea } = layout;
  return {
    ...textBox,
    x: clamp(x, safeArea.left, 1 - safeArea.right - textBox.width),
    y: clamp(y, safeArea.top, 1 - safeArea.bottom - textBox.height),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
