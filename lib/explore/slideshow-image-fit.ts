export const SLIDESHOW_CANVAS = { width: 1080, height: 1350 } as const;

/** Preserve the full image. A soft cover copy fills any unused canvas area. */
export function slideshowImageFit(width: number, height: number) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 32768) || width * height > 100_000_000) throw new Error("This image is too large or has invalid dimensions. Choose a smaller image.");
  const target = SLIDESHOW_CANVAS;
  const rect = (scale: number) => ({ x: (target.width - width * scale) / 2, y: (target.height - height * scale) / 2, width: width * scale, height: height * scale });
  return { ...target, alreadyFits: width * 5 === height * 4,
    foreground: rect(Math.min(target.width / width, target.height / height)),
    background: rect(Math.max((target.width + 96) / width, (target.height + 96) / height)) };
}
