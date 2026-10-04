export const POST_DOUBLE_TAP_MS = 320;
export const POST_TAP_MOVEMENT_PX = 12;
export const POST_LIKE_FEEDBACK_MS = 720;

export type PostTap = { itemId: string; x: number; y: number; time: number };

export function isPostDoubleTap(previous: PostTap | null, next: PostTap) {
  return Boolean(previous && previous.itemId === next.itemId &&
    next.time >= previous.time && next.time - previous.time <= POST_DOUBLE_TAP_MS &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= 36);
}

export function isPostTap(start: PostTap, end: PostTap) {
  return start.itemId === end.itemId && end.time - start.time <= POST_DOUBLE_TAP_MS &&
    Math.hypot(end.x - start.x, end.y - start.y) <= POST_TAP_MOVEMENT_PX;
}

export function getPostDragScrollTop({ startScrollTop, startY, y, height, anchor = 0, hasPrevious = false }: {
  startScrollTop: number; startY: number; y: number; height: number; anchor?: number; hasPrevious?: boolean;
}) {
  return Math.max(hasPrevious ? anchor - height : anchor,
    Math.min(anchor + Math.max(0, height), startScrollTop + startY - y));
}

/** Velocity is signed upward movement in pixels per millisecond. */
export function getPostDragSnapTop(scrollTop: number, height: number, velocity = 0, anchor = 0, hasPrevious = false) {
  if (height <= 0) return anchor;
  const distance = scrollTop - anchor;
  if (hasPrevious && (distance <= -height * .35 || (distance <= -height * .1 && velocity <= -.65))) return anchor - height;
  return distance >= height * .35 || (distance >= height * .1 && velocity >= .65) ? anchor + height : anchor;
}

export function shouldSkipScrolledPost({ scrollTop, height, userInitiated, disabled }: {
  scrollTop: number; height: number; userInitiated: boolean; disabled: boolean;
}) {
  return userInitiated && !disabled && height > 0 && scrollTop >= height * 0.8;
}
