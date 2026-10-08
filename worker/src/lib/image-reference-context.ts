// Both slideshow models support this many inputs; catalogue slides top out at 12.
export const MAX_IMAGE_REFERENCE_CONTEXT = 14;

export function parseImageReferenceContext(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_IMAGE_REFERENCE_CONTEXT) {
    throw new Error(`Choose 1–${MAX_IMAGE_REFERENCE_CONTEXT} reference images.`);
  }
  const urls = value.map(item => {
    if (typeof item !== "string" || !item.trim() || item.length > 4096) throw new Error("A reference image is invalid.");
    const url = new URL(item.trim());
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Reference images must use trusted HTTPS URLs.");
    return url.toString();
  });
  if (new Set(urls).size !== urls.length) throw new Error("Choose each reference image only once.");
  return urls;
}
