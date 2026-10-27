export const LANDING_GALLERY_STEP_MS = 3000;
export const LANDING_GALLERY_INITIAL_POSITION = 3;

/** Periodic track coordinates; cards wrap only beyond the clipped stage. */
export function landingGalleryPosition(index: number, phase: number, count: number) {
  return ((index - phase + count / 2) % count + count) % count - count / 2;
}

export function landingGalleryLayout(position: number, compact = false) {
  const distance = Math.abs(position);
  const slot = Math.min(Math.floor(distance), 3);
  const progress = Math.min(distance - slot, 1);
  const centers = [0, 243, 424, 567, 693];
  const widths = [270, 188, 146, 112, 112];
  const factor = compact ? 252 / 270 : 1;
  return {
    x: Math.sign(position) * (centers[slot] + (centers[slot + 1] - centers[slot]) * progress) * factor,
    scale: (widths[slot] + (widths[slot + 1] - widths[slot]) * progress) / 270 * factor,
    opacity: Math.max(0, Math.min(1, (4 - distance) * 2)),
  };
}
