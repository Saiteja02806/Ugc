export type SlideshowSourceIdentity = { referenceId: string; slideId: string; slideNumber: number };
export type SlideshowUploadName = { assetId: string; name: string };
export function slideshowUploadName(index: number) {
  // Up to fourteen live attachments; the monotonic counter may exceed Z after removals.
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return `Upload ${name}`;
}
export function assignSlideshowUploadNames(ids: string[], saved: SlideshowUploadName[] = []) {
  const names = [...saved];
  for (const assetId of ids) if (!names.some(item => item.assetId === assetId)) {
    if (names.length >= 500) throw new Error("This draft has used all available image names. Clear its attachments before adding more.");
    let index = names.length;
    while (names.some(item => item.name === slideshowUploadName(index))) index += 1;
    names.push({ assetId, name: slideshowUploadName(index) });
  }
  return names;
}
