/** A position in a frozen, version-major slideshow generation request. */
export type SlideshowGenerationSlot = {
  version: 1;
  batchKey: string;
  slideIndex: number;
  slideCount: number;
  versionIndex: number;
  versionCount: number;
};

export function readSlideshowGenerationSlot(value: unknown): SlideshowGenerationSlot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const slot = value as Record<string, unknown>;
  const bounded = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
  if (slot.version !== 1 || typeof slot.batchKey !== "string" || !slot.batchKey || slot.batchKey.length > 200 ||
      !bounded(slot.slideCount, 10) || !bounded(slot.versionCount, 4) || !bounded(slot.slideIndex, slot.slideCount) || !bounded(slot.versionIndex, slot.versionCount)) return null;
  return { version: 1, batchKey: slot.batchKey, slideIndex: slot.slideIndex, slideCount: slot.slideCount, versionIndex: slot.versionIndex, versionCount: slot.versionCount };
}

export function slideshowGenerationSlot(batchKey: string, slideCount: number, versionCount: number, index: number): SlideshowGenerationSlot {
  const slot = readSlideshowGenerationSlot({ version: 1, batchKey, slideCount, versionCount, slideIndex: index % slideCount + 1, versionIndex: Math.floor(index / slideCount) + 1 });
  if (!slot) throw new Error("Choose a valid slideshow slide count and version count.");
  return slot;
}

export function slideshowSlotPrompt(prompt: string, slot: SlideshowGenerationSlot) {
  return `${prompt}\n\nSlideshow output: version ${slot.versionIndex} of ${slot.versionCount}, slide ${slot.slideIndex} of ${slot.slideCount}. Create only this slide, using its selected reference as the layout. Keep the same business, audience and visual direction across this version. Do not combine multiple slides into one image or contact sheet.`;
}
