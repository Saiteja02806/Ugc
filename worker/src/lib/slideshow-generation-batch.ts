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

export function slideshowSlotPrompt(prompt: string, slot: SlideshowGenerationSlot, preserveReference = false) {
  if (preserveReference) {
    return `${prompt}\n\nSlideshow output: version ${slot.versionIndex} of ${slot.versionCount}, slide ${slot.slideIndex} of ${slot.slideCount}. Create only this slide from its designated base reference. Output slide numbers follow the selected reference order, not the full catalogue numbering. Apply shared instructions to every slide, but changes addressed to a particular output slide only to that slide. Do not apply another slide's background, screenshot replacement, heading or layout changes here. Preserve this slide's reference style and tone except for explicit requested changes and small business-specific adaptations. Do not combine multiple slides into one image or contact sheet.`;
  }
  return `${prompt}\n\nSlideshow output: version ${slot.versionIndex} of ${slot.versionCount}, slide ${slot.slideIndex} of ${slot.slideCount}. Create only this slide, using its selected reference as the layout. Keep the same business, audience and visual direction across this version. Do not combine multiple slides into one image or contact sheet.`;
}
