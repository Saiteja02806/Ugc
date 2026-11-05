import { parseImageReferenceContext } from "./image-reference-context.ts";

export type OwnedVideoImages = { version: 1; maxImageBytes: number; images: { assetId: string; url: string }[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ordered owned records, separate from the provider's scene/identity/first-frame roles. */
export function parseOwnedVideoImages(value: unknown, expectedUrls: readonly string[]): OwnedVideoImages {
  const input = value as OwnedVideoImages;
  if (!input || typeof input !== "object" || Array.isArray(input) || input.version !== 1 ||
      ![16, 20].some(mb => input.maxImageBytes === mb * 1024 ** 2) || !Array.isArray(input.images) ||
      input.images.length < 1 || input.images.length > 30 || input.images.length !== expectedUrls.length ||
      Object.keys(input).some(key => !["version", "maxImageBytes", "images"].includes(key)) ||
      input.images.some((image, index) => !image || typeof image.assetId !== "string" || !uuid.test(image.assetId) ||
        Object.keys(image).some(key => !["assetId", "url"].includes(key)) || image.url !== expectedUrls[index]) ||
      new Set(input.images.map(image => image.assetId)).size !== input.images.length) throw Error("The owned video image selection could not be verified.");
  // Reuse existing HTTPS/credential/duplicate checks without the slideshow's 14-image cap.
  for (const image of input.images) parseImageReferenceContext([image.url]);
  if (new Set(input.images.map(image => image.url)).size !== input.images.length) throw Error("Choose distinct video image references.");
  return { version: 1, maxImageBytes: input.maxImageBytes, images: input.images.map(image => ({ assetId: image.assetId, url: image.url })) };
}
