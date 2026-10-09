export const RECREATE_EDITOR_DEFAULT_FRACTION = 0.32;
export const RECREATE_EDITOR_DEFAULT_MIN = 320;
export const RECREATE_EDITOR_DEFAULT_MAX = 420;
export const RECREATE_EDITOR_MIN = 220;
export const RECREATE_EDITOR_MAX = 560;
export const RECREATE_GALLERY_MIN = 320;
export const RECREATE_DIVIDER_WIDTH = 16;

export function recreateEditorMaximum(containerWidth: number) {
  return Math.max(RECREATE_EDITOR_MIN, Math.min(RECREATE_EDITOR_MAX,
    containerWidth - RECREATE_DIVIDER_WIDTH - RECREATE_GALLERY_MIN));
}

export function recreateEditorDefault(containerWidth: number) {
  return clampRecreateEditorWidth(preferredEditorWidth(containerWidth), containerWidth);
}

export function clampRecreateEditorWidth(width: number, containerWidth: number) {
  const requested = Number.isFinite(width) ? width : preferredEditorWidth(containerWidth);
  return Math.round(Math.max(RECREATE_EDITOR_MIN, Math.min(requested, recreateEditorMaximum(containerWidth))));
}

function preferredEditorWidth(containerWidth: number) {
  return Math.min(RECREATE_EDITOR_DEFAULT_MAX, Math.max(RECREATE_EDITOR_DEFAULT_MIN,
    containerWidth * RECREATE_EDITOR_DEFAULT_FRACTION));
}
