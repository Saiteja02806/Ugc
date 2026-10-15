import type { AIStudioImageResult } from "../ai-studio/media-results";
import type { SlideshowGenerationSlot } from "../../worker/src/lib/slideshow-generation-batch";

export type SlideshowGenerationGroup = { key: string; slot: SlideshowGenerationSlot; images: AIStudioImageResult[]; complete: boolean };

/** Provider completion order must not become slide order or merge versions. */
export function slideshowGenerationGroups(images: readonly AIStudioImageResult[]): SlideshowGenerationGroup[] {
  const groups = new Map<string, SlideshowGenerationGroup>();
  for (const image of images) {
    const slot = image.slideshowGeneration;
    if (!slot) continue;
    const key = `${slot.batchKey}:${slot.versionIndex}`;
    const group = groups.get(key) ?? { key, slot, images: [], complete: false };
    if (group.slot.slideCount !== slot.slideCount || group.slot.versionCount !== slot.versionCount || group.images.some(value => value.slideshowGeneration?.slideIndex === slot.slideIndex)) continue;
    group.images.push(image); groups.set(key, group);
  }
  return [...groups.values()].map(group => ({ ...group, images: group.images.sort((a, b) => a.slideshowGeneration!.slideIndex - b.slideshowGeneration!.slideIndex), complete: group.images.length === group.slot.slideCount }))
    .sort((a, b) => a.slot.batchKey === b.slot.batchKey ? a.slot.versionIndex - b.slot.versionIndex : b.images[0].createdAt.localeCompare(a.images[0].createdAt));
}
