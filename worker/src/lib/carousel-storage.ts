import { uploadBufferToS3 } from "./s3.js";

const IMAGE_WEBP_CONTENT_TYPE = "image/webp";

function cleanPathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export async function uploadRenderedCarouselSlide(params: {
  buffer: Buffer;
  carouselId: string;
  format: string;
  projectId: string;
  slideNumber: number;
  userId: string;
}) {
  const formatSlug = cleanPathPart(params.format.replace(":", "x"));
  const slideSlug = params.slideNumber.toString().padStart(2, "0");
  const key = [
    "carousels",
    "rendered",
    cleanPathPart(params.userId),
    cleanPathPart(params.projectId),
    cleanPathPart(params.carouselId),
    `slide-${slideSlug}-${formatSlug}.webp`,
  ].join("/");

  return uploadBufferToS3({
    buffer: params.buffer,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: IMAGE_WEBP_CONTENT_TYPE,
    key,
  });
}
