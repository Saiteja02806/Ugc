/** Public, immutable media only. Never pass signed/private delivery URLs to the shared optimizer cache. */
export function imagePickerThumbnailUrl(source: string | null | undefined) {
  if (!source) return undefined;
  const catalog = /^\/ai-studio\/creator-references\/creator-\d{2}\.png$/.test(source);
  let publicMedia = false;
  try {
    const url = new URL(source);
    publicMedia = url.protocol === "https:" && url.hostname === "storage.googleapis.com" &&
      url.pathname.startsWith("/ugcsaas-media/") && !url.search && !url.hash && !url.username && !url.password;
  } catch { /* Local object URLs and private application URLs retain their original delivery path. */ }
  return catalog || publicMedia ? `/_next/image?url=${encodeURIComponent(source)}&w=256&q=75` : source;
}

// Stay well inside the five-minute private delivery token lifetime. Explicit refresh/upload still invalidates.
export const REFERENCE_IMAGE_STALE_MS = 60_000;
export const REFERENCE_IMAGE_PAGE_SIZE = 24;
